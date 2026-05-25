using System.Text.Json.Serialization;

namespace Siloscope.Core.Configuration;

/// <summary>
/// Represents clustering provider options backed by a connection string or endpoint.
/// </summary>
/// <param name="ConnectionString">The provider connection string or endpoint.</param>
/// <param name="Invariant">The optional ADO.NET provider invariant.</param>
public sealed record ConnectionStringClusteringOptions(
    [property: JsonPropertyName("connectionString")] string ConnectionString,
    [property: JsonPropertyName("invariant")] string? Invariant = null
);
