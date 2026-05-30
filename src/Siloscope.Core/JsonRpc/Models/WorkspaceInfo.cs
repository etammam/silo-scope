using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents an environment profile with a name and key-value variables.
/// </summary>
/// <param name="Name">The name of the environment profile.</param>
/// <param name="Variables">The key-value variables for this environment.</param>
public sealed record EnvironmentProfile(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("variables")] Dictionary<string, string> Variables
);

/// <summary>
/// Represents the environment configuration for a workspace.
/// </summary>
/// <param name="Profiles">The list of environment profiles.</param>
/// <param name="ActiveEnvironment">The name of the currently active environment profile.</param>
public sealed record EnvironmentConfigInfo(
    [property: JsonPropertyName("profiles")] List<EnvironmentProfile> Profiles,
    [property: JsonPropertyName("activeEnvironment")] string? ActiveEnvironment
);

/// <summary>
/// Represents a lightweight view of a workspace used for JSON-RPC communication.
/// </summary>
/// <param name="Id">The unique identifier of the workspace.</param>
/// <param name="Name">The display name of the workspace.</param>
/// <param name="Description">An optional description of the workspace.</param>
/// <param name="Cluster">The cluster connection options.</param>
/// <param name="Silos">The list of silo sources in the workspace.</param>
/// <param name="SavedContexts">The request contexts explicitly saved for workspace tabs.</param>
public sealed record WorkspaceInfo(
    [property: JsonPropertyName("id")] string Id,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("cluster")] ClusterOptions Cluster,
    [property: JsonPropertyName("silos")] List<SiloSource> Silos,
    [property: JsonPropertyName("savedContexts")] List<SavedRequestContext> SavedContexts
);
