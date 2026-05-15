using AwesomeAssertions;
using Siloscope.Core.Cluster;
using Siloscope.Core.Configuration;
using Siloscope.Core.Interfaces;
using Xunit;

namespace Siloscope.Test.Core;

public sealed class GrainInvocationServiceTests
{
    [Fact]
    public async Task InvokeAsync_EmptyGrainKey_FailsEarly()
    {
        var cluster = new ToolClusterOptions("dev", "svc", []);
        using var pool = new OrleansClientConnectorPool(cluster, new InterfaceCatalog([], []), []);
        var service = new GrainInvocationService(pool);

        var methodInfo = typeof(ITestStringGrain).GetMethod(nameof(ITestStringGrain.Echo))!;
        var grain = new GrainInterfaceDescriptor(
            "Test.StringGrain",
            typeof(ITestStringGrain),
            [new GrainMethodDescriptor("Echo()", methodInfo)],
            Gateway: null
        );

        var result = await service.InvokeAsync(
            grain,
            grain.Methods[0],
            string.Empty,
            "{}",
            CancellationToken.None
        );

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Be("Grain key is required.");
    }

    [Fact]
    public async Task InvokeAsync_WhenPoolHasNoConnectors_FailsWithNoConnectorMessage()
    {
        var cluster = new ToolClusterOptions("dev", "svc", []);
        var pool = new OrleansClientConnectorPool(cluster, new InterfaceCatalog([], []), []);
        pool.Dispose();

        var service = new GrainInvocationService(pool);

        var methodInfo = typeof(ITestStringGrain).GetMethod(nameof(ITestStringGrain.Echo))!;
        var grain = new GrainInterfaceDescriptor(
            "Test.StringGrain",
            typeof(ITestStringGrain),
            [new GrainMethodDescriptor("Echo()", methodInfo)],
            Gateway: "127.0.0.1:30000"
        );

        var result = await service.InvokeAsync(
            grain,
            grain.Methods[0],
            "abc",
            "{}",
            CancellationToken.None
        );

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Contain("No connector available for gateway");
    }
}
