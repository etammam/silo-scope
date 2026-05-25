using AwesomeAssertions;
using Microsoft.Extensions.Logging;
using Moq;
using NuGet.Frameworks;
using NuGet.Packaging;
using NuGet.Packaging.Core;
using NuGet.Versioning;
using Siloscope.Core.NuGet;
using Siloscope.Core.NuGet.Models;
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

        var result = await _manager.RestorePackagesAsync(
            packages,
            null,
            null,
            CancellationToken.None
        );

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task DownloadPackageAsync_Existing_ReturnsPath()
    {
        var result = await _manager.DownloadPackageAsync(
            "Newtonsoft.Json",
            "13.0.3",
            null,
            null,
            CancellationToken.None
        );

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeEmpty();
    }

    [Fact(Skip = "Requires network access and may fail if the package is not available")]
    public async Task RestorePackagesAsync_Existing_ReturnsSuccess()
    {
        var packages = new[] { ("Newtonsoft.Json", "13.0.3") };

        var result = await _manager.RestorePackagesAsync(
            packages,
            null,
            null,
            CancellationToken.None
        );

        result.IsSuccess.Should().BeTrue();
    }

    [Fact]
    public async Task RestorePackagesAsync_LocalPackage_RestoresTransitiveDependencies()
    {
        var previousPackagesPath = Environment.GetEnvironmentVariable("NUGET_PACKAGES");
        var testRoot = Path.Combine(Path.GetTempPath(), $"siloscope-nuget-{Guid.NewGuid():N}");
        var sourcePath = Path.Combine(testRoot, "source");
        var packagesPath = Path.Combine(testRoot, "packages");
        Directory.CreateDirectory(sourcePath);

        try
        {
            Environment.SetEnvironmentVariable("NUGET_PACKAGES", packagesPath);
            CreateLocalPackage(sourcePath, "SiloScope.Dependency", "2.0.0");
            CreateLocalPackage(
                sourcePath,
                "SiloScope.Root",
                "1.0.0",
                new PackageDependency("SiloScope.Dependency", VersionRange.Parse("[2.0.0]"))
            );

            var result = await _manager.RestorePackagesAsync(
                [("SiloScope.Root", "1.0.0")],
                sourcePath,
                null,
                CancellationToken.None
            );

            result.IsSuccess.Should().BeTrue(result.Errors.FirstOrDefault()?.Message ?? "");
            result.Value.Should().Be("Restored 2 packages");
            File.Exists(
                    Path.Combine(
                        packagesPath,
                        "siloscope.root",
                        "1.0.0",
                        "siloscope.root.1.0.0.nupkg"
                    )
                )
                .Should()
                .BeTrue();
            File.Exists(
                    Path.Combine(
                        packagesPath,
                        "siloscope.dependency",
                        "2.0.0",
                        "siloscope.dependency.2.0.0.nupkg"
                    )
                )
                .Should()
                .BeTrue();
        }
        finally
        {
            Environment.SetEnvironmentVariable("NUGET_PACKAGES", previousPackagesPath);
            if (Directory.Exists(testRoot))
            {
                Directory.Delete(testRoot, recursive: true);
            }
        }
    }

    [Fact]
    public async Task GetCredentials_WithCredentials_ReturnsCredentials()
    {
        var feedName = $"cred-feed-{Guid.NewGuid():N}";
        var feed = new NugetFeedSource(
            "https://api.nuget.org/v3/index.json",
            feedName,
            false,
            new NugetFeedSourceAuthentication("testuser", "testpass", true)
        );
        await _manager.CreateAsync(feed);

        var credentials = _manager.GetCredentials(feedName);

        credentials.Should().NotBeNull();
        credentials!.Username.Should().Be("testuser");
    }

    [Fact]
    public void GetCredentials_NoCredentials_ReturnsNull()
    {
        var credentials = _manager.GetCredentials("non-existing");

        credentials.Should().BeNull();
    }

    [Fact]
    public async Task CreateAsync_WithCredentials_StoresCredentials()
    {
        var feedName = $"auth-feed-{Guid.NewGuid():N}";
        var feed = new NugetFeedSource(
            "https://api.nuget.org/v3/index.json",
            feedName,
            false,
            new NugetFeedSourceAuthentication("admin", "secret123", true)
        );
        await _manager.CreateAsync(feed);

        var result = _manager.Get(feedName);
        result.Value.Username.Should().Be("admin");
    }

    private static void CreateLocalPackage(
        string sourcePath,
        string packageId,
        string version,
        params PackageDependency[] dependencies
    )
    {
        var packageBuilder = new PackageBuilder
        {
            Id = packageId,
            Version = NuGetVersion.Parse(version),
            Description = $"{packageId} test package",
        };
        packageBuilder.Authors.Add("SiloScope");
        var contentPath = Path.Combine(sourcePath, $"{packageId}.{version}.txt");
        File.WriteAllText(contentPath, packageId);
        packageBuilder.Files.Add(
            new PhysicalPackageFile
            {
                SourcePath = contentPath,
                TargetPath = $"content/{packageId}.txt",
            }
        );
        if (dependencies.Length > 0)
        {
            packageBuilder.DependencyGroups.Add(
                new PackageDependencyGroup(NuGetFramework.AnyFramework, dependencies)
            );
        }

        var packagePath = Path.Combine(sourcePath, $"{packageId}.{version}.nupkg");
        using var packageStream = File.Create(packagePath);
        packageBuilder.Save(packageStream);
    }
}
