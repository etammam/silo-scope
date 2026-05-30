using System.Text.Json.Serialization;

namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents an environment profile with a name and key-value variables.
/// </summary>
public sealed record EnvironmentProfile
{
    /// <summary>
    /// Gets the name of the environment profile.
    /// </summary>
    [JsonPropertyName("name")]
    public string Name { get; init; } = string.Empty;

    /// <summary>
    /// Gets the dictionary of environment variables.
    /// </summary>
    [JsonPropertyName("variables")]
    public Dictionary<string, string> Variables { get; init; } = new();
}

/// <summary>
/// Represents the persisted environment configuration for a workspace.
/// Stored separately from the workspace file.
/// </summary>
public sealed record EnvironmentConfig
{
    /// <summary>
    /// Gets the list of environment profiles.
    /// </summary>
    [JsonPropertyName("profiles")]
    public List<EnvironmentProfile> Profiles { get; init; } = [];

    /// <summary>
    /// Gets the name of the currently active environment profile.
    /// </summary>
    [JsonPropertyName("activeEnvironment")]
    public string? ActiveEnvironment { get; init; }
}
