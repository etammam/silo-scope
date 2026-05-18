using System.Text.Json;

namespace Siloscope.Core.Components.Workspace;

public interface IWorkspaceService
{
    Task<Workspace> LoadAsync(string path);
    Task<IReadOnlyList<Workspace>> ListAsync();
    Task SaveAsync(string path, Workspace workspace);
    string GetDefaultWorkspacePath();
    string GetWorkspacePath(string workspaceId);
    string GetLastWorkspacePath();
    Task SetLastWorkspacePathAsync(string path);
}

public class WorkspaceService : IWorkspaceService
{
    private readonly string _appDataRoot;

    public WorkspaceService(string? appDataRoot = null)
    {
        _appDataRoot =
            appDataRoot ?? Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData);
    }

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        WriteIndented = true,
        PropertyNameCaseInsensitive = true,
    };

    private string GetSessionFilePath()
    {
        return Path.Combine(_appDataRoot, "SiloScope", "session.json");
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

    public async Task<IReadOnlyList<Workspace>> ListAsync()
    {
        var workspaceDirectory = GetWorkspaceDirectory();
        if (!Directory.Exists(workspaceDirectory))
        {
            return [];
        }

        var workspaces = new List<Workspace>();
        foreach (var path in Directory.EnumerateFiles(workspaceDirectory, "*.workspace.json"))
        {
            workspaces.Add(await LoadAsync(path));
        }

        return workspaces
            .OrderBy(workspace => workspace.WorkspaceInfo.Name, StringComparer.OrdinalIgnoreCase)
            .ToList();
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
        return GetWorkspacePath("default");
    }

    public string GetWorkspacePath(string workspaceId)
    {
        var safeWorkspaceId = SanitizeFileName(
            string.IsNullOrWhiteSpace(workspaceId) ? "default" : workspaceId
        );
        return Path.Combine(GetWorkspaceDirectory(), $"{safeWorkspaceId}.workspace.json");
    }

    private static string SanitizeFileName(string value)
    {
        var invalidCharacters = Path.GetInvalidFileNameChars().Append(':').ToArray();
        return new string(
            value
                .Select(character => invalidCharacters.Contains(character) ? '-' : character)
                .ToArray()
        );
    }

    private string GetWorkspaceDirectory()
    {
        return Path.Combine(_appDataRoot, "SiloScope", "workspaces");
    }
}

internal class SessionData
{
    public string? LastWorkspacePath { get; set; }
}
