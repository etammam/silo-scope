using Microsoft.Extensions.Logging;

namespace Siloscope.Core.Logging;

/// <summary>
/// Provides <see cref="ILogger" /> instances that write captured entries into a <see cref="LogSink" />.
/// </summary>
public sealed class LogSinkLoggerProvider(LogSink sink) : ILoggerProvider
{
    /// <summary>
    /// Creates a logger with the specified category that writes to the configured sink.
    /// </summary>
    /// <param name="categoryName">The logger category name.</param>
    /// <returns>An <see cref="ILogger" /> that captures entries into the sink.</returns>
    public ILogger CreateLogger(string categoryName)
    {
        return new LogSinkLogger(categoryName, sink);
    }

    /// <summary>
    /// Releases any resources used by the provider.
    /// </summary>
    public void Dispose() { }
}
