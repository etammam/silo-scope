using FluentResults;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using Siloscope.Core.Serialization;
using Xunit;

namespace Siloscope.Test.Core;

public sealed class FluentResultJsonConverterTests
{
    private readonly JsonSerializerSettings _settings = new()
    {
        Converters = { new FluentResultJsonConverter() },
    };

    [Fact]
    public void Serialize_FailedGenericResult_DoesNotReadValue()
    {
        var result = Result.Fail<string>("workspace missing");

        var json = JsonConvert.SerializeObject(result, _settings);
        var token = JObject.Parse(json);

        Assert.False(token.Value<bool>("IsSuccess"));
        Assert.True(token.Value<bool>("IsFailed"));
        Assert.Null(token.Property("Value"));
        Assert.Equal("workspace missing", token["Errors"]?[0]?["Message"]?.Value<string>());
    }

    [Fact]
    public void Serialize_SuccessGenericResult_WritesValue()
    {
        var result = Result.Ok("grain catalog");

        var json = JsonConvert.SerializeObject(result, _settings);
        var token = JObject.Parse(json);

        Assert.True(token.Value<bool>("IsSuccess"));
        Assert.False(token.Value<bool>("IsFailed"));
        Assert.Equal("grain catalog", token.Value<string>("Value"));
    }
}
