using Microsoft.Extensions.Logging;

namespace Siloscope.Core.Logging;

public interface ILogSink
{
    void Log(LogLevel logLevel, string category, string message, DateTime timestamp);
}

public class LogSink : ILogger
{
    private readonly string _categoryName;
    private readonly ILogSink? _sink;

    public LogSink(string categoryName, ILogSink? sink = null)
    {
        _categoryName = categoryName;
        _sink = sink;
    }

    public IDisposable? BeginScope<TState>(TState state)
        where TState : notnull => null;

    public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;

    public void Log<TState>(
        LogLevel logLevel,
        EventId eventId,
        TState state,
        Exception? exception,
        Func<TState, Exception?, string> formatter
    )
    {
        if (!IsEnabled(logLevel))
            return;

        var message = formatter(state, exception);
        _sink?.Log(logLevel, _categoryName, message, DateTime.UtcNow);
    }
}

public class LogSinkProvider : ILoggerProvider
{
    private readonly ILogSink? _sink;

    public LogSinkProvider(ILogSink? sink = null)
    {
        _sink = sink;
    }

    public ILogger CreateLogger(string categoryName) => new LogSink(categoryName, _sink);

    public void Dispose() { }
}
