using System.Text.Json.Serialization;

namespace Siloscope.Core.Configuration;

/// <summary>
/// Represents the result of parsing a configuration value.
/// </summary>
/// <typeparam name="T">The type of the parsed value.</typeparam>
/// <param name="IsSuccess"><see langword="true" /> if parsing succeeded; otherwise, <see langword="false" />.</param>
/// <param name="Value">The parsed value, or <see langword="default" /> if parsing failed.</param>
/// <param name="ErrorMessage">An error message if parsing failed; otherwise, <see langword="null" />.</param>
public readonly record struct ParseResult<T>(
    [property: JsonPropertyName("isSuccess")] bool IsSuccess,
    [property: JsonPropertyName("value")] T? Value,
    [property: JsonPropertyName("errorMessage")] string? ErrorMessage
)
{
    /// <summary>
    /// Creates a successful parse result.
    /// </summary>
    /// <param name="value">The parsed value.</param>
    /// <returns>A successful <see cref="ParseResult{T}" />.</returns>
    public static ParseResult<T> Success(T value) => new(true, value, null);

    /// <summary>
    /// Creates a failed parse result.
    /// </summary>
    /// <param name="errorMessage">The error message describing the failure.</param>
    /// <returns>A failed <see cref="ParseResult{T}" />.</returns>
    public static ParseResult<T> Failure(string errorMessage) => new(false, default, errorMessage);
}
