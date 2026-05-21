namespace Siloscope.Core.Configuration;

/// <summary>Kept for backward compatibility with old single-source config.</summary>
public readonly record struct InterfaceSourceOptions(
    InterfaceSourceType SourceType,
    string? DllPath,
    string? PackageId,
    string? PackageVersion,
    string? PackageRoot,
    string? NugetConfigPath
);
