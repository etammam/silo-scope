namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a discovered grain interface exposed through JSON-RPC.
/// </summary>
/// <param name="FullName">The fully qualified name of the grain interface.</param>
/// <param name="Name">The short name of the grain interface.</param>
/// <param name="Namespace">The namespace of the grain interface.</param>
/// <param name="Methods">The list of methods exposed by the grain interface.</param>
/// <param name="Gateway">The optional gateway endpoint associated with the grain.</param>
public sealed record GrainInfo(
    string FullName,
    string Name,
    string Namespace,
    IReadOnlyList<MethodInfo> Methods,
    string? Gateway
);
