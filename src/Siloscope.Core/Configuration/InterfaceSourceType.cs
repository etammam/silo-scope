namespace Siloscope.Core.Configuration;

/// <summary>
/// Defines the supported interface source types.
/// </summary>
public enum InterfaceSourceType
{
    /// <summary>
    /// Loads grain interfaces from a local DLL file.
    /// </summary>
    Dll,

    /// <summary>
    /// Loads grain interfaces from a NuGet package.
    /// </summary>
    NuGet,
}
