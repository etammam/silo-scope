namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents information about a NuGet feed.
/// </summary>
/// <param name="Name">The display name of the feed.</param>
/// <param name="Url">The URL of the feed.</param>
/// <param name="HasCredentials"><see langword="true" /> if the feed requires credentials; otherwise, <see langword="false" />.</param>
/// <param name="IsDefault"><see langword="true" /> if the feed is the default NuGet.org feed; otherwise, <see langword="false" />.</param>
public sealed record NugetFeedInfo(
    string Name,
    string Url,
    bool HasCredentials,
    bool IsDefault = false
);
