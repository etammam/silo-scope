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
using Siloscope.Core.Nuget.Models;
using Siloscope.Core.Nuget.Store;
using Xunit;

namespace Siloscope.Test.Core;

public interface ITokenAwareGrain : IGrainWithStringKey
{
    Task<string> GetAsync(string tenantId, CancellationToken cancellationToken);
}

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
    public async Task ConnectClusterAsync_WithWorkspaceSources_ConfiguresDiscoveredGatewayConnectors()
    {
        var assemblyPath = typeof(ITestStringGrain).Assembly.Location;
        SetWorkspace(
            new Workspace
            {
                Id = "workspace-1",
                Silos =
                [
                    new Siloscope.Core.Components.Workspace.SiloSource
                    {
                        Reference = assemblyPath,
                        Source = "DLL",
                        Gateway = "127.0.0.1:30000",
                        Enabled = true,
                    },
                ],
            }
        );

        InterfaceCatalog? capturedCatalog = null;
        IReadOnlyList<InterfaceEntry>? capturedEntries = null;
        _connectorPoolMock
            .Setup(p =>
                p.Configure(
                    It.IsAny<ToolClusterOptions>(),
                    It.IsAny<InterfaceCatalog>(),
                    It.IsAny<IReadOnlyList<InterfaceEntry>?>()
                )
            )
            .Callback<ToolClusterOptions, InterfaceCatalog, IReadOnlyList<InterfaceEntry>?>(
                (_, catalog, entries) =>
                {
                    capturedCatalog = catalog;
                    capturedEntries = entries;
                }
            );
        _connectorPoolMock
            .Setup(p => p.ConnectAllAsync(It.IsAny<CancellationToken>()))
            .ReturnsAsync(Result.Ok("Connected to 1 gateway(s)."));

        var result = await _commands.ConnectClusterAsync(
            new ClusterOptions("test-cluster", "test-service", ["127.0.0.1:30000"])
        );

        result.IsSuccess.Should().BeTrue();
        capturedCatalog.Should().NotBeNull();
        capturedCatalog!.Gateways.Should().Contain("127.0.0.1:30000");
        capturedEntries.Should().ContainSingle(entry => entry.Gateway == "127.0.0.1:30000");
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
    public async Task SetWorkspaceAsync_StoresActiveWorkspaceForDiscovery()
    {
        var workspace = new Siloscope.Core.Endpoints.WorkspaceInfo(
            "workspace-1",
            "Local",
            "Local dev workspace",
            new ClusterOptions("dev", "SiloScope", ["127.0.0.1:30000"]),
            [new Siloscope.Core.Endpoints.SiloSource("missing.dll", "DLL", null, null, false)],
            new Dictionary<string, string> { ["ASPNETCORE_ENVIRONMENT"] = "Development" }
        );

        var setResult = await _commands.SetWorkspaceAsync(workspace);
        var discoverResult = await _commands.DiscoverSourceCatalogAsync();

        setResult.IsSuccess.Should().BeTrue();
        setResult.Value.Cluster.GatewayEndpoints.Should().ContainSingle("127.0.0.1:30000");
        setResult.Value.Silos.Should().ContainSingle(source => source.Reference == "missing.dll");
        discoverResult.IsSuccess.Should().BeTrue();
        discoverResult
            .Value.Sources.Should()
            .ContainSingle(source => source.Reference == "missing.dll" && source.Enabled == false);
    }

    [Fact]
    public async Task ListWorkspacesAsync_ReturnsPersistedWorkspaceSummaries()
    {
        var workspace = CreateTestWorkspace();
        workspace.Id = "workspace-1";
        workspace.WorkspaceInfo.Name = "Actors Workspace";
        _workspaceServiceMock.Setup(service => service.ListAsync()).ReturnsAsync([workspace]);

        var result = await _commands.ListWorkspacesAsync();

        result.IsSuccess.Should().BeTrue();
        result
            .Value.Should()
            .ContainSingle(summary =>
                summary.Id == "workspace-1" && summary.Name == "Actors Workspace"
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

    [Fact]
    public async Task InvokeGrainAsync_WithFunctionId_ResolvesSourceOwnedGrain()
    {
        var methodInfo = typeof(ITestStringGrain).GetMethod("Echo")!;
        var sourceId = "NuGet:Contracts:1.2.3:";
        var signature = "string Echo()";
        var functionId = $"{sourceId}:{typeof(ITestStringGrain).FullName}:{signature}";
        var catalog = new InterfaceCatalog(
            [
                new GrainInterfaceDescriptor(
                    typeof(ITestStringGrain).FullName!,
                    typeof(ITestStringGrain),
                    [new GrainMethodDescriptor(signature, methodInfo)],
                    "localhost:30000",
                    sourceId
                ),
            ],
            ["/test/path.dll"]
        );
        SetCatalog(catalog);

        GrainInterfaceDescriptor? invokedGrain = null;
        _grainInvocationServiceMock
            .Setup(s =>
                s.InvokeWithTimingAsync(
                    It.IsAny<GrainInterfaceDescriptor>(),
                    It.IsAny<GrainMethodDescriptor>(),
                    "key123",
                    "{}",
                    It.IsAny<CancellationToken>()
                )
            )
            .Callback<
                GrainInterfaceDescriptor,
                GrainMethodDescriptor,
                string,
                string?,
                CancellationToken
            >((grain, _, _, _, _) => invokedGrain = grain)
            .ReturnsAsync(
                Result.Ok(("{\"result\": \"success\"}", new InvocationTiming(1, 10, 15)))
            );

        var result = await _commands.InvokeGrainAsync(
            "ITestStringGrain",
            "Echo",
            "key123",
            "{}",
            sourceId,
            functionId
        );

        result.IsSuccess.Should().BeTrue();
        invokedGrain.Should().NotBeNull();
        invokedGrain!.Name.Should().Be(typeof(ITestStringGrain).FullName);
    }

    [Fact]
    public async Task DiscoverSourceCatalogAsync_OmitsCancellationTokenParameters()
    {
        var sourceId = "DLL:Contracts.dll::";
        SetWorkspace(
            new Workspace
            {
                Id = "test",
                Silos =
                [
                    new Siloscope.Core.Components.Workspace.SiloSource
                    {
                        Reference = "Contracts.dll",
                        Source = "DLL",
                        Enabled = true,
                    },
                ],
            }
        );
        SetCatalog(
            new InterfaceCatalog(
                [
                    new GrainInterfaceDescriptor(
                        typeof(ITokenAwareGrain).FullName!,
                        typeof(ITokenAwareGrain),
                        [
                            new GrainMethodDescriptor(
                                "Task<String> GetAsync(String tenantId)",
                                typeof(ITokenAwareGrain).GetMethod(
                                    nameof(ITokenAwareGrain.GetAsync)
                                )!
                            ),
                        ],
                        null,
                        sourceId
                    ),
                ],
                []
            )
        );

        var result = await _commands.DiscoverSourceCatalogAsync();

        result.IsSuccess.Should().BeTrue();
        result.Value.Sources[0].Interfaces[0].Methods[0].Parameters.Should().ContainSingle();
        result.Value.Sources[0].Interfaces[0].Methods[0].Parameters[0].Name.Should().Be("tenantId");
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
    public async Task ListNugetFeedsAsync_IncludesDefaultAndStoredFeeds()
    {
        _nugetManagerMock
            .Setup(m => m.List())
            .Returns(
                Result.Ok<IReadOnlyList<Feed>>([
                    new Feed
                    {
                        Name = "private",
                        Url = "https://nuget.example/v3/index.json",
                        Username = "user",
                    },
                ])
            );

        var result = await _commands.ListNugetFeedsAsync();

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().HaveCount(2);
        result.Value[0].Name.Should().Be("nuget.org");
        result.Value[0].IsDefault.Should().BeTrue();
        result.Value[1].HasCredentials.Should().BeTrue();
    }

    [Fact]
    public async Task CreateNugetFeedAsync_CreatesFeedWithCredentials()
    {
        _nugetManagerMock
            .Setup(m =>
                m.CreateAsync(
                    It.Is<NugetFeedSource>(feed =>
                        feed.Name == "private"
                        && feed.SourceUrl == "https://nuget.example/v3/index.json"
                        && feed.Credentials != null
                    ),
                    It.IsAny<CancellationToken>()
                )
            )
            .ReturnsAsync(Result.Ok());

        var result = await _commands.CreateNugetFeedAsync(
            new CreateNugetFeedRequest(
                "private",
                "https://nuget.example/v3/index.json",
                "user",
                "token"
            )
        );

        result.IsSuccess.Should().BeTrue();
        result.Value.Name.Should().Be("private");
        result.Value.HasCredentials.Should().BeTrue();
    }

    [Fact]
    public async Task SearchNugetPackagesAsync_ReturnsPackagesFromManager()
    {
        _nugetManagerMock
            .Setup(m =>
                m.SearchPackagesAsync(
                    "orleans",
                    "https://api.nuget.org/v3/index.json",
                    null,
                    20,
                    It.IsAny<CancellationToken>()
                )
            )
            .ReturnsAsync(
                Result.Ok<IReadOnlyList<NugetPackageSearchResult>>([
                    new("Microsoft.Orleans.Core", "10.0.0", "Orleans core", "Microsoft", 42),
                ])
            );

        var result = await _commands.SearchNugetPackagesAsync(
            "orleans",
            "https://api.nuget.org/v3/index.json"
        );

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().ContainSingle();
        result.Value[0].PackageId.Should().Be("Microsoft.Orleans.Core");
    }

    [Fact]
    public async Task AddNugetPackageSourceAsync_RestoresAndAddsSourceToWorkspace()
    {
        SetWorkspace(CreateTestWorkspace());
        _nugetManagerMock
            .Setup(m =>
                m.RestorePackagesAsync(
                    It.Is<IEnumerable<(string Id, string Version)>>(packages =>
                        packages.Single().Id == "Contracts" && packages.Single().Version == "1.2.3"
                    ),
                    It.IsAny<string?>(),
                    It.IsAny<string?>(),
                    It.IsAny<CancellationToken>()
                )
            )
            .ReturnsAsync(Result.Ok("Restored 1 packages"));

        var result = await _commands.AddNugetPackageSourceAsync(
            "Contracts",
            "1.2.3",
            "https://api.nuget.org/v3/index.json"
        );

        result.IsSuccess.Should().BeTrue();
        result
            .Value.Silos.Should()
            .ContainSingle(source =>
                source.Reference == "Contracts"
                && source.Source == "nuget"
                && source.Version == "1.2.3"
            );
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
