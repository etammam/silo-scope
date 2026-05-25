namespace Siloscope.Core.Catalog;

/// <summary>
/// Represents a catalog of discovered grain interfaces, their assembly paths, and source descriptors.
/// </summary>
/// <param name="Grains">The list of discovered grain interfaces.</param>
/// <param name="AssemblyPaths">The list of assembly paths that contain the grain interfaces.</param>
/// <param name="Sources">An optional list of source descriptors.</param>
public sealed record InterfaceCatalog(
    IReadOnlyList<GrainInterfaceDescriptor> Grains,
    IReadOnlyList<string> AssemblyPaths,
    IReadOnlyList<InterfaceSourceDescriptor>? Sources = null
)
{
    /// <summary>
    /// Gets the list of source descriptors, or an empty list if none were provided.
    /// </summary>
    public IReadOnlyList<InterfaceSourceDescriptor> SourceDescriptors => Sources ?? [];

    /// <summary>
    /// Gets the distinct list of gateway endpoints associated with the discovered grains.
    /// </summary>
    public IReadOnlyList<string> Gateways =>
        Grains.Select(static g => g.Gateway).Where(static g => g is not null).Distinct().ToList()!;
}
