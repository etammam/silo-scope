namespace Siloscope.Core.Configuration;

/// <summary>A single interface source bound to a specific gateway in a heterogeneous cluster.</summary>
public readonly record struct InterfaceEntry(
    string? Gateway,
    InterfaceSourceType SourceType,
    string? DllPath,
    string? PackageId,
    string? PackageVersion,
    string? PackageRoot,
    string? NugetConfigPath,
    string? SourceId = null
);
