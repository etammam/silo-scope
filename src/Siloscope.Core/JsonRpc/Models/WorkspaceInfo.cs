using System.Text.Json.Serialization;

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
/// <param name="SavedContexts">The request contexts explicitly saved for workspace tabs.</param>
public sealed record WorkspaceInfo(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("cluster")] ClusterOptions Cluster,
    [property: JsonPropertyName("silos")] List<SiloSource> Silos,
    [property: JsonPropertyName("environmentVariables")]
        Dictionary<string, string> EnvironmentVariables,
    [property: JsonPropertyName("savedContexts")] List<SavedRequestContext> SavedContexts
);
