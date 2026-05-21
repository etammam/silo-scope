using System.Text.Json.Serialization;

namespace Siloscope.Core.Catalog;

/// <summary>
/// Describes a discovered Orleans grain interface.
/// </summary>
/// <param name="Name">The fully qualified name of the interface.</param>
/// <param name="InterfaceType">The runtime <see cref="Type" /> of the interface.</param>
/// <param name="Methods">The list of methods exposed by the interface.</param>
/// <param name="Gateway">The optional gateway endpoint associated with the interface.</param>
/// <param name="SourceId">The optional source identifier that owns this interface.</param>
public sealed record GrainInterfaceDescriptor(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("interfaceType")] Type InterfaceType,
    [property: JsonPropertyName("methods")] IReadOnlyList<GrainMethodDescriptor> Methods,
    [property: JsonPropertyName("gateway")] string? Gateway,
    [property: JsonPropertyName("sourceId")] string? SourceId = null
);
