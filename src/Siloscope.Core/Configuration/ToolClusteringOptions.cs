namespace Siloscope.Core.Configuration;

/// <summary>
/// Represents the clustering provider configuration.
/// </summary>
/// <param name="Provider">The clustering provider.</param>
/// <param name="Redis">Optional Redis-specific configuration when <paramref name="Provider" /> is <see cref="ToolClusteringProvider.Redis" />.</param>
public sealed record ToolClusteringOptions(
    ToolClusteringProvider Provider,
    RedisClusteringOptions? Redis = null
);
