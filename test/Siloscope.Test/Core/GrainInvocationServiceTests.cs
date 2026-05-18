using AwesomeAssertions;
using Microsoft.Extensions.Logging.Abstractions;
using Siloscope.Core.Cluster;
using Siloscope.Core.Configuration;
using Siloscope.Core.Interfaces;
using Xunit;

namespace Siloscope.Test.Core;

public sealed class GrainInvocationServiceTests
{
    private static GrainInvocationService CreateService()
    {
        var logger = NullLogger<GrainInvocationService>.Instance;
        var cluster = new ToolClusterOptions("dev", "svc", []);
        var pool = new OrleansClientConnectorPool(cluster, new InterfaceCatalog([], []), []);
        pool.Dispose();
        return new GrainInvocationService(pool, logger);
    }

    [Fact]
    public async Task InvokeAsync_EmptyGrainKey_ReturnsFailure()
    {
        var service = CreateService();

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

        result.IsFailed.Should().BeTrue();
        result.Errors.Should().Contain(e => e.Message == "Grain key is required.");
    }

    [Fact]
    public async Task InvokeAsync_WhenPoolHasNoConnectors_FailsWithNoConnectorMessage()
    {
        var service = CreateService();

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
        result
            .Errors.Should()
            .Contain(e => e.Message.Contains("No connector available for gateway"));
    }

    [Fact]
    public async Task InvokeWithTimingAsync_EmptyGrainKey_ReturnsFailure()
    {
        var service = CreateService();

        var methodInfo = typeof(ITestStringGrain).GetMethod(nameof(ITestStringGrain.Echo))!;
        var grain = new GrainInterfaceDescriptor(
            "Test.StringGrain",
            typeof(ITestStringGrain),
            [new GrainMethodDescriptor("Echo()", methodInfo)],
            Gateway: null
        );

        var result = await service.InvokeWithTimingAsync(
            grain,
            grain.Methods[0],
            string.Empty,
            "{}",
            CancellationToken.None
        );

        result.IsFailed.Should().BeTrue();
        result.Errors.Should().Contain(e => e.Message == "Grain key is required.");
    }

    [Fact]
    public async Task InvokeWithTimingAsync_WhenPoolHasNoConnectors_ReturnsFailure()
    {
        var service = CreateService();

        var methodInfo = typeof(ITestStringGrain).GetMethod(nameof(ITestStringGrain.Echo))!;
        var grain = new GrainInterfaceDescriptor(
            "Test.StringGrain",
            typeof(ITestStringGrain),
            [new GrainMethodDescriptor("Echo()", methodInfo)],
            Gateway: "127.0.0.1:30000"
        );

        var result = await service.InvokeWithTimingAsync(
            grain,
            grain.Methods[0],
            "abc",
            "{}",
            CancellationToken.None
        );

        result.IsFailed.Should().BeTrue();
    }
}
