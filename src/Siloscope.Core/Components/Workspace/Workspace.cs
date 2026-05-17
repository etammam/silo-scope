using System.Text.Json.Serialization;

namespace Siloscope.Core.Components.Workspace;

public class Workspace
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("workspace")]
    public WorkspaceInfo WorkspaceInfo { get; set; } = new();

    [JsonPropertyName("cluster")]
    public ClusterConfig Cluster { get; set; } = new();

    [JsonPropertyName("silos")]
    public List<SiloSource> Silos { get; set; } = new();

    [JsonPropertyName("security")]
    public SecurityConfig Security { get; set; } = new();

    [JsonPropertyName("environments")]
    public List<EnvironmentConfig> Environments { get; set; } = new();

    [JsonPropertyName("session")]
    public SessionConfig Session { get; set; } = new();
}

public class WorkspaceInfo
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("description")]
    public string Description { get; set; } = string.Empty;

    [JsonPropertyName("creation")]
    public string Creation { get; set; } = string.Empty;
}

public enum ClusterType
{
    Homogenous,
    Heterogeneous,
}

public class ClusterConfig
{
    [JsonPropertyName("type")]
    public ClusterType Type { get; set; } = ClusterType.Homogenous;

    [JsonPropertyName("clusterId")]
    public string ClusterId { get; set; } = string.Empty;

    [JsonPropertyName("serviceId")]
    public string ServiceId { get; set; } = string.Empty;

    [JsonPropertyName("defaultGateway")]
    public string DefaultGateway { get; set; } = string.Empty;
}

public class SiloSource
{
    [JsonPropertyName("reference")]
    public string Reference { get; set; } = string.Empty;

    [JsonPropertyName("source")]
    public string Source { get; set; } = "DLL";

    [JsonPropertyName("version")]
    public string? Version { get; set; }

    [JsonPropertyName("gateway")]
    public string? Gateway { get; set; }

    [JsonPropertyName("enabled")]
    public bool Enabled { get; set; } = true;
}

public class SecurityConfig
{
    [JsonPropertyName("workspaceSalt")]
    public string WorkspaceSalt { get; set; } = string.Empty;
}

public class EnvironmentConfig
{
    [JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [JsonPropertyName("variables")]
    public Dictionary<string, string> Variables { get; set; } = new();
}

public class SessionConfig
{
    [JsonPropertyName("activeEnvironment")]
    public string ActiveEnvironment { get; set; } = string.Empty;
}
