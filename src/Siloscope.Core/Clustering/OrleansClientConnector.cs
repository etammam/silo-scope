using System.Net;
using System.Reflection;
using System.Runtime.Loader;
using Azure.Data.Tables;
using FluentResults;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Logging.Abstractions;
using Orleans.Clustering.Cassandra.Hosting;
using Orleans.Serialization;
using Orleans.Serialization.Configuration;
using Siloscope.Core.Configuration;
using StackExchange.Redis;

namespace Siloscope.Core.Clustering;

/// <summary>
/// Manages a single Orleans client connection to a cluster, including dynamic assembly loading and serializer configuration.
/// </summary>
public sealed class OrleansClientConnector(
    ToolClusterOptions options,
    IReadOnlyList<string>? interfaceAssemblyPaths = null,
    ILogger<OrleansClientConnector>? logger = null
) : IDisposable
{
    private const int DefaultConnectTimeoutSeconds = 20;
    private const int MinConnectTimeoutSeconds = 3;
    private const int MaxConnectTimeoutSeconds = 300;

    private readonly ILogger<OrleansClientConnector> _logger =
        logger ?? NullLogger<OrleansClientConnector>.Instance;
    private IHost? _host;
    private IClusterClient? _client;
    private Action<string>? _diagnosticSink;

    public bool IsConnected => _client is not null;

    public bool TryGetClient(out IClusterClient? client)
    {
        client = _client;
        return client is not null;
    }

    public void SetDiagnosticSink(Action<string>? sink)
    {
        _diagnosticSink = sink;
    }

    public async Task<Result<string>> ConnectAsync(CancellationToken cancellationToken)
    {
        if (_client is not null)
        {
            _logger.LogInformation("Connect skipped: client already connected.");
            return Result.Ok("Already connected.");
        }

        try
        {
            var rawTimeout =
                Environment.GetEnvironmentVariable("ORLEANS_TUI_CONNECT_TIMEOUT_SECONDS")
                ?? "<unset>";
            var clusteringMode = ResolveClusteringProvider(options);
            _logger.LogInformation(
                "Connect requested: ClusterId='{ClusterId}', ServiceId='{ServiceId}', Clustering='{Clustering}', Gateways='{Gateways}', InterfaceAssemblyPaths='{AssemblyPaths}'.",
                options.ClusterId,
                options.ServiceId,
                clusteringMode,
                FormatGateways(options.GatewayEndpoints),
                FormatAssemblyPaths(interfaceAssemblyPaths)
            );

            var timeoutSeconds = ResolveConnectTimeoutSeconds();
            _logger.LogInformation(
                "Connect timeout: {TimeoutSeconds}s (env ORLEANS_TUI_CONNECT_TIMEOUT_SECONDS='{RawTimeout}').",
                timeoutSeconds,
                rawTimeout
            );
            using var timeoutCts = CancellationTokenSource.CreateLinkedTokenSource(
                cancellationToken
            );
            timeoutCts.CancelAfter(TimeSpan.FromSeconds(timeoutSeconds));

            var builder = Host.CreateApplicationBuilder();

            // Terminal.Gui owns stdout. Disable console logging by default to avoid
            // log lines corrupting the TUI surface. Enable with ORLEANS_TUI_VERBOSE_LOGS=true.
            builder.Logging.ClearProviders();
            var verboseLogsEnabled = string.Equals(
                Environment.GetEnvironmentVariable("ORLEANS_TUI_VERBOSE_LOGS"),
                "true",
                StringComparison.OrdinalIgnoreCase
            );

            _logger.LogInformation(
                "Verbose host logging enabled: {VerboseLogsEnabled}.",
                verboseLogsEnabled
            );

            if (verboseLogsEnabled)
            {
                builder.Logging.AddSimpleConsole();
            }

            var resolvedAssemblies = ResolveInterfaceAssemblies(interfaceAssemblyPaths);
            if (resolvedAssemblies.Count > 0)
            {
                _logger.LogInformation(
                    "Interface assemblies resolved ({Count}): {AssemblyNames}",
                    resolvedAssemblies.Count,
                    string.Join(", ", resolvedAssemblies.Select(static a => a.GetName().Name))
                );

                var serializerAssemblies = ResolveSerializerAssemblies(resolvedAssemblies);
                _logger.LogInformation(
                    "Serializer assemblies ({Count}): {AssemblyNames}",
                    serializerAssemblies.Count,
                    string.Join(
                        ", ",
                        serializerAssemblies.Select(static assembly => assembly.GetName().Name)
                    )
                );

                builder.Services.AddSerializer(serializer =>
                {
                    foreach (var assembly in serializerAssemblies)
                    {
                        serializer.AddAssembly(assembly);
                    }

                    serializer.Configure(manifestOptions =>
                        ConfigureTypeManifest(manifestOptions, serializerAssemblies)
                    );
                });
                _logger.LogInformation(
                    "Serializer registration: interface assemblies added to Orleans type manifest."
                );
            }
            else
            {
                _logger.LogInformation(
                    "No interface assemblies resolved; serializer interface-assembly registration skipped."
                );
            }

            builder.UseOrleansClient(client =>
            {
                client.Configure<Orleans.Configuration.ClusterOptions>(cluster =>
                {
                    cluster.ClusterId = options.ClusterId;
                    cluster.ServiceId = options.ServiceId;
                });

                switch (clusteringMode)
                {
                    case ToolClusteringProvider.Redis:
                    {
                        var connectionString = GetRequiredConnectionString(
                            options.Clustering?.Redis,
                            ToolClusteringProvider.Redis
                        );
                        var config = ConfigurationOptions.Parse(connectionString);

                        client.UseRedisClustering(redisOptions =>
                        {
                            redisOptions.ConfigurationOptions = config;
                        });

                        _logger.LogInformation(
                            "Gateway mode: redis clustering discovery (DefaultDatabase={DefaultDatabase}, Endpoints={Endpoints}).",
                            config.DefaultDatabase?.ToString() ?? "none",
                            string.Join(
                                ", ",
                                config.EndPoints.Select(static endpoint => endpoint.ToString())
                            )
                        );
                        break;
                    }
                    case ToolClusteringProvider.AdoNet:
                    {
                        var adoNet = options.Clustering?.AdoNet;
                        var connectionString = GetRequiredConnectionString(
                            adoNet,
                            ToolClusteringProvider.AdoNet
                        );
                        client.UseAdoNetClustering(adoNetOptions =>
                        {
                            adoNetOptions.Invariant = string.IsNullOrWhiteSpace(adoNet?.Invariant)
                                ? "Npgsql"
                                : adoNet.Invariant;
                            adoNetOptions.ConnectionString = connectionString;
                        });
                        _logger.LogInformation("Gateway mode: ADO.NET clustering discovery.");
                        break;
                    }
                    case ToolClusteringProvider.AzureStorage:
                    {
                        var connectionString = GetRequiredConnectionString(
                            options.Clustering?.AzureStorage,
                            ToolClusteringProvider.AzureStorage
                        );
                        client.UseAzureStorageClustering(azureOptions =>
                        {
                            azureOptions.TableServiceClient = new TableServiceClient(
                                connectionString
                            );
                        });
                        _logger.LogInformation("Gateway mode: Azure Storage clustering discovery.");
                        break;
                    }
                    case ToolClusteringProvider.Cosmos:
                    {
                        var connectionString = GetRequiredConnectionString(
                            options.Clustering?.Cosmos,
                            ToolClusteringProvider.Cosmos
                        );
                        client.UseCosmosGatewayListProvider(cosmosOptions =>
                        {
                            cosmosOptions.ConfigureCosmosClient(connectionString);
                            cosmosOptions.DatabaseName = "Orleans";
                            cosmosOptions.ContainerName = "OrleansClusterMembership";
                        });
                        _logger.LogInformation("Gateway mode: Cosmos clustering discovery.");
                        break;
                    }
                    case ToolClusteringProvider.Consul:
                    {
                        var connectionString = GetRequiredConnectionString(
                            options.Clustering?.Consul,
                            ToolClusteringProvider.Consul
                        );
                        client.UseConsulClientClustering(consulOptions =>
                        {
                            consulOptions.ConfigureConsulClient(
                                new Uri(connectionString),
                                string.Empty
                            );
                        });
                        _logger.LogInformation("Gateway mode: Consul clustering discovery.");
                        break;
                    }
                    case ToolClusteringProvider.DynamoDB:
                    {
                        var connectionString = GetRequiredConnectionString(
                            options.Clustering?.DynamoDB,
                            ToolClusteringProvider.DynamoDB
                        );
                        client.UseDynamoDBClustering(dynamoOptions =>
                        {
                            var values = ParseConnectionStringValues(connectionString);
                            dynamoOptions.Service =
                                GetConnectionStringValue(values, "Service")
                                ?? GetConnectionStringValue(values, "Region")
                                ?? connectionString;
                            dynamoOptions.AccessKey =
                                GetConnectionStringValue(values, "AccessKey") ?? string.Empty;
                            dynamoOptions.SecretKey =
                                GetConnectionStringValue(values, "SecretKey") ?? string.Empty;
                            dynamoOptions.TableName = "OrleansClustering";
                        });
                        _logger.LogInformation("Gateway mode: DynamoDB clustering discovery.");
                        break;
                    }
                    case ToolClusteringProvider.ZooKeeper:
                    {
                        var connectionString = GetRequiredConnectionString(
                            options.Clustering?.ZooKeeper,
                            ToolClusteringProvider.ZooKeeper
                        );
                        client.UseZooKeeperClustering(zooKeeperOptions =>
                        {
                            zooKeeperOptions.ConnectionString = connectionString;
                        });
                        _logger.LogInformation("Gateway mode: ZooKeeper clustering discovery.");
                        break;
                    }
                    case ToolClusteringProvider.Cassandra:
                    {
                        var connectionString = GetRequiredConnectionString(
                            options.Clustering?.Cassandra,
                            ToolClusteringProvider.Cassandra
                        );
                        client.UseCassandraClustering(connectionString, "orleans");
                        _logger.LogInformation("Gateway mode: Cassandra clustering discovery.");
                        break;
                    }
                    case ToolClusteringProvider.Localhost when options.GatewayEndpoints.Count == 0:
                        _logger.LogInformation("Gateway mode: localhost clustering.");
                        client.UseLocalhostClustering();
                        break;
                    default:
                    {
                        var endpoints = options.GatewayEndpoints.Select(ParseEndpoint).ToArray();
                        _logger.LogInformation(
                            "Gateway mode: static clustering endpoints [{Endpoints}].",
                            string.Join(
                                ", ",
                                endpoints.Select(static endpoint => endpoint.ToString())
                            )
                        );
                        client.UseStaticClustering(endpoints);
                        break;
                    }
                }
            });

            _host = builder.Build();
            _logger.LogInformation("Host built. Starting Orleans client host...");
            await _host.StartAsync(timeoutCts.Token);
            _client = _host.Services.GetRequiredService<IClusterClient>();
            _logger.LogInformation(
                "Connected. Client runtime type='{ClientType}'.",
                _client.GetType().FullName
            );
            return Result.Ok("Connected to Orleans cluster.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            _logger.LogWarning("Connection timed out.");
            await CleanupHostAsync(CancellationToken.None);
            return Result.Ok(
                $"Connection timed out after {ResolveConnectTimeoutSeconds()} seconds."
            );
        }
        catch (OperationCanceledException)
        {
            _logger.LogWarning("Connection canceled by caller.");
            await CleanupHostAsync(CancellationToken.None);
            return Result.Fail("Connection canceled.");
        }
        catch (Exception ex)
        {
            _logger.LogError(
                ex,
                "Connection failed with {ExceptionType}: {Message}",
                ex.GetType().FullName,
                ex.Message
            );
            await CleanupHostAsync(CancellationToken.None);
            return Result.Fail($"Connection failed: {ex.Message}");
        }
    }

    public async Task DisconnectAsync()
    {
        if (_host is null)
        {
            return;
        }

        await _host.StopAsync();
        _host.Dispose();
        _host = null;
        _client = null;
    }

    private static IPEndPoint ParseEndpoint(string endpoint)
    {
        var parts = endpoint.Split(
            ':',
            StringSplitOptions.TrimEntries | StringSplitOptions.RemoveEmptyEntries
        );
        if (parts.Length != 2)
        {
            throw new ArgumentException(
                $"Invalid gateway endpoint '{endpoint}'. Expected host:port."
            );
        }

        if (!int.TryParse(parts[1], out var port) || port <= 0)
        {
            throw new ArgumentException($"Invalid gateway port in endpoint '{endpoint}'.");
        }

        if (!IPAddress.TryParse(parts[0], out var ip))
        {
            var addresses = Dns.GetHostAddresses(parts[0]);
            ip =
                addresses.FirstOrDefault()
                ?? throw new ArgumentException($"Cannot resolve host '{parts[0]}'.");
        }

        return new IPEndPoint(ip, port);
    }

    public void Dispose()
    {
        if (_host is null)
        {
            return;
        }

        _host.Dispose();
        _host = null;
        _client = null;
    }

    private async Task CleanupHostAsync(CancellationToken cancellationToken)
    {
        if (_host is null)
        {
            return;
        }

        try
        {
            await _host.StopAsync(cancellationToken);
        }
        catch
        {
            // Best-effort cleanup.
        }

        _host.Dispose();
        _host = null;
        _client = null;
    }

    private static string FormatAssemblyPaths(IReadOnlyList<string>? paths)
    {
        if (paths is null || paths.Count == 0)
        {
            return "<none>";
        }

        return string.Join(", ", paths.Select(Path.GetFileName));
    }

    private static string FormatGateways(IReadOnlyCollection<string> gateways)
    {
        return gateways.Count == 0 ? "localhost" : string.Join(", ", gateways);
    }

    private static int ResolveConnectTimeoutSeconds()
    {
        var raw = Environment.GetEnvironmentVariable("ORLEANS_TUI_CONNECT_TIMEOUT_SECONDS");
        if (!int.TryParse(raw, out var parsed))
        {
            return DefaultConnectTimeoutSeconds;
        }

        return parsed switch
        {
            < MinConnectTimeoutSeconds => MinConnectTimeoutSeconds,
            > MaxConnectTimeoutSeconds => MaxConnectTimeoutSeconds,
            _ => parsed,
        };
    }

    private static ToolClusteringProvider ResolveClusteringProvider(ToolClusterOptions options)
    {
        if (options.Clustering is not null)
        {
            return options.Clustering.Provider;
        }

        return options.GatewayEndpoints.Count > 0
            ? ToolClusteringProvider.Static
            : ToolClusteringProvider.Localhost;
    }

    private static string GetRequiredConnectionString(
        RedisClusteringOptions? options,
        ToolClusteringProvider provider
    )
    {
        if (options is null || string.IsNullOrWhiteSpace(options.ConnectionString))
        {
            throw new InvalidOperationException(
                $"{provider} clustering selected but the connection string is missing."
            );
        }

        return options.ConnectionString;
    }

    private static string GetRequiredConnectionString(
        ConnectionStringClusteringOptions? options,
        ToolClusteringProvider provider
    )
    {
        if (options is null || string.IsNullOrWhiteSpace(options.ConnectionString))
        {
            throw new InvalidOperationException(
                $"{provider} clustering selected but the connection string is missing."
            );
        }

        return options.ConnectionString;
    }

    private static Dictionary<string, string> ParseConnectionStringValues(string connectionString)
    {
        return connectionString
            .Split(';', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Select(part => part.Split('=', 2, StringSplitOptions.TrimEntries))
            .Where(parts => parts.Length == 2 && !string.IsNullOrWhiteSpace(parts[0]))
            .ToDictionary(parts => parts[0], parts => parts[1], StringComparer.OrdinalIgnoreCase);
    }

    private static string? GetConnectionStringValue(
        IReadOnlyDictionary<string, string> values,
        string key
    )
    {
        return values.TryGetValue(key, out var value) && !string.IsNullOrWhiteSpace(value)
            ? value
            : null;
    }

    private static IReadOnlyList<Assembly> ResolveInterfaceAssemblies(
        IReadOnlyList<string>? assemblyPaths
    )
    {
        if (assemblyPaths is null || assemblyPaths.Count == 0)
        {
            return [];
        }

        var result = new List<Assembly>();
        foreach (var path in assemblyPaths)
        {
            if (TryResolveInterfaceAssembly(path, out var assembly))
            {
                result.Add(assembly!);
            }
        }

        return result;
    }

    private static bool TryResolveInterfaceAssembly(string? assemblyPath, out Assembly? assembly)
    {
        assembly = null;
        if (string.IsNullOrWhiteSpace(assemblyPath))
        {
            return false;
        }

        var fullPath = Path.GetFullPath(assemblyPath);
        assembly = AssemblyLoadContext.Default.Assemblies.FirstOrDefault(loaded =>
        {
#pragma warning disable IL3000
            return string.Equals(loaded.Location, fullPath, StringComparison.OrdinalIgnoreCase);
#pragma warning restore IL3000
        });

        if (assembly is not null)
        {
            return true;
        }

        if (!File.Exists(fullPath))
        {
            return false;
        }

        try
        {
            assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(fullPath);
            return true;
        }
        catch
        {
            assembly = null;
            return false;
        }
    }

    private static IReadOnlyList<Assembly> ResolveSerializerAssemblies(
        IReadOnlyList<Assembly> rootAssemblies
    )
    {
        var queue = new Queue<Assembly>();
        var seenByName = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
        var result = new List<Assembly>();

        foreach (var rootAssembly in rootAssemblies)
        {
            queue.Enqueue(rootAssembly);
        }

        while (queue.Count > 0)
        {
            var current = queue.Dequeue();
            var currentName = current.GetName().Name;
            if (string.IsNullOrWhiteSpace(currentName) || !seenByName.Add(currentName))
            {
                continue;
            }

            result.Add(current);

            foreach (var reference in current.GetReferencedAssemblies())
            {
                if (ShouldSkipSerializerAssembly(reference.Name))
                {
                    continue;
                }

                var loaded = AssemblyLoadContext.Default.Assemblies.FirstOrDefault(assembly =>
                    string.Equals(
                        assembly.GetName().Name,
                        reference.Name,
                        StringComparison.OrdinalIgnoreCase
                    )
                );

                if (loaded is not null)
                {
                    queue.Enqueue(loaded);
                    continue;
                }

                try
                {
                    var resolved = AssemblyLoadContext.Default.LoadFromAssemblyName(reference);
                    queue.Enqueue(resolved);
                }
                catch
                {
                    // Best-effort dependency discovery; unresolved references are ignored.
                }
            }
        }

        return result;
    }

    private static bool ShouldSkipSerializerAssembly(string? assemblyName)
    {
        if (string.IsNullOrWhiteSpace(assemblyName))
        {
            return true;
        }

        return assemblyName.StartsWith("System.", StringComparison.Ordinal)
            || assemblyName.StartsWith("Microsoft.", StringComparison.Ordinal)
            || assemblyName.StartsWith("netstandard", StringComparison.OrdinalIgnoreCase)
            || assemblyName.Equals("mscorlib", StringComparison.OrdinalIgnoreCase)
            || assemblyName.Equals("System.Private.CoreLib", StringComparison.OrdinalIgnoreCase);
    }

    private static void ConfigureTypeManifest(
        TypeManifestOptions options,
        IReadOnlyCollection<Assembly> assemblies
    )
    {
        // We are loading contracts dynamically, so make Orleans aware of these runtime types.
        options.AllowAllTypes = true;

        foreach (var assembly in assemblies)
        {
            foreach (var type in assembly.ExportedTypes)
            {
                if (!string.IsNullOrWhiteSpace(type.FullName))
                {
                    options.AllowedTypes.Add(type.FullName);
                }

                var assemblyQualifiedName = type.AssemblyQualifiedName;
                if (!string.IsNullOrWhiteSpace(assemblyQualifiedName))
                {
                    options.AllowedTypes.Add(assemblyQualifiedName);
                }

                if (type.IsInterface && typeof(IAddressable).IsAssignableFrom(type))
                {
                    options.Interfaces.Add(type);
                }
            }
        }
    }
}
