using System.Threading.Channels;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.SystemConsole.Themes;
using Siloscope.Core.Catalog;
using Siloscope.Core.Clustering;
using Siloscope.Core.JsonRpc;
using Siloscope.Core.Logging;
using Siloscope.Core.NuGet;
using Siloscope.Core.Serialization;
using Siloscope.Core.Workspaces;
using StreamJsonRpc;

/// <summary>
/// The SiloScope backend entry point. Sets up dependency injection, logging, and starts a JSON-RPC server over standard input and output.
/// </summary>
var logPath = Path.Combine(
    Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
    "SiloScope",
    "logs",
    "siloscope-.log"
);

Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .MinimumLevel.Information()
    .WriteTo.Console(
        theme: AnsiConsoleTheme.Literate,
        standardErrorFromLevel: LogEventLevel.Verbose
    )
    .WriteTo.File(logPath, rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7)
    .CreateLogger();

var services = new ServiceCollection();
var logSink = new LogSink();
services.AddSingleton<ILogSink>(logSink);
services.AddLogging(logger =>
{
    logger.AddSerilog(dispose: true);
    logger.AddProvider(new LogSinkLoggerProvider(logSink));
});

Log.Information("SiloScope Core starting...");

// Core services
services.AddSingleton<INugetConnectionManager, NugetConnectionManager>();
services.AddSingleton<IWorkspaceService, WorkspaceService>();
services.AddSingleton<IEnvironmentService, EnvironmentService>();
services.AddSingleton<InterfaceCatalogLoader>();
services.AddSingleton<IOrleansClientConnectorPool, OrleansClientConnectorPool>();
services.AddSingleton<IGrainInvocationService, GrainInvocationService>();

// JSON-RPC command handlers
services.AddTransient<ISiloScopeCommands, SiloScopeCommands>();

await using var serviceProvider = services.BuildServiceProvider();

// Set up JSON-RPC over stdio
// JsonRpc(sendingStream, receivingStream, target) = (stdout, stdin, commands)
var commands = serviceProvider.GetRequiredService<ISiloScopeCommands>();

var formatter = new JsonMessageFormatter();
formatter.JsonSerializer.Converters.Add(new FluentResultJsonConverter());

var messageHandler = new HeaderDelimitedMessageHandler(
    Console.OpenStandardOutput(),
    Console.OpenStandardInput(),
    formatter
);

var jsonRpc = new JsonRpc(messageHandler, commands);
var logChannel = Channel.CreateUnbounded<CapturedLogEntry>();
logSink.EntryCaptured += (_, entry) => logChannel.Writer.TryWrite(entry);

_ = Task.Run(async () =>
{
    await foreach (var entry in logChannel.Reader.ReadAllAsync().ConfigureAwait(false))
    {
        try
        {
            await jsonRpc.NotifyWithParameterObjectAsync("log", entry).ConfigureAwait(false);
        }
        catch (Exception ex)
        {
            Log.Debug(ex, "Failed to send log notification.");
        }
    }
});
jsonRpc.StartListening();

Log.Information("JSON-RPC server listening...");

#pragma warning disable VSTHRD003
await jsonRpc.Completion.ConfigureAwait(false);
#pragma warning restore VSTHRD003
