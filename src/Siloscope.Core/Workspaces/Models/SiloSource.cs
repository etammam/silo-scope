using System.Text.Json.Serialization;

namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents a silo source entry within a persisted workspace.
/// </summary>
public sealed record SiloSource
{
    /// <summary>
    /// Gets the reference identifier, such as a DLL path or package ID.
    /// </summary>
    [JsonPropertyName("reference")]
    public string Reference { get; init; } = string.Empty;

    /// <summary>
    /// Gets the source type, such as "DLL" or "NuGet". The default is "DLL".
    /// </summary>
    [JsonPropertyName("source")]
    public string Source { get; init; } = "DLL";

    /// <summary>
    /// Gets the optional version of the source.
    /// </summary>
    [JsonPropertyName("version")]
    public string? Version { get; init; }

    /// <summary>
    /// Gets the optional gateway endpoint associated with the source.
    /// </summary>
    [JsonPropertyName("gateway")]
    public string? Gateway { get; init; }

    /// <summary>
    /// Gets the optional configured NuGet feed name used to restore package sources.
    /// </summary>
    [JsonPropertyName("feedName")]
    public string? FeedName { get; init; }

    /// <summary>
    /// Gets a value indicating whether the source is enabled. The default is <see langword="true" />.
    /// </summary>
    [JsonPropertyName("enabled")]
    public bool Enabled { get; init; } = true;
}
