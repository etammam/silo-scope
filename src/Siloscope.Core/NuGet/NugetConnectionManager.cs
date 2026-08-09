using System.IO.Compression;
using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging;
using NuGet.Common;
using NuGet.Configuration;
using NuGet.Packaging;
using NuGet.Packaging.Core;
using NuGet.Protocol;
using NuGet.Protocol.Core.Types;
using NuGet.Versioning;
using Siloscope.Core.NuGet.Models;

namespace Siloscope.Core.NuGet;

/// <summary>
/// Manages NuGet feed connections, package downloads, restores, and searches.
/// </summary>
public sealed class NugetConnectionManager : INugetConnectionManager
{
    private readonly List<Feed> _feeds = [];
    private readonly string _sourcePath;
    private readonly ILogger<NugetConnectionManager> _logger;
    private static readonly JsonSerializerOptions JsonSerializerOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
    };

    private static string GetStableAppDataPath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, "Siloscope", "feeds.json");
    }

    public NugetConnectionManager(ILogger<NugetConnectionManager> logger)
    {
        _logger = logger;
        var stablePath = GetStableAppDataPath();
        _logger.LogInformation(
            "NugetConnectionManager initializing. Stable app data path: {Path}",
            stablePath
        );
        Init(Path.GetDirectoryName(stablePath)!, Path.GetFileName(stablePath));
        _sourcePath = stablePath;
        _logger.LogInformation("Feeds loaded: {Count} feeds", _feeds.Count);
    }

    public async ValueTask<Result> CreateAsync(
        NugetFeedSource feed,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var validation = ValidateConnection(feed);
            if (validation.IsFailed)
                return validation;

            _logger.LogInformation("Feed connection success to the feed source");

            if (_feeds.Any(item => item.Name == feed.Name))
            {
                return Result.Fail(
                    new Error("Feed name must be unique, feed with same name already added.")
                );
            }
            _feeds.Add(
                new Feed
                {
                    Name = feed.Name,
                    Url = feed.SourceUrl,
                    Username = feed.Credentials?.Username,
                    Password = feed.Credentials?.Password,
                    IsPasswordClearText = feed.Credentials?.IsPasswordClearText,
                }
            );
            await WriteAsync(cancellationToken);
            _logger.LogInformation("Feed stored in the feed storage successfully");

            return Result.Ok();
        }
        catch (Exception e)
        {
            return Result.Fail(new Error(e.Message));
        }
    }

    private Result ValidateConnection(NugetFeedSource feed)
    {
        try
        {
            var source = new PackageSource(source: feed.SourceUrl);
            if (feed.Credentials is not null)
            {
                source.Credentials = new PackageSourceCredential(
                    source: feed.SourceUrl,
                    username: feed.Credentials.Username,
                    passwordText: feed.Credentials.Password,
                    isPasswordClearText: feed.Credentials.IsPasswordClearText,
                    validAuthenticationTypesText: "basic"
                );
                source.DisableTLSCertificateValidation = true;
            }
            Repository.Factory.GetCoreV3(source);
            return Result.Ok();
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Unhandled error occur. during feed connection validation");
            return Result.Fail(new Error(e.Message));
        }
    }

    public Result Test(NugetFeedSource feed) => ValidateConnection(feed);

    private void Init(string fullPath, string fileName)
    {
        try
        {
            _logger.LogInformation("Init: Using directory at {Location}", fullPath);
            if (!Directory.Exists(fullPath))
                Directory.CreateDirectory(fullPath);

            var filePath = Path.Combine(fullPath, fileName);
            _logger.LogInformation("Init: Using file path {FilePath}", filePath);
            if (!File.Exists(filePath))
            {
                using var _ = File.Create(filePath);
            }

            var fileContent = File.ReadAllText(filePath);

            if (string.IsNullOrEmpty(fileContent))
                fileContent = JsonSerializer.Serialize<Feed[]>([], JsonSerializerOptions);

            var content = JsonSerializer.Deserialize<List<Feed>>(
                fileContent,
                JsonSerializerOptions
            )!;

            _logger.LogInformation("Init: Loaded {Count} feeds from file", content.Count);
            _feeds.AddRange(content);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Init: Failed to initialize feed storage");
            throw;
        }
    }

    private async Task WriteAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation(
            "WriteAsync: Writing {Count} feeds to {Path}",
            _feeds.Count,
            _sourcePath
        );
        await File.WriteAllTextAsync(
            _sourcePath,
            JsonSerializer.Serialize(_feeds, JsonSerializerOptions),
            cancellationToken
        );
        _logger.LogInformation("WriteAsync: Successfully saved feeds");
    }

    public Result<Feed> Get(string name)
    {
        try
        {
            var feed = _feeds.FirstOrDefault(f => f.Name == name);
            if (feed is not null)
                return Result.Ok(feed);

            return Result.Fail(new Error("feed not exists"));
        }
        catch (Exception e)
        {
            return Result.Fail(new Error(e.Message));
        }
    }

    public Result<IReadOnlyList<Feed>> List()
    {
        try
        {
            return Result.Ok<IReadOnlyList<Feed>>(
                _feeds
                    .Select(feed => new Feed
                    {
                        Name = feed.Name,
                        Url = feed.Url,
                        Username = feed.Username,
                        Password = feed.Password,
                        IsPasswordClearText = feed.IsPasswordClearText,
                    })
                    .ToList()
            );
        }
        catch (Exception e)
        {
            return Result.Fail<IReadOnlyList<Feed>>(e.Message);
        }
    }

    public NugetFeedSourceAuthentication? GetCredentials(string feedName)
    {
        var feed = _feeds.FirstOrDefault(f => f.Name == feedName);
        if (feed is null || string.IsNullOrEmpty(feed.Username))
            return null;

        return new NugetFeedSourceAuthentication(
            feed.Username,
            feed.Password ?? string.Empty,
            feed.IsPasswordClearText ?? true
        );
    }

    public async ValueTask<Result<Feed>> UpdateAsync(
        Feed feed,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var existingIndex = _feeds.FindIndex(f => f.Name == feed.Name);
            if (existingIndex < 0)
                return Result.Fail(new Error("Feed not found."));

            _feeds[existingIndex] = feed;
            await WriteAsync(cancellationToken);
            return Result.Ok(feed);
        }
        catch (Exception e)
        {
            return Result.Fail(new Error(e.Message));
        }
    }

    public async ValueTask<Result> DeleteAsync(
        Feed feed,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            if (!_feeds.Remove(feed))
                return Result.Fail(new Error("Feed not found."));

            await WriteAsync(cancellationToken);
            return Result.Ok();
        }
        catch (Exception e)
        {
            return Result.Fail(new Error(e.Message));
        }
    }

    public async Task<Result<string>> DownloadPackageAsync(
        string packageId,
        string version,
        string? sourceUrl = null,
        NugetFeedSourceAuthentication? credentials = null,
        string? feedName = null,
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            // Resolve feed: explicit sourceUrl > feedName lookup > all feeds > nuget.org
            var feedUrls = new List<(string url, NugetFeedSourceAuthentication? creds)>();
            if (!string.IsNullOrEmpty(sourceUrl))
            {
                feedUrls.Add((sourceUrl, credentials));
            }
            else if (!string.IsNullOrEmpty(feedName))
            {
                var feed = _feeds.FirstOrDefault(f =>
                    string.Equals(f.Name, feedName, StringComparison.OrdinalIgnoreCase)
                );
                if (feed != null)
                    feedUrls.Add((feed.Url, GetCredentials(feed.Name)));
                else
                    feedUrls.Add(("https://api.nuget.org/v3/index.json", null));
            }
            else
            {
                foreach (var f in _feeds)
                    feedUrls.Add((f.Url, GetCredentials(f.Name)));
                feedUrls.Add(("https://api.nuget.org/v3/index.json", null));
            }

            var lastError = string.Empty;
            foreach (var (packageSourceUrl, creds) in feedUrls)
            {
                try
                {
                    var result = await DownloadSingleAsync(
                        packageId,
                        version,
                        packageSourceUrl,
                        creds,
                        cancellationToken
                    );
                    if (result.IsSuccess)
                        return result;
                    lastError = result.Errors.FirstOrDefault()?.Message ?? "Unknown error";
                }
                catch (Exception ex)
                {
                    lastError = ex.Message;
                }
            }

            return Result.Fail<string>(
                $"Failed to download {packageId} {version} from any feed. Last error: {lastError}"
            );
        }
        catch (Exception e)
        {
            _logger.LogError(
                e,
                "Failed to download package {PackageId} {Version}",
                packageId,
                version
            );
            return Result.Fail<string>(e.Message);
        }
    }

    private async Task<Result<string>> DownloadSingleAsync(
        string packageId,
        string version,
        string packageSourceUrl,
        NugetFeedSourceAuthentication? credentials,
        CancellationToken cancellationToken
    )
    {
        try
        {
            _logger.LogInformation(
                "Downloading {PackageId} {Version} from {Source}",
                packageId,
                version,
                packageSourceUrl
            );

            var source = CreatePackageSource(packageSourceUrl, credentials);

            var provider = Repository.Factory.GetCoreV3(source);

            var findPackageResource = await provider.GetResourceAsync<FindPackageByIdResource>(
                cancellationToken
            );
            var packageVersion = NuGetVersion.Parse(version);

            var normalizedVersion = packageVersion.ToNormalizedString().ToLowerInvariant();
            var nugetPackagesPath = GetNuGetPackagesPath();
            var targetPath = Path.Combine(
                nugetPackagesPath,
                packageId.ToLowerInvariant(),
                normalizedVersion
            );
            var nupkgPath = Path.Combine(
                targetPath,
                $"{packageId.ToLowerInvariant()}.{normalizedVersion}.nupkg"
            );

            if (Directory.Exists(targetPath) && HasInstalledPackageContent(targetPath, nupkgPath))
            {
                // If the .nupkg exists but is empty (failed download), clean it up
                if (File.Exists(nupkgPath) && new FileInfo(nupkgPath).Length == 0)
                {
                    try
                    {
                        File.Delete(nupkgPath);
                    }
                    catch
                    { /* best-effort */
                    }
                }
                else
                {
                    _logger.LogInformation("Package already exists at {Path}", targetPath);
                    return Result.Ok(targetPath);
                }
            }

            Directory.CreateDirectory(targetPath);

            {
                await using var fileStream = new FileStream(
                    nupkgPath,
                    FileMode.Create,
                    FileAccess.Write,
                    FileShare.None
                );

                await findPackageResource.CopyNupkgToStreamAsync(
                    packageId,
                    packageVersion,
                    fileStream,
                    new SourceCacheContext(),
                    NullLogger.Instance,
                    cancellationToken
                );
            }

            // Validate the download produced real content
            var fileInfo = new FileInfo(nupkgPath);
            if (!fileInfo.Exists || fileInfo.Length == 0)
            {
                // Clean up the empty file so it doesn't block future attempts
                try
                {
                    File.Delete(nupkgPath);
                }
                catch
                { /* best-effort */
                }
                return Result.Fail<string>(
                    $"NuGet package {packageId} {version} was not found on the configured feeds. "
                        + "Verify the package ID, version, and that the correct NuGet feed is configured."
                );
            }

            ExtractNupkg(nupkgPath, targetPath);

            _logger.LogInformation("Package extracted to {Path}", targetPath);
            return Result.Ok(targetPath);
        }
        catch (Exception e)
        {
            _logger.LogError(
                e,
                "Failed to download package {PackageId} {Version}",
                packageId,
                version
            );
            return Result.Fail<string>(e.Message);
        }
    }

    public async Task<Result<string>> RestorePackagesAsync(
        IEnumerable<(string Id, string Version)> packages,
        string? sourceUrl = null,
        string? feedName = null,
        int maxDepth = int.MaxValue,
        CancellationToken cancellationToken = default
    )
    {
        var results = new List<string>();
        var errors = new List<string>();
        var restored = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        // Resolve feeds to try: specific feed > all configured feeds > nuget.org fallback
        var feedUrls = new List<(string url, NugetFeedSourceAuthentication? credentials)>();
        if (!string.IsNullOrEmpty(sourceUrl))
        {
            var creds = !string.IsNullOrEmpty(feedName) ? GetCredentials(feedName) : null;
            feedUrls.Add((sourceUrl, creds));
        }
        else if (!string.IsNullOrEmpty(feedName))
        {
            var feed = _feeds.FirstOrDefault(f =>
                string.Equals(f.Name, feedName, StringComparison.OrdinalIgnoreCase)
            );
            if (feed != null)
                feedUrls.Add((feed.Url, GetCredentials(feed.Name)));
            else
                feedUrls.Add(("https://api.nuget.org/v3/index.json", null));
        }
        else
        {
            // Try all configured feeds, then fall back to nuget.org
            foreach (var feed in _feeds)
                feedUrls.Add((feed.Url, GetCredentials(feed.Name)));
            feedUrls.Add(("https://api.nuget.org/v3/index.json", null));
        }

        foreach (var (id, version) in packages)
        {
            var packageRestored = false;
            var packageErrors = new List<string>();

            foreach (var (url, credentials) in feedUrls)
            {
                var result = await RestorePackageGraphAsync(
                    id,
                    version,
                    url,
                    credentials,
                    restored,
                    results,
                    0,
                    maxDepth,
                    cancellationToken
                );
                if (result.IsSuccess)
                {
                    packageRestored = true;
                    break;
                }

                packageErrors.Add(
                    $"{id} {version} on {url}: {string.Join("; ", result.Errors.Select(e => e.Message))}"
                );
            }

            if (!packageRestored)
            {
                errors.AddRange(packageErrors);
            }
        } // end foreach packages

        if (errors.Count > 0)
        {
            return Result.Fail<string>(
                $"Failed to restore {errors.Count} packages:\n{string.Join("\n", errors)}"
            );
        }

        return Result.Ok($"Restored {results.Count} packages");
    }

    public async Task<Result<IReadOnlyList<NugetPackageSearchResult>>> SearchPackagesAsync(
        string query,
        string? sourceUrl = null,
        string? feedName = null,
        int take = 20,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(query))
        {
            return Result.Ok<IReadOnlyList<NugetPackageSearchResult>>([]);
        }

        try
        {
            var credentials = !string.IsNullOrEmpty(feedName) ? GetCredentials(feedName) : null;
            var source = CreatePackageSource(sourceUrl, credentials);
            var repository = Repository.Factory.GetCoreV3(source);
            var searchResource = await repository.GetResourceAsync<PackageSearchResource>(
                cancellationToken
            );
            var filter = new SearchFilter(includePrerelease: false);
            var metadata = await searchResource.SearchAsync(
                query,
                filter,
                skip: 0,
                take: Math.Clamp(take, 1, 50),
                log: NullLogger.Instance,
                cancellationToken
            );

            var results = metadata
                .Select(package => new NugetPackageSearchResult(
                    package.Identity.Id,
                    package.Identity.Version?.ToNormalizedString() ?? "",
                    package.Description,
                    package.Authors,
                    package.DownloadCount
                ))
                .ToList();

            return Result.Ok<IReadOnlyList<NugetPackageSearchResult>>(results);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Failed to search NuGet packages for {Query}", query);
            return Result.Fail<IReadOnlyList<NugetPackageSearchResult>>(e.Message);
        }
    }

    public async Task<Result<IReadOnlyList<string>>> GetPackageVersionsAsync(
        string packageId,
        string? sourceUrl = null,
        string? feedName = null,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(packageId))
        {
            return Result.Ok<IReadOnlyList<string>>([]);
        }

        try
        {
            var credentials = !string.IsNullOrEmpty(feedName) ? GetCredentials(feedName) : null;
            var source = CreatePackageSource(sourceUrl, credentials);
            var repository = Repository.Factory.GetCoreV3(source);
            var findPackageResource = await repository.GetResourceAsync<FindPackageByIdResource>(
                cancellationToken
            );

            var versions = await findPackageResource.GetAllVersionsAsync(
                packageId,
                new SourceCacheContext(),
                NullLogger.Instance,
                cancellationToken
            );

            var versionStrings = versions
                .OrderByDescending(v => v)
                .Select(v => v.ToNormalizedString())
                .ToList();

            return Result.Ok<IReadOnlyList<string>>(versionStrings);
        }
        catch (Exception e)
        {
            _logger.LogError(e, "Failed to get versions for {PackageId}", packageId);
            return Result.Fail<IReadOnlyList<string>>(e.Message);
        }
    }

    private async Task<Result> RestorePackageGraphAsync(
        string packageId,
        string version,
        string? sourceUrl,
        NugetFeedSourceAuthentication? credentials,
        HashSet<string> restored,
        List<string> restoredPaths,
        int depth,
        int maxDepth,
        CancellationToken cancellationToken
    )
    {
        var packageKey = $"{packageId}/{NuGetVersion.Parse(version).ToNormalizedString()}";
        if (!restored.Add(packageKey))
        {
            return Result.Ok();
        }

        var downloadResult = await DownloadPackageAsync(
            packageId,
            version,
            sourceUrl,
            credentials,
            cancellationToken: cancellationToken
        );
        if (downloadResult.IsFailed)
        {
            return Result.Fail(downloadResult.Errors.Select(e => e.Message));
        }

        restoredPaths.Add(downloadResult.Value);

        var dependenciesResult = ReadDependencies(downloadResult.Value);
        if (dependenciesResult.IsFailed)
        {
            return Result.Fail(dependenciesResult.Errors.Select(e => e.Message));
        }

        // Stop recursing when depth limit reached
        if (depth >= maxDepth)
        {
            return Result.Ok();
        }

        if (dependenciesResult.Value.Count == 0)
        {
            return Result.Ok();
        }

        // Build a list of fallback feeds for dependency resolution.
        // Dependencies may live on different feeds than the parent package.
        var depFeedUrls = new List<(string url, NugetFeedSourceAuthentication? creds)>();
        if (!string.IsNullOrEmpty(sourceUrl))
            depFeedUrls.Add((sourceUrl, credentials));
        // Add all configured feeds (deduplicated against sourceUrl)
        foreach (var feed in _feeds)
        {
            if (
                !string.IsNullOrEmpty(sourceUrl)
                && string.Equals(feed.Url, sourceUrl, StringComparison.OrdinalIgnoreCase)
            )
                continue;
            depFeedUrls.Add((feed.Url, GetCredentials(feed.Name)));
        }
        // Always include nuget.org as last resort
        depFeedUrls.Add(("https://api.nuget.org/v3/index.json", null));

        foreach (var dependency in dependenciesResult.Value)
        {
            var depRestored = false;
            var depErrors = new List<string>();

            foreach (var (depUrl, depCreds) in depFeedUrls)
            {
                var source = CreatePackageSource(depUrl, depCreds);
                var repository = Repository.Factory.GetCoreV3(source);
                var findPackageResource =
                    await repository.GetResourceAsync<FindPackageByIdResource>(cancellationToken);

                var versionResult = await ResolveDependencyVersionAsync(
                    findPackageResource,
                    dependency,
                    cancellationToken
                );
                if (versionResult.IsFailed)
                {
                    depErrors.Add(
                        $"{dependency.Id} on {depUrl}: {string.Join("; ", versionResult.Errors.Select(e => e.Message))}"
                    );
                    continue;
                }

                var restoreResult = await RestorePackageGraphAsync(
                    dependency.Id,
                    versionResult.Value.ToNormalizedString(),
                    depUrl,
                    depCreds,
                    restored,
                    restoredPaths,
                    depth + 1,
                    maxDepth,
                    cancellationToken
                );
                if (restoreResult.IsSuccess)
                {
                    depRestored = true;
                    break;
                }
                depErrors.Add(
                    $"{dependency.Id} on {depUrl}: {string.Join("; ", restoreResult.Errors.Select(e => e.Message))}"
                );
            }

            if (!depRestored)
            {
                return Result.Fail(
                    $"Failed to restore dependency {dependency.Id}: {string.Join("; ", depErrors)}"
                );
            }
        }

        return Result.Ok();
    }

    private static async Task<Result<NuGetVersion>> ResolveDependencyVersionAsync(
        FindPackageByIdResource findPackageResource,
        PackageDependency dependency,
        CancellationToken cancellationToken
    )
    {
        var availableVersions = await findPackageResource.GetAllVersionsAsync(
            dependency.Id,
            new SourceCacheContext(),
            NullLogger.Instance,
            cancellationToken
        );

        var selectedVersion = availableVersions
            .Where(version => dependency.VersionRange.Satisfies(version))
            .OrderByDescending(version => version)
            .FirstOrDefault();

        if (selectedVersion is not null)
        {
            return Result.Ok(selectedVersion);
        }

        if (dependency.VersionRange.MinVersion is not null)
        {
            return Result.Ok(dependency.VersionRange.MinVersion);
        }

        return Result.Fail<NuGetVersion>(
            $"Unable to resolve dependency {dependency.Id} {dependency.VersionRange}."
        );
    }

    private static Result<IReadOnlyList<PackageDependency>> ReadDependencies(string packagePath)
    {
        var nupkgPath = Directory
            .EnumerateFiles(packagePath, "*.nupkg", SearchOption.TopDirectoryOnly)
            .FirstOrDefault();
        if (nupkgPath is null)
        {
            return Result.Ok<IReadOnlyList<PackageDependency>>([]);
        }

        try
        {
            using var packageStream = File.OpenRead(nupkgPath);
            using var reader = new PackageArchiveReader(packageStream);

            var dependencies = reader
                .NuspecReader.GetDependencyGroups()
                .SelectMany(group => group.Packages)
                .GroupBy(dependency => dependency.Id, StringComparer.OrdinalIgnoreCase)
                .Select(group => group.First())
                .ToList();

            return Result.Ok<IReadOnlyList<PackageDependency>>(dependencies);
        }
        catch (Exception ex)
        {
            return Result.Fail<IReadOnlyList<PackageDependency>>(
                $"Failed to read NuGet dependencies from {nupkgPath}: {ex.Message}"
            );
        }
    }

    private static PackageSource CreatePackageSource(
        string? sourceUrl,
        NugetFeedSourceAuthentication? credentials
    )
    {
        var packageSourceUrl = string.IsNullOrEmpty(sourceUrl)
            ? "https://api.nuget.org/v3/index.json"
            : sourceUrl;
        var source = new PackageSource(packageSourceUrl);

        if (credentials is null)
        {
            return source;
        }

        source.Credentials = new PackageSourceCredential(
            source: packageSourceUrl,
            username: credentials.Username,
            passwordText: credentials.Password,
            isPasswordClearText: credentials.IsPasswordClearText,
            validAuthenticationTypesText: "basic"
        );
        source.DisableTLSCertificateValidation = true;

        return source;
    }

    private static string GetNuGetPackagesPath()
    {
        var fromEnv = Environment.GetEnvironmentVariable("NUGET_PACKAGES");
        if (!string.IsNullOrWhiteSpace(fromEnv))
        {
            return fromEnv;
        }

        var userHome = Environment.GetFolderPath(Environment.SpecialFolder.UserProfile);
        return Path.Combine(userHome, ".nuget", "packages");
    }

    private static void ExtractNupkg(string nupkgPath, string targetFolder)
    {
        Directory.CreateDirectory(targetFolder);
        ZipFile.ExtractToDirectory(nupkgPath, targetFolder, overwriteFiles: true);
    }

    private static bool HasInstalledPackageContent(string targetPath, string nupkgPath)
    {
        return File.Exists(nupkgPath)
            || Directory.Exists(Path.Combine(targetPath, "lib"))
            || Directory
                .EnumerateFiles(targetPath, "*.nuspec", SearchOption.TopDirectoryOnly)
                .Any();
    }
}
