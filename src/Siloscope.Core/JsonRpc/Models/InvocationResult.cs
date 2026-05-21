using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents the result of a grain method invocation.
/// </summary>
/// <param name="IsSuccess"><see langword="true" /> if the invocation succeeded; otherwise, <see langword="false" />.</param>
/// <param name="Result">The serialized result of the invocation, or <see langword="null" /> if the invocation failed.</param>
/// <param name="ErrorMessage">An error message if the invocation failed; otherwise, <see langword="null" />.</param>
/// <param name="Timing">Timing information for the invocation, or <see langword="null" />.</param>
public sealed record InvocationResult(
    [property: JsonPropertyName("isSuccess")] bool IsSuccess,
    [property: JsonPropertyName("result")] string? Result,
    [property: JsonPropertyName("errorMessage")] string? ErrorMessage,
    [property: JsonPropertyName("timing")] TimingInfo? Timing
);
