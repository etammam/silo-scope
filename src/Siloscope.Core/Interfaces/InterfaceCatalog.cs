using System.Reflection;
using FluentResults;

namespace Siloscope.Core.Interfaces;

public sealed record GrainMethodDescriptor(string Signature, MethodInfo MethodInfo);

public sealed record GrainInterfaceDescriptor(
    string Name,
    Type InterfaceType,
    IReadOnlyList<GrainMethodDescriptor> Methods,
    string? Gateway
);

public sealed record InterfaceCatalog(
    IReadOnlyList<GrainInterfaceDescriptor> Grains,
    IReadOnlyList<string> AssemblyPaths
)
{
    public IReadOnlyList<string> Gateways =>
        Grains.Select(static g => g.Gateway).Where(static g => g is not null).Distinct().ToList()!;
}
