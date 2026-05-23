using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a saved request configuration exposed to the desktop renderer.
/// </summary>
public sealed record SavedRequestContext(
    [property: JsonPropertyName("tabId")] string TabId,
    [property: JsonPropertyName("isDefaultActive")] bool IsDefaultActive,
    [property: JsonPropertyName("targetGrainClass")] string TargetGrainClass,
    [property: JsonPropertyName("targetMethod")] string TargetMethod,
    [property: JsonPropertyName("keyType")] string KeyType,
    [property: JsonPropertyName("grainId")] string GrainId,
    [property: JsonPropertyName("payload")] string Payload,
    [property: JsonPropertyName("sourceId")] string? SourceId,
    [property: JsonPropertyName("functionId")] string? FunctionId
);
