using System.Reflection;

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
    /// <summary>All unique gateway endpoints referenced by the loaded grains.</summary>
    public IReadOnlyList<string> Gateways =>
        Grains.Select(static g => g.Gateway).Where(static g => g is not null).Distinct().ToList()!;
}

public sealed record OperationResult<T>(bool IsSuccess, T? Value, string? ErrorMessage)
{
    public static OperationResult<T> Success(T value)
    {
        return new OperationResult<T>(true, value, null);
    }

    public static OperationResult<T> Failure(string errorMessage)
    {
        return new OperationResult<T>(false, default, errorMessage);
    }
}
