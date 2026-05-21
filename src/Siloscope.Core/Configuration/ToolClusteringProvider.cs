namespace Siloscope.Core.Configuration;

/// <summary>
/// Defines the supported Orleans clustering providers.
/// </summary>
public enum ToolClusteringProvider
{
    /// <summary>
    /// Uses localhost clustering discovery.
    /// </summary>
    Localhost,

    /// <summary>
    /// Uses statically configured gateway endpoints.
    /// </summary>
    Static,

    /// <summary>
    /// Uses Redis for cluster membership discovery.
    /// </summary>
    Redis,
}
