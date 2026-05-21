using FluentResults;
using Newtonsoft.Json;

namespace Siloscope.Core.Serialization;

/// <summary>
/// Converts <see cref="Result" /> and <see cref="Result{T}" /> instances to JSON for JSON-RPC serialization.
/// </summary>
public sealed class FluentResultJsonConverter : JsonConverter
{
    public override bool CanRead => false;

    public override bool CanConvert(Type objectType)
    {
        return objectType == typeof(Result)
            || (
                objectType.IsGenericType
                && objectType.GetGenericTypeDefinition() == typeof(Result<>)
            );
    }

    public override void WriteJson(JsonWriter writer, object? value, JsonSerializer serializer)
    {
        if (value is null)
        {
            writer.WriteNull();
            return;
        }

        var isSuccess = (bool)(
            value.GetType().GetProperty(nameof(Result.IsSuccess))?.GetValue(value) ?? false
        );
        var reasons =
            value.GetType().GetProperty(nameof(Result.Reasons))?.GetValue(value)
            as IReadOnlyList<IReason>;

        writer.WriteStartObject();
        writer.WritePropertyName(nameof(Result.IsSuccess));
        writer.WriteValue(isSuccess);
        writer.WritePropertyName(nameof(Result.IsFailed));
        writer.WriteValue(!isSuccess);

        if (isSuccess && TryGetValue(value, out var resultValue))
        {
            writer.WritePropertyName("Value");
            serializer.Serialize(writer, resultValue);
        }

        writer.WritePropertyName(nameof(Result.Reasons));
        WriteReasons(writer, serializer, reasons ?? []);

        writer.WritePropertyName(nameof(Result.Errors));
        WriteReasons(writer, serializer, reasons?.OfType<IError>().ToList() ?? []);

        writer.WritePropertyName(nameof(Result.Successes));
        WriteReasons(writer, serializer, reasons?.OfType<ISuccess>().ToList() ?? []);
        writer.WriteEndObject();
    }

    public override object ReadJson(
        JsonReader reader,
        Type objectType,
        object? existingValue,
        JsonSerializer serializer
    )
    {
        throw new NotSupportedException("FluentResults are only serialized by JSON-RPC.");
    }

    private static bool TryGetValue(object result, out object? value)
    {
        var valueProperty = result.GetType().GetProperty("Value");
        if (valueProperty is null)
        {
            value = null;
            return false;
        }

        value = valueProperty.GetValue(result);
        return true;
    }

    private static void WriteReasons(
        JsonWriter writer,
        JsonSerializer serializer,
        IReadOnlyList<IReason> reasons
    )
    {
        writer.WriteStartArray();

        foreach (var reason in reasons)
        {
            writer.WriteStartObject();
            writer.WritePropertyName(nameof(IReason.Message));
            writer.WriteValue(reason.Message);

            if (reason.Metadata.Count > 0)
            {
                writer.WritePropertyName(nameof(IReason.Metadata));
                serializer.Serialize(writer, reason.Metadata);
            }

            if (reason is IError error && error.Reasons.Count > 0)
            {
                writer.WritePropertyName(nameof(IError.Reasons));
                WriteReasons(writer, serializer, error.Reasons);
            }

            writer.WriteEndObject();
        }

        writer.WriteEndArray();
    }
}
