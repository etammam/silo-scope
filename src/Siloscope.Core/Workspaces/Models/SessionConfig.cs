namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents session configuration stored in a workspace.
/// </summary>
public sealed record SessionConfig
{
    /// <summary>
    /// Gets the name of the active environment.
    /// </summary>
    public string ActiveEnvironment { get; init; } = string.Empty;

    /// <summary>
    /// Gets the optional identifier of the last active workspace.
    /// </summary>
    public string? LastWorkspaceId { get; init; }
}
