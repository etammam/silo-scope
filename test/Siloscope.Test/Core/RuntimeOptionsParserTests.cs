using System.Text.Json;
using AwesomeAssertions;
using Siloscope.Core.Configuration;
using Xunit;

namespace Siloscope.Test.Core;

public sealed class RuntimeOptionsParserTests
{
    [Fact]
    public void Parse_HelpRequested_FailsWithHelpRequestedMessage()
    {
        var result = RuntimeOptionsParser.Parse(["--help"]);

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Be("Help requested.");
    }

    [Fact]
    public void Parse_UnexpectedToken_Fails()
    {
        var result = RuntimeOptionsParser.Parse(["cluster-id", "dev"]);

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Contain("Unexpected token");
    }

    [Fact]
    public void Parse_DllSource_Succeeds()
    {
        var args = new[]
        {
            "--cluster-id",
            "dev",
            "--service-id",
            "svc",
            "--source",
            "dll",
            "--dll",
            "/tmp/contracts.dll",
        };

        var result = RuntimeOptionsParser.Parse(args);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Interfaces[0].SourceType.Should().Be(InterfaceSourceType.Dll);
        result.Value.Cluster.ClusterId.Should().Be("dev");
    }

    [Fact]
    public void Parse_NuGetMissingVersion_Fails()
    {
        var args = new[]
        {
            "--cluster-id",
            "dev",
            "--service-id",
            "svc",
            "--source",
            "nuget",
            "--package-id",
            "Contracts",
        };

        var result = RuntimeOptionsParser.Parse(args);

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Contain("--package-id and --package-version");
    }

    [Fact]
    public void Parse_LoadsDefaultJson_WhenConfigFlagIsMissing()
    {
        using var scope = CurrentDirectoryScope.Create();
        WriteConfig(
            Path.Combine(scope.Path, "default.json"),
            "dev-from-default",
            "svc",
            "dll",
            dll: "/tmp/contracts.dll"
        );

        var result = RuntimeOptionsParser.Parse([]);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Cluster.ClusterId.Should().Be("dev-from-default");
        result.Value.Interfaces[0].SourceType.Should().Be(InterfaceSourceType.Dll);
    }

    [Fact]
    public void Parse_CliOverrides_DefaultJson()
    {
        using var scope = CurrentDirectoryScope.Create();
        WriteConfig(
            Path.Combine(scope.Path, "default.json"),
            "dev-from-default",
            "svc",
            "dll",
            dll: "/tmp/contracts.dll"
        );

        var args = new[] { "--cluster-id", "dev-from-cli" };
        var result = RuntimeOptionsParser.Parse(args);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Cluster.ClusterId.Should().Be("dev-from-cli");
    }

    [Fact]
    public void Parse_ConfigRelativeDll_IsResolvedFromConfigDirectory()
    {
        using var scope = CurrentDirectoryScope.Create();
        var configDirectory = Path.Combine(scope.Path, "cfg");
        Directory.CreateDirectory(configDirectory);

        var configPath = Path.Combine(configDirectory, "custom.json");
        WriteConfig(configPath, "dev", "svc", "dll", dll: "src/contracts.dll");

        var result = RuntimeOptionsParser.Parse(["--config", configPath]);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result
            .Value!.Interfaces[0]
            .DllPath.Should()
            .Be(Path.GetFullPath(Path.Combine(configDirectory, "src/contracts.dll")));
    }

    [Fact]
    public void Parse_ConfigWithHyphenatedNuGetKeys_Succeeds()
    {
        using var scope = CurrentDirectoryScope.Create();
        var configPath = Path.Combine(scope.Path, "default.json");

        File.WriteAllText(
            configPath,
            """
            {
              "clusterId": "dev",
              "serviceId": "svc",
              "source": "nuget",
              "package-id": "Contracts",
              "package-version": "1.2.3",
              "nuget-config": "nuget.config"
            }
            """
        );

        var result = RuntimeOptionsParser.Parse([]);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        var source = result.Value!.Interfaces[0];
        source.SourceType.Should().Be(InterfaceSourceType.NuGet);
        source.PackageId.Should().Be("Contracts");
        source.PackageVersion.Should().Be("1.2.3");
        source.NugetConfigPath.Should().NotBeNullOrWhiteSpace();
        source.NugetConfigPath.Should().EndWith(Path.Combine("nuget.config"));
    }

    [Fact]
    public void Parse_CliNugetConfig_PropagatesToConfigInterfacesWithoutOwnValue()
    {
        using var scope = CurrentDirectoryScope.Create();
        var configPath = Path.Combine(scope.Path, "default.json");

        File.WriteAllText(
            configPath,
            """
            {
              "clusterId": "dev",
              "serviceId": "svc",
              "interfaces": [
                {
                  "source": "nuget",
                  "package-id": "Contracts",
                  "package-version": "1.2.3"
                }
              ]
            }
            """
        );

        var cliNugetConfig = Path.Combine(scope.Path, "feeds", "nuget.config");
        var result = RuntimeOptionsParser.Parse(["--nuget-config", cliNugetConfig]);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Interfaces.Should().HaveCount(1);
        result.Value.Interfaces[0].NugetConfigPath.Should().NotBeNullOrWhiteSpace();
        result
            .Value.Interfaces[0]
            .NugetConfigPath.Should()
            .EndWith(Path.Combine("feeds", "nuget.config"));
    }

    [Fact]
    public void Parse_MissingRequiredClusterId_Fails()
    {
        var result = RuntimeOptionsParser.Parse([
            "--service-id",
            "svc",
            "--source",
            "dll",
            "--dll",
            "/tmp/a.dll",
        ]);

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Be("Missing required option: --cluster-id");
    }

    [Fact]
    public void Parse_ConfigPathNotFound_Fails()
    {
        var result = RuntimeOptionsParser.Parse(["--config", "./does-not-exist.json"]);

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Contain("Config file not found:");
    }

    [Fact]
    public void Parse_InvalidConfigJson_Fails()
    {
        using var scope = CurrentDirectoryScope.Create();
        var configPath = Path.Combine(scope.Path, "default.json");
        File.WriteAllText(configPath, "{ invalid-json");

        var result = RuntimeOptionsParser.Parse([]);

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().StartWith("Failed to read config file:");
    }

    [Fact]
    public void Parse_MultiSourceConfig_LoadsAllInterfacesAndResolvesRelativePaths()
    {
        using var scope = CurrentDirectoryScope.Create();
        var configPath = Path.Combine(scope.Path, "default.json");

        File.WriteAllText(
            configPath,
            """
            {
              "clusterId": "dev",
              "serviceId": "svc",
              "gatewayEndpoints": ["127.0.0.1:30000"],
              "interfaces": [
                {
                  "gateway": "127.0.0.1:30000",
                  "source": "dll",
                  "dll": "contracts/one.dll"
                },
                {
                  "gateway": "127.0.0.1:30001",
                  "source": "nuget",
                  "package-id": "Contracts",
                  "package-version": "1.2.3",
                  "package-root": "pkgs"
                }
              ]
            }
            """
        );

        var result = RuntimeOptionsParser.Parse([]);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Interfaces.Should().HaveCount(2);

        var first = result.Value.Interfaces[0];
        first.SourceType.Should().Be(InterfaceSourceType.Dll);
        first.DllPath.Should().EndWith(Path.Combine("contracts", "one.dll"));
        first.Gateway.Should().Be("127.0.0.1:30000");

        var second = result.Value.Interfaces[1];
        second.SourceType.Should().Be(InterfaceSourceType.NuGet);
        second.PackageId.Should().Be("Contracts");
        second.PackageVersion.Should().Be("1.2.3");
        second.PackageRoot.Should().EndWith(Path.Combine("pkgs"));
        second.Gateway.Should().Be("127.0.0.1:30001");
    }

    [Fact]
    public void Parse_CliSourceOverride_ReplacesConfigMultiSourceWithSingleCliEntry()
    {
        using var scope = CurrentDirectoryScope.Create();
        var configPath = Path.Combine(scope.Path, "default.json");

        File.WriteAllText(
            configPath,
            """
            {
              "clusterId": "dev",
              "serviceId": "svc",
              "interfaces": [
                {
                  "gateway": "127.0.0.1:30000",
                  "source": "nuget",
                  "package-id": "Contracts",
                  "package-version": "1.2.3"
                }
              ]
            }
            """
        );

        var result = RuntimeOptionsParser.Parse(["--source", "dll", "--dll", "/tmp/override.dll"]);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Interfaces.Should().HaveCount(1);
        result.Value.Interfaces[0].SourceType.Should().Be(InterfaceSourceType.Dll);
        result.Value.Interfaces[0].DllPath.Should().Be("/tmp/override.dll");
    }

    [Fact]
    public void Parse_CliNugetConfig_DoesNotOverrideInterfaceEntryThatAlreadyHasNugetConfig()
    {
        using var scope = CurrentDirectoryScope.Create();
        var configPath = Path.Combine(scope.Path, "default.json");

        File.WriteAllText(
            configPath,
            """
            {
              "clusterId": "dev",
              "serviceId": "svc",
              "interfaces": [
                {
                  "source": "nuget",
                  "package-id": "Contracts",
                  "package-version": "1.2.3",
                  "nuget-config": "existing.nuget.config"
                }
              ]
            }
            """
        );

        var result = RuntimeOptionsParser.Parse(["--nuget-config", "./override.nuget.config"]);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Interfaces.Should().HaveCount(1);
        result.Value.Interfaces[0].NugetConfigPath.Should().EndWith("existing.nuget.config");
    }

    [Fact]
    public void Parse_RedisClusteringConfig_Succeeds()
    {
        using var scope = CurrentDirectoryScope.Create();
        var configPath = Path.Combine(scope.Path, "default.json");

        File.WriteAllText(
            configPath,
            """
            {
              "clusterId": "interlink",
              "serviceId": "interlink",
              "clustering": {
                "provider": "redis",
                "redis": {
                  "connectionString": "127.0.0.1:6379,defaultDatabase=5"
                }
              },
              "interfaces": [
                {
                  "source": "dll",
                  "dll": "contracts/interlink.dll"
                }
              ]
            }
            """
        );

        var result = RuntimeOptionsParser.Parse([]);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Cluster.Clustering.Should().NotBeNull();
        result.Value.Cluster.Clustering!.Provider.Should().Be(ToolClusteringProvider.Redis);
        result.Value.Cluster.Clustering.Redis.Should().NotBeNull();
        result
            .Value.Cluster.Clustering.Redis!.ConnectionString.Should()
            .Be("127.0.0.1:6379,defaultDatabase=5");
    }

    [Fact]
    public void Parse_AdoNetClusteringConfig_Succeeds()
    {
        using var scope = CurrentDirectoryScope.Create();
        var configPath = Path.Combine(scope.Path, "default.json");

        File.WriteAllText(
            configPath,
            """
            {
              "clusterId": "interlink",
              "serviceId": "interlink",
              "clustering": {
                "provider": "adoNet",
                "adoNet": {
                  "connectionString": "Host=localhost;Database=orleans"
                }
              },
              "interfaces": [
                {
                  "source": "dll",
                  "dll": "contracts/interlink.dll"
                }
              ]
            }
            """
        );

        var result = RuntimeOptionsParser.Parse([]);

        result.IsSuccess.Should().BeTrue();
        result.Value.Should().NotBeNull();
        result.Value!.Cluster.Clustering.Should().NotBeNull();
        result.Value.Cluster.Clustering!.Provider.Should().Be(ToolClusteringProvider.AdoNet);
        result.Value.Cluster.Clustering.AdoNet.Should().NotBeNull();
        result
            .Value.Cluster.Clustering.AdoNet!.ConnectionString.Should()
            .Be("Host=localhost;Database=orleans");
    }

    [Fact]
    public void Parse_RedisClusteringWithoutConnectionString_Fails()
    {
        using var scope = CurrentDirectoryScope.Create();
        var configPath = Path.Combine(scope.Path, "default.json");

        File.WriteAllText(
            configPath,
            """
            {
              "clusterId": "interlink",
              "serviceId": "interlink",
              "clustering": {
                "provider": "redis",
                "redis": {
                  "database": 1
                }
              },
              "source": "dll",
              "dll": "contracts/interlink.dll"
            }
            """
        );

        var result = RuntimeOptionsParser.Parse([]);

        result.IsSuccess.Should().BeFalse();
        result.ErrorMessage.Should().Contain("Redis clustering requires");
    }

    private static void WriteConfig(
        string path,
        string clusterId,
        string serviceId,
        string source,
        string? dll = null,
        string? packageId = null,
        string? packageVersion = null
    )
    {
        var json = JsonSerializer.Serialize(
            new
            {
                clusterId,
                serviceId,
                source,
                dll,
                packageId,
                packageVersion,
            }
        );

        File.WriteAllText(path, json);
    }

    private sealed class CurrentDirectoryScope(string previousPath, string path) : IDisposable
    {
        public string Path => path;

        public static CurrentDirectoryScope Create()
        {
            var previous = Directory.GetCurrentDirectory();
            var temp = System.IO.Path.Combine(
                System.IO.Path.GetTempPath(),
                "orleans-tui-tests",
                Guid.NewGuid().ToString("N")
            );
            Directory.CreateDirectory(temp);
            Directory.SetCurrentDirectory(temp);
            return new CurrentDirectoryScope(previous, temp);
        }

        public void Dispose()
        {
            Directory.SetCurrentDirectory(previousPath);
            Directory.Delete(path, recursive: true);
        }
    }
}
