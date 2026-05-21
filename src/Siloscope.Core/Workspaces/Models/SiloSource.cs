namespace Siloscope.Core.Workspaces;

/// <summary>
/// Represents a silo source entry within a persisted workspace.
/// </summary>
public sealed record SiloSource
{
    /// <summary>
    /// Gets the reference identifier, such as a DLL path or package ID.
    /// </summary>
    public string Reference { get; init; } = string.Empty;

    /// <summary>
    /// Gets the source type, such as "DLL" or "NuGet". The default is "DLL".
    /// </summary>
    public string Source { get; init; } = "DLL";

    /// <summary>
    /// Gets the optional version of the source.
    /// </summary>
    public string? Version { get; init; }

    /// <summary>
    /// Gets the optional gateway endpoint associated with the source.
    /// </summary>
    public string? Gateway { get; init; }

    /// <summary>
    /// Gets a value indicating whether the source is enabled. The default is <see langword="true" />.
    /// </summary>
    public bool Enabled { get; init; } = true;
}
