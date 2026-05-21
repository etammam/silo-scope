using System.Text.Json.Serialization;

namespace Siloscope.Core.Configuration;

/// <summary>
/// Represents the clustering provider configuration.
/// </summary>
/// <param name="Provider">The clustering provider.</param>
/// <param name="Redis">Optional Redis-specific configuration when <paramref name="Provider" /> is <see cref="ToolClusteringProvider.Redis" />.</param>
public sealed record ToolClusteringOptions(
    [property: JsonPropertyName("provider")] ToolClusteringProvider Provider,
    [property: JsonPropertyName("redis")] RedisClusteringOptions? Redis = null
);
