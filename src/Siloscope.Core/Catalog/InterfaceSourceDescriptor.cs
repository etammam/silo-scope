namespace Siloscope.Core.Catalog;

/// <summary>
/// Describes a single interface source discovered during catalog loading.
/// </summary>
/// <param name="SourceId">The unique identifier of the source.</param>
/// <param name="SourceType">The type of the source.</param>
/// <param name="Reference">The reference identifier of the source.</param>
/// <param name="Label">The display label of the source.</param>
/// <param name="Version">The optional version of the source.</param>
/// <param name="Gateway">The optional gateway endpoint associated with the source.</param>
/// <param name="Enabled"><see langword="true" /> if the source is enabled; otherwise, <see langword="false" />.</param>
/// <param name="AssemblyPath">The file path of the loaded assembly.</param>
public readonly record struct InterfaceSourceDescriptor(
    string SourceId,
    string SourceType,
    string Reference,
    string Label,
    string? Version,
    string? Gateway,
    bool Enabled,
    string AssemblyPath
);
