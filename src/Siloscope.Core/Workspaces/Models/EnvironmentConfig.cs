namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents an environment configuration with a set of key-value variables.
/// </summary>
public sealed record EnvironmentConfig
{
    /// <summary>
    /// Gets the name of the environment.
    /// </summary>
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// Gets the dictionary of environment variables.
    /// </summary>
    public Dictionary<string, string> Variables { get; init; } = new();
}
