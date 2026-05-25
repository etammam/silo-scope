using System.Text.Json.Serialization;

namespace Siloscope.Core.Configuration;

/// <summary>
/// Represents the runtime options parsed from command-line arguments or configuration files.
/// </summary>
/// <param name="Cluster">The cluster connection options.</param>
/// <param name="Interfaces">The list of interface entries to load.</param>
public sealed record RuntimeOptions(
    [property: JsonPropertyName("cluster")] ToolClusterOptions Cluster,
    [property: JsonPropertyName("interfaces")] IReadOnlyList<InterfaceEntry> Interfaces
);
