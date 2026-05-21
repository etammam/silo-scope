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
    string PackageId,
    string Version,
    string? Description,
    string? Authors,
    long? DownloadCount
);
