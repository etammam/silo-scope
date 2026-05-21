using System.Text.Json.Serialization;

namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents a persisted workspace containing cluster configuration, silo sources, and environment settings.
/// </summary>
public sealed record Workspace
{
    /// <summary>
    /// Gets the unique identifier of the workspace.
    /// </summary>
    [JsonPropertyName("id")]
    public string Id { get; init; } = string.Empty;

    /// <summary>
    /// Gets the workspace metadata.
    /// </summary>
    [JsonPropertyName("workspaceInfo")]
    public WorkspaceInfo WorkspaceInfo { get; init; } = new();

    /// <summary>
    /// Gets the cluster configuration.
    /// </summary>
    [JsonPropertyName("cluster")]
    public ClusterConfig Cluster { get; init; } = new();

    /// <summary>
    /// Gets the list of silo sources in the workspace.
    /// </summary>
    [JsonPropertyName("silos")]
    public List<SiloSource> Silos { get; init; } = [];

    /// <summary>
    /// Gets the security configuration for the workspace.
    /// </summary>
    [JsonPropertyName("security")]
    public SecurityConfig Security { get; init; } = new();

    /// <summary>
    /// Gets the list of environment configurations.
    /// </summary>
    [JsonPropertyName("environments")]
    public List<EnvironmentConfig> Environments { get; init; } = [];

    /// <summary>
    /// Gets the session configuration.
    /// </summary>
    [JsonPropertyName("session")]
    public SessionConfig Session { get; init; } = new();
}
