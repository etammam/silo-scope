using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents information about a NuGet package returned from a search.
/// </summary>
/// <param name="PackageId">The package identifier.</param>
/// <param name="Version">The package version.</param>
/// <param name="Description">An optional description of the package.</param>
/// <param name="Authors">An optional comma-separated list of authors.</param>
/// <param name="DownloadCount">The optional download count of the package.</param>
public sealed record NugetPackageInfo(
    [property: JsonPropertyName("packageId")] string PackageId,
    [property: JsonPropertyName("version")] string Version,
    [property: JsonPropertyName("description")] string? Description,
    [property: JsonPropertyName("authors")] string? Authors,
    [property: JsonPropertyName("downloadCount")] long? DownloadCount
);
