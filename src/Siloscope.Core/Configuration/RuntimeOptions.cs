namespace Siloscope.Core.Configuration;

/// <summary>
/// Represents the runtime options parsed from command-line arguments or configuration files.
/// </summary>
/// <param name="Cluster">The cluster connection options.</param>
/// <param name="Interfaces">The list of interface entries to load.</param>
public sealed record RuntimeOptions(
    ToolClusterOptions Cluster,
    IReadOnlyList<InterfaceEntry> Interfaces
);
