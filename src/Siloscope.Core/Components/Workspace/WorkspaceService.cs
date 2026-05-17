using System.Text.Json;

namespace Siloscope.Core.Components.Workspace;

public interface IWorkspaceService
{
    Task<Workspace> LoadAsync(string path);
    Task SaveAsync(string path, Workspace workspace);
    string GetDefaultWorkspacePath();
}

public class WorkspaceService : IWorkspaceService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
    };

    public async Task<Workspace> LoadAsync(string path)
    {
        if (!File.Exists(path))
        {
            throw new FileNotFoundException($"Workspace file not found: {path}");
        }

        var json = await File.ReadAllTextAsync(path);
        var workspace = JsonSerializer.Deserialize<Workspace>(json, JsonOptions);

        if (workspace == null)
        {
            throw new InvalidOperationException("Failed to deserialize workspace JSON");
        }

        return workspace;
    }

    public async Task SaveAsync(string path, Workspace workspace)
    {
        var directory = Path.GetDirectoryName(path);
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var json = JsonSerializer.Serialize(workspace, JsonOptions);
        await File.WriteAllTextAsync(path, json);
    }

    public string GetDefaultWorkspacePath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, "SiloScope", "workspaces", "default.workspace.json");
    }
}
