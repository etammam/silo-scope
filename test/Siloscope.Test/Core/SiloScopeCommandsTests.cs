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
    private readonly InterfaceCatalogLoader _catalogLoader;
    private readonly Mock<IWorkspaceService> _workspaceServiceMock;
    private readonly Mock<INugetConnectionManager> _nugetManagerMock;
    private readonly Mock<ILogger<SiloScopeCommands>> _loggerMock;
    private readonly SiloScopeCommands _commands;

    public SiloScopeCommandsTests()
    {
        _connectorPoolMock = new Mock<IOrleansClientConnectorPool>(MockBehavior.Strict);
        _grainInvocationServiceMock = new Mock<IGrainInvocationService>(MockBehavior.Strict);
        _catalogLoader = new InterfaceCatalogLoader();
        _workspaceServiceMock = new Mock<IWorkspaceService>(MockBehavior.Strict);
        _nugetManagerMock = new Mock<INugetConnectionManager>(MockBehavior.Strict);
        _loggerMock = new Mock<ILogger<SiloScopeCommands>>();

        _commands = new SiloScopeCommands(
            _connectorPoolMock.Object,
            _grainInvocationServiceMock.Object,
            _catalogLoader,
            _workspaceServiceMock.Object,
            _nugetManagerMock.Object,
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

    [Fact]
    public async Task DiscoverGrainsAsync_NoWorkspace_LoadsDefaultWorkspace()
    {
        var workspace = CreateTestWorkspace();
        _workspaceServiceMock.Setup(s => s.GetDefaultWorkspacePath()).Returns("/test/path");
        _workspaceServiceMock.Setup(s => s.LoadAsync(It.IsAny<string>())).ReturnsAsync(workspace);

        var result = await _commands.DiscoverGrainsAsync();

        result.IsSuccess.Should().BeTrue();
        result.Value.Grains.Should().BeEmpty();
        _workspaceServiceMock.Verify(s => s.GetDefaultWorkspacePath(), Times.Once);
    }

    [Fact]
    public async Task DiscoverGrainsAsync_WithNoEnabledSilos_ReturnsEmptyCatalog()
    {
        SetWorkspace(new Workspace { Id = "test", Silos = [] });

        var result = await _commands.DiscoverGrainsAsync();

        result.IsSuccess.Should().BeTrue();
        result.Value.Grains.Should().BeEmpty();
        result.Value.AssemblyPaths.Should().BeEmpty();
    }

    [Fact]
    public async Task DiscoverSourceCatalogAsync_ReturnsFunctionsUnderParentSources()
    {
        var methodInfo = typeof(ITestStringGrain).GetMethod("Echo")!;
        var sourceId = "DLL:/tmp/Core.dll::127.0.0.1:30000";
        SetWorkspace(
            new Workspace
            {
                Id = "test",
                Silos =
                [
                    new Siloscope.Core.Components.Workspace.SiloSource
                    {
                        Reference = "/tmp/Core.dll",
                        Source = "DLL",
                        Gateway = "127.0.0.1:30000",
                        Enabled = true,
                    },
                    new Siloscope.Core.Components.Workspace.SiloSource
                    {
                        Reference = "Contracts",
                        Source = "nuget",
                        Version = "1.2.3",
                        Enabled = false,
                    },
                ],
            }
        );
        SetCatalog(
            new InterfaceCatalog(
                [
                    new GrainInterfaceDescriptor(
                        typeof(ITestStringGrain).FullName!,
                        typeof(ITestStringGrain),
                        [new GrainMethodDescriptor("Task<String> Echo()", methodInfo)],
                        "127.0.0.1:30000",
                        sourceId
                    ),
                ],
                ["/tmp/Core.dll"],
                [
                    new InterfaceSourceDescriptor(
                        sourceId,
                        "DLL",
                        "/tmp/Core.dll",
                        "Core.dll",
                        null,
                        "127.0.0.1:30000",
                        true,
                        "/tmp/Core.dll"
                    ),
                ]
            )
        );

        var result = await _commands.DiscoverSourceCatalogAsync();

        result.IsSuccess.Should().BeTrue();
        result.Value.Sources.Should().HaveCount(2);
        var dllSource = result.Value.Sources[0];
        dllSource.SourceId.Should().Be(sourceId);
        dllSource.Label.Should().Be("Core.dll");
        dllSource.DiscoveryStatus.Should().Be("ready");
        dllSource.Interfaces.Should().ContainSingle();
        dllSource.Interfaces[0].Methods.Should().ContainSingle();
        dllSource.Interfaces[0].Methods[0].SourceId.Should().Be(sourceId);
        dllSource.Interfaces[0].Methods[0].MethodName.Should().Be("Echo");
        dllSource.Interfaces[0].Methods[0].KeyType.Should().Be("String");

        var disabledNugetSource = result.Value.Sources[1];
        disabledNugetSource.Enabled.Should().BeFalse();
        disabledNugetSource.DiscoveryStatus.Should().Be("idle");
        disabledNugetSource.Interfaces.Should().BeEmpty();
    }

    [Fact]
    public async Task DiscoverSourceCatalogAsync_PreservesDuplicateMethodsBySource()
    {
        var methodInfo = typeof(ITestStringGrain).GetMethod("Echo")!;
        var coreSourceId = "DLL:/tmp/Core.dll::127.0.0.1:30000";
        var tenantSourceId = "NuGet:Contracts:1.2.3:";
        SetWorkspace(
            new Workspace
            {
                Id = "test",
                Silos =
                [
                    new Siloscope.Core.Components.Workspace.SiloSource
                    {
                        Reference = "/tmp/Core.dll",
                        Source = "DLL",
                        Gateway = "127.0.0.1:30000",
                        Enabled = true,
                    },
                    new Siloscope.Core.Components.Workspace.SiloSource
                    {
                        Reference = "Contracts",
                        Source = "nuget",
                        Version = "1.2.3",
                        Enabled = true,
                    },
                ],
            }
        );
        SetCatalog(
            new InterfaceCatalog(
                [
                    new GrainInterfaceDescriptor(
                        "Duplicate",
                        typeof(ITestStringGrain),
                        [new GrainMethodDescriptor("Task<String> Echo()", methodInfo)],
                        "127.0.0.1:30000",
                        coreSourceId
                    ),
                    new GrainInterfaceDescriptor(
                        "Duplicate",
                        typeof(ITestStringGrain),
                        [new GrainMethodDescriptor("Task<String> Echo()", methodInfo)],
                        null,
                        tenantSourceId
                    ),
                ],
                ["/tmp/Core.dll", "/tmp/Contracts.dll"],
                [
                    new InterfaceSourceDescriptor(
                        coreSourceId,
                        "DLL",
                        "/tmp/Core.dll",
                        "Core.dll",
                        null,
                        "127.0.0.1:30000",
                        true,
                        "/tmp/Core.dll"
                    ),
                    new InterfaceSourceDescriptor(
                        tenantSourceId,
                        "NuGet",
                        "Contracts",
                        "Contracts 1.2.3",
                        "1.2.3",
                        null,
                        true,
                        "/tmp/Contracts.dll"
                    ),
                ]
            )
        );

        var result = await _commands.DiscoverSourceCatalogAsync();

        result.IsSuccess.Should().BeTrue();
        var functionIds = result
            .Value.Sources.SelectMany(source => source.Interfaces)
            .SelectMany(catalogInterface => catalogInterface.Methods)
            .Select(method => method.FunctionId)
            .ToList();

        functionIds.Should().HaveCount(2);
        functionIds.Should().OnlyHaveUniqueItems();
        functionIds.Should().Contain(id => id.StartsWith(coreSourceId, StringComparison.Ordinal));
        functionIds.Should().Contain(id => id.StartsWith(tenantSourceId, StringComparison.Ordinal));
    }

    [Fact]
    public async Task InvokeGrainAsync_NoCatalog_ReturnsFailure()
    {
        var result = await _commands.InvokeGrainAsync("TestGrain", "DoSomething", "key123", "{}");

        result.IsFailed.Should().BeTrue();
        result.Errors.Should().Contain(e => e.Message.Contains("No grain catalog available"));
    }

    [Fact]
    public async Task InvokeGrainAsync_GrainNotFound_ReturnsFailure()
    {
        SetCatalog(new InterfaceCatalog([], []));

        var result = await _commands.InvokeGrainAsync("TestGrain", "DoSomething", "key123", "{}");

        result.IsFailed.Should().BeTrue();
        result.Errors.Should().Contain(e => e.Message.Contains("not found in catalog"));
    }

    [Fact]
    public async Task InvokeGrainAsync_Success_ReturnsResult()
    {
        var methodInfo = typeof(ITestStringGrain).GetMethod("Echo")!;
        var catalog = new InterfaceCatalog(
            [
                new GrainInterfaceDescriptor(
                    "TestGrain",
                    typeof(ITestStringGrain),
                    [new GrainMethodDescriptor("string Echo()", methodInfo)],
                    "localhost:30000"
                ),
            ],
            ["/test/path.dll"]
        );
        SetCatalog(catalog);

        _grainInvocationServiceMock
            .Setup(s =>
                s.InvokeWithTimingAsync(
                    It.IsAny<GrainInterfaceDescriptor>(),
                    It.IsAny<GrainMethodDescriptor>(),
                    It.IsAny<string>(),
                    It.IsAny<string>(),
                    It.IsAny<CancellationToken>()
                )
            )
            .ReturnsAsync(
                Result.Ok(("{\"result\": \"success\"}", new InvocationTiming(1, 10, 15)))
            );

        var result = await _commands.InvokeGrainAsync("TestGrain", "Echo", "key123", "{}");

        result.IsSuccess.Should().BeTrue();
        result.Value.IsSuccess.Should().BeTrue();
        result.Value.Result.Should().Be("{\"result\": \"success\"}");
        result.Value.Timing.Should().NotBeNull();
        result.Value.Timing.SerializationMs.Should().Be(1);
        result.Value.Timing.ExecutionMs.Should().Be(10);
        result.Value.Timing.TotalMs.Should().Be(15);
    }

    private void SetWorkspace(Workspace workspace)
    {
        var field = typeof(SiloScopeCommands).GetField(
            "_currentWorkspace",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance
        );
        field?.SetValue(_commands, workspace);
    }

    private void SetCatalog(InterfaceCatalog catalog)
    {
        var field = typeof(SiloScopeCommands).GetField(
            "_catalog",
            System.Reflection.BindingFlags.NonPublic | System.Reflection.BindingFlags.Instance
        );
        field?.SetValue(_commands, catalog);
    }

    private static Workspace CreateTestWorkspace()
    {
        return new Workspace
        {
            Id = "test-workspace",
            WorkspaceInfo = new Siloscope.Core.Components.Workspace.WorkspaceInfo
            {
                Name = "Test",
                Description = "Test workspace",
            },
            Cluster = new ClusterConfig
            {
                ClusterId = "cluster",
                ServiceId = "service",
                DefaultGateway = "localhost:30000",
            },
            Silos = [],
            Environments = [],
            Session = new SessionConfig { ActiveEnvironment = "default" },
        };
    }

    [Fact]
    public async Task RestorePackagesAsync_NoNugetSilos_ReturnsEmptyResult()
    {
        var silos = new Siloscope.Core.Endpoints.SiloSource[]
        {
            new("test.dll", "DLL", null, null, true),
        };

        var result = await _commands.RestorePackagesAsync(silos, null, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.RestoredCount.Should().Be(0);
    }

    [Fact]
    public async Task RestorePackagesAsync_WithNugetSilos_RestoresPackages()
    {
        var silos = new Siloscope.Core.Endpoints.SiloSource[]
        {
            new("Newtonsoft.Json", "nuget", "13.0.3", null, true),
        };

        _nugetManagerMock
            .Setup(m =>
                m.RestorePackagesAsync(
                    It.IsAny<IEnumerable<(string Id, string Version)>>(),
                    null,
                    null,
                    It.IsAny<CancellationToken>()
                )
            )
            .ReturnsAsync(Result.Ok("Restored 1 packages"));

        var result = await _commands.RestorePackagesAsync(silos, null, CancellationToken.None);

        result.IsSuccess.Should().BeTrue();
        result.Value.RestoredCount.Should().Be(1);
    }

    [Fact]
    public async Task RestorePackagesAsync_FailedDownload_TracksFailure()
    {
        var silos = new Siloscope.Core.Endpoints.SiloSource[]
        {
            new("NonExistent", "nuget", "1.0.0", null, true),
        };

        _nugetManagerMock
            .Setup(m =>
                m.RestorePackagesAsync(
                    It.IsAny<IEnumerable<(string Id, string Version)>>(),
                    null,
                    null,
                    It.IsAny<CancellationToken>()
                )
            )
            .ReturnsAsync(Result.Fail<string>("Package not found"));

        var result = await _commands.RestorePackagesAsync(silos, null, CancellationToken.None);

        result.IsFailed.Should().BeTrue();
    }
}
