using FluentResults;
using Siloscope.Core.Interfaces;

namespace Siloscope.Core.Cluster;

public interface IGrainInvocationService
{
    void SetDiagnosticSink(Action<string>? sink);
    Task<Result<string>> InvokeAsync(
        GrainInterfaceDescriptor grain,
        GrainMethodDescriptor method,
        string grainKey,
        string? payloadJson,
        CancellationToken cancellationToken
    );
    Task<Result<(string Result, InvocationTiming Timing)>> InvokeWithTimingAsync(
        GrainInterfaceDescriptor grain,
        GrainMethodDescriptor method,
        string grainKey,
        string? payloadJson,
        CancellationToken cancellationToken
    );
}

public record InvocationTiming(long SerializationMs, long ExecutionMs, long TotalMs);
