namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents a persisted workspace containing cluster configuration, silo sources, and environment settings.
/// </summary>
public sealed record Workspace
{
    /// <summary>
    /// Gets the unique identifier of the workspace.
    /// </summary>
    public string Id { get; init; } = string.Empty;

    /// <summary>
    /// Gets the workspace metadata.
    /// </summary>
    public WorkspaceInfo WorkspaceInfo { get; init; } = new();

    /// <summary>
    /// Gets the cluster configuration.
    /// </summary>
    public ClusterConfig Cluster { get; init; } = new();

    /// <summary>
    /// Gets the list of silo sources in the workspace.
    /// </summary>
    public List<SiloSource> Silos { get; init; } = [];

    /// <summary>
    /// Gets the security configuration for the workspace.
    /// </summary>
    public SecurityConfig Security { get; init; } = new();

    /// <summary>
    /// Gets the list of environment configurations.
    /// </summary>
    public List<EnvironmentConfig> Environments { get; init; } = [];

    /// <summary>
    /// Gets the session configuration.
    /// </summary>
    public SessionConfig Session { get; init; } = new();
}
