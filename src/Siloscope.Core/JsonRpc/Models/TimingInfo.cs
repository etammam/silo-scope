namespace Siloscope.Core.JsonRpc.Models;

/// <summary>
/// Represents timing breakdown for a grain method invocation.
/// </summary>
/// <param name="SerializationMs">The time spent serializing and deserializing arguments and results, in milliseconds.</param>
/// <param name="ExecutionMs">The time spent executing the grain method, in milliseconds.</param>
/// <param name="TotalMs">The total time for the invocation, in milliseconds.</param>
public sealed record TimingInfo(long SerializationMs, long ExecutionMs, long TotalMs);
