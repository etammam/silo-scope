using System.Text.Json.Serialization;

namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents the cluster configuration stored in a workspace.
/// </summary>
public sealed record ClusterConfig
{
    /// <summary>
    /// Gets the clustering type. The default is <see cref="ClusterType.Homogenous" />.
    /// </summary>
    [JsonPropertyName("type")]
    public ClusterType Type { get; init; } = ClusterType.Homogenous;

    /// <summary>
    /// Gets the Orleans cluster identifier.
    /// </summary>
    [JsonPropertyName("clusterId")]
    public string ClusterId { get; init; } = string.Empty;

    /// <summary>
    /// Gets the Orleans service identifier.
    /// </summary>
    [JsonPropertyName("serviceId")]
    public string ServiceId { get; init; } = string.Empty;

    /// <summary>
    /// Gets the default gateway endpoint address.
    /// </summary>
    [JsonPropertyName("defaultGateway")]
    public string DefaultGateway { get; init; } = string.Empty;
}
