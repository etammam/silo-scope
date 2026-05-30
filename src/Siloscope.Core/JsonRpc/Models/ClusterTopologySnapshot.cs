using System.Text.Json.Serialization;

namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents a point-in-time topology and telemetry snapshot for the active cluster.
/// </summary>
/// <param name="CapturedAt">The timestamp when the snapshot was captured.</param>
/// <param name="IsLive"><see langword="true" /> when the snapshot includes observed runtime data; otherwise, <see langword="false" />.</param>
/// <param name="Source">The source of the telemetry values.</param>
/// <param name="Clients">The Orleans client telemetry entries included in the snapshot.</param>
/// <param name="Silos">The silo telemetry entries included in the snapshot.</param>
/// <param name="RequestEvents">The recent request telemetry events observed by the client.</param>
/// <param name="Connections">The inter-silo connection telemetry entries included in the snapshot.</param>
public sealed record ClusterTopologySnapshot(
    [property: JsonPropertyName("capturedAt")] DateTimeOffset CapturedAt,
    [property: JsonPropertyName("isLive")] bool IsLive,
    [property: JsonPropertyName("source")] string Source,
    [property: JsonPropertyName("clients")] IReadOnlyList<ClientTopologyTelemetry> Clients,
    [property: JsonPropertyName("silos")] IReadOnlyList<SiloTopologyTelemetry> Silos,
    [property: JsonPropertyName("requestEvents")]
        IReadOnlyList<RequestTopologyTelemetry> RequestEvents,
    [property: JsonPropertyName("connections")]
        IReadOnlyList<TopologyConnectionTelemetry> Connections
);

/// <summary>
/// Represents topology telemetry for an Orleans client connected to the cluster.
/// </summary>
/// <param name="ClientId">The stable client identifier.</param>
/// <param name="Name">The display name of the client.</param>
/// <param name="Gateway">The gateway endpoint used by the client.</param>
/// <param name="Address">The client-side address.</param>
/// <param name="ConnectedSiloIds">The silo identifiers this client is connected through.</param>
/// <param name="Status">The computed health status for the client.</param>
public sealed record ClientTopologyTelemetry(
    [property: JsonPropertyName("clientId")] string ClientId,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("gateway")] string? Gateway,
    [property: JsonPropertyName("address")] string Address,
    [property: JsonPropertyName("connectedSiloIds")] IReadOnlyList<string> ConnectedSiloIds,
    [property: JsonPropertyName("status")] string Status
);

/// <summary>
/// Represents topology, resource, and actor placement telemetry for a silo.
/// </summary>
/// <param name="SiloId">The stable silo identifier.</param>
/// <param name="Name">The display name of the silo.</param>
/// <param name="Gateway">The gateway endpoint associated with the silo.</param>
/// <param name="Host">The host metadata associated with the silo.</param>
/// <param name="Resources">The current resource usage telemetry.</param>
/// <param name="Grains">The actor placement summary grouped by grain type.</param>
/// <param name="Status">The computed health status for the silo.</param>
public sealed record SiloTopologyTelemetry(
    [property: JsonPropertyName("siloId")] string SiloId,
    [property: JsonPropertyName("name")] string Name,
    [property: JsonPropertyName("gateway")] string? Gateway,
    [property: JsonPropertyName("host")] SiloHostMetadata Host,
    [property: JsonPropertyName("resources")] SiloResourceTelemetry Resources,
    [property: JsonPropertyName("grains")] IReadOnlyList<GrainPlacementTelemetry> Grains,
    [property: JsonPropertyName("status")] string Status
);

/// <summary>
/// Represents host metadata for a silo.
/// </summary>
/// <param name="Address">The internal network address.</param>
/// <param name="UptimeSeconds">The observed uptime duration, in seconds.</param>
/// <param name="ClientConnections">The observed or inferred client connection count.</param>
public sealed record SiloHostMetadata(
    [property: JsonPropertyName("address")] string Address,
    [property: JsonPropertyName("uptimeSeconds")] long UptimeSeconds,
    [property: JsonPropertyName("clientConnections")] int ClientConnections
);

/// <summary>
/// Represents lightweight CPU and memory telemetry for a silo.
/// </summary>
/// <param name="CpuPercent">The current CPU usage percentage.</param>
/// <param name="MemoryPercent">The current memory usage percentage.</param>
/// <param name="MemoryBytes">The current managed process memory usage, in bytes.</param>
public sealed record SiloResourceTelemetry(
    [property: JsonPropertyName("cpuPercent")] double CpuPercent,
    [property: JsonPropertyName("memoryPercent")] double MemoryPercent,
    [property: JsonPropertyName("memoryBytes")] long MemoryBytes
);

/// <summary>
/// Represents a grain placement aggregate for a silo.
/// </summary>
/// <param name="GrainType">The grain type or type segment.</param>
/// <param name="Count">The number of discovered or observed grains in the segment.</param>
public sealed record GrainPlacementTelemetry(
    [property: JsonPropertyName("grainType")] string GrainType,
    [property: JsonPropertyName("count")] int Count
);

/// <summary>
/// Represents an observed Orleans request moving through the topology.
/// </summary>
/// <param name="EventId">The stable event identifier.</param>
/// <param name="SourceId">The client or source node identifier.</param>
/// <param name="TargetSiloId">The silo identifier that owns the targeted grain placement.</param>
/// <param name="GrainType">The targeted grain type.</param>
/// <param name="MethodName">The invoked method name.</param>
/// <param name="IsSuccess"><see langword="true" /> when the request succeeded; otherwise, <see langword="false" />.</param>
/// <param name="LatencyMs">The observed request latency in milliseconds.</param>
/// <param name="Message">The short response or failure message.</param>
/// <param name="ObservedAt">The timestamp when the request was observed.</param>
public sealed record RequestTopologyTelemetry(
    [property: JsonPropertyName("eventId")] string EventId,
    [property: JsonPropertyName("sourceId")] string SourceId,
    [property: JsonPropertyName("targetSiloId")] string TargetSiloId,
    [property: JsonPropertyName("grainType")] string GrainType,
    [property: JsonPropertyName("methodName")] string MethodName,
    [property: JsonPropertyName("isSuccess")] bool IsSuccess,
    [property: JsonPropertyName("latencyMs")] double LatencyMs,
    [property: JsonPropertyName("message")] string? Message,
    [property: JsonPropertyName("observedAt")] DateTimeOffset ObservedAt
);

/// <summary>
/// Represents communication telemetry between two silos.
/// </summary>
/// <param name="ConnectionId">The stable connection identifier.</param>
/// <param name="SourceSiloId">The source silo identifier.</param>
/// <param name="TargetSiloId">The target silo identifier.</param>
/// <param name="LatencyMs">The current latency in milliseconds.</param>
/// <param name="Status">The computed health status for this connection.</param>
/// <param name="IsSpiking"><see langword="true" /> when the latency is currently above its recent baseline; otherwise, <see langword="false" />.</param>
/// <param name="ObservedAt">The timestamp when this connection telemetry was observed.</param>
public sealed record TopologyConnectionTelemetry(
    [property: JsonPropertyName("connectionId")] string ConnectionId,
    [property: JsonPropertyName("sourceSiloId")] string SourceSiloId,
    [property: JsonPropertyName("targetSiloId")] string TargetSiloId,
    [property: JsonPropertyName("latencyMs")] double LatencyMs,
    [property: JsonPropertyName("status")] string Status,
    [property: JsonPropertyName("isSpiking")] bool IsSpiking,
    [property: JsonPropertyName("observedAt")] DateTimeOffset ObservedAt
);
