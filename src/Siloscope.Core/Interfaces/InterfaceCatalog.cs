using System.Reflection;
using FluentResults;

namespace Siloscope.Core.Interfaces;

public sealed record GrainMethodDescriptor(string Signature, MethodInfo MethodInfo);

public sealed record GrainInterfaceDescriptor(
    string Name,
    Type InterfaceType,
    IReadOnlyList<GrainMethodDescriptor> Methods,
    string? Gateway,
    string? SourceId = null
);

public sealed record InterfaceSourceDescriptor(
    string SourceId,
    string SourceType,
    string Reference,
    string Label,
    string? Version,
    string? Gateway,
    bool Enabled,
    string AssemblyPath
);

public sealed record InterfaceCatalog(
    IReadOnlyList<GrainInterfaceDescriptor> Grains,
    IReadOnlyList<string> AssemblyPaths,
    IReadOnlyList<InterfaceSourceDescriptor>? Sources = null
)
{
    public IReadOnlyList<InterfaceSourceDescriptor> SourceDescriptors => Sources ?? [];

    public IReadOnlyList<string> Gateways =>
        Grains.Select(static g => g.Gateway).Where(static g => g is not null).Distinct().ToList()!;
}
