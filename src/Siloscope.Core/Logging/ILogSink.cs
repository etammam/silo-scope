namespace Siloscope.Core.Logging;

/// <summary>
/// Defines a sink that captures log entries for inspection or relay.
/// </summary>
public interface ILogSink
{
    /// <summary>
    /// Occurs when a new log entry is captured.
    /// </summary>
    event EventHandler<CapturedLogEntry>? EntryCaptured;

    /// <summary>
    /// Gets a read-only list of captured log entries.
    /// </summary>
    IReadOnlyList<CapturedLogEntry> Entries { get; }

    /// <summary>
    /// Clears all captured log entries.
    /// </summary>
    void Clear();
}
