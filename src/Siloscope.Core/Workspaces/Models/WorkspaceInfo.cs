namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents metadata about a workspace.
/// </summary>
public sealed record WorkspaceInfo
{
    /// <summary>
    /// Gets the display name of the workspace.
    /// </summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// Gets the description of the workspace.
    /// </summary>
    public string Description { get; init; } = string.Empty;

    /// <summary>
    /// Gets the ISO 8601 creation timestamp of the workspace.
    /// </summary>
    public string Creation { get; init; } = string.Empty;
}
