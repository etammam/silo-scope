namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a lightweight view of a workspace used for JSON-RPC communication.
/// </summary>
/// <param name="Id">The unique identifier of the workspace.</param>
/// <param name="Name">The display name of the workspace.</param>
/// <param name="Description">An optional description of the workspace.</param>
/// <param name="Cluster">The cluster connection options.</param>
/// <param name="Silos">The list of silo sources in the workspace.</param>
/// <param name="EnvironmentVariables">The active environment variables for the workspace.</param>
public sealed record WorkspaceInfo(
    string Id,
    string Name,
    string? Description,
    ClusterOptions Cluster,
    List<SiloSource> Silos,
    Dictionary<string, string> EnvironmentVariables
);
