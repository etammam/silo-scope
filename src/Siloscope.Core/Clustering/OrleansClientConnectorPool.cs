using FluentResults;
using Microsoft.Extensions.Logging;
using Siloscope.Core.Catalog;
using Siloscope.Core.Configuration;

namespace Siloscope.Core.Clustering;

/// <summary>
/// Manages a pool of <see cref="OrleansClientConnector" /> instances, one per gateway endpoint.
/// </summary>
public sealed class OrleansClientConnectorPool : IOrleansClientConnectorPool, IDisposable
{
    private readonly Dictionary<string, OrleansClientConnector> _connectors = new(
        StringComparer.OrdinalIgnoreCase
    );
    private readonly ILogger<OrleansClientConnectorPool>? _logger;
    private ToolClusterOptions? _clusterOptions;
    private List<string>? _assemblyPaths;

    public OrleansClientConnectorPool(ILogger<OrleansClientConnectorPool>? logger = null)
    {
        _logger = logger;
        _logger?.LogInformation("OrleansClientConnectorPool created (no args)");
    }

    public OrleansClientConnectorPool(
        ToolClusterOptions clusterOptions,
        InterfaceCatalog catalog,
        IReadOnlyList<InterfaceEntry> entries,
        ILogger<OrleansClientConnectorPool>? logger = null
    )
        : this(logger)
    {
        _logger?.LogInformation("OrleansClientConnectorPool created (with cluster options)");
        Configure(clusterOptions, catalog, entries);
    }

    public void Configure(
        ToolClusterOptions clusterOptions,
        InterfaceCatalog catalog,
        IReadOnlyList<InterfaceEntry>? entries = null
    )
    {
        foreach (var connector in _connectors.Values)
        {
            connector.Dispose();
        }

        _connectors.Clear();
        _clusterOptions = clusterOptions;
        _assemblyPaths = catalog.AssemblyPaths.Count > 0 ? catalog.AssemblyPaths.ToList() : null;

        _logger?.LogInformation(
            "Configure: catalog has {GatewayCount} gateways: {Gateways}",
            catalog.Gateways.Count,
            string.Join(", ", catalog.Gateways)
        );

        var gatewayToAssemblyPaths = new Dictionary<string, List<string>>(
            StringComparer.OrdinalIgnoreCase
        );

        if (entries is not null)
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

        _logger?.LogInformation(
            "Configured {ConnectorCount} connectors: {Connectors}",
            _connectors.Count,
            string.Join(", ", _connectors.Keys)
        );
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

        _logger?.LogInformation(
            "ConnectAllAsync: connecting to {Count} connectors",
            _connectors.Count
        );

        foreach (var (gateway, connector) in _connectors)
        {
            _logger?.LogInformation("Connecting to gateway {Gateway}", gateway);
            var result = await connector.ConnectAsync(cancellationToken);
            if (result.IsFailed)
            {
                _logger?.LogWarning(
                    "Gateway {Gateway} connection failed: {Error}",
                    gateway,
                    result.Errors.Select(e => e.Message)
                );
                errors.AddRange(result.Errors.Select(e => $"[{gateway}] {e.Message}"));
            }
            else
            {
                _logger?.LogInformation(
                    "Gateway {Gateway} connected: {Message}",
                    gateway,
                    result.Value
                );
            }
        }

        _logger?.LogInformation(
            "After ConnectAllAsync, IsConnected={IsConnected}, connectors: {Status}",
            IsConnected,
            string.Join(", ", _connectors.Select(kv => $"{kv.Key}={kv.Value.IsConnected}"))
        );

        return errors.Count > 0
            ? Result.Fail($"Connection errors:\n{string.Join("\n", errors)}")
            : Result.Ok($"Connected to {_connectors.Count} gateway(s).");
    }

    public bool TryGetConnectorForGateway(string? gateway, out OrleansClientConnector? connector)
    {
        connector = null;

        _logger?.LogDebug(
            "TryGetConnectorForGateway: looking for '{Gateway}', available: {Keys}",
            gateway ?? "null",
            string.Join(", ", _connectors.Keys)
        );

        if (gateway is not null && _connectors.TryGetValue(gateway, out connector))
        {
            _logger?.LogDebug(
                "TryGetConnectorForGateway: found exact match for '{Gateway}'",
                gateway
            );
            return true;
        }

        if (_connectors.Count > 0)
        {
            connector = _connectors.Values.First();
            _logger?.LogDebug("TryGetConnectorForGateway: falling back to first connector");
            return true;
        }

        _logger?.LogWarning("TryGetConnectorForGateway: no connectors available");
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
