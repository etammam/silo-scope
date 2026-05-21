namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a request to create or test a NuGet feed.
/// </summary>
/// <param name="Name">The display name of the feed.</param>
/// <param name="Url">The URL of the feed.</param>
/// <param name="Username">An optional username for authenticated feeds.</param>
/// <param name="Password">An optional password for authenticated feeds.</param>
/// <param name="IsPasswordClearText"><see langword="true" /> if the password is in clear text; otherwise, <see langword="false" />. The default is <see langword="true" />.</param>
public sealed record CreateNugetFeedRequest(
    string Name,
    string Url,
    string? Username,
    string? Password,
    bool IsPasswordClearText = true
);
