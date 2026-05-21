using AwesomeAssertions;
using Siloscope.Core.Catalog;
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
}
