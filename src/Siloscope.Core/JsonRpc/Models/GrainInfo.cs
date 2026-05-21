using System.Text.Json.Serialization;

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
    [property: JsonPropertyName("fullName")] string FullName,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("namespace")] string Namespace,
    [property: JsonPropertyName("methods")] IReadOnlyList<MethodInfo> Methods,
    [property: JsonPropertyName("gateway")] string? Gateway
);
