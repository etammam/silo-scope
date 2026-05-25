using AwesomeAssertions;
using FluentResults;
using Moq;
using Siloscope.Core.Catalog;
using Siloscope.Core.Configuration;
using Siloscope.Core.NuGet;
using Xunit;

namespace Siloscope.Test.Core;

public interface ITestStringGrain : IGrainWithStringKey
{
    Task<string> Echo();
}

public interface ITestGuidGrain : IGrainWithGuidKey
{
    Task<string> Echo();
}

public sealed class InterfaceCatalogTests
{
    [Fact]
    public void Gateways_ReturnDistinctNonNullValues()
    {
        var catalog = new InterfaceCatalog(
            [
                new GrainInterfaceDescriptor("g1", typeof(ITestGuidGrain), [], "127.0.0.1:30000"),
                new GrainInterfaceDescriptor("g2", typeof(ITestStringGrain), [], "127.0.0.1:30000"),
                new GrainInterfaceDescriptor("g3", typeof(ITestStringGrain), [], "127.0.0.1:30001"),
                new GrainInterfaceDescriptor("g4", typeof(ITestStringGrain), [], null),
            ],
            []
        );

        catalog.Gateways.Should().BeEquivalentTo(["127.0.0.1:30000", "127.0.0.1:30001"]);
    }

    [Fact]
    public void Load_NuGetSourceMissingLocally_RestoresPackageBeforeResolvingDll()
    {
        var packageRoot = Path.Combine(Path.GetTempPath(), $"siloscope-test-{Guid.NewGuid():N}");
        var previousNugetPackages = Environment.GetEnvironmentVariable("NUGET_PACKAGES");
        Environment.SetEnvironmentVariable("NUGET_PACKAGES", packageRoot);

        try
        {
            var nugetManager = new Mock<INugetConnectionManager>(MockBehavior.Strict);
            nugetManager
                .Setup(manager =>
                    manager.RestorePackagesAsync(
                        It.Is<IEnumerable<(string Id, string Version)>>(packages =>
                            packages.Single().Id == "Contracts"
                            && packages.Single().Version == "1.2.3"
                        ),
                        null,
                        "private",
                        default
                    )
                )
                .Callback(() =>
                    Directory.CreateDirectory(Path.Combine(packageRoot, "contracts", "1.2.3"))
                )
                .ReturnsAsync(Result.Ok("Restored 1 packages"));

            var loader = new InterfaceCatalogLoader(nugetManager: nugetManager.Object);
            var result = loader.Load(
                new InterfaceSourceOptions(
                    InterfaceSourceType.NuGet,
                    null,
                    "Contracts",
                    "1.2.3",
                    null,
                    null,
                    "private"
                )
            );

            result.IsFailed.Should().BeTrue();
            result
                .Errors.Should()
                .Contain(error =>
                    error.Message.Contains("Could not find a DLL", StringComparison.Ordinal)
                );
            nugetManager.VerifyAll();
        }
        finally
        {
            Environment.SetEnvironmentVariable("NUGET_PACKAGES", previousNugetPackages);
            if (Directory.Exists(packageRoot))
            {
                Directory.Delete(packageRoot, recursive: true);
            }
        }
    }
}
