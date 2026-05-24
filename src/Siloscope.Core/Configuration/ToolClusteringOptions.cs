using System.Text.Json.Serialization;

namespace Siloscope.Core.Configuration;

/// <summary>
/// Represents the clustering provider configuration.
/// </summary>
/// <param name="Provider">The clustering provider.</param>
/// <param name="Redis">Optional Redis-specific configuration when <paramref name="Provider" /> is <see cref="ToolClusteringProvider.Redis" />.</param>
/// <param name="AdoNet">Optional ADO.NET-specific configuration.</param>
/// <param name="AzureStorage">Optional Azure Storage-specific configuration.</param>
/// <param name="Cosmos">Optional Cosmos-specific configuration.</param>
/// <param name="Consul">Optional Consul-specific configuration.</param>
/// <param name="DynamoDB">Optional DynamoDB-specific configuration.</param>
/// <param name="ZooKeeper">Optional ZooKeeper-specific configuration.</param>
/// <param name="Cassandra">Optional Cassandra-specific configuration.</param>
public sealed record ToolClusteringOptions(
    [property: JsonPropertyName("provider")] ToolClusteringProvider Provider,
    [property: JsonPropertyName("redis")] RedisClusteringOptions? Redis = null,
    [property: JsonPropertyName("adoNet")] ConnectionStringClusteringOptions? AdoNet = null,
    [property: JsonPropertyName("azureStorage")]
        ConnectionStringClusteringOptions? AzureStorage = null,
    [property: JsonPropertyName("cosmos")] ConnectionStringClusteringOptions? Cosmos = null,
    [property: JsonPropertyName("consul")] ConnectionStringClusteringOptions? Consul = null,
    [property: JsonPropertyName("dynamoDB")] ConnectionStringClusteringOptions? DynamoDB = null,
    [property: JsonPropertyName("zooKeeper")] ConnectionStringClusteringOptions? ZooKeeper = null,
    [property: JsonPropertyName("cassandra")] ConnectionStringClusteringOptions? Cassandra = null
);
