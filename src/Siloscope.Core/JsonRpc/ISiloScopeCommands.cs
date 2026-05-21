using FluentResults;
using Siloscope.Core.JsonRpc.Models;
using StreamJsonRpc;

namespace Siloscope.Core.JsonRpc;

/// <summary>
/// Defines the JSON-RPC command interface exposed by the SiloScope backend.
/// </summary>
public interface ISiloScopeCommands
{
    // Workspace
    /// <summary>
    /// Loads a workspace from the specified path.
    /// </summary>
    /// <param name="path">The file path to load the workspace from, or <see langword="null" /> to use the default path.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result{WorkspaceInfo}" /> containing the loaded workspace information.</returns>
    [JsonRpcMethod("LoadWorkspaceAsync")]
    Task<Result<WorkspaceInfo>> LoadWorkspaceAsync(
        string? path = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Saves the specified workspace to the given path.
    /// </summary>
    /// <param name="workspace">The workspace information to save.</param>
    /// <param name="path">The file path to save the workspace to, or <see langword="null" /> to derive the path from the workspace identifier.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> indicating success or failure.</returns>
    [JsonRpcMethod("SaveWorkspaceAsync")]
    Task<Result> SaveWorkspaceAsync(
        WorkspaceInfo workspace,
        string? path = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Lists all available workspaces.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing a read-only list of workspace information.</returns>
    [JsonRpcMethod("ListWorkspacesAsync")]
    Task<Result<IReadOnlyList<WorkspaceInfo>>> ListWorkspacesAsync(
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Sets the active workspace without persisting it.
    /// </summary>
    /// <param name="workspace">The workspace information to set as active.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing the set workspace information.</returns>
    [JsonRpcMethod("SetWorkspaceAsync")]
    Task<Result<WorkspaceInfo>> SetWorkspaceAsync(
        WorkspaceInfo workspace,
        CancellationToken cancellationToken = default
    );

    // Cluster
    /// <summary>
    /// Connects to an Orleans cluster using the specified options.
    /// </summary>
    /// <param name="options">The cluster connection options.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing a connection status message.</returns>
    [JsonRpcMethod("ConnectClusterAsync")]
    Task<Result<string>> ConnectClusterAsync(
        ClusterOptions options,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Disconnects from the currently connected Orleans cluster.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> indicating success or failure.</returns>
    [JsonRpcMethod("DisconnectClusterAsync")]
    Task<Result> DisconnectClusterAsync(CancellationToken cancellationToken = default);

    // Grains
    /// <summary>
    /// Discovers all grain interfaces available in the current workspace.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing a catalog of discovered grains.</returns>
    [JsonRpcMethod("DiscoverGrainsAsync")]
    Task<Result<GrainCatalog>> DiscoverGrainsAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Discovers the grain catalog organized by source ownership.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing a source-owned grain catalog.</returns>
    [JsonRpcMethod("DiscoverSourceCatalogAsync")]
    Task<Result<SourceOwnedGrainCatalog>> DiscoverSourceCatalogAsync(
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Invokes a grain method with the specified parameters.
    /// </summary>
    /// <param name="grainType">The full name or short name of the grain interface.</param>
    /// <param name="methodName">The name of the method to invoke.</param>
    /// <param name="grainKey">The grain key used to resolve the grain instance.</param>
    /// <param name="payload">The JSON payload to pass to the method.</param>
    /// <param name="sourceId">An optional source identifier to narrow the grain search.</param>
    /// <param name="functionId">An optional function identifier to narrow the method search.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing the invocation result and timing information.</returns>
    [JsonRpcMethod("InvokeGrainAsync")]
    Task<Result<InvocationResult>> InvokeGrainAsync(
        string grainType,
        string methodName,
        string grainKey,
        string? payload,
        string? sourceId = null,
        string? functionId = null,
        CancellationToken cancellationToken = default
    );

    // NuGet
    /// <summary>
    /// Restores NuGet packages for the specified silo sources.
    /// </summary>
    /// <param name="silos">The collection of silo sources to restore packages for.</param>
    /// <param name="sourceUrl">An optional NuGet feed URL to use for restoration.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing the restore result.</returns>
    Task<Result<RestoreResult>> RestorePackagesAsync(
        IEnumerable<SiloSource> silos,
        string? sourceUrl = null,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Lists all configured NuGet feeds.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing a read-only list of NuGet feed information.</returns>
    [JsonRpcMethod("ListNugetFeedsAsync")]
    Task<Result<IReadOnlyList<NugetFeedInfo>>> ListNugetFeedsAsync(
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Creates a new NuGet feed configuration.
    /// </summary>
    /// <param name="request">The feed creation request.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing the created feed information.</returns>
    [JsonRpcMethod("CreateNugetFeedAsync")]
    Task<Result<NugetFeedInfo>> CreateNugetFeedAsync(
        CreateNugetFeedRequest request,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Tests the connection to a NuGet feed.
    /// </summary>
    /// <param name="request">The feed request containing the URL and credentials to test.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> indicating whether the connection succeeded.</returns>
    [JsonRpcMethod("TestNugetFeedAsync")]
    Task<Result> TestNugetFeedAsync(
        CreateNugetFeedRequest request,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Updates an existing NuGet feed configuration.
    /// </summary>
    /// <param name="name">The name of the feed to update.</param>
    /// <param name="request">The updated feed information.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing the updated feed information.</returns>
    [JsonRpcMethod("UpdateNugetFeedAsync")]
    Task<Result<NugetFeedInfo>> UpdateNugetFeedAsync(
        string name,
        CreateNugetFeedRequest request,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Searches for NuGet packages matching the specified query.
    /// </summary>
    /// <param name="query">The search query string.</param>
    /// <param name="sourceUrl">An optional NuGet feed URL to search.</param>
    /// <param name="feedName">An optional configured feed name to search.</param>
    /// <param name="take">The maximum number of results to return.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing a read-only list of matching package information.</returns>
    [JsonRpcMethod("SearchNugetPackagesAsync")]
    Task<Result<IReadOnlyList<NugetPackageInfo>>> SearchNugetPackagesAsync(
        string query,
        string? sourceUrl = null,
        string? feedName = null,
        int take = 20,
        CancellationToken cancellationToken = default
    );

    /// <summary>
    /// Adds a NuGet package as a silo source to the current workspace.
    /// </summary>
    /// <param name="packageId">The NuGet package identifier.</param>
    /// <param name="version">The package version.</param>
    /// <param name="gateway">An optional gateway endpoint to associate with the package source.</param>
    /// <param name="sourceUrl">An optional NuGet feed URL to restore from.</param>
    /// <param name="feedName">An optional configured feed name to use.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing the updated workspace information.</returns>
    [JsonRpcMethod("AddNugetPackageSourceAsync")]
    Task<Result<WorkspaceInfo>> AddNugetPackageSourceAsync(
        string packageId,
        string version,
        string? gateway = null,
        string? sourceUrl = null,
        string? feedName = null,
        CancellationToken cancellationToken = default
    );
}
