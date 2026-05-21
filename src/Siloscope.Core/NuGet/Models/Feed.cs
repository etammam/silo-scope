namespace Siloscope.Core.NuGet.Models;

/// <summary>
/// Represents a persisted NuGet feed configuration.
/// </summary>
public sealed record Feed
{
    /// <summary>
    /// Gets the display name of the feed.
    /// </summary>
    public required string Name { get; init; }

    /// <summary>
    /// Gets the URL of the feed.
    /// </summary>
    public required string Url { get; init; }

    /// <summary>
    /// Gets the optional username for authenticated feeds.
    /// </summary>
    public string? Username { get; init; }

    /// <summary>
    /// Gets the optional password for authenticated feeds.
    /// </summary>
    public string? Password { get; init; }

    /// <summary>
    /// Gets a value indicating whether the password is stored in clear text.
    /// </summary>
    public bool? IsPasswordClearText { get; init; }
}
