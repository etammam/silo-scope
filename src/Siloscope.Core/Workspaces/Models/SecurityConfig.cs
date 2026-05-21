namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents security configuration stored in a workspace.
/// </summary>
public sealed record SecurityConfig
{
    /// <summary>
    /// Gets the workspace salt used for security operations.
    /// </summary>
    public string WorkspaceSalt { get; init; } = string.Empty;
}
