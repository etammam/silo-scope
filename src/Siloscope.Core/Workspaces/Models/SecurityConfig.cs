using System.Text.Json.Serialization;

namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents security configuration stored in a workspace.
/// </summary>
public sealed record SecurityConfig
{
    /// <summary>
    /// Gets the workspace salt used for security operations.
    /// </summary>
    [JsonPropertyName("workspaceSalt")]
    public string WorkspaceSalt { get; init; } = string.Empty;
}
