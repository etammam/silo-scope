using System.Net;
using System.Reflection;
using System.Runtime.Loader;
using FluentResults;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Orleans.Serialization;
using Orleans.Serialization.Configuration;
using Siloscope.Core.Configuration;
using Siloscope.Core.Interfaces;
using StackExchange.Redis;

namespace Siloscope.Core.Cluster;

public sealed class OrleansClientConnector(
    ToolClusterOptions options,
    IReadOnlyList<string>? interfaceAssemblyPaths = null
) : IDisposable
{
    private const int DefaultConnectTimeoutSeconds = 20;
    private const int MinConnectTimeoutSeconds = 3;
    private const int MaxConnectTimeoutSeconds = 300;

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
            LogDiagnostic("Connect skipped: client already connected.");
            return Result.Ok("Already connected.");
        }

        try
        {
            var rawTimeout =
                Environment.GetEnvironmentVariable("ORLEANS_TUI_CONNECT_TIMEOUT_SECONDS")
                ?? "<unset>";
            var clusteringMode = ResolveClusteringProvider(options);
            LogDiagnostic(
                $"Connect requested: ClusterId='{options.ClusterId}', ServiceId='{options.ServiceId}', Clustering='{clusteringMode}', Gateways='{FormatGateways(options.GatewayEndpoints)}', InterfaceAssemblyPaths='{FormatAssemblyPaths(interfaceAssemblyPaths)}'."
            );

            var timeoutSeconds = ResolveConnectTimeoutSeconds();
            LogDiagnostic(
                $"Connect timeout: {timeoutSeconds}s (env ORLEANS_TUI_CONNECT_TIMEOUT_SECONDS='{rawTimeout}')."
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

            LogDiagnostic($"Verbose host logging enabled: {verboseLogsEnabled}.");

            if (verboseLogsEnabled)
            {
                builder.Logging.AddSimpleConsole();
            }

            var resolvedAssemblies = ResolveInterfaceAssemblies(interfaceAssemblyPaths);
            if (resolvedAssemblies.Count > 0)
            {
                LogDiagnostic(
                    $"Interface assemblies resolved ({resolvedAssemblies.Count}): {string.Join(", ", resolvedAssemblies.Select(static a => a.GetName().Name))}"
                );

                var serializerAssemblies = ResolveSerializerAssemblies(resolvedAssemblies);
                LogDiagnostic(
                    $"Serializer assemblies ({serializerAssemblies.Count}): {string.Join(", ", serializerAssemblies.Select(static assembly => assembly.GetName().Name))}"
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
                LogDiagnostic(
                    "Serializer registration: interface assemblies added to Orleans type manifest."
                );
            }
            else
            {
                LogDiagnostic(
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

                if (clusteringMode == ToolClusteringProvider.Redis)
                {
                    var redis = options.Clustering?.Redis;
                    if (redis is null || string.IsNullOrWhiteSpace(redis.ConnectionString))
                    {
                        throw new InvalidOperationException(
                            "Redis clustering selected but options.Clustering.Redis.ConnectionString is missing."
                        );
                    }

                    var config = ConfigurationOptions.Parse(redis.ConnectionString);

                    client.UseRedisClustering(redisOptions =>
                    {
                        redisOptions.ConfigurationOptions = config;
                    });

                    LogDiagnostic(
                        $"Gateway mode: redis clustering discovery (DefaultDatabase={config.DefaultDatabase?.ToString() ?? "none"}, Endpoints={string.Join(", ", config.EndPoints.Select(static endpoint => endpoint.ToString()))})."
                    );
                }
                else if (options.GatewayEndpoints.Count == 0)
                {
                    LogDiagnostic("Gateway mode: localhost clustering.");
                    client.UseLocalhostClustering();
                }
                else
                {
                    var endpoints = options.GatewayEndpoints.Select(ParseEndpoint).ToArray();
                    LogDiagnostic(
                        $"Gateway mode: static clustering endpoints [{string.Join(", ", endpoints.Select(static endpoint => endpoint.ToString()))}]."
                    );
                    client.UseStaticClustering(endpoints);
                }
            });

            _host = builder.Build();
            LogDiagnostic("Host built. Starting Orleans client host...");
            await _host.StartAsync(timeoutCts.Token);
            _client = _host.Services.GetRequiredService<IClusterClient>();
            LogDiagnostic($"Connected. Client runtime type='{_client.GetType().FullName}'.");
            return Result.Ok("Connected to Orleans cluster.");
        }
        catch (OperationCanceledException) when (!cancellationToken.IsCancellationRequested)
        {
            LogDiagnostic("Connection timed out.");
            await CleanupHostAsync(CancellationToken.None);
            return Result.Ok(
                $"Connection timed out after {ResolveConnectTimeoutSeconds()} seconds."
            );
        }
        catch (OperationCanceledException)
        {
            LogDiagnostic("Connection canceled by caller.");
            await CleanupHostAsync(CancellationToken.None);
            return Result.Fail("Connection canceled.");
        }
        catch (Exception ex)
        {
            LogDiagnostic($"Connection failed with {ex.GetType().FullName}: {ex.Message}");
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

    private void LogDiagnostic(string message)
    {
        _diagnosticSink?.Invoke($"[Connect] {message}");
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

        if (parsed < MinConnectTimeoutSeconds)
        {
            return MinConnectTimeoutSeconds;
        }

        if (parsed > MaxConnectTimeoutSeconds)
        {
            return MaxConnectTimeoutSeconds;
        }

        return parsed;
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
            string.Equals(loaded.Location, fullPath, StringComparison.OrdinalIgnoreCase)
        );

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
