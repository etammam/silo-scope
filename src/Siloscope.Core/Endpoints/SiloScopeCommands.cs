using FluentResults;
using Microsoft.Extensions.Logging;
using Siloscope.Core.Cluster;
using Siloscope.Core.Components.Nuget;
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
    private readonly INugetConnectionManager _nugetManager;
    private readonly ILogger<SiloScopeCommands> _logger;

    private InterfaceCatalog? _catalog;
    private Workspace? _currentWorkspace;

    public SiloScopeCommands(
        IOrleansClientConnectorPool connectorPool,
        IGrainInvocationService grainInvocationService,
        InterfaceCatalogLoader catalogLoader,
        IWorkspaceService workspaceService,
        INugetConnectionManager nugetManager,
        ILogger<SiloScopeCommands> logger
    )
    {
        _connectorPool = connectorPool;
        _grainInvocationService = grainInvocationService;
        _catalogLoader = catalogLoader;
        _workspaceService = workspaceService;
        _nugetManager = nugetManager;
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
        return DiscoverGrainsAsync(null, cancellationToken);
    }

    public async Task<Result<GrainCatalog>> DiscoverGrainsAsync(
        string? path,
        CancellationToken cancellationToken = default
    )
    {
        if (_currentWorkspace is null)
        {
            var loadResult = await LoadWorkspaceAsync(path, cancellationToken);
            if (loadResult.IsFailed)
            {
                return Result.Fail<GrainCatalog>("No workspace loaded and none specified");
            }
        }

        var enabledSilos = _currentWorkspace!.Silos.Where(s => s.Enabled).ToList();
        if (enabledSilos.Count == 0)
        {
            _logger.LogWarning("No enabled silos in workspace");
            return Result.Ok(new GrainCatalog([], []));
        }

        var entries = enabledSilos
            .Select(s => new InterfaceEntry(
                s.Gateway,
                s.Source.Equals("nuget", StringComparison.OrdinalIgnoreCase)
                    ? InterfaceSourceType.NuGet
                    : InterfaceSourceType.Dll,
                s.Source.Equals("DLL", StringComparison.OrdinalIgnoreCase) ? s.Reference : null,
                s.Source.Equals("nuget", StringComparison.OrdinalIgnoreCase) ? s.Reference : null,
                s.Source.Equals("nuget", StringComparison.OrdinalIgnoreCase) ? s.Version : null,
                null,
                null
            ))
            .ToList();

        var catalogResult = _catalogLoader.LoadAll(entries);
        if (catalogResult.IsFailed)
        {
            return Result.Fail<GrainCatalog>(catalogResult.Errors.Select(e => e.Message));
        }

        var catalog = catalogResult.Value;
        var grainInfos = catalog
            .Grains.Select(g => new GrainInfo(
                g.Name,
                g.InterfaceType.Name,
                g.InterfaceType.Namespace ?? "",
                g.Methods.Select(m => new MethodInfo(
                        m.MethodInfo.Name,
                        m.Signature ?? "",
                        m.MethodInfo.ReturnType.Name
                    ))
                    .ToList(),
                g.Gateway
            ))
            .ToList();

        _catalog = catalog;
        _logger.LogInformation("Discovered {Count} grain interfaces", grainInfos.Count);

        return Result.Ok(new GrainCatalog(grainInfos, catalog.AssemblyPaths));
    }

    public async Task<Result<InvocationResult>> InvokeGrainAsync(
        string grainType,
        string methodName,
        string grainKey,
        string? payload,
        CancellationToken cancellationToken = default
    )
    {
        _logger.LogInformation(
            "InvokeGrain called for {GrainType}.{Method}",
            grainType,
            methodName
        );

        if (_catalog is null)
        {
            return Result.Fail<InvocationResult>(
                "No grain catalog available. Call grains.discover first."
            );
        }

        var grain = _catalog.Grains.FirstOrDefault(g =>
            string.Equals(g.Name, grainType, StringComparison.OrdinalIgnoreCase)
            || string.Equals(
                g.InterfaceType.FullName,
                grainType,
                StringComparison.OrdinalIgnoreCase
            )
        );

        if (grain is null)
        {
            return Result.Fail<InvocationResult>(
                $"Grain interface '{grainType}' not found in catalog. Call grains.discover first."
            );
        }

        var method = grain.Methods.FirstOrDefault(m =>
            string.Equals(m.MethodInfo.Name, methodName, StringComparison.OrdinalIgnoreCase)
        );

        if (method is null)
        {
            return Result.Fail<InvocationResult>(
                $"Method '{methodName}' not found on grain '{grainType}'."
            );
        }

        var result = await _grainInvocationService.InvokeWithTimingAsync(
            grain,
            method,
            grainKey,
            payload,
            cancellationToken
        );

        if (result.IsFailed)
        {
            return Result.Fail<InvocationResult>(
                result.Errors.Select(e => e.Message).FirstOrDefault() ?? "Unknown error"
            );
        }

        var (response, timing) = result.Value;
        var timingInfo = new TimingInfo(timing.SerializationMs, timing.ExecutionMs, timing.TotalMs);

        return Result.Ok(new InvocationResult(true, response, null, timingInfo));
    }

    public async Task<Result<RestoreResult>> RestorePackagesAsync(
        IEnumerable<SiloSource> silos,
        string? sourceUrl = null,
        CancellationToken cancellationToken = default
    )
    {
        var nugetPackages = silos
            .Where(s => s.Source.Equals("nuget", StringComparison.OrdinalIgnoreCase))
            .Where(s => !string.IsNullOrEmpty(s.Reference) && !string.IsNullOrEmpty(s.Version))
            .Select(s => (s.Reference, s.Version!))
            .ToList();

        if (nugetPackages.Count == 0)
        {
            return Result.Ok(new RestoreResult(0, 0, [], []));
        }

        _logger.LogInformation("Restoring {Count} NuGet packages", nugetPackages.Count);

        var result = await _nugetManager.RestorePackagesAsync(
            nugetPackages,
            sourceUrl,
            null,
            cancellationToken
        );

        if (result.IsFailed)
        {
            return Result.Fail<RestoreResult>(
                result.Errors.FirstOrDefault()?.Message ?? "Restore failed"
            );
        }

        _logger.LogInformation("Restore complete: {Message}", result.Value);

        return Result.Ok(
            new RestoreResult(
                nugetPackages.Count,
                0,
                nugetPackages.Select(p => $"{p.Reference} {p.Item2}").ToList(),
                []
            )
        );
    }
}
