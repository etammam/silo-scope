using AwesomeAssertions;
using Siloscope.Core.Cluster;
using Siloscope.Core.Configuration;
using Siloscope.Core.Interfaces;
using Xunit;

namespace Siloscope.Test.Core;

public sealed class OrleansClientConnectorPoolTests
{
    [Fact]
    public void Constructor_UsesCatalogGatewaysAndAllowsFallbackLookup()
    {
        var cluster = new ToolClusterOptions("dev", "svc", []);
        var catalog = new InterfaceCatalog(
            [
                new GrainInterfaceDescriptor("g1", typeof(ITestStringGrain), [], "127.0.0.1:30000"),
                new GrainInterfaceDescriptor("g2", typeof(ITestGuidGrain), [], "127.0.0.1:30001"),
            ],
            ["/tmp/a.dll", "/tmp/b.dll"]
        );
        var entries = new List<InterfaceEntry>
        {
            new("127.0.0.1:30000", InterfaceSourceType.Dll, "/tmp/a.dll", null, null, null, null),
            new("127.0.0.1:30001", InterfaceSourceType.Dll, "/tmp/b.dll", null, null, null, null),
        };

        using var pool = new OrleansClientConnectorPool(cluster, catalog, entries);

        pool.Connectors.Keys.Should().BeEquivalentTo(["127.0.0.1:30000", "127.0.0.1:30001"]);
        pool.IsConnected.Should().BeFalse();

        pool.TryGetConnectorForGateway("127.0.0.1:30000", out var byGateway).Should().BeTrue();
        byGateway.Should().NotBeNull();

        pool.TryGetConnectorForGateway("unknown:9999", out var fallback).Should().BeTrue();
        fallback.Should().NotBeNull();
    }

    [Fact]
    public void Constructor_WithoutCatalogGateways_CreatesLocalhostFallback()
    {
        var cluster = new ToolClusterOptions("dev", "svc", []);
        var catalog = new InterfaceCatalog([], []);

        using var pool = new OrleansClientConnectorPool(cluster, catalog, []);

        pool.Connectors.Keys.Should().ContainSingle().Which.Should().Be("localhost");
    }

    [Fact]
    public void Configure_ReplacesExistingConnectors()
    {
        using var pool = new OrleansClientConnectorPool(
            new ToolClusterOptions("dev", "svc", []),
            new InterfaceCatalog(
                [
                    new GrainInterfaceDescriptor(
                        "g1",
                        typeof(ITestStringGrain),
                        [],
                        "127.0.0.1:30000"
                    ),
                ],
                []
            ),
            []
        );

        pool.Configure(
            new ToolClusterOptions("dev", "svc", []),
            new InterfaceCatalog(
                [new GrainInterfaceDescriptor("g2", typeof(ITestGuidGrain), [], "127.0.0.1:30001")],
                []
            ),
            []
        );

        pool.Connectors.Keys.Should().ContainSingle().Which.Should().Be("127.0.0.1:30001");
    }
}
