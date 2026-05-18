using AwesomeAssertions;
using Siloscope.Core.Components.Workspace;
using Xunit;

namespace Siloscope.Test.Core;

public sealed class WorkspaceServiceTests
{
    private readonly WorkspaceService _workspaceService;
    private readonly string _testDirectory;

    public WorkspaceServiceTests()
    {
        _testDirectory = Path.Combine(Path.GetTempPath(), $"siloscope-test-{Guid.NewGuid()}");
        Directory.CreateDirectory(_testDirectory);
        _workspaceService = new WorkspaceService(_testDirectory);
    }

    [Fact]
    public async Task SaveAsync_ValidWorkspace_SavesToFile()
    {
        var workspace = CreateTestWorkspace();
        var filePath = Path.Combine(_testDirectory, "test.workspace.json");

        await _workspaceService.SaveAsync(filePath, workspace);

        File.Exists(filePath).Should().BeTrue();
    }

    [Fact]
    public async Task SaveAsync_ValidWorkspace_CanBeLoadedBack()
    {
        var workspace = CreateTestWorkspace();
        var filePath = Path.Combine(_testDirectory, "test.workspace.json");

        await _workspaceService.SaveAsync(filePath, workspace);
        var loaded = await _workspaceService.LoadAsync(filePath);

        loaded.Id.Should().Be(workspace.Id);
        loaded.WorkspaceInfo.Name.Should().Be(workspace.WorkspaceInfo.Name);
        loaded.Cluster.ClusterId.Should().Be(workspace.Cluster.ClusterId);
    }

    [Fact]
    public async Task LoadAsync_FileNotFound_ThrowsException()
    {
        var filePath = Path.Combine(_testDirectory, "nonexistent.json");

        var action = async () => await _workspaceService.LoadAsync(filePath);

        await action.Should().ThrowAsync<FileNotFoundException>();
    }

    [Fact]
    public async Task SaveAsync_MultipleWorkspaces_CanLoadEach()
    {
        var workspace1 = CreateTestWorkspace();
        workspace1.Id = "workspace-1";
        workspace1.WorkspaceInfo.Name = "Workspace One";

        var workspace2 = CreateTestWorkspace();
        workspace2.Id = "workspace-2";
        workspace2.WorkspaceInfo.Name = "Workspace Two";

        var filePath1 = Path.Combine(_testDirectory, "workspace1.json");
        var filePath2 = Path.Combine(_testDirectory, "workspace2.json");

        await _workspaceService.SaveAsync(filePath1, workspace1);
        await _workspaceService.SaveAsync(filePath2, workspace2);

        var loaded1 = await _workspaceService.LoadAsync(filePath1);
        var loaded2 = await _workspaceService.LoadAsync(filePath2);

        loaded1.Id.Should().Be("workspace-1");
        loaded1.WorkspaceInfo.Name.Should().Be("Workspace One");
        loaded2.Id.Should().Be("workspace-2");
        loaded2.WorkspaceInfo.Name.Should().Be("Workspace Two");
    }

    [Fact]
    public async Task ListAsync_ReturnsPersistedWorkspaces()
    {
        var workspace1 = CreateTestWorkspace();
        workspace1.Id = "workspace-list-1";
        workspace1.WorkspaceInfo.Name = "Workspace B";

        var workspace2 = CreateTestWorkspace();
        workspace2.Id = "workspace-list-2";
        workspace2.WorkspaceInfo.Name = "Workspace A";

        await _workspaceService.SaveAsync(
            _workspaceService.GetWorkspacePath(workspace1.Id),
            workspace1
        );
        await _workspaceService.SaveAsync(
            _workspaceService.GetWorkspacePath(workspace2.Id),
            workspace2
        );

        var workspaces = await _workspaceService.ListAsync();

        workspaces.Should().Contain(workspace => workspace.Id == "workspace-list-1");
        workspaces.Should().Contain(workspace => workspace.Id == "workspace-list-2");
        workspaces
            .Select(workspace => workspace.WorkspaceInfo.Name)
            .Should()
            .ContainInOrder("Workspace A", "Workspace B");
    }

    [Fact]
    public void GetDefaultWorkspacePath_ReturnsValidPath()
    {
        var path = _workspaceService.GetDefaultWorkspacePath();

        path.Should().NotBeEmpty();
        path.Should().Contain("SiloScope");
    }

    [Fact]
    public void GetWorkspacePath_UsesWorkspaceIdFileName()
    {
        var path = _workspaceService.GetWorkspacePath("workspace:one");

        path.Should().EndWith("workspace-one.workspace.json");
        path.Should().Contain("SiloScope");
    }

    private static Workspace CreateTestWorkspace()
    {
        return new Workspace
        {
            Id = "test-workspace-id",
            WorkspaceInfo = new Siloscope.Core.Components.Workspace.WorkspaceInfo
            {
                Name = "Test Workspace",
                Description = "A test workspace",
                Creation = DateTime.UtcNow.ToString("O"),
            },
            Cluster = new ClusterConfig
            {
                Type = ClusterType.Homogenous,
                ClusterId = "test-cluster",
                ServiceId = "test-service",
                DefaultGateway = "127.0.0.1:30000",
            },
            Silos =
            [
                new Siloscope.Core.Components.Workspace.SiloSource
                {
                    Reference = "../../test.dll",
                    Source = "DLL",
                    Version = null,
                    Gateway = "127.0.0.1:30001",
                    Enabled = true,
                },
            ],
            Security = new SecurityConfig { WorkspaceSalt = "test-salt" },
            Environments =
            [
                new EnvironmentConfig
                {
                    Name = "development",
                    Variables = new Dictionary<string, string> { ["KEY"] = "VALUE" },
                },
            ],
            Session = new SessionConfig { ActiveEnvironment = "development" },
        };
    }
}
