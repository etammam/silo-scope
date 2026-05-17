using AwesomeAssertions;
using Microsoft.Extensions.Logging;
using Siloscope.Core.Logging;
using Xunit;

namespace Siloscope.Test.Core;

public sealed class LogSinkTests
{
    [Fact]
    public void LogSink_ImplementsILogger()
    {
        var sink = new TestLogSink();
        var logger = new LogSink("TestCategory", sink);

        logger.LogInformation("Test message");

        sink.Logs.Should().NotBeEmpty();
        sink.Logs[0].Category.Should().Be("TestCategory");
    }

    [Fact]
    public void LogSink_DoesNotLogDisabledLevels()
    {
        var sink = new TestLogSink();
        var logger = new LogSink("TestCategory", sink);

        logger.Log(LogLevel.None, 0, "test", null, (s, e) => s.ToString()!);

        sink.Logs.Should().BeEmpty();
    }

    [Fact]
    public void LogSinkProvider_CreatesLoggers()
    {
        var provider = new LogSinkProvider();
        var logger = provider.CreateLogger("TestLogger");

        logger.Should().BeOfType<LogSink>();
    }

    private class TestLogSink : ILogSink
    {
        public List<LogEntry> Logs { get; } = new();

        public void Log(LogLevel logLevel, string category, string message, DateTime timestamp)
        {
            Logs.Add(new LogEntry(logLevel, category, message, timestamp));
        }
    }

    private record LogEntry(LogLevel Level, string Category, string Message, DateTime Timestamp);
}
