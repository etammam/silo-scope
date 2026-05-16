using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using Serilog;
using Serilog.Sinks.SystemConsole.Themes;
using Siloscope.Core.Components.Nuget;

namespace Siloscope.Core;

public static class DependencyInjection
{
    public static IHostApplicationBuilder AddCore(this IHostApplicationBuilder builder)
    {
        Log.Logger = new LoggerConfiguration()
            .Enrich.FromLogContext()
            .WriteTo.Console(theme: AnsiConsoleTheme.Literate)
            .CreateLogger();

        builder.Logging.ClearProviders();
        builder.Services.AddLogging(logger => logger.AddSerilog());

        builder.Services.AddSingleton<INugetConnectionManager, NugetConnectionManager>();

        return builder;
    }
}
