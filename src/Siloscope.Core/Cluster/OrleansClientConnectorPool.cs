using FluentResults;
using Siloscope.Core.Configuration;
using Siloscope.Core.Interfaces;

namespace Siloscope.Core.Cluster;

public sealed class OrleansClientConnectorPool : IOrleansClientConnectorPool, IDisposable
{
    private readonly Dictionary<string, OrleansClientConnector> _connectors = new(
        StringComparer.OrdinalIgnoreCase
    );
    private ToolClusterOptions? _clusterOptions;
    private List<string>? _assemblyPaths;

    public OrleansClientConnectorPool() { }

    public OrleansClientConnectorPool(
        ToolClusterOptions clusterOptions,
        InterfaceCatalog catalog,
        IReadOnlyList<InterfaceEntry> entries
    )
        : this()
    {
        Configure(clusterOptions, catalog, entries);
    }

    public void Configure(
        ToolClusterOptions clusterOptions,
        InterfaceCatalog catalog,
        IReadOnlyList<InterfaceEntry>? entries = null
    )
    {
        _clusterOptions = clusterOptions;
        _assemblyPaths = catalog.AssemblyPaths.Count > 0 ? catalog.AssemblyPaths.ToList() : null;

        var gatewayToAssemblyPaths = new Dictionary<string, List<string>>(
            StringComparer.OrdinalIgnoreCase
        );

        if (entries != null)
        {
            foreach (var entry in entries)
            {
                var gw = entry.Gateway;
                if (string.IsNullOrWhiteSpace(gw) || string.IsNullOrWhiteSpace(entry.DllPath))
                    continue;

                if (!gatewayToAssemblyPaths.TryGetValue(gw, out var paths))
                {
                    paths = [];
                    gatewayToAssemblyPaths[gw] = paths;
                }
                paths.Add(entry.DllPath);
            }
        }

        foreach (var gateway in catalog.Gateways)
        {
            if (_connectors.ContainsKey(gateway))
                continue;

            var perGatewayCluster = new ToolClusterOptions(
                clusterOptions.ClusterId,
                clusterOptions.ServiceId,
                [gateway]
            );

            gatewayToAssemblyPaths.TryGetValue(gateway, out var assemblyPaths);
            _connectors[gateway] = new OrleansClientConnector(perGatewayCluster, assemblyPaths);
        }

        if (_connectors.Count == 0)
        {
            _connectors["localhost"] = new OrleansClientConnector(clusterOptions, _assemblyPaths);
        }
    }

    public async Task DisconnectAllAsync(CancellationToken cancellationToken = default)
    {
        foreach (var connector in _connectors.Values)
        {
            await connector.DisconnectAsync();
        }
    }

    public bool IsConnected => _connectors.Values.All(static c => c.IsConnected);

    public IReadOnlyDictionary<string, OrleansClientConnector> Connectors => _connectors;

    public void SetDiagnosticSink(Action<string>? sink)
    {
        foreach (var connector in _connectors.Values)
        {
            connector.SetDiagnosticSink(sink);
        }
    }

    public async Task<Result<string>> ConnectAllAsync(CancellationToken cancellationToken)
    {
        var errors = new List<string>();

        foreach (var (gateway, connector) in _connectors)
        {
            var result = await connector.ConnectAsync(cancellationToken);
            if (result.IsFailed)
            {
                errors.AddRange(result.Errors.Select(e => $"[{gateway}] {e.Message}"));
            }
        }

        return errors.Count > 0
            ? Result.Fail($"Connection errors:\n{string.Join("\n", errors)}")
            : Result.Ok($"Connected to {_connectors.Count} gateway(s).");
    }

    public bool TryGetConnectorForGateway(string? gateway, out OrleansClientConnector? connector)
    {
        connector = null;

        if (gateway is not null && _connectors.TryGetValue(gateway, out connector))
        {
            return true;
        }

        if (_connectors.Count > 0)
        {
            connector = _connectors.Values.First();
            return true;
        }

        return false;
    }

    public void Dispose()
    {
        foreach (var connector in _connectors.Values)
        {
            connector.Dispose();
        }

        _connectors.Clear();
    }
}
