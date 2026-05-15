using Siloscope.Core.Configuration;
using Siloscope.Core.Interfaces;

namespace Siloscope.Core.Cluster;

/// <summary>
/// Manages one <see cref="OrleansClientConnector"/> per unique gateway endpoint.
/// In a heterogeneous cluster each silo gateway can only deserialize its own grain types,
/// so invocations must be routed through the correct gateway.
/// </summary>
public sealed class OrleansClientConnectorPool : IDisposable
{
    private readonly Dictionary<string, OrleansClientConnector> _connectors = new(
        StringComparer.OrdinalIgnoreCase
    );

    public OrleansClientConnectorPool(
        ToolClusterOptions clusterOptions,
        InterfaceCatalog catalog,
        IReadOnlyList<InterfaceEntry> entries
    )
    {
        // Build mapping: gateway → interface assembly paths (for serializer registration).
        var gatewayToAssemblyPaths = new Dictionary<string, List<string>>(
            StringComparer.OrdinalIgnoreCase
        );
        foreach (var entry in entries)
        {
            var gw = entry.Gateway;
            if (string.IsNullOrWhiteSpace(gw) || string.IsNullOrWhiteSpace(entry.DllPath))
            {
                continue;
            }

            if (!gatewayToAssemblyPaths.TryGetValue(gw, out var paths))
            {
                paths = [];
                gatewayToAssemblyPaths[gw] = paths;
            }

            paths.Add(entry.DllPath);
        }

        // Create one connector per unique gateway referenced by the loaded grains.
        foreach (var gateway in catalog.Gateways)
        {
            if (_connectors.ContainsKey(gateway))
            {
                continue;
            }

            var perGatewayCluster = new ToolClusterOptions(
                clusterOptions.ClusterId,
                clusterOptions.ServiceId,
                [gateway]
            );

            gatewayToAssemblyPaths.TryGetValue(gateway, out var assemblyPaths);
            _connectors[gateway] = new OrleansClientConnector(perGatewayCluster, assemblyPaths);
        }

        // Fallback: if no gateways are specified, create a single connector with all interface assemblies.
        // This is the common case for Redis clustering where gateways are discovered dynamically.
        if (_connectors.Count == 0)
        {
            _connectors["localhost"] = new OrleansClientConnector(
                clusterOptions,
                catalog.AssemblyPaths.Count > 0 ? catalog.AssemblyPaths.ToList() : null
            );
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

    public async Task<OperationResult<string>> ConnectAllAsync(CancellationToken cancellationToken)
    {
        var errors = new List<string>();

        foreach (var (gateway, connector) in _connectors)
        {
            var result = await connector.ConnectAsync(cancellationToken);
            if (!result.IsSuccess)
            {
                errors.Add($"[{gateway}] {result.ErrorMessage}");
            }
        }

        return errors.Count > 0
            ? OperationResult<string>.Failure($"Connection errors:\n{string.Join("\n", errors)}")
            : OperationResult<string>.Success($"Connected to {_connectors.Count} gateway(s).");
    }

    public bool TryGetConnectorForGateway(string? gateway, out OrleansClientConnector? connector)
    {
        connector = null;

        if (gateway is not null && _connectors.TryGetValue(gateway, out connector))
        {
            return true;
        }

        // Fallback: return the first (or only) connector.
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
