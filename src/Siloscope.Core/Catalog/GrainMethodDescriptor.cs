using System.Text.Json.Serialization;

namespace Siloscope.Core.Catalog;

/// <summary>
/// Describes a method on a discovered Orleans grain interface.
/// </summary>
/// <param name="Signature">The formatted method signature.</param>
/// <param name="MethodInfo">The runtime <see cref="System.Reflection.MethodInfo" /> of the method.</param>
public sealed record GrainMethodDescriptor(
    [property: JsonPropertyName("signature")] string Signature,
    [property: JsonPropertyName("methodInfo")] System.Reflection.MethodInfo MethodInfo
);
