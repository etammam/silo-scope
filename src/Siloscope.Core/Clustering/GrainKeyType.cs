namespace Siloscope.Core.Clustering;

/// <summary>
/// Defines the supported Orleans grain key types.
/// </summary>
public enum GrainKeyType
{
    /// <summary>
    /// The grain key type could not be determined.
    /// </summary>
    Unknown,

    /// <summary>
    /// A string grain key.
    /// </summary>
    String,

    /// <summary>
    /// An integer (long) grain key.
    /// </summary>
    Integer,

    /// <summary>
    /// A GUID grain key.
    /// </summary>
    Guid,

    /// <summary>
    /// A compound key with an integer primary part and a string extension.
    /// </summary>
    IntegerCompound,

    /// <summary>
    /// A compound key with a GUID primary part and a string extension.
    /// </summary>
    GuidCompound,
}
