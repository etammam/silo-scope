using System.Diagnostics;
using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using FluentResults;
using Microsoft.Extensions.Logging;
using Siloscope.Core.Catalog;

namespace Siloscope.Core.Clustering;

/// <summary>
/// Invokes grain methods on an Orleans cluster through the connector pool, handling argument binding and result serialization.
/// </summary>
public sealed class GrainInvocationService : IGrainInvocationService
{
    private readonly IOrleansClientConnectorPool _connectorPool;
    private readonly ILogger<GrainInvocationService> _logger;

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };
    private Action<string>? _diagnosticSink;

    public GrainInvocationService(
        IOrleansClientConnectorPool connectorPool,
        ILogger<GrainInvocationService> logger
    )
    {
        _connectorPool = connectorPool;
        _logger = logger;
    }

    public void SetDiagnosticSink(Action<string>? sink)
    {
        _diagnosticSink = sink;
    }

    public async Task<Result<string>> InvokeAsync(
        GrainInterfaceDescriptor grain,
        GrainMethodDescriptor method,
        string grainKey,
        string? payloadJson,
        CancellationToken cancellationToken
    )
    {
        var result = await InvokeWithTimingAsync(
            grain,
            method,
            grainKey,
            payloadJson,
            cancellationToken
        );

        if (result.IsFailed)
            return Result.Fail<string>(result.Errors.FirstOrDefault()?.Message ?? "Unknown error");

        return Result.Ok(result.Value.Result);
    }

    public async Task<Result<(string Result, InvocationTiming Timing)>> InvokeWithTimingAsync(
        GrainInterfaceDescriptor grain,
        GrainMethodDescriptor method,
        string grainKey,
        string? payloadJson,
        CancellationToken cancellationToken
    )
    {
        var totalStopwatch = Stopwatch.StartNew();
        var serializationStopwatch = new Stopwatch();

        payloadJson ??= string.Empty;

        _logger.LogInformation(
            "[Invoke] Start {GrainName}.{MethodName}, key='{GrainKey}', payloadChars={PayloadChars}",
            grain.Name,
            method.MethodInfo.Name,
            grainKey,
            payloadJson.Length
        );
        _logger.LogInformation("[Payload] JSON={JsonPayload}", FormatPayloadForLog(payloadJson));

        if (string.IsNullOrWhiteSpace(grainKey))
        {
            _logger.LogError("[Invoke] Rejected: empty grain key.");
            return Result.Fail("Grain key is required.");
        }

        if (
            !_connectorPool.TryGetConnectorForGateway(grain.Gateway, out var connector)
            || connector is null
        )
        {
            _logger.LogError(
                "[Invoke] Rejected: no connector for gateway '{Gateway}'.",
                grain.Gateway ?? "null"
            );
            return Result.Fail($"No connector available for gateway '{grain.Gateway}'.");
        }

        _logger.LogInformation(
            "[Invoke] Found connector for gateway {Gateway}, IsConnected={IsConnected}",
            grain.Gateway,
            connector.IsConnected
        );

        if (!connector.TryGetClient(out var client))
        {
            _logger.LogError("[Invoke] Rejected: Orleans client is not connected.");
            return Result.Fail("Client is not connected. Click Connect first.");
        }

        var keyType = DetectGrainKeyType(grain.InterfaceType);
        if (keyType == GrainKeyType.Unknown)
        {
            _logger.LogError(
                "[Invoke] Rejected: unsupported key type for '{GrainName}'.",
                grain.Name
            );
            return Result.Fail(
                $"Grain '{grain.Name}' does not implement a supported key interface (string, integer, guid, or compound)."
            );
        }

        _logger.LogInformation("[Invoke] Detected grain key type: {KeyType}.", keyType);

        _logger.LogInformation(
            "[TypeLoad] Discovered interface '{InterfaceType}' in '{AssemblyName}'.",
            grain.InterfaceType.FullName,
            grain.InterfaceType.Assembly.FullName
        );
        _logger.LogInformation(
            "[TypeLoad] {Diagnostics}",
            BuildTypeDiagnostics(grain.InterfaceType, "catalog")
        );
        _logger.LogInformation(
            "[TypeLoad] Discovered method '{MethodSignature}'.",
            BuildMethodSignature(method.MethodInfo)
        );

        var runtimeResolution = ResolveRuntimeTargets(grain.InterfaceType, method.MethodInfo);
        if (!runtimeResolution.IsSuccess)
        {
            foreach (var error in runtimeResolution.Errors)
            {
                _logger.LogWarning("[TypeLoad] Failed: {ErrorMessage}", error.Message);
            }

            return Result.Fail(errors: runtimeResolution.Errors);
        }

        var (runtimeInterfaceType, runtimeMethodInfo) = runtimeResolution.Value;
        _logger.LogInformation(
            "[TypeLoad] {Diagnostics}",
            BuildTypeDiagnostics(runtimeInterfaceType, "runtime")
        );
        _logger.LogInformation(
            "[TypeLoad] Resolved method '{MethodSignature}'.",
            BuildMethodSignature(runtimeMethodInfo)
        );

        try
        {
            if (client is not IGrainFactory grainFactory)
            {
                _logger.LogWarning("[Invoke] Rejected: connected client is not an IGrainFactory.");
                return Result.Fail("Connected Orleans client does not expose IGrainFactory.");
            }

            var grainRef = ResolveGrain(grainFactory, runtimeInterfaceType, keyType, grainKey);
            if (!grainRef.IsSuccess)
            {
                foreach (var error in grainRef.Errors)
                {
                    _logger.LogError(
                        "[Invoke] Grain resolution failed: {ErrorMessage}",
                        error.Message
                    );
                }

                return Result.Fail(errors: grainRef.Errors);
            }

            var grainReference = grainRef.Value!;
            _logger.LogInformation(
                "[Invoke] Grain reference resolved as '{GrainReferenceType}'.",
                grainReference.GetType().FullName
            );

            serializationStopwatch.Start();
            var arguments = BindArguments(runtimeMethodInfo, payloadJson);
            serializationStopwatch.Stop();

            _logger.LogInformation(
                "[Bind] Bound {ArgCount} argument(s). [{Arguments}]",
                arguments.Length,
                DescribeArguments(runtimeMethodInfo, arguments)
            );

            var executionStopwatch = Stopwatch.StartNew();
            var rawResult = runtimeMethodInfo.Invoke(grainReference, arguments);
            executionStopwatch.Stop();

            _logger.LogInformation(
                "[Invoke] Method invocation returned '{ResultType}'.",
                rawResult?.GetType().FullName ?? "null"
            );

            var normalized = await AwaitResultAsync(
                rawResult,
                runtimeMethodInfo.ReturnType,
                cancellationToken
            );
            _logger.LogInformation(
                "[Result] Normalized result type '{ResultType}'.",
                normalized?.GetType().FullName ?? "null"
            );

            serializationStopwatch.Start();
            var response = JsonSerializer.Serialize(normalized, SerializerOptions);
            serializationStopwatch.Stop();

            _logger.LogInformation(
                "[Result] Serialized response size={ResponseSize} chars.",
                response.Length
            );

            totalStopwatch.Stop();

            var timing = new InvocationTiming(
                serializationStopwatch.ElapsedMilliseconds,
                executionStopwatch.ElapsedMilliseconds,
                totalStopwatch.ElapsedMilliseconds
            );

            return Result.Ok((response, timing));
        }
        catch (Exception ex)
        {
            var flattened = FlattenException(ex);
            if (
                flattened.Contains(
                    "Unable to parse or load type",
                    StringComparison.OrdinalIgnoreCase
                )
            )
            {
                flattened += " | " + BuildTypeDiagnostics(runtimeInterfaceType, "runtime");
            }

            _logger.LogWarning("[Error] {ErrorDetails}", flattened);
            _logger.LogWarning(
                "[Error] Exception chain: {ExceptionChain}",
                BuildExceptionChain(ex)
            );
            _logger.LogError(ex, "[Error] Stack trace: {StackTrace}", ex);

            return Result.Fail($"Invocation failed: {flattened}");
        }
    }

    private static string BuildMethodSignature(MethodInfo methodInfo)
    {
        var parameters = string.Join(
            ", ",
            methodInfo
                .GetParameters()
                .Select(static parameter =>
                    $"{parameter.ParameterType.FullName ?? parameter.ParameterType.Name} {parameter.Name}"
                )
        );

        return $"{methodInfo.DeclaringType?.FullName}.{methodInfo.Name}({parameters})";
    }

    private static string DescribeArguments(MethodInfo methodInfo, IReadOnlyList<object?> arguments)
    {
        var parameters = methodInfo.GetParameters();
        if (parameters.Length == 0)
        {
            return "none";
        }

        return string.Join(
            ", ",
            parameters.Select(
                (parameter, index) =>
                {
                    var argument = index < arguments.Count ? arguments[index] : null;
                    var valueStr = argument is null
                        ? "null"
                        : $"{argument} ({argument.GetType().Name})";
                    return $"{parameter.Name}:{parameter.ParameterType.Name}={valueStr}";
                }
            )
        );
    }

    private static string BuildTypeDiagnostics(Type type, string source)
    {
        var assembly = type.Assembly;
        var alc = AssemblyLoadContext.GetLoadContext(assembly)?.Name ?? "default";
#pragma warning disable IL3000
        var location = string.IsNullOrWhiteSpace(assembly.Location)
            ? "<dynamic>"
            : assembly.Location;
#pragma warning restore IL3000
        return $"TypeDiagnostics Source='{source}', Interface='{type.FullName}', Assembly='{assembly.FullName}', Location='{location}', ALC='{alc}'";
    }

    private Result<(Type InterfaceType, MethodInfo MethodInfo)> ResolveRuntimeTargets(
        Type discoveredInterfaceType,
        MethodInfo discoveredMethod
    )
    {
        var runtimeInterfaceType = ResolveInterfaceTypeInDefaultContext(discoveredInterfaceType);
        if (runtimeInterfaceType is null)
        {
            return Result.Fail(
                $"Unable to resolve runtime grain type '{discoveredInterfaceType.FullName}'."
            );
        }

        var runtimeMethod = runtimeInterfaceType
            .GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .FirstOrDefault(method => MethodMatches(method, discoveredMethod));

        if (runtimeMethod is null)
        {
            return Result.Fail<(Type InterfaceType, MethodInfo MethodInfo)>(
                $"Unable to resolve runtime method '{discoveredInterfaceType.FullName}.{discoveredMethod.Name}'."
            );
        }

        return Result.Ok<(Type InterfaceType, MethodInfo MethodInfo)>(
            (runtimeInterfaceType, runtimeMethod)
        );
    }

    private Type? ResolveInterfaceTypeInDefaultContext(Type discoveredInterfaceType)
    {
        var fullName = discoveredInterfaceType.FullName;
        if (string.IsNullOrWhiteSpace(fullName))
        {
            _logger.LogWarning(
                "[TypeLoad] Type resolution skipped: discovered interface has no full name."
            );
            return null;
        }

        _logger.LogInformation(
            "[TypeLoad] Resolving type '{FullName}' in AssemblyLoadContext.Default.",
            fullName
        );

        foreach (var assembly in AssemblyLoadContext.Default.Assemblies)
        {
            var found = assembly.GetType(fullName, throwOnError: false, ignoreCase: false);
            if (found is not null)
            {
                _logger.LogInformation(
                    "[TypeLoad] Resolved from already loaded assembly '{AssemblyName}'.",
                    assembly.FullName
                );
                return found;
            }
        }

        try
        {
            var loadedByName = AssemblyLoadContext.Default.LoadFromAssemblyName(
                discoveredInterfaceType.Assembly.GetName()
            );
            var byNameType = loadedByName.GetType(fullName, throwOnError: false, ignoreCase: false);
            if (byNameType is not null)
            {
                _logger.LogInformation(
                    "[TypeLoad] Resolved after LoadFromAssemblyName('{AssemblyName}').",
                    discoveredInterfaceType.Assembly.GetName().Name
                );
                return byNameType;
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                "[TypeLoad] LoadFromAssemblyName failed: {ErrorMessage}",
                ex.Message
            );
        }

#pragma warning disable IL3000
        var assemblyPath = discoveredInterfaceType.Assembly.Location;
        if (string.IsNullOrWhiteSpace(assemblyPath) || !File.Exists(assemblyPath))
#pragma warning restore IL3000
        {
            _logger.LogWarning(
                "[TypeLoad] Type resolution fallback skipped: assembly path not found for '{AssemblyFullName}'.",
                discoveredInterfaceType.Assembly.FullName
            );
            return null;
        }

        try
        {
            var assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(assemblyPath);
            var resolved = assembly.GetType(fullName, throwOnError: false, ignoreCase: false);
            if (resolved is not null)
            {
                _logger.LogInformation(
                    "[TypeLoad] Resolved after LoadFromAssemblyPath('{AssemblyPath}').",
                    assemblyPath
                );
            }

            return resolved;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                "[TypeLoad] LoadFromAssemblyPath failed: {ErrorMessage}",
                ex.Message
            );
            return null;
        }
    }

    private static string FormatPayloadForLog(string payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson))
        {
            return "<empty>";
        }

        const int maxLength = 1200;
        return payloadJson.Length <= maxLength ? payloadJson : payloadJson[..maxLength] + "...";
    }

    private static bool MethodMatches(MethodInfo runtimeMethod, MethodInfo discoveredMethod)
    {
        if (!string.Equals(runtimeMethod.Name, discoveredMethod.Name, StringComparison.Ordinal))
        {
            return false;
        }

        var runtimeParameters = runtimeMethod.GetParameters();
        var discoveredParameters = discoveredMethod.GetParameters();
        if (runtimeParameters.Length != discoveredParameters.Length)
        {
            return false;
        }

        for (var i = 0; i < runtimeParameters.Length; i++)
        {
            var runtimeParameterType = runtimeParameters[i].ParameterType.FullName;
            var discoveredParameterType = discoveredParameters[i].ParameterType.FullName;
            if (
                !string.Equals(
                    runtimeParameterType,
                    discoveredParameterType,
                    StringComparison.Ordinal
                )
            )
            {
                return false;
            }
        }

        return true;
    }

    public enum GrainKeyType
    {
        Unknown,
        String,
        Integer,
        Guid,
        IntegerCompound,
        GuidCompound,
    }

    public static GrainKeyType DetectGrainKeyType(Type interfaceType)
    {
        return interfaceType switch
        {
            _ when typeof(IGrainWithStringKey).IsAssignableFrom(interfaceType) =>
                GrainKeyType.String,
            _ when typeof(IGrainWithIntegerKey).IsAssignableFrom(interfaceType) =>
                GrainKeyType.Integer,
            _ when typeof(IGrainWithGuidKey).IsAssignableFrom(interfaceType) => GrainKeyType.Guid,
            _ when typeof(IGrainWithIntegerCompoundKey).IsAssignableFrom(interfaceType) =>
                GrainKeyType.IntegerCompound,
            _ when typeof(IGrainWithGuidCompoundKey).IsAssignableFrom(interfaceType) =>
                GrainKeyType.GuidCompound,
            _ => GrainKeyType.Unknown,
        };
    }

    public static string DescribeGrainKeyType(Type interfaceType)
    {
        return DetectGrainKeyType(interfaceType) switch
        {
            GrainKeyType.String => "string",
            GrainKeyType.Integer => "integer (long)",
            GrainKeyType.Guid => "guid",
            GrainKeyType.IntegerCompound => "integer,string (compound)",
            GrainKeyType.GuidCompound => "guid,string (compound)",
            _ => "unknown",
        };
    }

    private Result<object> ResolveGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        GrainKeyType keyType,
        string grainKey
    )
    {
        return keyType switch
        {
            GrainKeyType.String => ResolveStringKeyGrain(
                grainFactory,
                grainInterfaceType,
                grainKey
            ),
            GrainKeyType.Integer => ResolveIntegerKeyGrain(
                grainFactory,
                grainInterfaceType,
                grainKey
            ),
            GrainKeyType.Guid => ResolveGuidKeyGrain(grainFactory, grainInterfaceType, grainKey),
            GrainKeyType.IntegerCompound => ResolveIntegerCompoundKeyGrain(
                grainFactory,
                grainInterfaceType,
                grainKey
            ),
            GrainKeyType.GuidCompound => ResolveGuidCompoundKeyGrain(
                grainFactory,
                grainInterfaceType,
                grainKey
            ),
            _ => Result.Fail($"Unsupported grain key type for '{grainInterfaceType.Name}'."),
        };
    }

    private Result<object> ResolveStringKeyGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        string grainKey
    )
    {
        try
        {
            var genericRef = InvokeGetGrain(
                grainFactory,
                grainInterfaceType,
                typeof(string),
                grainKey
            );
            _logger.LogInformation("[Invoke] Grain reference path: GetGrain<T>(string).");
            return Result.Ok<object>(genericRef);
        }
        catch (Exception ex)
        {
            _logger.LogError("[Invoke] GetGrain<T>(string) failed: {Error}", FlattenException(ex));
            return Result.Fail<object>(
                $"Failed to resolve string-key grain: {FlattenException(ex)}"
            );
        }
    }

    private Result<object> ResolveIntegerKeyGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        string grainKey
    )
    {
        if (!long.TryParse(grainKey, out var longKey))
        {
            return Result.Fail<object>($"Grain key '{grainKey}' is not a valid integer (long).");
        }

        try
        {
            var genericRef = InvokeGetGrain(
                grainFactory,
                grainInterfaceType,
                typeof(long),
                longKey
            );
            _logger.LogInformation("[Invoke] Grain reference path: GetGrain<T>(long).");
            return Result.Ok<object>(genericRef);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[Invoke] GetGrain<T>(long) failed: {Error}", FlattenException(ex));
            return Result.Fail<object>(
                $"Failed to resolve integer-key grain: {FlattenException(ex)}"
            );
        }
    }

    private Result<object> ResolveGuidKeyGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        string grainKey
    )
    {
        if (!Guid.TryParse(grainKey, out var guidKey))
        {
            return Result.Fail<object>($"Grain key '{grainKey}' is not a valid GUID.");
        }

        try
        {
            var genericRef = InvokeGetGrain(
                grainFactory,
                grainInterfaceType,
                typeof(Guid),
                guidKey
            );
            _logger.LogInformation("[Invoke] Grain reference path: GetGrain<T>(Guid).");
            return Result.Ok<object>(genericRef);
        }
        catch (Exception ex)
        {
            _logger.LogWarning("[Invoke] GetGrain<T>(Guid) failed: {Error}", FlattenException(ex));
            return Result.Fail<object>($"Failed to resolve GUID-key grain: {FlattenException(ex)}");
        }
    }

    private Result<object> ResolveIntegerCompoundKeyGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        string grainKey
    )
    {
        var (primaryKey, keyExtension) = ParseCompoundKey(grainKey);
        if (!long.TryParse(primaryKey, out var longKey))
        {
            return Result.Fail<object>(
                $"Compound key primary part '{primaryKey}' is not a valid integer. Use format: <integer>,<string>"
            );
        }

        try
        {
            var method = typeof(IGrainFactory)
                .GetMethods(BindingFlags.Public | BindingFlags.Instance)
                .First(m =>
                    m.Name == "GetGrain"
                    && m.IsGenericMethodDefinition
                    && m.GetGenericArguments().Length == 1
                    && m.GetParameters() is { Length: >= 2 } p
                    && p[0].ParameterType == typeof(long)
                    && p[1].ParameterType == typeof(string)
                );

            var closed = method.MakeGenericMethod(grainInterfaceType);
            var result =
                closed.Invoke(grainFactory, [longKey, keyExtension])
                ?? throw new InvalidOperationException("GetGrain returned null.");
            _logger.LogInformation(
                "[Invoke] Grain reference path: GetGrain<T>(long, string) with extension='{KeyExtension}'.",
                keyExtension
            );
            return Result.Ok<object>(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                "[Invoke] GetGrain<T>(long, string) failed: {Error}",
                FlattenException(ex)
            );
            return Result.Fail<object>(
                $"Failed to resolve integer-compound-key grain: {FlattenException(ex)}"
            );
        }
    }

    private Result<object> ResolveGuidCompoundKeyGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        string grainKey
    )
    {
        var (primaryKey, keyExtension) = ParseCompoundKey(grainKey);
        if (!Guid.TryParse(primaryKey, out var guidKey))
        {
            return Result.Fail<object>(
                $"Compound key primary part '{primaryKey}' is not a valid GUID. Use format: <guid>,<string>"
            );
        }

        try
        {
            var method = typeof(IGrainFactory)
                .GetMethods(BindingFlags.Public | BindingFlags.Instance)
                .First(m =>
                    m.Name == "GetGrain"
                    && m.IsGenericMethodDefinition
                    && m.GetGenericArguments().Length == 1
                    && m.GetParameters() is { Length: >= 2 } p
                    && p[0].ParameterType == typeof(Guid)
                    && p[1].ParameterType == typeof(string)
                );

            var closed = method.MakeGenericMethod(grainInterfaceType);
            var result =
                closed.Invoke(grainFactory, [guidKey, keyExtension])
                ?? throw new InvalidOperationException("GetGrain returned null.");
            _logger.LogInformation(
                "[Invoke] Grain reference path: GetGrain<T>(Guid, string) with extension='{KeyExtension}'.",
                keyExtension
            );
            return Result.Ok<object>(result);
        }
        catch (Exception ex)
        {
            _logger.LogWarning(
                "[Invoke] GetGrain<T>(Guid, string) failed: {Error}",
                FlattenException(ex)
            );
            return Result.Fail<object>(
                $"Failed to resolve GUID-compound-key grain: {FlattenException(ex)}"
            );
        }
    }

    private static object InvokeGetGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        Type keyType,
        object key
    )
    {
        var method = typeof(IGrainFactory)
            .GetMethods(BindingFlags.Public | BindingFlags.Instance)
            .First(m =>
                m.Name == "GetGrain"
                && m.IsGenericMethodDefinition
                && m.GetGenericArguments().Length == 1
                && m.GetParameters() is { Length: >= 1 } p
                && p[0].ParameterType == keyType
            );

        var closedMethod = method.MakeGenericMethod(grainInterfaceType);
        var parameters = closedMethod.GetParameters();
        var args = parameters.Length switch
        {
            1 => [key],
            _ => new[] { key, null },
        };

        return closedMethod.Invoke(grainFactory, args)
            ?? throw new InvalidOperationException(
                $"GetGrain<{grainInterfaceType.Name}>({keyType.Name}) returned null."
            );
    }

    /// <summary>Splits a compound key in the format "primaryKey,extension". If no comma, the extension is null.</summary>
    private static (string PrimaryKey, string? Extension) ParseCompoundKey(string grainKey)
    {
        var commaIndex = grainKey.IndexOf(',');
        if (commaIndex < 0)
        {
            return (grainKey, null);
        }

        return (grainKey[..commaIndex], grainKey[(commaIndex + 1)..]);
    }

    private static object?[] BindArguments(MethodInfo methodInfo, string payloadJson)
    {
        var parameters = methodInfo.GetParameters();
        if (parameters.Length == 0)
        {
            return [];
        }

        var hasPayload = !string.IsNullOrWhiteSpace(payloadJson);
        if (!hasPayload)
        {
            var defaults = new object?[parameters.Length];
            for (var i = 0; i < parameters.Length; i++)
            {
                defaults[i] = ResolveDefaultValue(parameters[i]);
            }

            return defaults;
        }

        using var json = JsonDocument.Parse(payloadJson);
        var root = json.RootElement;

        return root.ValueKind switch
        {
            JsonValueKind.Object => BindFromObject(parameters, root),
            JsonValueKind.Array => BindFromArray(parameters, root),
            _ when parameters.Length == 1 => [ConvertValue(root, parameters[0].ParameterType)],
            _ => throw new InvalidOperationException(
                "Payload must be a JSON object (by parameter name) or JSON array (by position)."
            ),
        };
    }

    private static object?[] BindFromObject(
        IReadOnlyList<ParameterInfo> parameters,
        JsonElement root
    )
    {
        var values = new object?[parameters.Count];
        for (var i = 0; i < parameters.Count; i++)
        {
            var parameter = parameters[i];
            if (parameter.ParameterType == typeof(CancellationToken))
            {
                values[i] = CancellationToken.None;
                continue;
            }

            if (TryGetPropertyIgnoreCase(root, parameter.Name!, out var value))
            {
                values[i] = ConvertValue(value, parameter.ParameterType);
                continue;
            }

            values[i] = ResolveDefaultValue(parameter);
        }

        return values;
    }

    private static object?[] BindFromArray(
        IReadOnlyList<ParameterInfo> parameters,
        JsonElement root
    )
    {
        var values = new object?[parameters.Count];
        var payloadIndex = 0;

        for (var i = 0; i < parameters.Count; i++)
        {
            var parameter = parameters[i];
            if (parameter.ParameterType == typeof(CancellationToken))
            {
                values[i] = CancellationToken.None;
                continue;
            }

            if (payloadIndex < root.GetArrayLength())
            {
                values[i] = ConvertValue(root[payloadIndex], parameter.ParameterType);
                payloadIndex++;
                continue;
            }

            values[i] = ResolveDefaultValue(parameter);
        }

        return values;
    }

    private static object? ConvertValue(JsonElement element, Type targetType)
    {
        var deserializationType = ResolveDeserializationType(targetType);
        return JsonSerializer.Deserialize(
            element.GetRawText(),
            deserializationType,
            SerializerOptions
        );
    }

    private static Type ResolveDeserializationType(Type targetType)
    {
        if (!targetType.IsInterface || !targetType.IsGenericType)
        {
            return targetType;
        }

        var genericDefinition = targetType.GetGenericTypeDefinition();
        var args = targetType.GetGenericArguments();

        return genericDefinition switch
        {
            _ when genericDefinition == typeof(IReadOnlySet<>)
                    || genericDefinition == typeof(ISet<>) => typeof(HashSet<>).MakeGenericType(
                args
            ),
            _ when genericDefinition == typeof(IReadOnlyList<>)
                    || genericDefinition == typeof(IList<>)
                    || genericDefinition == typeof(IEnumerable<>) => typeof(List<>).MakeGenericType(
                args
            ),
            _ when genericDefinition == typeof(IReadOnlyDictionary<,>)
                    || genericDefinition == typeof(IDictionary<,>) =>
                typeof(Dictionary<,>).MakeGenericType(args),
            _ => targetType,
        };
    }

    private static object? ResolveDefaultValue(ParameterInfo parameter)
    {
        if (parameter.ParameterType == typeof(CancellationToken))
        {
            return CancellationToken.None;
        }

        if (parameter.HasDefaultValue)
        {
            return parameter.DefaultValue;
        }

        var underlyingNullable = Nullable.GetUnderlyingType(parameter.ParameterType);
        if (!parameter.ParameterType.IsValueType || underlyingNullable is not null)
        {
            return null;
        }

        return Activator.CreateInstance(parameter.ParameterType);
    }

    private static bool TryGetPropertyIgnoreCase(
        JsonElement element,
        string propertyName,
        out JsonElement value
    )
    {
        foreach (var property in element.EnumerateObject())
        {
            if (string.Equals(property.Name, propertyName, StringComparison.OrdinalIgnoreCase))
            {
                value = property.Value;
                return true;
            }
        }

        value = default;
        return false;
    }

    private static async Task<object?> AwaitResultAsync(
        object? invocationResult,
        Type returnType,
        CancellationToken cancellationToken
    )
    {
        if (returnType == typeof(void))
        {
            return null;
        }

        if (invocationResult is not Task task)
        {
            return invocationResult;
        }

        await task.WaitAsync(cancellationToken);

        if (!returnType.IsGenericType || returnType.GetGenericTypeDefinition() != typeof(Task<>))
        {
            return new { success = true };
        }

        return returnType.GetProperty("Result")?.GetValue(task);
    }

    private static string BuildExceptionChain(Exception exception)
    {
        var parts = new List<string>();
        var current = exception;
        var depth = 0;
        while (current is not null && depth < 10)
        {
            parts.Add($"[{current.GetType().Name}] {current.Message}");
            current = current.InnerException;
            depth++;
        }

        return string.Join(" → ", parts);
    }

    private static string FlattenException(Exception exception)
    {
        var current = exception;

        // Unwrap reflection/aggregate/task wrappers to reach the real cause.
        while (current is TargetInvocationException or AggregateException)
        {
            current = current.InnerException ?? current;
            if (current == exception)
            {
                break;
            }
        }

        // For Orleans remote errors, include the full chain so server-side details are visible.
        var messages = new List<string>();
        var walk = current;
        while (walk is not null)
        {
            var prefix = walk is TypeLoadException ? "[TypeLoadException] " : string.Empty;
            if (!string.IsNullOrWhiteSpace(walk.Message))
            {
                messages.Add($"{prefix}{walk.Message}");
            }

            walk = walk.InnerException;
        }

        if (messages.Count == 0)
        {
            return "Unknown error.";
        }

        var result = string.Join(" -> ", messages);

        // Hint when the error is a server-side type resolution failure.
        if (result.Contains("Unable to parse or load type", StringComparison.OrdinalIgnoreCase))
        {
            result +=
                " [Hint: This error typically occurs on the receiving silo/gateway, not in the TUI client."
                + " Verify the TUI gateway endpoint points to a silo that has the grain interface assembly loaded."
                + " Check the silo's gatewayPort in the Orleans configuration.]";
        }

        return result;
    }
}
