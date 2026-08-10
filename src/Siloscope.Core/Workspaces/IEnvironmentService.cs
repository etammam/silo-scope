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
    /// Updates a single environment profile by name. Replaces the profile
    /// with the same name, or adds it if no match exists.
    /// </summary>
    /// <param name="profileName">The name of the profile to update.</param>
    /// <param name="profile">The replacement profile data.</param>
    /// <returns>A <see cref="Task" /> representing the asynchronous update operation.</returns>
    Task UpdateAsync(string profileName, EnvironmentProfile profile);

    /// <summary>
    /// Deletes a single environment profile by name.
    /// </summary>
    /// <param name="profileName">The name of the profile to delete.</param>
    /// <returns>A <see cref="Task" /> representing the asynchronous delete operation.</returns>
    Task DeleteAsync(string profileName);

    /// <summary>
    /// Gets the file path used for the global environment configuration.
    /// </summary>
    /// <returns>The derived file path.</returns>
    string GetEnvironmentPath();
}
