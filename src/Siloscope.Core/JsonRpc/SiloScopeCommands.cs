using FluentResults;
using Microsoft.Extensions.Logging;
using Siloscope.Core.Catalog;
using Siloscope.Core.Clustering;
using Siloscope.Core.Configuration;
using Siloscope.Core.JsonRpc.Models;
using Siloscope.Core.NuGet;
using Siloscope.Core.NuGet.Models;
using IWorkspaceService = Siloscope.Core.Workspaces.IWorkspaceService;
using Workspaces = Siloscope.Core.Workspaces;

namespace Siloscope.Core.JsonRpc;

/// <summary>
/// Implements the <see cref="ISiloScopeCommands" /> interface exposed over JSON-RPC.
/// </summary>
public sealed class SiloScopeCommands : ISiloScopeCommands
{
    private readonly IOrleansClientConnectorPool _connectorPool;
    private readonly IGrainInvocationService _grainInvocationService;
    private readonly InterfaceCatalogLoader _catalogLoader;
    private readonly IWorkspaceService _workspaceService;
    private readonly INugetConnectionManager _nugetManager;
    private readonly ILogger<SiloScopeCommands> _logger;

    private InterfaceCatalog? _catalog;
    private Workspaces.Workspace? _currentWorkspace;

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
                    : [workspace.Cluster.DefaultGateway],
                workspace.Cluster.Type,
                workspace.Cluster.Clustering
            );

            var siloSources = workspace
                .Silos.Select(s => new SiloSource(
                    s.Reference,
                    s.Source,
                    s.Version,
                    s.Gateway,
                    s.Enabled,
                    s.FeedName
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
                envVars,
                workspace.Session.SavedContexts.Select(ToJsonRpcSavedContext).ToList()
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
        path ??= _workspaceService.GetWorkspacePath(workspace.Id);
        _logger.LogInformation("Saving workspace to {Path}", path);

        try
        {
            var workspaceModel = ToWorkspaceModel(workspace);
            var shouldInvalidateCatalog =
                _currentWorkspace is null || !CatalogInputsEqual(_currentWorkspace, workspaceModel);

            await _workspaceService.SaveAsync(path, workspaceModel);
            _currentWorkspace = workspaceModel;
            if (shouldInvalidateCatalog)
            {
                _catalog = null;
            }

            _logger.LogInformation("Workspace saved: {WorkspaceName}", workspace.Name);
            return Result.Ok();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to save workspace");
            return Result.Fail(ex.Message);
        }
    }

    public async Task<Result<IReadOnlyList<WorkspaceInfo>>> ListWorkspacesAsync(
        CancellationToken cancellationToken = default
    )
    {
        try
        {
            var workspaces = await _workspaceService.ListAsync();
            return Result.Ok<IReadOnlyList<WorkspaceInfo>>(
                workspaces.Select(ToWorkspaceInfo).ToList()
            );
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to list workspaces");
            return Result.Fail<IReadOnlyList<WorkspaceInfo>>(ex.Message);
        }
    }

    public Task<Result<WorkspaceInfo>> SetWorkspaceAsync(
        WorkspaceInfo workspace,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(workspace.Id))
        {
            return Task.FromResult(Result.Fail<WorkspaceInfo>("Workspace id is required."));
        }

        if (string.IsNullOrWhiteSpace(workspace.Name))
        {
            return Task.FromResult(Result.Fail<WorkspaceInfo>("Workspace name is required."));
        }

        _currentWorkspace = ToWorkspaceModel(workspace);
        _catalog = null;

        _logger.LogInformation("Active workspace set: {WorkspaceName}", workspace.Name);
        return Task.FromResult(Result.Ok(ToWorkspaceInfo(_currentWorkspace)));
    }

    public async Task<Result<string>> ConnectClusterAsync(
        ClusterOptions options,
        CancellationToken cancellationToken = default
    )
    {
        _logger.LogInformation("Connecting to cluster {ClusterId}", options.ClusterId);

        InterfaceCatalog catalog = new([], []);
        IReadOnlyList<InterfaceEntry>? entries = null;
        if (_currentWorkspace is not null)
        {
            var discoverResult = await DiscoverGrainsAsync(null, cancellationToken);
            if (discoverResult.IsFailed)
            {
                return Result.Fail<string>(discoverResult.Errors.Select(e => e.Message));
            }

            catalog = _catalog ?? catalog;
            entries = BuildInterfaceEntries(_currentWorkspace.Silos.Where(s => s.Enabled).ToList());
        }

        var toolOptions = new ToolClusterOptions(
            options.ClusterId,
            options.ServiceId,
            options.GatewayEndpoints,
            options.Clustering
        );

        _connectorPool.Configure(toolOptions, catalog, entries);
        var result = await _connectorPool.ConnectAllAsync(cancellationToken);

        return result.IsSuccess
            ? Result.Ok(result.Value)
            : Result.Fail<string>(result.Errors.Select(e => e.Message));
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
            _catalog = new InterfaceCatalog([], []);
            return Result.Ok(new GrainCatalog([], []));
        }

        var entries = BuildInterfaceEntries(enabledSilos);

        var catalogResult = _catalogLoader.LoadAll(entries);
        if (catalogResult.IsFailed)
        {
            _logger.LogWarning(
                "Catalog loading failed: {Errors}",
                string.Join("; ", catalogResult.Errors.Select(e => e.Message))
            );
            return Result.Fail<GrainCatalog>(catalogResult.Errors.Select(e => e.Message));
        }

        var catalog = catalogResult.Value;
        _logger.LogInformation(
            "Loaded catalog: {GrainCount} grains, {GatewayCount} gateways: {Gateways}",
            catalog.Grains.Count,
            catalog.Gateways.Count,
            string.Join(", ", catalog.Gateways)
        );
        foreach (var grain in catalog.Grains)
        {
            _logger.LogInformation(
                "Grain {GrainName} has gateway {Gateway}",
                grain.Name,
                grain.Gateway ?? "null"
            );
        }
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

    public Task<Result<SourceOwnedGrainCatalog>> DiscoverSourceCatalogAsync(
        CancellationToken cancellationToken = default
    )
    {
        return DiscoverSourceCatalogAsync(null, cancellationToken);
    }

    public async Task<Result<SourceOwnedGrainCatalog>> DiscoverSourceCatalogAsync(
        string? path,
        CancellationToken cancellationToken = default
    )
    {
        if (_currentWorkspace is null)
        {
            var loadResult = await LoadWorkspaceAsync(path, cancellationToken);
            if (loadResult.IsFailed)
            {
                return Result.Fail<SourceOwnedGrainCatalog>(
                    "No workspace loaded and none specified"
                );
            }
        }

        if (_catalog is null)
        {
            var discoverResult = await DiscoverGrainsAsync(path, cancellationToken);
            if (discoverResult.IsFailed)
            {
                return Result.Fail<SourceOwnedGrainCatalog>(
                    discoverResult.Errors.Select(e => e.Message)
                );
            }
        }

        return Result.Ok(BuildSourceOwnedCatalog(_currentWorkspace!, _catalog!));
    }

    public async Task<Result<InvocationResult>> InvokeGrainAsync(
        string grainType,
        string methodName,
        string grainKey,
        string? payload,
        string? sourceId = null,
        string? functionId = null,
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

        var grain = ResolveGrain(grainType, sourceId, functionId);

        if (grain is null)
        {
            return Result.Fail<InvocationResult>(
                $"Grain interface '{grainType}' not found in catalog. Call grains.discover first."
            );
        }

        var method = ResolveMethod(grain, methodName, functionId);

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
            .Select(s => (Id: s.Reference, Version: s.Version!, s.FeedName))
            .ToList();

        if (nugetPackages.Count == 0)
        {
            return Result.Ok(new RestoreResult(0, 0, [], []));
        }

        _logger.LogInformation("Restoring {Count} NuGet packages", nugetPackages.Count);

        foreach (var group in nugetPackages.GroupBy(package => package.FeedName))
        {
            var result = await _nugetManager.RestorePackagesAsync(
                group.Select(package => (package.Id, package.Version)).ToList(),
                sourceUrl,
                group.Key,
                cancellationToken
            );

            if (result.IsFailed)
            {
                return Result.Fail<RestoreResult>(
                    result.Errors.FirstOrDefault()?.Message ?? "Restore failed"
                );
            }

            _logger.LogInformation("Restore complete: {Message}", result.Value);
        }

        return Result.Ok(
            new RestoreResult(
                nugetPackages.Count,
                0,
                nugetPackages.Select(p => $"{p.Id} {p.Version}").ToList(),
                []
            )
        );
    }

    public Task<Result<IReadOnlyList<NugetFeedInfo>>> ListNugetFeedsAsync(
        CancellationToken cancellationToken = default
    )
    {
        var feedsResult = _nugetManager.List();
        if (feedsResult.IsFailed)
        {
            return Task.FromResult(
                Result.Fail<IReadOnlyList<NugetFeedInfo>>(feedsResult.Errors.Select(e => e.Message))
            );
        }

        var feeds = new List<NugetFeedInfo>
        {
            new("nuget.org", "https://api.nuget.org/v3/index.json", false, true),
        };
        feeds.AddRange(
            feedsResult.Value.Select(feed => new NugetFeedInfo(
                feed.Name,
                feed.Url,
                !string.IsNullOrWhiteSpace(feed.Username),
                false
            ))
        );

        return Task.FromResult(Result.Ok<IReadOnlyList<NugetFeedInfo>>(feeds));
    }

    public async Task<Result<NugetFeedInfo>> CreateNugetFeedAsync(
        CreateNugetFeedRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var feedResult = CreateNugetFeedSource(request);
        if (feedResult.IsFailed)
        {
            return Result.Fail<NugetFeedInfo>(feedResult.Errors.Select(e => e.Message));
        }

        var result = await _nugetManager.CreateAsync(feedResult.Value, cancellationToken);

        if (result.IsFailed)
        {
            return Result.Fail<NugetFeedInfo>(result.Errors.Select(e => e.Message));
        }

        return Result.Ok(ToNugetFeedInfo(feedResult.Value));
    }

    public Task<Result> TestNugetFeedAsync(
        CreateNugetFeedRequest request,
        CancellationToken cancellationToken = default
    )
    {
        var feedResult = CreateNugetFeedSource(request);
        if (feedResult.IsFailed)
        {
            return Task.FromResult(Result.Fail(feedResult.Errors.Select(e => e.Message)));
        }

        return Task.FromResult(_nugetManager.Test(feedResult.Value));
    }

    public async Task<Result<NugetFeedInfo>> UpdateNugetFeedAsync(
        string name,
        CreateNugetFeedRequest request,
        CancellationToken cancellationToken = default
    )
    {
        if (string.IsNullOrWhiteSpace(name))
        {
            return Result.Fail<NugetFeedInfo>("Feed name is required.");
        }

        var existingResult = _nugetManager.Get(name);
        if (existingResult.IsFailed)
        {
            return Result.Fail<NugetFeedInfo>(existingResult.Errors.Select(e => e.Message));
        }

        var feedResult = CreateNugetFeedSource(request);
        if (feedResult.IsFailed)
        {
            return Result.Fail<NugetFeedInfo>(feedResult.Errors.Select(e => e.Message));
        }

        var existing = existingResult.Value;
        var updatedFeed = new Feed
        {
            Name = feedResult.Value.Name,
            Url = feedResult.Value.SourceUrl,
            Username = feedResult.Value.Credentials?.Username,
            Password = feedResult.Value.Credentials?.Password,
            IsPasswordClearText = feedResult.Value.Credentials?.IsPasswordClearText,
        };

        var result = await _nugetManager.UpdateAsync(updatedFeed, cancellationToken);
        if (result.IsFailed)
        {
            return Result.Fail<NugetFeedInfo>(result.Errors.Select(e => e.Message));
        }

        return Result.Ok(ToNugetFeedInfo(feedResult.Value));
    }

    public async Task<Result<IReadOnlyList<NugetPackageInfo>>> SearchNugetPackagesAsync(
        string query,
        string? sourceUrl = null,
        string? feedName = null,
        int take = 20,
        CancellationToken cancellationToken = default
    )
    {
        var result = await _nugetManager.SearchPackagesAsync(
            query,
            sourceUrl,
            feedName,
            take,
            cancellationToken
        );
        if (result.IsFailed)
        {
            return Result.Fail<IReadOnlyList<NugetPackageInfo>>(
                result.Errors.Select(e => e.Message)
            );
        }

        return Result.Ok<IReadOnlyList<NugetPackageInfo>>(
            result
                .Value.Select(package => new NugetPackageInfo(
                    package.PackageId,
                    package.Version,
                    package.Description,
                    package.Authors,
                    package.DownloadCount
                ))
                .ToList()
        );
    }

    public async Task<Result<IReadOnlyList<string>>> GetNugetPackageVersionsAsync(
        string packageId,
        string? sourceUrl = null,
        string? feedName = null,
        CancellationToken cancellationToken = default
    )
    {
        var result = await _nugetManager.GetPackageVersionsAsync(
            packageId,
            sourceUrl,
            feedName,
            cancellationToken
        );
        if (result.IsFailed)
        {
            return Result.Fail<IReadOnlyList<string>>(result.Errors.Select(e => e.Message));
        }

        return Result.Ok<IReadOnlyList<string>>(result.Value);
    }

    public async Task<Result<WorkspaceInfo>> AddNugetPackageSourceAsync(
        string packageId,
        string version,
        string? gateway = null,
        string? sourceUrl = null,
        string? feedName = null,
        CancellationToken cancellationToken = default
    )
    {
        if (_currentWorkspace is null)
        {
            var loadResult = await LoadWorkspaceAsync(null, cancellationToken);
            if (loadResult.IsFailed)
            {
                return Result.Fail<WorkspaceInfo>("No workspace loaded and none specified");
            }
        }

        if (string.IsNullOrWhiteSpace(packageId))
        {
            return Result.Fail<WorkspaceInfo>("Package ID is required.");
        }

        if (string.IsNullOrWhiteSpace(version))
        {
            return Result.Fail<WorkspaceInfo>("Package version is required.");
        }

        var restoreResult = await _nugetManager.RestorePackagesAsync(
            [(packageId, version)],
            sourceUrl,
            feedName,
            cancellationToken
        );
        if (restoreResult.IsFailed)
        {
            return Result.Fail<WorkspaceInfo>(restoreResult.Errors.Select(e => e.Message));
        }

        var existingIndex = _currentWorkspace!.Silos.FindIndex(source =>
            source.Source.Equals("nuget", StringComparison.OrdinalIgnoreCase)
            && source.Reference.Equals(packageId, StringComparison.OrdinalIgnoreCase)
            && string.Equals(source.Version, version, StringComparison.OrdinalIgnoreCase)
        );

        if (existingIndex < 0)
        {
            _currentWorkspace = _currentWorkspace with
            {
                Silos =
                [
                    .. _currentWorkspace.Silos,
                    new Workspaces.SiloSource
                    {
                        Reference = packageId,
                        Source = "nuget",
                        Version = version,
                        Gateway = gateway,
                        FeedName = feedName,
                        Enabled = true,
                    },
                ],
            };
        }
        else
        {
            var existing = _currentWorkspace.Silos[existingIndex];
            var updated = existing with
            {
                Enabled = true,
                Gateway = !string.IsNullOrWhiteSpace(gateway) ? gateway : existing.Gateway,
                FeedName = !string.IsNullOrWhiteSpace(feedName) ? feedName : existing.FeedName,
            };
            var newSilos = _currentWorkspace.Silos.ToList();
            newSilos[existingIndex] = updated;
            _currentWorkspace = _currentWorkspace with { Silos = newSilos };
        }

        _logger.LogInformation(
            "Added NuGet package source {PackageId} {Version} with gateway {Gateway}",
            packageId,
            version,
            gateway ?? "<none>"
        );

        return Result.Ok(ToWorkspaceInfo(_currentWorkspace));
    }

    private static Result<NugetFeedSource> CreateNugetFeedSource(CreateNugetFeedRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Name))
        {
            return Result.Fail<NugetFeedSource>("Feed name is required.");
        }

        if (string.IsNullOrWhiteSpace(request.Url))
        {
            return Result.Fail<NugetFeedSource>("Feed URL is required.");
        }

        var credentials =
            !string.IsNullOrWhiteSpace(request.Username)
            && !string.IsNullOrWhiteSpace(request.Password)
                ? new NugetFeedSourceAuthentication(
                    request.Username,
                    request.Password,
                    request.IsPasswordClearText
                )
                : null;

        return Result.Ok(new NugetFeedSource(request.Url, request.Name, true, credentials));
    }

    private static NugetFeedInfo ToNugetFeedInfo(NugetFeedSource feed) =>
        new(feed.Name, feed.SourceUrl, feed.Credentials is not null, false);

    private static SourceOwnedGrainCatalog BuildSourceOwnedCatalog(
        Workspaces.Workspace workspace,
        InterfaceCatalog catalog
    )
    {
        var catalogSources = catalog.SourceDescriptors.ToDictionary(
            static source => source.SourceId,
            StringComparer.Ordinal
        );

        var sources = workspace
            .Silos.Select(silo =>
            {
                var sourceId = BuildSourceId(silo);
                catalogSources.TryGetValue(sourceId, out var sourceDescriptor);

                var interfaces = catalog
                    .Grains.Where(grain =>
                        string.Equals(grain.SourceId, sourceId, StringComparison.Ordinal)
                    )
                    .Select(grain => new SourceCatalogInterface(
                        grain.Name,
                        grain.InterfaceType.Name,
                        grain.InterfaceType.Namespace ?? "",
                        grain
                            .Methods.Select(method => new SourceCatalogFunction(
                                BuildFunctionId(sourceId, grain, method),
                                sourceId,
                                grain.Name,
                                grain.InterfaceType.Name,
                                grain.InterfaceType.Namespace ?? "",
                                method.MethodInfo.Name,
                                method.Signature,
                                FormatTypeName(method.MethodInfo.ReturnType),
                                GetGrainKeyType(grain.InterfaceType),
                                method
                                    .MethodInfo.GetParameters()
                                    .Where(static parameter =>
                                        parameter.ParameterType != typeof(CancellationToken)
                                    )
                                    .Select(parameter => new FunctionParameterInfo(
                                        parameter.Name ?? "value",
                                        FormatTypeName(parameter.ParameterType)
                                    ))
                                    .ToList()
                            ))
                            .ToList()
                    ))
                    .OrderBy(
                        static catalogInterface => catalogInterface.Namespace,
                        StringComparer.Ordinal
                    )
                    .ThenBy(
                        static catalogInterface => catalogInterface.InterfaceName,
                        StringComparer.Ordinal
                    )
                    .ToList();

                return new SourceCatalogInfo(
                    sourceId,
                    NormalizeSourceType(silo.Source),
                    silo.Reference,
                    GetSourceLabel(silo),
                    silo.Version,
                    silo.Gateway,
                    silo.Enabled,
                    GetDiscoveryStatus(silo, sourceDescriptor, interfaces),
                    interfaces
                );
            })
            .ToList();

        return new SourceOwnedGrainCatalog(sources);
    }

    private static List<InterfaceEntry> BuildInterfaceEntries(
        IReadOnlyList<Workspaces.SiloSource> enabledSilos
    )
    {
        return enabledSilos
            .Select(s => new InterfaceEntry(
                s.Gateway,
                s.Source.Equals("nuget", StringComparison.OrdinalIgnoreCase)
                    ? InterfaceSourceType.NuGet
                    : InterfaceSourceType.Dll,
                s.Source.Equals("DLL", StringComparison.OrdinalIgnoreCase) ? s.Reference : null,
                s.Source.Equals("nuget", StringComparison.OrdinalIgnoreCase) ? s.Reference : null,
                s.Source.Equals("nuget", StringComparison.OrdinalIgnoreCase) ? s.Version : null,
                null,
                null,
                BuildSourceId(s),
                s.FeedName
            ))
            .ToList();
    }

    private static WorkspaceInfo ToWorkspaceInfo(Workspaces.Workspace workspace)
    {
        var clusterOptions = new ClusterOptions(
            workspace.Cluster.ClusterId,
            workspace.Cluster.ServiceId,
            string.IsNullOrEmpty(workspace.Cluster.DefaultGateway)
                ? []
                : [workspace.Cluster.DefaultGateway],
            workspace.Cluster.Type,
            workspace.Cluster.Clustering
        );

        var siloSources = workspace
            .Silos.Select(s => new SiloSource(
                s.Reference,
                s.Source,
                s.Version,
                s.Gateway,
                s.Enabled,
                s.FeedName
            ))
            .ToList();

        var activeEnv = workspace.Environments.FirstOrDefault(e =>
            e.Name == workspace.Session.ActiveEnvironment
        );

        return new WorkspaceInfo(
            workspace.Id,
            workspace.WorkspaceInfo.Name,
            workspace.WorkspaceInfo.Description,
            clusterOptions,
            siloSources,
            activeEnv?.Variables ?? new Dictionary<string, string>(),
            workspace.Session.SavedContexts.Select(ToJsonRpcSavedContext).ToList()
        );
    }

    private static Workspaces.Workspace ToWorkspaceModel(WorkspaceInfo workspace)
    {
        return new Workspaces.Workspace
        {
            Id = workspace.Id,
            WorkspaceInfo = new Workspaces.WorkspaceInfo
            {
                Name = workspace.Name,
                Description = workspace.Description ?? string.Empty,
                Creation = DateTime.UtcNow.ToString("O"),
            },
            Cluster = new Workspaces.ClusterConfig
            {
                Type = workspace.Cluster.Type,
                ClusterId = workspace.Cluster.ClusterId,
                ServiceId = workspace.Cluster.ServiceId,
                DefaultGateway =
                    workspace.Cluster.GatewayEndpoints.FirstOrDefault() ?? string.Empty,
                Clustering = workspace.Cluster.Clustering,
            },
            Silos = workspace
                .Silos.Select(s => new Workspaces.SiloSource
                {
                    Reference = s.Reference,
                    Source = s.Source,
                    Version = s.Version,
                    Gateway = s.Gateway,
                    Enabled = s.Enabled,
                })
                .ToList(),
            Security = new Workspaces.SecurityConfig(),
            Environments =
            [
                new Workspaces.EnvironmentConfig
                {
                    Name = "default",
                    Variables = workspace.EnvironmentVariables,
                },
            ],
            Session = new Workspaces.SessionConfig
            {
                ActiveEnvironment = "default",
                SavedContexts = workspace.SavedContexts.Select(ToWorkspaceSavedContext).ToList(),
            },
        };
    }

    private static bool CatalogInputsEqual(Workspaces.Workspace left, Workspaces.Workspace right)
    {
        return left.Silos.Count == right.Silos.Count
            && left.Silos.Zip(right.Silos).All(pair => SiloSourceEqual(pair.First, pair.Second));
    }

    private static bool SiloSourceEqual(Workspaces.SiloSource left, Workspaces.SiloSource right)
    {
        return StringComparer.Ordinal.Equals(left.Reference, right.Reference)
            && StringComparer.OrdinalIgnoreCase.Equals(left.Source, right.Source)
            && StringComparer.Ordinal.Equals(left.Version, right.Version)
            && StringComparer.Ordinal.Equals(left.Gateway, right.Gateway)
            && left.Enabled == right.Enabled;
    }

    private static SavedRequestContext ToJsonRpcSavedContext(Workspaces.SavedRequestContext context)
    {
        return new SavedRequestContext(
            context.TabId,
            context.IsDefaultActive,
            context.TargetGrainClass,
            context.TargetMethod,
            context.KeyType,
            context.GrainId,
            context.Payload,
            context.SourceId,
            context.FunctionId
        );
    }

    private static Workspaces.SavedRequestContext ToWorkspaceSavedContext(
        SavedRequestContext context
    )
    {
        return new Workspaces.SavedRequestContext
        {
            TabId = context.TabId,
            IsDefaultActive = context.IsDefaultActive,
            TargetGrainClass = context.TargetGrainClass,
            TargetMethod = context.TargetMethod,
            KeyType = context.KeyType,
            GrainId = context.GrainId,
            Payload = context.Payload,
            SourceId = context.SourceId,
            FunctionId = context.FunctionId,
        };
    }

    private static string BuildSourceId(Workspaces.SiloSource silo)
    {
        return $"{NormalizeSourceType(silo.Source)}:{silo.Reference}:{silo.Version ?? ""}:{silo.Gateway ?? ""}";
    }

    private static string BuildFunctionId(
        string sourceId,
        GrainInterfaceDescriptor grain,
        GrainMethodDescriptor method
    )
    {
        return $"{sourceId}:{grain.Name}:{method.Signature}";
    }

    private GrainInterfaceDescriptor? ResolveGrain(
        string grainType,
        string? sourceId,
        string? functionId
    )
    {
        var grains = _catalog!.Grains.AsEnumerable();
        if (!string.IsNullOrWhiteSpace(sourceId))
        {
            grains = grains.Where(grain =>
                string.Equals(grain.SourceId, sourceId, StringComparison.Ordinal)
            );
        }

        if (!string.IsNullOrWhiteSpace(functionId))
        {
            var functionGrain = grains.FirstOrDefault(grain =>
                grain.Methods.Any(method =>
                    string.Equals(
                        BuildFunctionId(grain.SourceId ?? string.Empty, grain, method),
                        functionId,
                        StringComparison.Ordinal
                    )
                )
            );

            if (functionGrain is not null)
            {
                return functionGrain;
            }
        }

        return grains.FirstOrDefault(g =>
            string.Equals(g.Name, grainType, StringComparison.OrdinalIgnoreCase)
            || string.Equals(
                g.InterfaceType.FullName,
                grainType,
                StringComparison.OrdinalIgnoreCase
            )
            || string.Equals(g.InterfaceType.Name, grainType, StringComparison.OrdinalIgnoreCase)
        );
    }

    private static GrainMethodDescriptor? ResolveMethod(
        GrainInterfaceDescriptor grain,
        string methodName,
        string? functionId
    )
    {
        if (!string.IsNullOrWhiteSpace(functionId))
        {
            var sourceId = grain.SourceId ?? string.Empty;
            var functionMethod = grain.Methods.FirstOrDefault(method =>
                string.Equals(
                    BuildFunctionId(sourceId, grain, method),
                    functionId,
                    StringComparison.Ordinal
                )
            );

            if (functionMethod is not null)
            {
                return functionMethod;
            }
        }

        return grain.Methods.FirstOrDefault(m =>
            string.Equals(m.MethodInfo.Name, methodName, StringComparison.OrdinalIgnoreCase)
        );
    }

    private static string NormalizeSourceType(string source)
    {
        return source.Equals("nuget", StringComparison.OrdinalIgnoreCase) ? "NuGet" : "DLL";
    }

    private static string GetSourceLabel(Workspaces.SiloSource source)
    {
        if (source.Source.Equals("nuget", StringComparison.OrdinalIgnoreCase))
        {
            return string.IsNullOrWhiteSpace(source.Version)
                ? source.Reference
                : $"{source.Reference} {source.Version}";
        }

        return Path.GetFileName(source.Reference);
    }

    private static string GetDiscoveryStatus(
        Workspaces.SiloSource source,
        InterfaceSourceDescriptor? sourceDescriptor,
        IReadOnlyList<SourceCatalogInterface> interfaces
    )
    {
        return source.Enabled switch
        {
            false => "idle",
            _ => sourceDescriptor is not null && interfaces.Count > 0 ? "ready" : "idle",
        };
    }

    private static string GetGrainKeyType(Type interfaceType)
    {
        if (typeof(IGrainWithGuidKey).IsAssignableFrom(interfaceType))
        {
            return "Guid";
        }

        if (typeof(IGrainWithIntegerKey).IsAssignableFrom(interfaceType))
        {
            return "Integer";
        }

        return "String";
    }

    private static string FormatTypeName(Type type)
    {
        if (!type.IsGenericType)
        {
            return type.Name;
        }

        var baseName = type.Name;
        var tick = baseName.IndexOf('`');
        if (tick >= 0)
        {
            baseName = baseName[..tick];
        }

        var args = string.Join(", ", type.GetGenericArguments().Select(FormatTypeName));
        return $"{baseName}<{args}>";
    }
}
