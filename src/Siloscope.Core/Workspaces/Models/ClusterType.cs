namespace Siloscope.Core.Workspaces;

/// <summary>
/// Defines the supported cluster types.
/// </summary>
public enum ClusterType
{
    /// <summary>
    /// All silos share the same gateway endpoint.
    /// </summary>
    Homogenous,

    /// <summary>
    /// Silos are distributed across different gateway endpoints.
    /// </summary>
    Heterogeneous,
}
