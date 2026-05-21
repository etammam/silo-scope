using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a silo source entry within a workspace.
/// </summary>
/// <param name="Reference">The reference identifier, such as a DLL path or package ID.</param>
/// <param name="Source">The source type, such as "DLL" or "NuGet".</param>
/// <param name="Version">The optional version of the source.</param>
/// <param name="Gateway">The optional gateway endpoint associated with the source.</param>
/// <param name="Enabled"><see langword="true" /> if the source is enabled; otherwise, <see langword="false" />.</param>
public sealed record SiloSource(
    [property: JsonPropertyName("reference")] string Reference,
    [property: JsonPropertyName("source")] string Source,
    [property: JsonPropertyName("version")] string? Version,
    [property: JsonPropertyName("gateway")] string? Gateway,
    [property: JsonPropertyName("enabled")] bool Enabled
);
