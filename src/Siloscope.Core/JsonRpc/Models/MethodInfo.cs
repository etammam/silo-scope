namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a method exposed by a grain interface.
/// </summary>
/// <param name="Name">The name of the method.</param>
/// <param name="Signature">The formatted method signature.</param>
/// <param name="ReturnType">The return type of the method.</param>
public sealed record MethodInfo(string Name, string Signature, string ReturnType);
