using Microsoft.Extensions.Logging;

namespace Siloscope.Core.Logging;

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
