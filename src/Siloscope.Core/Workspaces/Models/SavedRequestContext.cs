using System.Text.Json.Serialization;

namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents an explicitly saved request configuration for a workspace tab.
/// </summary>
public sealed record SavedRequestContext
{
    /// <summary>
    /// Gets the identifier of the tab this context belongs to.
    /// </summary>
    [JsonPropertyName("tabId")]
    public string TabId { get; init; } = string.Empty;

    /// <summary>
    /// Gets a value indicating whether this context should be restored as the default active tab.
    /// </summary>
    [JsonPropertyName("isDefaultActive")]
    public bool IsDefaultActive { get; init; }

    /// <summary>
    /// Gets the target grain interface or class name.
    /// </summary>
    [JsonPropertyName("targetGrainClass")]
    public string TargetGrainClass { get; init; } = string.Empty;

    /// <summary>
    /// Gets the target method name.
    /// </summary>
    [JsonPropertyName("targetMethod")]
    public string TargetMethod { get; init; } = string.Empty;

    /// <summary>
    /// Gets the grain key type.
    /// </summary>
    [JsonPropertyName("keyType")]
    public string KeyType { get; init; } = "String";

    /// <summary>
    /// Gets the grain identifier.
    /// </summary>
    [JsonPropertyName("grainId")]
    public string GrainId { get; init; } = string.Empty;

    /// <summary>
    /// Gets the raw JSON payload text.
    /// </summary>
    [JsonPropertyName("payload")]
    public string Payload { get; init; } = "{\n}";

    /// <summary>
    /// Gets the optional source identifier for source-owned catalog selections.
    /// </summary>
    [JsonPropertyName("sourceId")]
    public string? SourceId { get; init; }

    /// <summary>
    /// Gets the optional catalog function identifier.
    /// </summary>
    [JsonPropertyName("functionId")]
    public string? FunctionId { get; init; }
}
