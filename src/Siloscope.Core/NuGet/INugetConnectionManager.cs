using FluentResults;
using Siloscope.Core.NuGet.Models;

namespace Siloscope.Core.NuGet;

/// <summary>
/// Manages NuGet feed connections and package operations.
/// </summary>
public interface INugetConnectionManager
{
    /// <summary>
    /// Creates and persists a new NuGet feed.
    /// </summary>
    /// <param name="feed">The feed source to create.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> indicating success or failure.</returns>
    ValueTask<Result> CreateAsync(
        NugetFeedSource feed,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Tests the connection to a NuGet feed.
    /// </summary>
    /// <param name="feed">The feed source to test.</param>
    /// <returns>A <see cref="Result" /> indicating whether the connection succeeded.</returns>
    Result Test(NugetFeedSource feed);

    /// <summary>
    /// Gets a feed by name.
    /// </summary>
    /// <param name="name">The name of the feed.</param>
    /// <returns>A <see cref="Result" /> containing the feed.</returns>
    Result<Feed> Get(string name);

    /// <summary>
    /// Lists all configured NuGet feeds.
    /// </summary>
    /// <returns>A <see cref="Result" /> containing a read-only list of feeds.</returns>
    Result<IReadOnlyList<Feed>> List();

    /// <summary>
    /// Updates an existing NuGet feed.
    /// </summary>
    /// <param name="feed">The updated feed information.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing the updated feed.</returns>
    ValueTask<Result<Feed>> UpdateAsync(Feed feed, CancellationToken cancellationToken = default);

    /// <summary>
    /// Deletes the specified NuGet feed.
    /// </summary>
    /// <param name="feed">The feed to delete.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> indicating success or failure.</returns>
    ValueTask<Result> DeleteAsync(Feed feed, CancellationToken cancellationToken = default);

    /// <summary>
    /// Gets the credentials for a named feed.
    /// </summary>
    /// <param name="feedName">The name of the feed.</param>
    /// <returns>The authentication credentials, or <see langword="null" /> if none are stored.</returns>
    NugetFeedSourceAuthentication? GetCredentials(string feedName);

    /// <summary>
    /// Downloads a NuGet package to the local cache.
    /// </summary>
    /// <param name="packageId">The package identifier.</param>
    /// <param name="version">The package version.</param>
    /// <param name="sourceUrl">An optional NuGet feed URL to download from.</param>
    /// <param name="credentials">Optional credentials for authenticated feeds.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing the path to the downloaded package.</returns>
    Task<Result<string>> DownloadPackageAsync(
        string packageId,
        string version,
        string? sourceUrl = null,
        NugetFeedSourceAuthentication? credentials = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Restores the specified NuGet packages and their dependencies.
    /// </summary>
    /// <param name="packages">The collection of package identifiers and versions to restore.</param>
    /// <param name="sourceUrl">An optional NuGet feed URL to restore from.</param>
    /// <param name="feedName">An optional configured feed name to use.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing a status message.</returns>
    Task<Result<string>> RestorePackagesAsync(
        IEnumerable<(string Id, string Version)> packages,
        string? sourceUrl = null,
        string? feedName = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Searches for NuGet packages matching the specified query.
    /// </summary>
    /// <param name="query">The search query string.</param>
    /// <param name="sourceUrl">An optional NuGet feed URL to search.</param>
    /// <param name="feedName">An optional configured feed name to search.</param>
    /// <param name="take">The maximum number of results to return.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing a read-only list of search results.</returns>
    Task<Result<IReadOnlyList<NugetPackageSearchResult>>> SearchPackagesAsync(
        string query,
        string? sourceUrl = null,
        string? feedName = null,
        int take = 20,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Gets all available versions for a NuGet package.
    /// </summary>
    /// <param name="packageId">The package identifier.</param>
    /// <param name="sourceUrl">An optional NuGet feed URL to query.</param>
    /// <param name="feedName">An optional configured feed name to query.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing a read-only list of version strings.</returns>
    Task<Result<IReadOnlyList<string>>> GetPackageVersionsAsync(
        string packageId,
        string? sourceUrl = null,
        string? feedName = null,
        CancellationToken cancellationToken = default
    );
}
