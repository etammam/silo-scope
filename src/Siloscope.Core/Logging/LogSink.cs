using Microsoft.Extensions.Logging;

namespace Siloscope.Core.Logging;

public sealed record CapturedLogEntry(
    DateTimeOffset Timestamp,
    string Level,
    string Category,
    string Message,
    string? Exception
);

public interface ILogSink
{
    event EventHandler<CapturedLogEntry>? EntryCaptured;

    IReadOnlyList<CapturedLogEntry> Entries { get; }

    void Clear();
}

public sealed class LogSink : ILogSink
{
    private const int MaxEntries = 1_000;
    private readonly List<CapturedLogEntry> _entries = [];
    private readonly object _gate = new();

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

public sealed class LogSinkLoggerProvider(LogSink sink) : ILoggerProvider
{
    public ILogger CreateLogger(string categoryName)
    {
        return new LogSinkLogger(categoryName, sink);
    }

    public void Dispose() { }
}

internal sealed class LogSinkLogger(string category, LogSink sink) : ILogger
{
    public IDisposable? BeginScope<TState>(TState state)
        where TState : notnull
    {
        return NullScope.Instance;
    }

    public bool IsEnabled(LogLevel logLevel)
    {
        return logLevel != LogLevel.None;
    }

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter
    )
    {
        if (!IsEnabled(logLevel))
        {
            return;
        }

        var message = formatter(state, exception);
        if (string.IsNullOrWhiteSpace(message) && exception is null)
        {
            return;
        }

        sink.Capture(
            new CapturedLogEntry(
                DateTimeOffset.UtcNow,
                logLevel.ToString().ToLowerInvariant(),
                category,
                message,
                exception?.ToString()
            )
        );
    }
}

internal sealed class NullScope : IDisposable
{
    public static readonly NullScope Instance = new();

    public void Dispose() { }
}
