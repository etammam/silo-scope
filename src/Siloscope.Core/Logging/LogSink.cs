namespace Siloscope.Core.Logging;

/// <summary>
/// Provides a thread-safe in-memory sink for captured log entries with a configurable maximum capacity.
/// </summary>
public sealed class LogSink : ILogSink
{
    private const int MaxEntries = 50_000;
    private readonly List<CapturedLogEntry> _entries = [];
    private readonly Lock _gate = new();

    public event EventHandler<CapturedLogEntry>? EntryCaptured;

    public IReadOnlyList<CapturedLogEntry> Entries
    {
        get
        {
            lock (_gate)
            {
                return _entries.ToArray();
            }
        }
    }

    public void Clear()
    {
        lock (_gate)
        {
            _entries.Clear();
        }
    }

    internal void Capture(CapturedLogEntry entry)
    {
        lock (_gate)
        {
            _entries.Add(entry);
            if (_entries.Count > MaxEntries)
            {
                _entries.RemoveRange(0, _entries.Count - MaxEntries);
            }
        }

        EntryCaptured?.Invoke(this, entry);
    }
}
