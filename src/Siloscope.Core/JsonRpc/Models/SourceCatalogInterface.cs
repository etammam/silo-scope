namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a discovered grain interface within a source catalog.
/// </summary>
/// <param name="InterfaceId">The unique identifier of the interface.</param>
/// <param name="InterfaceName">The short name of the interface.</param>
/// <param name="Namespace">The namespace of the interface.</param>
/// <param name="Methods">The list of methods exposed by the interface.</param>
public sealed record SourceCatalogInterface(
    string InterfaceId,
    string InterfaceName,
    string Namespace,
    IReadOnlyList<SourceCatalogFunction> Methods
);
