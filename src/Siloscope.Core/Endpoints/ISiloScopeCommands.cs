using FluentResults;

namespace Siloscope.Core.Endpoints;

public interface ISiloScopeCommands
{
    // Workspace
    Task<Result<WorkspaceInfo>> LoadWorkspaceAsync(
        string? path = null,
        CancellationToken cancellationToken = default
    );
    Task<Result> SaveWorkspaceAsync(
        WorkspaceInfo workspace,
        string? path = null,
        CancellationToken cancellationToken = default
    );

    // Cluster
    Task<Result<string>> ConnectClusterAsync(
        ClusterOptions options,
        CancellationToken cancellationToken = default
    );
    Task<Result> DisconnectClusterAsync(CancellationToken cancellationToken = default);

    // Grains
    Task<Result<GrainCatalog>> DiscoverGrainsAsync(CancellationToken cancellationToken = default);
    Task<Result<InvocationResult>> InvokeGrainAsync(
        string grainType,
        string methodName,
        string grainKey,
        string? payload,
        CancellationToken cancellationToken = default
    );

    // NuGet
    Task<Result<RestoreResult>> RestorePackagesAsync(
        IEnumerable<SiloSource> silos,
        string? sourceUrl = null,
        CancellationToken cancellationToken = default
    );
}

public record WorkspaceInfo(
    string Id,
    string Name,
    string? Description,
    ClusterOptions Cluster,
    List<SiloSource> Silos,
    Dictionary<string, string> EnvironmentVariables
);

public record ClusterOptions(string ClusterId, string ServiceId, List<string> GatewayEndpoints);

public record SiloSource(
    string Reference,
    string Source,
    string? Version,
    string? Gateway,
    bool Enabled
);

public record GrainCatalog(IReadOnlyList<GrainInfo> Grains, IReadOnlyList<string> AssemblyPaths);

public record GrainInfo(
    string FullName,
    string Name,
    string Namespace,
    IReadOnlyList<MethodInfo> Methods,
    string? Gateway
);

public record MethodInfo(string Name, string Signature, string ReturnType);

public record InvocationResult(
    bool IsSuccess,
    string? Result,
    string? ErrorMessage,
    TimingInfo? Timing
);

public record TimingInfo(long SerializationMs, long ExecutionMs, long TotalMs);

public record RestoreResult(
    int RestoredCount,
    int FailedCount,
    IReadOnlyList<string> RestoredPackages,
    IReadOnlyList<string> FailedPackages
);
