using FluentResults;
using Siloscope.Core.Catalog;
using Siloscope.Core.Configuration;

namespace Siloscope.Core.Clustering;

/// <summary>
/// Manages a pool of <see cref="OrleansClientConnector" /> instances, one per gateway endpoint.
/// </summary>
public interface IOrleansClientConnectorPool
{
    /// <summary>
    /// Configures the connector pool with cluster options and interface catalog information.
    /// </summary>
    /// <param name="clusterOptions">The cluster options used for Orleans client configuration.</param>
    /// <param name="catalog">The interface catalog containing discovered grain assemblies.</param>
    /// <param name="entries">An optional list of interface entries mapping gateways to assemblies.</param>
    void Configure(
        ToolClusterOptions clusterOptions,
        InterfaceCatalog catalog,
        IReadOnlyList<InterfaceEntry>? entries = null
    );

    /// <summary>
    /// Connects all configured Orleans clients to their respective gateways.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing a connection status message.</returns>
    Task<Result<string>> ConnectAllAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Disconnects all configured Orleans clients.
    /// </summary>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Task" /> that represents the asynchronous disconnect operation.</returns>
    Task DisconnectAllAsync(CancellationToken cancellationToken = default);

    /// <summary>
    /// Attempts to get the connector associated with the specified gateway.
    /// </summary>
    /// <param name="gateway">The gateway endpoint to look up, or <see langword="null" /> for a fallback connector.</param>
    /// <param name="connector">When this method returns, contains the connector if found; otherwise, <see langword="null" />.</param>
    /// <returns><see langword="true" /> if a connector was found; otherwise, <see langword="false" />.</returns>
    bool TryGetConnectorForGateway(string? gateway, out OrleansClientConnector? connector);

    /// <summary>
    /// Gets a read-only dictionary of all configured connectors keyed by gateway.
    /// </summary>
    IReadOnlyDictionary<string, OrleansClientConnector> Connectors { get; }

    /// <summary>
    /// Gets a value indicating whether all connectors in the pool are connected.
    /// </summary>
    bool IsConnected { get; }

    /// <summary>
    /// Sets a diagnostic sink for all connectors in the pool.
    /// </summary>
    /// <param name="sink">The action to receive diagnostic messages, or <see langword="null" /> to clear.</param>
    void SetDiagnosticSink(Action<string>? sink);
}
