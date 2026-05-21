using Siloscope.Core.Workspaces;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents the cluster connection options used for JSON-RPC communication.
/// </summary>
/// <param name="ClusterId">The Orleans cluster identifier.</param>
/// <param name="ServiceId">The Orleans service identifier.</param>
/// <param name="GatewayEndpoints">The list of gateway endpoint addresses.</param>
/// <param name="Type">The clustering type. The default is <see cref="ClusterType.Homogenous" />.</param>
public sealed record ClusterOptions(
    string ClusterId,
    string ServiceId,
    List<string> GatewayEndpoints,
    ClusterType Type = ClusterType.Homogenous
);
