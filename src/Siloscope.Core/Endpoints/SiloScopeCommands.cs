using FluentResults;
using Microsoft.Extensions.Logging;
using Siloscope.Core.Cluster;
using Siloscope.Core.Components.Workspace;
using Siloscope.Core.Configuration;
using Siloscope.Core.Interfaces;

namespace Siloscope.Core.Endpoints;

public class SiloScopeCommands : ISiloScopeCommands
{
    private readonly IOrleansClientConnectorPool _connectorPool;
    private readonly IGrainInvocationService _grainInvocationService;
    private readonly InterfaceCatalogLoader _catalogLoader;
    private readonly IWorkspaceService _workspaceService;
    private readonly ILogger<SiloScopeCommands> _logger;

    private InterfaceCatalog? _catalog;
    private Workspace? _currentWorkspace;

    public SiloScopeCommands(
        IOrleansClientConnectorPool connectorPool,
        IGrainInvocationService grainInvocationService,
        InterfaceCatalogLoader catalogLoader,
        IWorkspaceService workspaceService,
        ILogger<SiloScopeCommands> logger
    )
    {
        _connectorPool = connectorPool;
        _grainInvocationService = grainInvocationService;
        _catalogLoader = catalogLoader;
        _workspaceService = workspaceService;
        _logger = logger;
    }

    public async Task<Result<WorkspaceInfo>> LoadWorkspaceAsync(
        string? path = null,
        CancellationToken cancellationToken = default
    )
    {
        path ??= _workspaceService.GetDefaultWorkspacePath();
        _logger.LogInformation("Loading workspace from {Path}", path);

        try
        {
            var workspace = await _workspaceService.LoadAsync(path);
            _currentWorkspace = workspace;

            var clusterOptions = new ClusterOptions(
                workspace.Cluster.ClusterId,
                workspace.Cluster.ServiceId,
                string.IsNullOrEmpty(workspace.Cluster.DefaultGateway)
                    ? []
                    : [workspace.Cluster.DefaultGateway]
            );

            var siloSources = workspace
                .Silos.Select(s => new SiloSource(
                    s.Reference,
                    s.Source,
                    s.Version,
                    s.Gateway,
                    s.Enabled
                ))
                .ToList();

            var activeEnv = workspace.Environments.FirstOrDefault(e =>
                e.Name == workspace.Session.ActiveEnvironment
            );
            var envVars = activeEnv?.Variables ?? new Dictionary<string, string>();

            var workspaceInfo = new WorkspaceInfo(
                workspace.Id,
                workspace.WorkspaceInfo.Name,
                workspace.WorkspaceInfo.Description,
                clusterOptions,
                siloSources,
                envVars
            );

            _logger.LogInformation(
                "Workspace loaded: {WorkspaceName}",
                workspace.WorkspaceInfo.Name
            );
            return Result.Ok(workspaceInfo);
        }
        catch (FileNotFoundException ex)
        {
            _logger.LogWarning("Workspace file not found: {Message}", ex.Message);
            return Result.Fail<WorkspaceInfo>(ex.Message);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to load workspace");
            return Result.Fail<WorkspaceInfo>(ex.Message);
        }
    }

    public async Task<Result> SaveWorkspaceAsync(
        WorkspaceInfo workspace,
        string? path = null,
        CancellationToken cancellationToken = default
    )
    {
        path ??= _workspaceService.GetDefaultWorkspacePath();
        _logger.LogInformation("Saving workspace to {Path}", path);

        try
        {
            var workspaceModel = new Workspace
            {
                Id = workspace.Id,
                WorkspaceInfo = new Components.Workspace.WorkspaceInfo
                {
                    Name = workspace.Name,
                    Description = workspace.Description ?? string.Empty,
                    Creation = DateTime.UtcNow.ToString("O"),
                },
                Cluster = new ClusterConfig
                {
                    Type = ClusterType.Homogenous,
                    ClusterId = workspace.Cluster.ClusterId,
                    ServiceId = workspace.Cluster.ServiceId,
                    DefaultGateway =
                        workspace.Cluster.GatewayEndpoints.FirstOrDefault() ?? string.Empty,
                },
                Silos = workspace
                    .Silos.Select(s => new Components.Workspace.SiloSource
                    {
                        Reference = s.Reference,
                        Source = s.Source,
                        Version = s.Version,
                        Gateway = s.Gateway,
                        Enabled = s.Enabled,
                    })
                    .ToList(),
                Security = new SecurityConfig(),
                Environments = new List<EnvironmentConfig>
                {
                    new EnvironmentConfig
                    {
                        Name = "default",
                        Variables = workspace.EnvironmentVariables,
                    },
                },
                Session = new SessionConfig { ActiveEnvironment = "default" },
            };

            await _workspaceService.SaveAsync(path, workspaceModel);
            _currentWorkspace = workspaceModel;

            _logger.LogInformation("Workspace saved: {WorkspaceName}", workspace.Name);
            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save workspace");
            return Result.Fail(ex.Message);
        }
    }

    public async Task<Result<string>> ConnectClusterAsync(
        ClusterOptions options,
        CancellationToken cancellationToken = default
    )
    {
        _logger.LogInformation("Connecting to cluster {ClusterId}", options.ClusterId);

        var toolOptions = new ToolClusterOptions(
            options.ClusterId,
            options.ServiceId,
            options.GatewayEndpoints
        );

        var emptyCatalog = new InterfaceCatalog(
            Array.Empty<GrainInterfaceDescriptor>(),
            Array.Empty<string>()
        );
        _connectorPool.Configure(toolOptions, emptyCatalog);
        var result = await _connectorPool.ConnectAllAsync(cancellationToken);

        if (result.IsSuccess)
        {
            return Result.Ok(result.Value);
        }

        return Result.Fail<string>(result.Errors.Select(e => e.Message));
    }

    public async Task<Result> DisconnectClusterAsync(CancellationToken cancellationToken = default)
    {
        _logger.LogInformation("Disconnecting from cluster");
        await _connectorPool.DisconnectAllAsync(cancellationToken);
        return Result.Ok();
    }

    public Task<Result<GrainCatalog>> DiscoverGrainsAsync(
        CancellationToken cancellationToken = default
    )
    {
        // TODO: Implement - use InterfaceCatalogLoader
        _logger.LogInformation("DiscoverGrains called");
        return Task.FromResult(Result.Ok(new GrainCatalog([], [])));
    }

    public Task<Result<InvocationResult>> InvokeGrainAsync(
        string grainType,
        string methodName,
        string grainKey,
        string? payload,
        CancellationToken cancellationToken = default
    )
    {
        // TODO: Implement - use GrainInvocationService
        _logger.LogInformation(
            "InvokeGrain called for {GrainType}.{Method}",
            grainType,
            methodName
        );
        return Task.FromResult(Result.Ok(new InvocationResult(true, "{}", null, null)));
    }
}
