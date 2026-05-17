using FluentResults;
using Siloscope.Core.Configuration;
using Siloscope.Core.Interfaces;

namespace Siloscope.Core.Cluster;

public interface IOrleansClientConnectorPool
{
    void Configure(
        ToolClusterOptions clusterOptions,
        InterfaceCatalog catalog,
        IReadOnlyList<InterfaceEntry>? entries = null
    );
    Task<Result<string>> ConnectAllAsync(CancellationToken cancellationToken = default);
    Task DisconnectAllAsync(CancellationToken cancellationToken = default);
    bool TryGetConnectorForGateway(string? gateway, out OrleansClientConnector? connector);
    IReadOnlyDictionary<string, OrleansClientConnector> Connectors { get; }
    bool IsConnected { get; }
    void SetDiagnosticSink(Action<string>? sink);
}
