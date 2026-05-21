using System.Text.Json.Serialization;

namespace Siloscope.Core.Configuration;

/// <summary>
/// Represents Redis-specific clustering options.
/// </summary>
/// <param name="ConnectionString">The Redis connection string.</param>
public sealed record RedisClusteringOptions(
    [property: JsonPropertyName("connectionString")] string ConnectionString
);
