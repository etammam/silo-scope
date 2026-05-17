using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using FluentResults;
using Siloscope.Core.Interfaces;

namespace Siloscope.Core.Cluster;

public sealed class GrainInvocationService : IGrainInvocationService
{
    private readonly IOrleansClientConnectorPool _connectorPool;

    public GrainInvocationService(IOrleansClientConnectorPool connectorPool)
    {
        _connectorPool = connectorPool;
    }

    private static readonly JsonSerializerOptions SerializerOptions = new()
    {
        PropertyNameCaseInsensitive = true,
    };
    private Action<string>? _diagnosticSink;

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
        payloadJson ??= string.Empty;

        LogSection(
            "Invoke",
            $"Start {grain.Name}.{method.MethodInfo.Name}, key='{grainKey}', payloadChars={payloadJson.Length}"
        );
        LogSection("Payload", $"JSON={FormatPayloadForLog(payloadJson)}");

        if (string.IsNullOrWhiteSpace(grainKey))
        {
            LogSection("Invoke", "Rejected: empty grain key.");
            return Result.Fail("Grain key is required.");
        }

        if (
            !_connectorPool.TryGetConnectorForGateway(grain.Gateway, out var connector)
            || connector is null
        )
        {
            LogSection(
                "Invoke",
                $"Rejected: no connector for gateway '{grain.Gateway ?? "null"}'."
            );
            return Result.Fail($"No connector available for gateway '{grain.Gateway}'.");
        }

        if (!connector.TryGetClient(out var client))
        {
            LogSection("Invoke", "Rejected: Orleans client is not connected.");
            return Result.Fail("Client is not connected. Click Connect first.");
        }

        var keyType = DetectGrainKeyType(grain.InterfaceType);
        if (keyType == GrainKeyType.Unknown)
        {
            LogSection("Invoke", $"Rejected: unsupported key type for '{grain.Name}'.");
            return Result.Fail(
                $"Grain '{grain.Name}' does not implement a supported key interface (string, integer, guid, or compound)."
            );
        }

        LogSection("Invoke", $"Detected grain key type: {keyType}.");

        LogSection(
            "TypeLoad",
            $"Discovered interface '{grain.InterfaceType.FullName}' in '{grain.InterfaceType.Assembly.FullName}'."
        );
        LogSection("TypeLoad", BuildTypeDiagnostics(grain.InterfaceType, "catalog"));
        LogSection("TypeLoad", $"Discovered method '{BuildMethodSignature(method.MethodInfo)}'.");

        var runtimeResolution = ResolveRuntimeTargets(grain.InterfaceType, method.MethodInfo);
        if (!runtimeResolution.IsSuccess)
        {
            foreach (var error in runtimeResolution.Errors)
            {
                LogSection("TypeLoad", $"Failed: {error.Message}");
            }

            return Result.Fail(errors: runtimeResolution.Errors);
        }

        var (runtimeInterfaceType, runtimeMethodInfo) = runtimeResolution.Value;
        LogSection("TypeLoad", BuildTypeDiagnostics(runtimeInterfaceType, "runtime"));
        LogSection("TypeLoad", $"Resolved method '{BuildMethodSignature(runtimeMethodInfo)}'.");

        try
        {
            if (client is not IGrainFactory grainFactory)
            {
                LogSection("Invoke", "Rejected: connected client is not an IGrainFactory.");
                return Result.Fail("Connected Orleans client does not expose IGrainFactory.");
            }

            var grainRef = ResolveGrain(
                grainFactory,
                runtimeInterfaceType,
                keyType,
                grainKey,
                LogSection
            );
            if (!grainRef.IsSuccess)
            {
                foreach (var error in grainRef.Errors)
                {
                    LogSection("Invoke", $"Grain resolution failed: {error.Message}");
                }

                return Result.Fail(errors: grainRef.Errors);
            }

            var grainReference = grainRef.Value!;
            LogSection(
                "Invoke",
                $"Grain reference resolved as '{grainReference.GetType().FullName}'."
            );

            var arguments = BindArguments(runtimeMethodInfo, payloadJson);
            LogSection(
                "Bind",
                $"Bound {arguments.Length} argument(s). [{DescribeArguments(runtimeMethodInfo, arguments)}]"
            );

            var rawResult = runtimeMethodInfo.Invoke(grainReference, arguments);
            LogSection(
                "Invoke",
                $"Method invocation returned '{rawResult?.GetType().FullName ?? "null"}'."
            );

            var normalized = await AwaitResultAsync(
                rawResult,
                runtimeMethodInfo.ReturnType,
                cancellationToken
            );
            LogSection(
                "Result",
                $"Normalized result type '{normalized?.GetType().FullName ?? "null"}'."
            );

            var response = JsonSerializer.Serialize(normalized, SerializerOptions);
            LogSection("Result", $"Serialized response size={response.Length} chars.");
            return Result.Ok(response);
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

            LogSection("Error", flattened);
            LogSection("Error", $"Exception chain: {BuildExceptionChain(ex)}");
            LogSection("Error", $"Stack trace: {ex}");

            return Result.Fail($"Invocation failed: {flattened}");
        }
    }

    private void LogSection(string section, string message)
    {
        _diagnosticSink?.Invoke($"[{section}] {message}");
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
        var location = string.IsNullOrWhiteSpace(assembly.Location)
            ? "<dynamic>"
            : assembly.Location;
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
            LogSection(
                "TypeLoad",
                "Type resolution skipped: discovered interface has no full name."
            );
            return null;
        }

        LogSection("TypeLoad", $"Resolving type '{fullName}' in AssemblyLoadContext.Default.");

        foreach (var assembly in AssemblyLoadContext.Default.Assemblies)
        {
            var found = assembly.GetType(fullName, throwOnError: false, ignoreCase: false);
            if (found is not null)
            {
                LogSection(
                    "TypeLoad",
                    $"Resolved from already loaded assembly '{assembly.FullName}'."
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
                LogSection(
                    "TypeLoad",
                    $"Resolved after LoadFromAssemblyName('{discoveredInterfaceType.Assembly.GetName().Name}')."
                );
                return byNameType;
            }
        }
        catch (Exception ex)
        {
            LogSection("TypeLoad", $"LoadFromAssemblyName failed: {ex.Message}");
        }

        var assemblyPath = discoveredInterfaceType.Assembly.Location;
        if (string.IsNullOrWhiteSpace(assemblyPath) || !File.Exists(assemblyPath))
        {
            LogSection(
                "TypeLoad",
                $"Type resolution fallback skipped: assembly path not found for '{discoveredInterfaceType.Assembly.FullName}'."
            );
            return null;
        }

        try
        {
            var assembly = AssemblyLoadContext.Default.LoadFromAssemblyPath(assemblyPath);
            var resolved = assembly.GetType(fullName, throwOnError: false, ignoreCase: false);
            if (resolved is not null)
            {
                LogSection("TypeLoad", $"Resolved after LoadFromAssemblyPath('{assemblyPath}').");
            }

            return resolved;
        }
        catch (Exception ex)
        {
            LogSection("TypeLoad", $"LoadFromAssemblyPath failed: {ex.Message}");
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
        if (typeof(IGrainWithStringKey).IsAssignableFrom(interfaceType))
            return GrainKeyType.String;
        if (typeof(IGrainWithIntegerKey).IsAssignableFrom(interfaceType))
            return GrainKeyType.Integer;
        if (typeof(IGrainWithGuidKey).IsAssignableFrom(interfaceType))
            return GrainKeyType.Guid;
        if (typeof(IGrainWithIntegerCompoundKey).IsAssignableFrom(interfaceType))
            return GrainKeyType.IntegerCompound;
        if (typeof(IGrainWithGuidCompoundKey).IsAssignableFrom(interfaceType))
            return GrainKeyType.GuidCompound;
        return GrainKeyType.Unknown;
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

    private static Result<object> ResolveGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        GrainKeyType keyType,
        string grainKey,
        Action<string, string>? logSection = null
    )
    {
        return keyType switch
        {
            GrainKeyType.String => ResolveStringKeyGrain(
                grainFactory,
                grainInterfaceType,
                grainKey,
                logSection
            ),
            GrainKeyType.Integer => ResolveIntegerKeyGrain(
                grainFactory,
                grainInterfaceType,
                grainKey,
                logSection
            ),
            GrainKeyType.Guid => ResolveGuidKeyGrain(
                grainFactory,
                grainInterfaceType,
                grainKey,
                logSection
            ),
            GrainKeyType.IntegerCompound => ResolveIntegerCompoundKeyGrain(
                grainFactory,
                grainInterfaceType,
                grainKey,
                logSection
            ),
            GrainKeyType.GuidCompound => ResolveGuidCompoundKeyGrain(
                grainFactory,
                grainInterfaceType,
                grainKey,
                logSection
            ),
            _ => Result.Fail($"Unsupported grain key type for '{grainInterfaceType.Name}'."),
        };
    }

    private static Result<object> ResolveStringKeyGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        string grainKey,
        Action<string, string>? logSection = null
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
            logSection?.Invoke("Invoke", "Grain reference path: GetGrain<T>(string).");
            return Result.Ok<object>(genericRef);
        }
        catch (Exception ex)
        {
            logSection?.Invoke("Invoke", $"GetGrain<T>(string) failed: {FlattenException(ex)}");
            return Result.Fail<object>(
                $"Failed to resolve string-key grain: {FlattenException(ex)}"
            );
        }
    }

    private static Result<object> ResolveIntegerKeyGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        string grainKey,
        Action<string, string>? logSection = null
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
            logSection?.Invoke("Invoke", "Grain reference path: GetGrain<T>(long).");
            return Result.Ok<object>(genericRef);
        }
        catch (Exception ex)
        {
            logSection?.Invoke("Invoke", $"GetGrain<T>(long) failed: {FlattenException(ex)}");
            return Result.Fail<object>(
                $"Failed to resolve integer-key grain: {FlattenException(ex)}"
            );
        }
    }

    private static Result<object> ResolveGuidKeyGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        string grainKey,
        Action<string, string>? logSection = null
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
            logSection?.Invoke("Invoke", "Grain reference path: GetGrain<T>(Guid).");
            return Result.Ok<object>(genericRef);
        }
        catch (Exception ex)
        {
            logSection?.Invoke("Invoke", $"GetGrain<T>(Guid) failed: {FlattenException(ex)}");
            return Result.Fail<object>($"Failed to resolve GUID-key grain: {FlattenException(ex)}");
        }
    }

    private static Result<object> ResolveIntegerCompoundKeyGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        string grainKey,
        Action<string, string>? logSection = null
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
            logSection?.Invoke(
                "Invoke",
                $"Grain reference path: GetGrain<T>(long, string) with extension='{keyExtension}'."
            );
            return Result.Ok<object>(result);
        }
        catch (Exception ex)
        {
            logSection?.Invoke(
                "Invoke",
                $"GetGrain<T>(long, string) failed: {FlattenException(ex)}"
            );
            return Result.Fail<object>(
                $"Failed to resolve integer-compound-key grain: {FlattenException(ex)}"
            );
        }
    }

    private static Result<object> ResolveGuidCompoundKeyGrain(
        IGrainFactory grainFactory,
        Type grainInterfaceType,
        string grainKey,
        Action<string, string>? logSection = null
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
            logSection?.Invoke(
                "Invoke",
                $"Grain reference path: GetGrain<T>(Guid, string) with extension='{keyExtension}'."
            );
            return Result.Ok<object>(result);
        }
        catch (Exception ex)
        {
            logSection?.Invoke(
                "Invoke",
                $"GetGrain<T>(Guid, string) failed: {FlattenException(ex)}"
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

        if (genericDefinition == typeof(IReadOnlySet<>) || genericDefinition == typeof(ISet<>))
        {
            return typeof(HashSet<>).MakeGenericType(args);
        }

        if (
            genericDefinition == typeof(IReadOnlyList<>)
            || genericDefinition == typeof(IList<>)
            || genericDefinition == typeof(IEnumerable<>)
        )
        {
            return typeof(List<>).MakeGenericType(args);
        }

        if (
            genericDefinition == typeof(IReadOnlyDictionary<,>)
            || genericDefinition == typeof(IDictionary<,>)
        )
        {
            return typeof(Dictionary<,>).MakeGenericType(args);
        }

        return targetType;
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
