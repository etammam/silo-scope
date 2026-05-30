namespace Siloscope.Core.Workspaces;

/// <summary>
/// Provides global persistence for environment configurations shared across all workspaces.
/// </summary>
public interface IEnvironmentService
{
    /// <summary>
    /// Loads the global environment configuration.
    /// </summary>
    /// <returns>A <see cref="Task" /> containing the environment configuration.</returns>
    Task<EnvironmentConfig> LoadAsync();

    /// <summary>
    /// Saves the global environment configuration.
    /// </summary>
    /// <param name="config">The environment configuration to persist.</param>
    /// <returns>A <see cref="Task" /> representing the asynchronous save operation.</returns>
    Task SaveAsync(EnvironmentConfig config);

    /// <summary>
    /// Gets the file path used for the global environment configuration.
    /// </summary>
    /// <returns>The derived file path.</returns>
    string GetEnvironmentPath();
}
