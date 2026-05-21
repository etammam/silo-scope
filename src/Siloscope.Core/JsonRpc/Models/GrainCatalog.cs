using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a catalog of discovered grain interfaces and their assembly paths.
/// </summary>
/// <param name="Grains">The list of discovered grain interfaces.</param>
/// <param name="AssemblyPaths">The list of assembly paths that contain the grain interfaces.</param>
public sealed record GrainCatalog(
    [property: JsonPropertyName("grains")] IReadOnlyList<GrainInfo> Grains,
    [property: JsonPropertyName("assemblyPaths")] IReadOnlyList<string> AssemblyPaths
);
