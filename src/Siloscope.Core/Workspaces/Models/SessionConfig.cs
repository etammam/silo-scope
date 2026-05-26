using System.Text.Json.Serialization;

namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents session configuration stored in a workspace.
/// </summary>
public sealed record SessionConfig
{
    /// <summary>
    /// Gets the optional identifier of the last active workspace.
    /// </summary>
    [JsonPropertyName("lastWorkspaceId")]
    public string? LastWorkspaceId { get; init; }

    /// <summary>
    /// Gets the request contexts explicitly saved by the user.
    /// </summary>
    [JsonPropertyName("savedContexts")]
    public List<SavedRequestContext> SavedContexts { get; init; } = [];
}
