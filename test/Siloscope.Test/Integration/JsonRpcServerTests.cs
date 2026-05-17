using System.Diagnostics;
using Xunit;

namespace Siloscope.Test.Integration;

public class JsonRpcServerTests
{
    private static string GetCoreExePath()
    {
        var testDir = AppContext.BaseDirectory;
        var repoRoot = testDir;

        while (repoRoot != null && !File.Exists(Path.Combine(repoRoot, "Siloscope.slnx")))
        {
            repoRoot = Directory.GetParent(repoRoot)?.FullName;
        }

        if (repoRoot == null)
        {
            throw new InvalidOperationException("Could not find repository root");
        }

        var coreDir = Path.Combine(repoRoot, "src", "Siloscope.Core", "bin", "Debug", "net10.0");

        if (OperatingSystem.IsWindows())
        {
            return Path.Combine(coreDir, "Siloscope.Core.exe");
        }

        return Path.Combine(coreDir, "Siloscope.Core");
    }

    [Fact]
    public async Task Server_Starts_And_Stays_Running()
    {
        var corePath = GetCoreExePath();

        if (!File.Exists(corePath))
        {
            throw new InvalidOperationException(
                $"Core executable not found at: {corePath}. Build the project first."
            );
        }

        var process = new Process
        {
            StartInfo = new ProcessStartInfo
            {
                FileName = corePath,
                RedirectStandardInput = true,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true,
            },
        };

        try
        {
            process.Start();

            await Task.Delay(2000);

            var hasExited = process.HasExited;
            var error = hasExited ? await process.StandardError.ReadToEndAsync() : "";

            Assert.False(hasExited, $"Server should not exit immediately. Error: {error}");
        }
        finally
        {
            if (!process.HasExited)
            {
                process.Kill();
            }
            process.Dispose();
        }
    }
}
