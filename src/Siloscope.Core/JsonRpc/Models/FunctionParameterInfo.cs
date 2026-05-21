using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a parameter of a grain method.
/// </summary>
/// <param name="Name">The name of the parameter.</param>
/// <param name="TypeName">The type name of the parameter.</param>
public sealed record FunctionParameterInfo(
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("typeName")] string TypeName
);
