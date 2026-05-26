using System.Text.Json;

namespace Siloscope.Core.Workspaces;

/// <summary>
/// Provides global file-based environment configuration persistence.
/// </summary>
public class EnvironmentService : IEnvironmentService
{
    private readonly string _appDataRoot;

    public EnvironmentService(string? appDataRoot = null)
    {
        _appDataRoot =
            appDataRoot ?? Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
    };

    public async Task<EnvironmentConfig> LoadAsync()
    {
        var path = GetEnvironmentPath();
        if (!File.Exists(path))
        {
            return new EnvironmentConfig();
        }

        var json = await File.ReadAllTextAsync(path);
        var config = JsonSerializer.Deserialize<EnvironmentConfig>(json, JsonOptions);

        return config ?? new EnvironmentConfig();
    }

    public async Task SaveAsync(EnvironmentConfig config)
    {
        var path = GetEnvironmentPath();
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var json = JsonSerializer.Serialize(config, JsonOptions);
        await File.WriteAllTextAsync(path, json);
    }

    public string GetEnvironmentPath()
    {
        return Path.Combine(GetAppDirectory(), "environments.json");
    }

    private string GetAppDirectory()
    {
        return Path.Combine(_appDataRoot, "SiloScope");
    }
}
