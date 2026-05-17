using System.IO.Compression;
using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging;
using NuGet.Common;
using NuGet.Configuration;
using NuGet.Packaging;
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

    Task<Result<string>> DownloadPackageAsync(
        string packageId,
        string version,
        string? sourceUrl = null,
        CancellationToken cancellationToken = default
    );

    Task<Result<string>> RestorePackagesAsync(
        IEnumerable<(string Id, string Version)> packages,
        string? sourceUrl = null,
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

            var source = new PackageSource(packageSourceUrl);
            var provider = Repository.Factory.GetCoreV3(source);

            var findPackageResource = await provider.GetResourceAsync<FindPackageByIdResource>(
                cancellationToken
            );
            var packageVersion = NuGetVersion.Parse(version);

            var nugetPackagesPath = GetNuGetPackagesPath();
            var targetPath = Path.Combine(nugetPackagesPath, packageId.ToLowerInvariant(), version);

            if (Directory.Exists(targetPath))
            {
                _logger.LogInformation("Package already exists at {Path}", targetPath);
                return Result.Ok(targetPath);
            }

            Directory.CreateDirectory(targetPath);

            var nupkgPath = Path.Combine(targetPath, $"{packageId}.{version}.nupkg");
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

            var extractionFolder = Path.Combine(targetPath, "extracted");
            ExtractNupkg(nupkgPath, extractionFolder);

            _logger.LogInformation("Package extracted to {Path}", extractionFolder);
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
        CancellationToken cancellationToken = default
    )
    {
        var results = new List<string>();
        var errors = new List<string>();

        foreach (var (id, version) in packages)
        {
            var result = await DownloadPackageAsync(id, version, sourceUrl, cancellationToken);
            if (result.IsSuccess)
            {
                results.Add(result.Value);
            }
            else
            {
                errors.Add($"{id} {version}: {result.Errors.FirstOrDefault()?.Message}");
            }
        }

        if (errors.Count > 0)
        {
            return Result.Fail<string>(
                $"Failed to restore {errors.Count} packages:\n{string.Join("\n", errors)}"
            );
        }

        return Result.Ok($"Restored {results.Count} packages");
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
}
