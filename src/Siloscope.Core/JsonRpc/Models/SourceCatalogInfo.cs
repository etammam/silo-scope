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
    string SourceId,
    string SourceType,
    string Reference,
    string Label,
    string? Version,
    string? Gateway,
    bool Enabled,
    string DiscoveryStatus,
    IReadOnlyList<SourceCatalogInterface> Interfaces
);
