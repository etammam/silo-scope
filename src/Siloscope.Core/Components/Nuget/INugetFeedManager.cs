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
using Siloscope.Core.Nuget.Models;
using Siloscope.Core.Nuget.Store;

namespace Siloscope.Core.Components.Nuget;

public interface INugetConnectionManager
{
    ValueTask<Result> CreateAsync(
        NugetFeedSource feed,
        CancellationToken cancellationToken = default
    );

    Result<Feed> Get(string name);
    ValueTask<Result<Feed>> UpdateAsync(Feed feed, CancellationToken cancellationToken = default);
    ValueTask<Result> DeleteAsync(Feed feed, CancellationToken cancellationToken = default);

    NugetFeedSourceAuthentication? GetCredentials(string feedName);

    Task<Result<string>> DownloadPackageAsync(
        string packageId,
        string version,
        string? sourceUrl = null,
        NugetFeedSourceAuthentication? credentials = null,
        CancellationToken cancellationToken = default
    );

    Task<Result<string>> RestorePackagesAsync(
        IEnumerable<(string Id, string Version)> packages,
        string? sourceUrl = null,
        string? feedName = null,
        CancellationToken cancellationToken = default
    );
}

public class NugetConnectionManager : INugetConnectionManager
{
    private readonly List<Feed> _feeds = new List<Feed>();
    private readonly string _sourcePath;
    private readonly ILogger<NugetConnectionManager> _logger;
    private static JsonSerializerOptions _jsonSerializerOptions = new JsonSerializerOptions()
    {
        WriteIndented = true,
    };

    public NugetConnectionManager(ILogger<NugetConnectionManager> logger)
    {
        Init("app-data", "feeds.json");
        _sourcePath = Path.Combine(AppContext.BaseDirectory, "app-data", "feeds.json");
        _logger = logger;
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
                new Feed()
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
            if (feed.Credentials != null)
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

    private void Init(string folder, string fileName)
    {
        try
        {
            var location = Path.Combine(AppContext.BaseDirectory, folder);
            if (!Directory.Exists(location))
                Directory.CreateDirectory(location);

            var filePath = Path.Combine(location, fileName);
            if (!File.Exists(filePath))
            {
                using var _ = File.Create(filePath);
            }

            var fileContent = File.ReadAllText(filePath);

            if (string.IsNullOrEmpty(fileContent))
                fileContent = JsonSerializer.Serialize<Feed[]>([], _jsonSerializerOptions);

            var content = JsonSerializer.Deserialize<List<Feed>>(
                fileContent,
                _jsonSerializerOptions
            )!;

            _feeds.AddRange(content);
        }
        catch (Exception)
        {
            throw;
        }
    }

    private async Task WriteAsync(CancellationToken cancellationToken = default)
    {
        await File.WriteAllTextAsync(
            _sourcePath,
            JsonSerializer.Serialize(_feeds, _jsonSerializerOptions),
            cancellationToken
        );
    }

    public Result<Feed> Get(string name)
    {
        try
        {
            var feed = _feeds.FirstOrDefault(f => f.Name == name);
            if (feed != null)
                return Result.Ok(feed);

            return Result.Fail(new Error("feed not exists"));
        }
        catch (Exception e)
        {
            return Result.Fail(new Error(e.Message));
        }
    }

    public NugetFeedSourceAuthentication? GetCredentials(string feedName)
    {
        var feed = _feeds.FirstOrDefault(f => f.Name == feedName);
        if (feed == null || string.IsNullOrEmpty(feed.Username))
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
            if (!_feeds.Contains(feed))
                return Result.Fail(new Error("Feed not found."));

            _feeds.Remove(feed);
            _feeds.Add(feed);
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
            if (!_feeds.Contains(feed))
                return Result.Fail(new Error("Feed not found."));

            _feeds.Remove(feed);
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
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var packageSourceUrl = string.IsNullOrEmpty(sourceUrl)
                ? "https://api.nuget.org/v3/index.json"
                : sourceUrl;

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
                _logger.LogInformation("Package already exists at {Path}", targetPath);
                return Result.Ok(targetPath);
            }

            Directory.CreateDirectory(targetPath);

            var fileStream = new FileStream(
                nupkgPath,
                FileMode.Create,
                FileAccess.Write,
                FileShare.None
            );

            try
            {
                await findPackageResource.CopyNupkgToStreamAsync(
                    packageId,
                    packageVersion,
                    fileStream,
                    new SourceCacheContext(),
                    NullLogger.Instance,
                    cancellationToken
                );
            }
            finally
            {
                await fileStream.DisposeAsync();
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
        CancellationToken cancellationToken = default
    )
    {
        var results = new List<string>();
        var errors = new List<string>();
        var restored = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var credentials = !string.IsNullOrEmpty(feedName) ? GetCredentials(feedName) : null;

        foreach (var (id, version) in packages)
        {
            var result = await RestorePackageGraphAsync(
                id,
                version,
                sourceUrl,
                credentials,
                restored,
                results,
                cancellationToken
            );
            if (result.IsSuccess)
            {
                continue;
            }

            errors.Add($"{id} {version}: {result.Errors.FirstOrDefault()?.Message}");
        }

        if (errors.Count > 0)
        {
            return Result.Fail<string>(
                $"Failed to restore {errors.Count} packages:\n{string.Join("\n", errors)}"
            );
        }

        return Result.Ok($"Restored {results.Count} packages");
    }

    private async Task<Result> RestorePackageGraphAsync(
        string packageId,
        string version,
        string? sourceUrl,
        NugetFeedSourceAuthentication? credentials,
        HashSet<string> restored,
        List<string> restoredPaths,
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
            cancellationToken
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

        if (dependenciesResult.Value.Count == 0)
        {
            return Result.Ok();
        }

        var source = CreatePackageSource(sourceUrl, credentials);
        var repository = Repository.Factory.GetCoreV3(source);
        var findPackageResource = await repository.GetResourceAsync<FindPackageByIdResource>(
            cancellationToken
        );

        foreach (var dependency in dependenciesResult.Value)
        {
            var versionResult = await ResolveDependencyVersionAsync(
                findPackageResource,
                dependency,
                cancellationToken
            );
            if (versionResult.IsFailed)
            {
                return Result.Fail(versionResult.Errors.Select(e => e.Message));
            }

            var restoreResult = await RestorePackageGraphAsync(
                dependency.Id,
                versionResult.Value.ToNormalizedString(),
                sourceUrl,
                credentials,
                restored,
                restoredPaths,
                cancellationToken
            );
            if (restoreResult.IsFailed)
            {
                return restoreResult;
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
