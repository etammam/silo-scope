namespace Siloscope.Core.NuGet.Models;

/// <summary>
/// Represents authentication credentials for a NuGet feed.
/// </summary>
/// <param name="Username">The username for authentication.</param>
/// <param name="Password">The password for authentication.</param>
/// <param name="IsPasswordClearText"><see langword="true" /> if the password is stored in clear text; otherwise, <see langword="false" />.</param>
public sealed record NugetFeedSourceAuthentication(
    string Username,
    string Password,
    bool IsPasswordClearText
);
