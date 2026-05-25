using System.Text.Json;
using System.Text.Json.Serialization;

namespace Siloscope.Core.Configuration;

public static class RuntimeOptionsParser
{
    private const string DefaultConfigFileName = "default.json";

    public const string HelpText = """
Usage:
  Actors.Tools.Orleans.Tui \
    --cluster-id <id> \
    --service-id <id> \
    [--gateway <host:port>]... \
    --source dll --dll <path>

  Actors.Tools.Orleans.Tui \
    --cluster-id <id> \
    --service-id <id> \
    [--gateway <host:port>]... \
    --source nuget --package-id <id> --package-version <version> [--package-root <path>] [--nuget-config <path>]

Optional:
  --config <path>   JSON file containing RuntimeOptions-compatible fields.
  --nuget-config <path>   Optional custom nuget.config used when private feeds are required.
  --help            Print this help.

Clustering config (JSON):
  "clustering": {
    "provider": "redis",
    "redis": { "connectionString": "127.0.0.1:6379,defaultDatabase=0" }
  }

Notes:
  - If --config is omitted, default.json is loaded from the current working directory when present.
  - If no --gateway is provided, localhost clustering is used.
  - CLI args override config file values.
""";

    public static ParseResult<RuntimeOptions> Parse(IReadOnlyList<string> args)
    {
        if (args.Any(static a => string.Equals(a, "--help", StringComparison.OrdinalIgnoreCase)))
        {
            return ParseResult<RuntimeOptions>.Failure("Help requested.");
        }

        var mapResult = BuildMap(args);
        if (!mapResult.IsSuccess)
        {
            return ParseResult<RuntimeOptions>.Failure(mapResult.ErrorMessage!);
        }

        var map = mapResult.Value!;
        var configOptions = TryLoadConfig(map);
        if (!configOptions.IsSuccess)
        {
            return configOptions;
        }

        return BuildOptions(map, configOptions.Value);
    }

    private static ParseResult<RuntimeOptions> TryLoadConfig(
        Dictionary<string, List<string>> cliMap
    )
    {
        var configPathResult = ResolveConfigPath(cliMap);
        if (!configPathResult.IsSuccess)
        {
            return ParseResult<RuntimeOptions>.Failure(configPathResult.ErrorMessage!);
        }

        if (configPathResult.Value is null)
        {
            return ParseResult<RuntimeOptions>.Success(
                new RuntimeOptions(
                    new ToolClusterOptions(string.Empty, string.Empty, Array.Empty<string>(), null),
                    [
                        new InterfaceEntry(
                            null,
                            InterfaceSourceType.Dll,
                            null,
                            null,
                            null,
                            null,
                            null
                        ),
                    ]
                )
            );
        }

        var configPath = configPathResult.Value;

        try
        {
            var json = File.ReadAllText(configPath);
            var root = JsonSerializer.Deserialize<RuntimeConfigFile>(
                json,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true }
            );

            if (root is null)
            {
                return ParseResult<RuntimeOptions>.Failure(
                    $"Config file is empty or invalid JSON: {configPath}"
                );
            }

            var clusteringResult = ParseClustering(root.Clustering);
            if (!clusteringResult.IsSuccess)
            {
                return ParseResult<RuntimeOptions>.Failure(clusteringResult.ErrorMessage!);
            }

            var cluster = new ToolClusterOptions(
                root.ClusterId ?? string.Empty,
                root.ServiceId ?? string.Empty,
                root.GatewayEndpoints?.ToArray() ?? Array.Empty<string>(),
                clusteringResult.Value
            );

            // ── New multi-source format ──
            if (root.Interfaces is { Count: > 0 })
            {
                var entries = new List<InterfaceEntry>();
                foreach (var entry in root.Interfaces)
                {
                    var entrySourceResult = ParseSourceType(entry.Source);
                    if (!entrySourceResult.IsSuccess)
                    {
                        return ParseResult<RuntimeOptions>.Failure(entrySourceResult.ErrorMessage!);
                    }

                    entries.Add(
                        new InterfaceEntry(
                            entry.Gateway,
                            entrySourceResult.Value,
                            ResolvePathRelativeToConfig(entry.Dll, configPath),
                            entry.PackageId,
                            entry.PackageVersion,
                            ResolvePathRelativeToConfig(entry.PackageRoot, configPath),
                            ResolvePathRelativeToConfig(entry.NugetConfig, configPath)
                        )
                    );
                }

                return ParseResult<RuntimeOptions>.Success(new RuntimeOptions(cluster, entries));
            }

            // ── Legacy single-source format (backward compat) ──
            var sourceType = ParseSourceType(root.Source);
            if (!sourceType.IsSuccess)
            {
                return ParseResult<RuntimeOptions>.Failure(sourceType.ErrorMessage!);
            }

            var legacyEntry = new InterfaceEntry(
                cluster.GatewayEndpoints.FirstOrDefault(),
                sourceType.Value,
                ResolvePathRelativeToConfig(root.Dll, configPath),
                root.PackageId,
                root.PackageVersion,
                ResolvePathRelativeToConfig(root.PackageRoot, configPath),
                ResolvePathRelativeToConfig(root.NugetConfig, configPath)
            );

            return ParseResult<RuntimeOptions>.Success(new RuntimeOptions(cluster, [legacyEntry]));
        }
        catch (Exception ex)
        {
            return ParseResult<RuntimeOptions>.Failure($"Failed to read config file: {ex.Message}");
        }
    }

    private static ParseResult<string?> ResolveConfigPath(
        IReadOnlyDictionary<string, List<string>> cliMap
    )
    {
        if (cliMap.TryGetValue("config", out var configValues) && configValues.Count > 0)
        {
            var explicitPath = Path.GetFullPath(configValues[0]);
            if (!File.Exists(explicitPath))
            {
                return ParseResult<string?>.Failure($"Config file not found: {explicitPath}");
            }

            return ParseResult<string?>.Success(explicitPath);
        }

        var defaultPath = Path.Combine(Directory.GetCurrentDirectory(), DefaultConfigFileName);
        if (File.Exists(defaultPath))
        {
            return ParseResult<string?>.Success(defaultPath);
        }

        return ParseResult<string?>.Success(null);
    }

    private static string? ResolvePathRelativeToConfig(string? value, string configPath)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            return value;
        }

        if (Path.IsPathRooted(value))
        {
            return value;
        }

        var configDirectory = Path.GetDirectoryName(configPath);
        if (string.IsNullOrWhiteSpace(configDirectory))
        {
            return Path.GetFullPath(value);
        }

        return Path.GetFullPath(Path.Combine(configDirectory, value));
    }

    private static ParseResult<RuntimeOptions> BuildOptions(
        IReadOnlyDictionary<string, List<string>> cliMap,
        RuntimeOptions? fallbackOptions
    )
    {
        var clusterId = GetSingle(cliMap, "cluster-id") ?? fallbackOptions?.Cluster.ClusterId;
        var serviceId = GetSingle(cliMap, "service-id") ?? fallbackOptions?.Cluster.ServiceId;
        var gateways = GetMulti(cliMap, "gateway");
        if (gateways.Count == 0 && fallbackOptions is not null)
        {
            gateways = fallbackOptions.Cluster.GatewayEndpoints.ToList();
        }

        if (string.IsNullOrWhiteSpace(clusterId))
        {
            return ParseResult<RuntimeOptions>.Failure("Missing required option: --cluster-id");
        }

        if (string.IsNullOrWhiteSpace(serviceId))
        {
            return ParseResult<RuntimeOptions>.Failure("Missing required option: --service-id");
        }

        var cluster = new ToolClusterOptions(
            clusterId,
            serviceId,
            gateways,
            fallbackOptions?.Cluster.Clustering
        );

        // If config already provided multi-source interfaces and no CLI source override, use them.
        var hasCliSourceOverride =
            cliMap.ContainsKey("source")
            || cliMap.ContainsKey("dll")
            || cliMap.ContainsKey("package-id");

        if (!hasCliSourceOverride && fallbackOptions?.Interfaces is { Count: > 0 } configInterfaces)
        {
            // Propagate CLI --nuget-config to interface entries that don't already have one.
            var cliNugetConfig = GetSingle(cliMap, "nuget-config");
            if (!string.IsNullOrWhiteSpace(cliNugetConfig))
            {
                var resolvedNugetConfig = Path.GetFullPath(cliNugetConfig);
                configInterfaces = configInterfaces
                    .Select(e =>
                        string.IsNullOrWhiteSpace(e.NugetConfigPath)
                            ? e with
                            {
                                NugetConfigPath = resolvedNugetConfig,
                            }
                            : e
                    )
                    .ToList();
            }

            return ParseResult<RuntimeOptions>.Success(
                new RuntimeOptions(cluster, configInterfaces)
            );
        }

        // CLI single-source override (backward compat).
        var firstFallback = fallbackOptions?.Interfaces.FirstOrDefault();
        var sourceRaw = GetSingle(cliMap, "source") ?? firstFallback?.SourceType.ToString();
        var sourceTypeResult = ParseSourceType(sourceRaw);
        if (!sourceTypeResult.IsSuccess)
        {
            return ParseResult<RuntimeOptions>.Failure(sourceTypeResult.ErrorMessage!);
        }

        var dll = GetSingle(cliMap, "dll") ?? firstFallback?.DllPath;
        var packageId = GetSingle(cliMap, "package-id") ?? firstFallback?.PackageId;
        var packageVersion = GetSingle(cliMap, "package-version") ?? firstFallback?.PackageVersion;
        var packageRoot = GetSingle(cliMap, "package-root") ?? firstFallback?.PackageRoot;
        var nugetConfig = GetSingle(cliMap, "nuget-config") ?? firstFallback?.NugetConfigPath;

        var sourceType = sourceTypeResult.Value;
        if (sourceType == InterfaceSourceType.Dll && string.IsNullOrWhiteSpace(dll))
        {
            return ParseResult<RuntimeOptions>.Failure(
                "Missing required option for DLL mode: --dll"
            );
        }

        if (sourceType == InterfaceSourceType.NuGet)
        {
            if (string.IsNullOrWhiteSpace(packageId) || string.IsNullOrWhiteSpace(packageVersion))
            {
                return ParseResult<RuntimeOptions>.Failure(
                    "Missing required options for NuGet mode: --package-id and --package-version"
                );
            }
        }

        var entry = new InterfaceEntry(
            gateways.FirstOrDefault(),
            sourceType,
            dll,
            packageId,
            packageVersion,
            packageRoot,
            nugetConfig
        );

        return ParseResult<RuntimeOptions>.Success(new RuntimeOptions(cluster, [entry]));
    }

    private static ParseResult<Dictionary<string, List<string>>> BuildMap(
        IReadOnlyList<string> args
    )
    {
        var map = new Dictionary<string, List<string>>(StringComparer.OrdinalIgnoreCase);
        for (var i = 0; i < args.Count; i++)
        {
            var arg = args[i];
            if (!arg.StartsWith("--", StringComparison.Ordinal))
            {
                return ParseResult<Dictionary<string, List<string>>>.Failure(
                    $"Unexpected token '{arg}'. Options should start with '--'."
                );
            }

            var key = arg[2..];
            if (i == args.Count - 1 || args[i + 1].StartsWith("--", StringComparison.Ordinal))
            {
                map[key] = ["true"];
                continue;
            }

            var value = args[++i];
            if (!map.TryGetValue(key, out var values))
            {
                values = [];
                map[key] = values;
            }

            values.Add(value);
        }

        return ParseResult<Dictionary<string, List<string>>>.Success(map);
    }

    private static ParseResult<InterfaceSourceType> ParseSourceType(string? sourceRaw)
    {
        if (string.IsNullOrWhiteSpace(sourceRaw))
        {
            return ParseResult<InterfaceSourceType>.Failure("Missing required option: --source");
        }

        if (sourceRaw.Equals("dll", StringComparison.OrdinalIgnoreCase))
        {
            return ParseResult<InterfaceSourceType>.Success(InterfaceSourceType.Dll);
        }

        if (sourceRaw.Equals("nuget", StringComparison.OrdinalIgnoreCase))
        {
            return ParseResult<InterfaceSourceType>.Success(InterfaceSourceType.NuGet);
        }

        return ParseResult<InterfaceSourceType>.Failure(
            $"Unsupported source '{sourceRaw}'. Allowed values: dll, nuget"
        );
    }

    private static string? GetSingle(IReadOnlyDictionary<string, List<string>> map, string key)
    {
        return map.TryGetValue(key, out var values) ? values.LastOrDefault() : null;
    }

    private static ParseResult<ToolClusteringOptions?> ParseClustering(
        RuntimeClusteringFile? clustering
    )
    {
        if (clustering is null)
        {
            return ParseResult<ToolClusteringOptions?>.Success(null);
        }

        if (string.IsNullOrWhiteSpace(clustering.Provider))
        {
            return ParseResult<ToolClusteringOptions?>.Failure(
                "Missing required clustering provider."
            );
        }

        if (clustering.Provider.Equals("redis", StringComparison.OrdinalIgnoreCase))
        {
            if (
                clustering.Redis is null
                || string.IsNullOrWhiteSpace(clustering.Redis.ConnectionString)
            )
            {
                return ParseResult<ToolClusteringOptions?>.Failure(
                    "Redis clustering requires clustering.redis.connectionString."
                );
            }

            return ParseResult<ToolClusteringOptions?>.Success(
                new ToolClusteringOptions(
                    ToolClusteringProvider.Redis,
                    new RedisClusteringOptions(clustering.Redis.ConnectionString)
                )
            );
        }

        var connectionStringProvider = ParseConnectionStringClustering(clustering);
        if (connectionStringProvider is { } providerResult)
        {
            return providerResult;
        }

        if (clustering.Provider.Equals("static", StringComparison.OrdinalIgnoreCase))
        {
            return ParseResult<ToolClusteringOptions?>.Success(
                new ToolClusteringOptions(ToolClusteringProvider.Static)
            );
        }

        if (clustering.Provider.Equals("localhost", StringComparison.OrdinalIgnoreCase))
        {
            return ParseResult<ToolClusteringOptions?>.Success(
                new ToolClusteringOptions(ToolClusteringProvider.Localhost)
            );
        }

        return ParseResult<ToolClusteringOptions?>.Failure(
            $"Unsupported clustering provider '{clustering.Provider}'. Allowed values: localhost, static, redis, adoNet, azureStorage, cosmos, consul, dynamoDB, zooKeeper, cassandra"
        );
    }

    private static ParseResult<ToolClusteringOptions?>? ParseConnectionStringClustering(
        RuntimeClusteringFile clustering
    )
    {
        return clustering.Provider?.ToLowerInvariant() switch
        {
            "adonet" => BuildConnectionStringClustering(
                ToolClusteringProvider.AdoNet,
                "adoNet",
                clustering.AdoNet,
                adoNet => new ToolClusteringOptions(
                    AdoNet: adoNet,
                    Provider: ToolClusteringProvider.AdoNet
                )
            ),
            "azurestorage" => BuildConnectionStringClustering(
                ToolClusteringProvider.AzureStorage,
                "azureStorage",
                clustering.AzureStorage,
                azureStorage => new ToolClusteringOptions(
                    AzureStorage: azureStorage,
                    Provider: ToolClusteringProvider.AzureStorage
                )
            ),
            "cosmos" => BuildConnectionStringClustering(
                ToolClusteringProvider.Cosmos,
                "cosmos",
                clustering.Cosmos,
                cosmos => new ToolClusteringOptions(
                    Cosmos: cosmos,
                    Provider: ToolClusteringProvider.Cosmos
                )
            ),
            "consul" => BuildConnectionStringClustering(
                ToolClusteringProvider.Consul,
                "consul",
                clustering.Consul,
                consul => new ToolClusteringOptions(
                    Consul: consul,
                    Provider: ToolClusteringProvider.Consul
                )
            ),
            "dynamodb" => BuildConnectionStringClustering(
                ToolClusteringProvider.DynamoDB,
                "dynamoDB",
                clustering.DynamoDB,
                dynamoDB => new ToolClusteringOptions(
                    DynamoDB: dynamoDB,
                    Provider: ToolClusteringProvider.DynamoDB
                )
            ),
            "zookeeper" => BuildConnectionStringClustering(
                ToolClusteringProvider.ZooKeeper,
                "zooKeeper",
                clustering.ZooKeeper,
                zooKeeper => new ToolClusteringOptions(
                    ZooKeeper: zooKeeper,
                    Provider: ToolClusteringProvider.ZooKeeper
                )
            ),
            "cassandra" => BuildConnectionStringClustering(
                ToolClusteringProvider.Cassandra,
                "cassandra",
                clustering.Cassandra,
                cassandra => new ToolClusteringOptions(
                    Cassandra: cassandra,
                    Provider: ToolClusteringProvider.Cassandra
                )
            ),
            _ => null,
        };
    }

    private static ParseResult<ToolClusteringOptions?> BuildConnectionStringClustering(
        ToolClusteringProvider provider,
        string jsonPropertyName,
        RuntimeConnectionStringClusteringFile? options,
        Func<ConnectionStringClusteringOptions, ToolClusteringOptions> create
    )
    {
        if (options is null || string.IsNullOrWhiteSpace(options.ConnectionString))
        {
            return ParseResult<ToolClusteringOptions?>.Failure(
                $"{provider} clustering requires clustering.{jsonPropertyName}.connectionString."
            );
        }

        return ParseResult<ToolClusteringOptions?>.Success(
            create(
                new ConnectionStringClusteringOptions(options.ConnectionString, options.Invariant)
            )
        );
    }

    private static List<string> GetMulti(IReadOnlyDictionary<string, List<string>> map, string key)
    {
        return map.TryGetValue(key, out var values) ? [.. values] : [];
    }

    private sealed class RuntimeConfigFile
    {
        [JsonPropertyName("clusterId")]
        public string? ClusterId { get; init; }

        [JsonPropertyName("serviceId")]
        public string? ServiceId { get; init; }

        [JsonPropertyName("gatewayEndpoints")]
        public List<string>? GatewayEndpoints { get; init; }

        [JsonPropertyName("clustering")]
        public RuntimeClusteringFile? Clustering { get; init; }

        // ── New multi-source format ──
        public List<InterfaceEntryFile>? Interfaces { get; init; }

        // ── Legacy single-source fields (backward compat) ──
        public string? Source { get; init; }

        public string? Dll { get; init; }

        [JsonPropertyName("package-id")]
        public string? PackageId { get; init; }

        [JsonPropertyName("package-version")]
        public string? PackageVersion { get; init; }

        [JsonPropertyName("package-root")]
        public string? PackageRoot { get; init; }

        [JsonPropertyName("nuget-config")]
        public string? NugetConfig { get; init; }
    }

    private sealed class InterfaceEntryFile
    {
        public string? Gateway { get; init; }

        public string? Source { get; init; }

        public string? Dll { get; init; }

        [JsonPropertyName("package-id")]
        public string? PackageId { get; init; }

        [JsonPropertyName("package-version")]
        public string? PackageVersion { get; init; }

        [JsonPropertyName("package-root")]
        public string? PackageRoot { get; init; }

        [JsonPropertyName("nuget-config")]
        public string? NugetConfig { get; init; }
    }

    private sealed class RuntimeClusteringFile
    {
        [JsonPropertyName("provider")]
        public string? Provider { get; init; }

        [JsonPropertyName("redis")]
        public RuntimeRedisClusteringFile? Redis { get; init; }

        [JsonPropertyName("adoNet")]
        public RuntimeConnectionStringClusteringFile? AdoNet { get; init; }

        [JsonPropertyName("azureStorage")]
        public RuntimeConnectionStringClusteringFile? AzureStorage { get; init; }

        [JsonPropertyName("cosmos")]
        public RuntimeConnectionStringClusteringFile? Cosmos { get; init; }

        [JsonPropertyName("consul")]
        public RuntimeConnectionStringClusteringFile? Consul { get; init; }

        [JsonPropertyName("dynamoDB")]
        public RuntimeConnectionStringClusteringFile? DynamoDB { get; init; }

        [JsonPropertyName("zooKeeper")]
        public RuntimeConnectionStringClusteringFile? ZooKeeper { get; init; }

        [JsonPropertyName("cassandra")]
        public RuntimeConnectionStringClusteringFile? Cassandra { get; init; }
    }

    private sealed class RuntimeRedisClusteringFile
    {
        [JsonPropertyName("connectionString")]
        public string? ConnectionString { get; init; }
    }

    private sealed class RuntimeConnectionStringClusteringFile
    {
        [JsonPropertyName("connectionString")]
        public string? ConnectionString { get; init; }

        [JsonPropertyName("invariant")]
        public string? Invariant { get; init; }
    }
}
