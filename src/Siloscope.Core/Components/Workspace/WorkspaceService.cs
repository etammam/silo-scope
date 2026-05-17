using System.Text.Json;

namespace Siloscope.Core.Components.Workspace;

public interface IWorkspaceService
{
    Task<Workspace> LoadAsync(string path);
    Task SaveAsync(string path, Workspace workspace);
    string GetDefaultWorkspacePath();
    string GetLastWorkspacePath();
    Task SetLastWorkspacePathAsync(string path);
}

public class WorkspaceService : IWorkspaceService
{
    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
    };

    private string GetSessionFilePath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, "SiloScope", "session.json");
    }

    public string GetLastWorkspacePath()
    {
        var sessionPath = GetSessionFilePath();
        if (!File.Exists(sessionPath))
            return GetDefaultWorkspacePath();

        var json = File.ReadAllText(sessionPath);
        var session = JsonSerializer.Deserialize<SessionData>(json, JsonOptions);
        return session?.LastWorkspacePath ?? GetDefaultWorkspacePath();
    }

    public async Task SetLastWorkspacePathAsync(string path)
    {
        var directory = Path.GetDirectoryName(GetSessionFilePath());
        if (!string.IsNullOrEmpty(directory) && !Directory.Exists(directory))
        {
            Directory.CreateDirectory(directory);
        }

        var session = new SessionData { LastWorkspacePath = path };
        var json = JsonSerializer.Serialize(session, JsonOptions);
        await File.WriteAllTextAsync(GetSessionFilePath(), json);
    }

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

        await SetLastWorkspacePathAsync(path);
    }

    public string GetDefaultWorkspacePath()
    {
        var appData = Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
        return Path.Combine(appData, "SiloScope", "workspaces", "default.workspace.json");
    }
}

internal class SessionData
{
    public string? LastWorkspacePath { get; set; }
}
