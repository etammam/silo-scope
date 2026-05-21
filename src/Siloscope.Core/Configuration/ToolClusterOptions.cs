namespace Siloscope.Core.Configuration;

/// <summary>
/// Represents the cluster options used to configure an Orleans client connection.
/// </summary>
/// <param name="ClusterId">The Orleans cluster identifier.</param>
/// <param name="ServiceId">The Orleans service identifier.</param>
/// <param name="GatewayEndpoints">The list of gateway endpoint addresses.</param>
/// <param name="Clustering">Optional clustering provider configuration.</param>
public sealed record ToolClusterOptions(
    string ClusterId,
    string ServiceId,
    IReadOnlyList<string> GatewayEndpoints,
    ToolClusteringOptions? Clustering = null
);
