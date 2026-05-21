using FluentResults;
using Siloscope.Core.Catalog;

namespace Siloscope.Core.Clustering;

/// <summary>
/// Invokes grain methods on an Orleans cluster through the connector pool.
/// </summary>
public interface IGrainInvocationService
{
    /// <summary>
    /// Sets a diagnostic sink for invocation operations.
    /// </summary>
    /// <param name="sink">The action to receive diagnostic messages, or <see langword="null" /> to clear.</param>
    void SetDiagnosticSink(Action<string>? sink);

    /// <summary>
    /// Invokes the specified grain method asynchronously.
    /// </summary>
    /// <param name="grain">The descriptor of the grain interface to invoke.</param>
    /// <param name="method">The descriptor of the method to invoke.</param>
    /// <param name="grainKey">The grain key used to resolve the grain instance.</param>
    /// <param name="payloadJson">The JSON payload to deserialize and pass as method arguments.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing the serialized invocation result.</returns>
    Task<Result<string>> InvokeAsync(
        GrainInterfaceDescriptor grain,
        GrainMethodDescriptor method,
        string grainKey,
        string? payloadJson,
        CancellationToken cancellationToken
    );

    /// <summary>
    /// Invokes the specified grain method asynchronously and returns timing information.
    /// </summary>
    /// <param name="grain">The descriptor of the grain interface to invoke.</param>
    /// <param name="method">The descriptor of the method to invoke.</param>
    /// <param name="grainKey">The grain key used to resolve the grain instance.</param>
    /// <param name="payloadJson">The JSON payload to deserialize and pass as method arguments.</param>
    /// <param name="cancellationToken">A token to cancel the operation.</param>
    /// <returns>A <see cref="Result" /> containing the serialized result and invocation timing.</returns>
    Task<Result<(string Result, InvocationTiming Timing)>> InvokeWithTimingAsync(
        GrainInterfaceDescriptor grain,
        GrainMethodDescriptor method,
        string grainKey,
        string? payloadJson,
        CancellationToken cancellationToken
    );
}
