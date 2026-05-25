using System.Text.Json.Serialization;

namespace Siloscope.Core.NuGet.Models;

/// <summary>
/// Represents authentication credentials for a NuGet feed.
/// </summary>
/// <param name="Username">The username for authentication.</param>
/// <param name="Password">The password for authentication.</param>
/// <param name="IsPasswordClearText"><see langword="true" /> if the password is stored in clear text; otherwise, <see langword="false" />.</param>
public sealed record NugetFeedSourceAuthentication(
    [property: JsonPropertyName("username")] string Username,
    [property: JsonPropertyName("password")] string Password,
    [property: JsonPropertyName("isPasswordClearText")] bool IsPasswordClearText
);
