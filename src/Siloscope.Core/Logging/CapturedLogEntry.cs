using System.Text.Json.Serialization;

namespace Siloscope.Core.Logging;

/// <summary>
/// Represents a single captured log entry.
/// </summary>
/// <param name="Timestamp">The UTC timestamp when the log was captured.</param>
/// <param name="Level">The log level, such as "information" or "error".</param>
/// <param name="Category">The logger category name.</param>
/// <param name="Message">The log message.</param>
/// <param name="Exception">An optional exception string representation.</param>
public sealed record CapturedLogEntry(
    [property: JsonPropertyName("timestamp")] DateTimeOffset Timestamp,
    [property: JsonPropertyName("level")] string Level,
    [property: JsonPropertyName("category")] string Category,
    [property: JsonPropertyName("message")] string Message,
    [property: JsonPropertyName("exception")] string? Exception
);
