using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Sinks.SystemConsole.Themes;
using Siloscope.Core.Cluster;
using Siloscope.Core.Components.Nuget;
using Siloscope.Core.Components.Workspace;
using Siloscope.Core.Endpoints;
using Siloscope.Core.Interfaces;
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
    .WriteTo.Console(theme: AnsiConsoleTheme.Literate)
    .WriteTo.File(logPath, rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7)
    .CreateLogger();

var builder = Host.CreateApplicationBuilder(args);

builder.Logging.ClearProviders();
builder.Services.AddLogging(logger => logger.AddSerilog());

Log.Information("SiloScope Core starting...");

// Core services
builder.Services.AddSingleton<INugetConnectionManager, NugetConnectionManager>();
builder.Services.AddSingleton<IWorkspaceService, WorkspaceService>();
builder.Services.AddSingleton<InterfaceCatalogLoader>();
builder.Services.AddTransient<IOrleansClientConnectorPool, OrleansClientConnectorPool>();
builder.Services.AddTransient<IGrainInvocationService, GrainInvocationService>();

// JSON-RPC command handlers
builder.Services.AddTransient<ISiloScopeCommands, SiloScopeCommands>();

var host = builder.Build();

// Set up JSON-RPC over stdio
// JsonRpc(sendingStream, receivingStream, target) = (stdout, stdin, commands)
var commands = host.Services.GetRequiredService<ISiloScopeCommands>();

var jsonRpc = new JsonRpc(Console.OpenStandardOutput(), Console.OpenStandardInput(), commands);
jsonRpc.StartListening();

Log.Information("JSON-RPC server listening...");

// Keep running until stdin is closed
await Task.Delay(Timeout.Infinite);
