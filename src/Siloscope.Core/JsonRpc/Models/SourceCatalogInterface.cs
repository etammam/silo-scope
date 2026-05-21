using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a discovered grain interface within a source catalog.
/// </summary>
/// <param name="InterfaceId">The unique identifier of the interface.</param>
/// <param name="InterfaceName">The short name of the interface.</param>
/// <param name="Namespace">The namespace of the interface.</param>
/// <param name="Methods">The list of methods exposed by the interface.</param>
public sealed record SourceCatalogInterface(
    [property: JsonPropertyName("interfaceId")] string InterfaceId,
    [property: JsonPropertyName("interfaceName")] string InterfaceName,
    [property: JsonPropertyName("namespace")] string Namespace,
    [property: JsonPropertyName("methods")] IReadOnlyList<SourceCatalogFunction> Methods
);
