namespace Siloscope.Core.Configuration;

public sealed record RuntimeOptions(
    ToolClusterOptions Cluster,
    IReadOnlyList<InterfaceEntry> Interfaces
);

public sealed record ToolClusterOptions(
    string ClusterId,
    string ServiceId,
    IReadOnlyList<string> GatewayEndpoints,
    ToolClusteringOptions? Clustering = null
);

public sealed record ToolClusteringOptions(
    ToolClusteringProvider Provider,
    RedisClusteringOptions? Redis = null
);

public sealed record RedisClusteringOptions(string ConnectionString);

public enum ToolClusteringProvider
{
    Localhost,
    Static,
    Redis,
}

/// <summary>A single interface source bound to a specific gateway in a heterogeneous cluster.</summary>
public sealed record InterfaceEntry(
    string? Gateway,
    InterfaceSourceType SourceType,
    string? DllPath,
    string? PackageId,
    string? PackageVersion,
    string? PackageRoot,
    string? NugetConfigPath,
    string? SourceId = null
);

/// <summary>Kept for backward compatibility with old single-source config.</summary>
public sealed record InterfaceSourceOptions(
    InterfaceSourceType SourceType,
    string? DllPath,
    string? PackageId,
    string? PackageVersion,
    string? PackageRoot,
    string? NugetConfigPath
);

public enum InterfaceSourceType
{
    Dll,
    NuGet,
}

public sealed record ParseResult<T>(bool IsSuccess, T? Value, string? ErrorMessage)
{
    public static ParseResult<T> Success(T value)
    {
        return new ParseResult<T>(true, value, null);
    }

    public static ParseResult<T> Failure(string errorMessage)
    {
        return new ParseResult<T>(false, default, errorMessage);
    }
}
