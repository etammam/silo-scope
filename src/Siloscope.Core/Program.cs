using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Events;
using Serilog.Sinks.SystemConsole.Themes;
using Siloscope.Core.Cluster;
using Siloscope.Core.Components.Nuget;
using Siloscope.Core.Components.Workspace;
using Siloscope.Core.Endpoints;
using Siloscope.Core.Interfaces;
using Siloscope.Core.Logging;
using Siloscope.Core.Serialization;
using StreamJsonRpc;

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
services.AddSingleton<InterfaceCatalogLoader>();
services.AddTransient<IOrleansClientConnectorPool, OrleansClientConnectorPool>();
services.AddTransient<IGrainInvocationService, GrainInvocationService>();

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
jsonRpc.StartListening();

Log.Information("JSON-RPC server listening...");

#pragma warning disable VSTHRD003
await jsonRpc.Completion.ConfigureAwait(false);
#pragma warning restore VSTHRD003
