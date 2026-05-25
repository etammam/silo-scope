using AwesomeAssertions;
using Microsoft.Extensions.Logging;
using Siloscope.Core.Logging;
using Xunit;

namespace Siloscope.Test.Core;

public sealed class LogSinkTests
{
    [Fact]
    public void LoggerProvider_CapturesFormattedLogEntries()
    {
        var sink = new LogSink();
        using var provider = new LogSinkLoggerProvider(sink);
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddProvider(provider));
        var logger = loggerFactory.CreateLogger("SiloScope.Test");

        logger.LogInformation("Workspace {WorkspaceName} loaded", "Local");

        sink.Entries.Should().ContainSingle();
        var entry = sink.Entries[0];
        entry.Level.Should().Be("information");
        entry.Category.Should().Be("SiloScope.Test");
        entry.Message.Should().Be("Workspace Local loaded");
        entry.Timestamp.Should().BeCloseTo(DateTimeOffset.UtcNow, TimeSpan.FromSeconds(5));
        entry.Exception.Should().BeNull();
    }

    [Fact]
    public void LoggerProvider_CapturesExceptions()
    {
        var sink = new LogSink();
        using var provider = new LogSinkLoggerProvider(sink);
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddProvider(provider));
        var logger = loggerFactory.CreateLogger("SiloScope.Errors");
        var exception = new InvalidOperationException("bad workspace");

        logger.LogError(exception, "Workspace failed");

        var entry = sink.Entries.Should().ContainSingle().Subject;
        entry.Level.Should().Be("error");
        entry.Message.Should().Be("Workspace failed");
        entry.Exception.Should().Contain("bad workspace");
    }

    [Fact]
    public void Sink_RaisesEventAndCanClearEntries()
    {
        var sink = new LogSink();
        CapturedLogEntry? captured = null;
        sink.EntryCaptured += (_, entry) => captured = entry;
        using var provider = new LogSinkLoggerProvider(sink);
        using var loggerFactory = LoggerFactory.Create(builder => builder.AddProvider(provider));
        var logger = loggerFactory.CreateLogger("SiloScope.Events");

        logger.LogWarning("No silo sources");

        captured.Should().NotBeNull();
        captured!.Level.Should().Be("warning");
        sink.Entries.Should().ContainSingle();

        sink.Clear();

        sink.Entries.Should().BeEmpty();
    }
}
