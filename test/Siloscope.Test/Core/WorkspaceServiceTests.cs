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
        _workspaceService = new WorkspaceService();
        _testDirectory = Path.Combine(Path.GetTempPath(), $"siloscope-test-{Guid.NewGuid()}");
        Directory.CreateDirectory(_testDirectory);
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
