namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a grain catalog organized by source ownership.
/// </summary>
/// <param name="Sources">The list of sources and their discovered interfaces.</param>
public sealed record SourceOwnedGrainCatalog(IReadOnlyList<SourceCatalogInfo> Sources);
