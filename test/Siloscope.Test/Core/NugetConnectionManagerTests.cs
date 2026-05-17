using AwesomeAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using Siloscope.Core.Components.Nuget;
using Siloscope.Core.Nuget.Models;
using Xunit;

namespace Siloscope.Test.Core;

public sealed class NugetConnectionManagerTests
{
    private readonly Mock<ILogger<NugetConnectionManager>> _loggerMock;
    private readonly NugetConnectionManager _manager;

    public NugetConnectionManagerTests()
    {
        _loggerMock = new Mock<ILogger<NugetConnectionManager>>();
        _manager = new NugetConnectionManager(_loggerMock.Object);
    }

    [Fact]
    public void Get_NonExistingFeed_ReturnsFailure()
    {
        var result = _manager.Get("non-existing");

        result.IsFailed.Should().BeTrue();
    }

    [Fact]
    public async Task CreateAsync_ValidFeed_ReturnsSuccess()
    {
        var feed = new NugetFeedSource(
            "https://api.nuget.org/v3/index.json",
            $"nuget-org-{Guid.NewGuid():N}",
            false,
            null
        );

        var result = await _manager.CreateAsync(feed);

        result
            .IsSuccess.Should()
            .BeTrue(result.Errors.Select(e => e.Message).FirstOrDefault() ?? "");
    }

    [Fact]
    public async Task Get_ExistingFeed_ReturnsFeed()
    {
        var feedName = $"test-feed-{Guid.NewGuid():N}";
        var feed = new NugetFeedSource(
            "https://api.nuget.org/v3/index.json",
            feedName,
            false,
            null
        );
        await _manager.CreateAsync(feed);

        var result = _manager.Get(feedName);

        result.IsSuccess.Should().BeTrue();
        result.Value.Name.Should().Be(feedName);
    }

    [Fact]
    public async Task RestorePackagesAsync_EmptyList_ReturnsSuccess()
    {
        var packages = Array.Empty<(string Id, string Version)>();

        var result = await _manager.RestorePackagesAsync(packages, null, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DownloadPackageAsync_Existing_ReturnsPath()
    {
        var result = await _manager.DownloadPackageAsync(
            "Newtonsoft.Json",
            "13.0.3",
            null,
            CancellationToken.None
        );

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeEmpty();
    }

    [Fact]
    public async Task RestorePackagesAsync_Existing_ReturnsSuccess()
    {
        var packages = new[] { ("Newtonsoft.Json", "13.0.3") };

        var result = await _manager.RestorePackagesAsync(packages, null, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
    }
}
