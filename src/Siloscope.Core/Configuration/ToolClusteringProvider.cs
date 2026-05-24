namespace Siloscope.Core.Configuration;

/// <summary>
/// Defines the supported Orleans clustering providers.
/// </summary>
public enum ToolClusteringProvider
{
    /// <summary>
    /// Uses localhost clustering discovery.
    /// </summary>
    Localhost,

    /// <summary>
    /// Uses statically configured gateway endpoints.
    /// </summary>
    Static,

    /// <summary>
    /// Uses Redis for cluster membership discovery.
    /// </summary>
    Redis,

    /// <summary>
    /// Uses ADO.NET for cluster membership discovery.
    /// </summary>
    AdoNet,

    /// <summary>
    /// Uses Azure Storage for cluster membership discovery.
    /// </summary>
    AzureStorage,

    /// <summary>
    /// Uses Azure Cosmos DB for cluster membership discovery.
    /// </summary>
    Cosmos,

    /// <summary>
    /// Uses Consul for cluster membership discovery.
    /// </summary>
    Consul,

    /// <summary>
    /// Uses Amazon DynamoDB for cluster membership discovery.
    /// </summary>
    DynamoDB,

    /// <summary>
    /// Uses Apache ZooKeeper for cluster membership discovery.
    /// </summary>
    ZooKeeper,

    /// <summary>
    /// Uses Apache Cassandra for cluster membership discovery.
    /// </summary>
    Cassandra,
}
