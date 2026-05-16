using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging;
using NuGet.Configuration;
using NuGet.Protocol;
using NuGet.Protocol.Core.Types;
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
}

internal class NugetConnectionManager : INugetConnectionManager
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

            if (!File.Exists(Path.Combine(location, fileName)))
                File.Create(Path.Combine(location, fileName));

            var fileContent =
                File.ReadAllText(Path.Combine(AppContext.BaseDirectory, folder, fileName))
                ?? JsonSerializer.Serialize<Feed[]>([], _jsonSerializerOptions);

            if (fileContent.Length == 0)
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
}
