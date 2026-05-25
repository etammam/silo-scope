using System.Text.Json.Serialization;

namespace Siloscope.Core.Configuration;

/// <summary>
/// Represents the cluster options used to configure an Orleans client connection.
/// </summary>
/// <param name="ClusterId">The Orleans cluster identifier.</param>
/// <param name="ServiceId">The Orleans service identifier.</param>
/// <param name="GatewayEndpoints">The list of gateway endpoint addresses.</param>
/// <param name="Clustering">Optional clustering provider configuration.</param>
public sealed record ToolClusterOptions(
    [property: JsonPropertyName("clusterId")] string ClusterId,
    [property: JsonPropertyName("serviceId")] string ServiceId,
    [property: JsonPropertyName("gatewayEndpoints")] IReadOnlyList<string> GatewayEndpoints,
    [property: JsonPropertyName("clustering")] ToolClusteringOptions? Clustering = null
);
