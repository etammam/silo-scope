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
}
