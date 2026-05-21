using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a catalog entry for a single silo source and its discovered interfaces.
/// </summary>
/// <param name="SourceId">The unique identifier of the source.</param>
/// <param name="SourceType">The type of the source.</param>
/// <param name="Reference">The reference identifier of the source.</param>
/// <param name="Label">The display label of the source.</param>
/// <param name="Version">The optional version of the source.</param>
/// <param name="Gateway">The optional gateway endpoint associated with the source.</param>
/// <param name="Enabled"><see langword="true" /> if the source is enabled; otherwise, <see langword="false" />.</param>
/// <param name="DiscoveryStatus">The discovery status of the source, such as "ready" or "idle".</param>
/// <param name="Interfaces">The list of discovered interfaces for this source.</param>
public sealed record SourceCatalogInfo(
    [property: JsonPropertyName("sourceId")] string SourceId,
    [property: JsonPropertyName("sourceType")] string SourceType,
    [property: JsonPropertyName("reference")] string Reference,
    [property: JsonPropertyName("label")] string Label,
    [property: JsonPropertyName("version")] string? Version,
    [property: JsonPropertyName("gateway")] string? Gateway,
    [property: JsonPropertyName("enabled")] bool Enabled,
    [property: JsonPropertyName("discoveryStatus")] string DiscoveryStatus,
    [property: JsonPropertyName("interfaces")] IReadOnlyList<SourceCatalogInterface> Interfaces
);
