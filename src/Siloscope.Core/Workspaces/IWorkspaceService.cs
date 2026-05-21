namespace Siloscope.Core.Workspaces;

/// <summary>
/// Provides workspace persistence and discovery operations.
/// </summary>
public interface IWorkspaceService
{
    /// <summary>
    /// Loads a workspace from the specified file path.
    /// </summary>
    /// <param name="path">The file path of the workspace to load.</param>
    /// <returns>A <see cref="Task" /> that represents the asynchronous load operation.</returns>
    /// <exception cref="FileNotFoundException">The workspace file does not exist.</exception>
    Task<Workspace> LoadAsync(string path);

    /// <summary>
    /// Lists all persisted workspaces.
    /// </summary>
    /// <returns>A <see cref="Task" /> that represents the asynchronous list operation.</returns>
    Task<IReadOnlyList<Workspace>> ListAsync();

    /// <summary>
    /// Saves the workspace to the specified file path.
    /// </summary>
    /// <param name="path">The file path to save the workspace to.</param>
    /// <param name="workspace">The workspace to persist.</param>
    /// <returns>A <see cref="Task" /> that represents the asynchronous save operation.</returns>
    Task SaveAsync(string path, Workspace workspace);

    /// <summary>
    /// Gets the default workspace file path.
    /// </summary>
    /// <returns>The default workspace file path.</returns>
    string GetDefaultWorkspacePath();

    /// <summary>
    /// Gets the file path for a workspace with the specified identifier.
    /// </summary>
    /// <param name="workspaceId">The workspace identifier.</param>
    /// <returns>The derived file path.</returns>
    string GetWorkspacePath(string workspaceId);

    /// <summary>
    /// Gets the path of the last loaded workspace, or the default path if none was recorded.
    /// </summary>
    /// <returns>The last workspace file path.</returns>
    string GetLastWorkspacePath();

    /// <summary>
    /// Records the specified path as the last loaded workspace.
    /// </summary>
    /// <param name="path">The workspace file path to record.</param>
    /// <returns>A <see cref="Task" /> that represents the asynchronous operation.</returns>
    Task SetLastWorkspacePathAsync(string path);
}
