using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a function exposed by a grain interface within a source catalog.
/// </summary>
/// <param name="FunctionId">The unique identifier of the function.</param>
/// <param name="SourceId">The identifier of the owning source.</param>
/// <param name="InterfaceId">The identifier of the owning interface.</param>
/// <param name="InterfaceName">The short name of the owning interface.</param>
/// <param name="Namespace">The namespace of the owning interface.</param>
/// <param name="MethodName">The name of the method.</param>
/// <param name="Signature">The formatted method signature.</param>
/// <param name="ReturnType">The return type of the method.</param>
/// <param name="KeyType">The grain key type required by the interface.</param>
/// <param name="Parameters">The list of method parameters.</param>
public sealed record SourceCatalogFunction(
    [property: JsonPropertyName("functionId")] string FunctionId,
    [property: JsonPropertyName("sourceId")] string SourceId,
    [property: JsonPropertyName("interfaceId")] string InterfaceId,
    [property: JsonPropertyName("interfaceName")] string InterfaceName,
    [property: JsonPropertyName("namespace")] string Namespace,
    [property: JsonPropertyName("methodName")] string MethodName,
    [property: JsonPropertyName("signature")] string Signature,
    [property: JsonPropertyName("returnType")] string ReturnType,
    [property: JsonPropertyName("keyType")] string KeyType,
    [property: JsonPropertyName("parameters")] IReadOnlyList<FunctionParameterInfo> Parameters
);
