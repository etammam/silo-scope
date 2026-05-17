using AwesomeAssertions;
using FluentResults;
using Microsoft.Extensions.Logging;
using Moq;
using Siloscope.Core.Cluster;
using Siloscope.Core.Components.Nuget;
using Siloscope.Core.Components.Workspace;
using Siloscope.Core.Configuration;
using Siloscope.Core.Endpoints;
using Siloscope.Core.Interfaces;
using Xunit;

namespace Siloscope.Test.Core;

public sealed class SiloScopeCommandsTests
{
    private readonly Mock<IOrleansClientConnectorPool> _connectorPoolMock;
    private readonly Mock<IGrainInvocationService> _grainInvocationServiceMock;
    private readonly Mock<IWorkspaceService> _workspaceServiceMock;
    private readonly Mock<ILogger<SiloScopeCommands>> _loggerMock;
    private readonly SiloScopeCommands _commands;

    public SiloScopeCommandsTests()
    {
        _connectorPoolMock = new Mock<IOrleansClientConnectorPool>(MockBehavior.Strict);
        _grainInvocationServiceMock = new Mock<IGrainInvocationService>(MockBehavior.Strict);
        _workspaceServiceMock = new Mock<IWorkspaceService>(MockBehavior.Strict);
        _loggerMock = new Mock<ILogger<SiloScopeCommands>>();

        _commands = new SiloScopeCommands(
            _connectorPoolMock.Object,
            _grainInvocationServiceMock.Object,
            null!,
            _workspaceServiceMock.Object,
            _loggerMock.Object
        );
    }

    [Fact]
    public async Task ConnectClusterAsync_ValidOptions_ReturnsSuccess()
    {
        var options = new ClusterOptions("test-cluster", "test-service", ["127.0.0.1:30000"]);

        _connectorPoolMock
            .Setup(p =>
                p.Configure(It.IsAny<ToolClusterOptions>(), It.IsAny<InterfaceCatalog>(), null)
            )
            .Verifiable();
        _connectorPoolMock
            .Setup(p => p.ConnectAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok("Connected to 1 gateway(s)."));

        var result = await _commands.ConnectClusterAsync(options);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().Be("Connected to 1 gateway(s).");
        _connectorPoolMock.VerifyAll();
    }

    [Fact]
    public async Task ConnectClusterAsync_ConnectionFailure_ReturnsFailureWithErrors()
    {
        var options = new ClusterOptions("test-cluster", "test-service", ["127.0.0.1:30000"]);

        _connectorPoolMock.Setup(p =>
            p.Configure(It.IsAny<ToolClusterOptions>(), It.IsAny<InterfaceCatalog>(), null)
        );
        _connectorPoolMock
            .Setup(p => p.ConnectAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Fail<string>("Connection refused"));

        var result = await _commands.ConnectClusterAsync(options);

        result.IsFailed.Should().BeTrue();
        result.Errors.Should().Contain(e => e.Message.Contains("Connection refused"));
    }

    [Fact]
    public async Task ConnectClusterAsync_MultipleGateways_PassesAllToConnector()
    {
        var options = new ClusterOptions(
            "test-cluster",
            "test-service",
            ["127.0.0.1:30000", "127.0.0.1:30001"]
        );

        ToolClusterOptions? capturedOptions = null;
        _connectorPoolMock
            .Setup(p =>
                p.Configure(It.IsAny<ToolClusterOptions>(), It.IsAny<InterfaceCatalog>(), null)
            )
            .Callback<ToolClusterOptions, InterfaceCatalog, IReadOnlyList<InterfaceEntry>?>(
                (opts, _, _) => capturedOptions = opts
            );
        _connectorPoolMock
            .Setup(p => p.ConnectAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok("Connected to 2 gateway(s)."));

        var result = await _commands.ConnectClusterAsync(options);

        result.IsSuccess.Should().BeTrue();
        capturedOptions.Should().NotBeNull();
        capturedOptions!
            .GatewayEndpoints.Should()
            .BeEquivalentTo(["127.0.0.1:30000", "127.0.0.1:30001"]);
    }

    [Fact]
    public async Task DisconnectClusterAsync_CallsDisconnectOnPool()
    {
        _connectorPoolMock
            .Setup(p => p.DisconnectAllAsync(It.IsAny<CancellationToken>()))
            .Returns(Task.CompletedTask);

        var result = await _commands.DisconnectClusterAsync();

        result.IsSuccess.Should().BeTrue();
        _connectorPoolMock.Verify(
            p => p.DisconnectAllAsync(It.IsAny<CancellationToken>()),
            Times.Once
        );
    }
}
