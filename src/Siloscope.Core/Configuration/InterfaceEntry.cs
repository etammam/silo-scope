using System.Text.Json.Serialization;

namespace Siloscope.Core.Configuration;

/// <summary>A single interface source bound to a specific gateway in a heterogeneous cluster.</summary>
public readonly record struct InterfaceEntry(
    [property: JsonPropertyName("gateway")] string? Gateway,
    [property: JsonPropertyName("sourceType")] InterfaceSourceType SourceType,
    [property: JsonPropertyName("dllPath")] string? DllPath,
    [property: JsonPropertyName("packageId")] string? PackageId,
    [property: JsonPropertyName("packageVersion")] string? PackageVersion,
    [property: JsonPropertyName("packageRoot")] string? PackageRoot,
    [property: JsonPropertyName("nugetConfigPath")] string? NugetConfigPath,
    [property: JsonPropertyName("sourceId")] string? SourceId = null
);
