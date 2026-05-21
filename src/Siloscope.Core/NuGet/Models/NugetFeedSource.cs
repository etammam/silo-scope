using System.Text.Json.Serialization;

namespace Siloscope.Core.NuGet.Models;

/// <summary>
/// Represents a NuGet feed source used for package operations.
/// </summary>
/// <param name="SourceUrl">The URL of the feed.</param>
/// <param name="Name">The display name of the feed.</param>
/// <param name="Persist"><see langword="true" /> to persist the feed; otherwise, <see langword="false" />.</param>
/// <param name="Credentials">Optional credentials for authenticated feeds.</param>
public sealed record NugetFeedSource(
    [property: JsonPropertyName("sourceUrl")] string SourceUrl,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("persist")] bool Persist,
    [property: JsonPropertyName("credentials")] NugetFeedSourceAuthentication? Credentials
);
