using System.Text.Json.Serialization;

namespace Siloscope.Core.Configuration;

/// <summary>Kept for backward compatibility with old single-source config.</summary>
public readonly record struct InterfaceSourceOptions(
    [property: JsonPropertyName("sourceType")] InterfaceSourceType SourceType,
    [property: JsonPropertyName("dllPath")] string? DllPath,
    [property: JsonPropertyName("packageId")] string? PackageId,
    [property: JsonPropertyName("packageVersion")] string? PackageVersion,
    [property: JsonPropertyName("packageRoot")] string? PackageRoot,
    [property: JsonPropertyName("nugetConfigPath")] string? NugetConfigPath,
    [property: JsonPropertyName("feedName")] string? FeedName = null
);
