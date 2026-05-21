using System.Text.Json.Serialization;
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
    [property: JsonPropertyName("clusterId")] string ClusterId,
    [property: JsonPropertyName("serviceId")] string ServiceId,
    [property: JsonPropertyName("gatewayEndpoints")] List<string> GatewayEndpoints,
    [property: JsonPropertyName("type")] ClusterType Type = ClusterType.Homogenous
);
