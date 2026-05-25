using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents the result of a NuGet package restore operation.
/// </summary>
/// <param name="RestoredCount">The number of packages successfully restored.</param>
/// <param name="FailedCount">The number of packages that failed to restore.</param>
/// <param name="RestoredPackages">The list of successfully restored package identifiers.</param>
/// <param name="FailedPackages">The list of package identifiers that failed to restore.</param>
public sealed record RestoreResult(
    [property: JsonPropertyName("restoredCount")] int RestoredCount,
    [property: JsonPropertyName("failedCount")] int FailedCount,
    [property: JsonPropertyName("restoredPackages")] IReadOnlyList<string> RestoredPackages,
    [property: JsonPropertyName("failedPackages")] IReadOnlyList<string> FailedPackages
);
