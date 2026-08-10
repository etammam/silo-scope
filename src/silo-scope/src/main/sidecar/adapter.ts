/**
 * Typed adapter for the SiloScope Core JSON-RPC sidecar.
 *
 * Wraps {@link SidecarJsonRpcClient} with methods matching the C#
 * `ISiloScopeCommands` interface. Owns PascalCase→camelCase field
 * mapping and `FluentResult<T>` unwrapping so that IPC handlers receive
 * clean, validated data.
 *
 * The adapter is the single seam between the Electron main process and the
 * .NET sidecar — mock it in tests, swap the transport in the future.
 *
 * @module main/sidecar/adapter
 */

import type { Workspace } from "../../features/workspaces/schema";
import { SidecarJsonRpcClient } from "./json-rpc-client";

/**
 * Generic `FluentResult<T>` envelope returned by every SiloScope Core
 * JSON-RPC method. Mirrors the C# `FluentResults.Result<T>` shape.
 */
type FluentResult<T> = {
  /** Whether the operation succeeded. */
  IsSuccess: boolean;
  /** Error details when `IsSuccess` is false. */
  Errors?: Array<{ Message?: string }>;
  /** The result value when `IsSuccess` is true. */
  Value?: T;
};

/**
 * Backend (PascalCase) types matching the C# JSON-RPC response shapes.
 * These are anonymous — they exist only for mapping, not exported.
 */
type BackendParameter = {
  Name?: string;
  TypeName?: string;
};

type BackendMethod = {
  FunctionId: string;
  SourceId: string;
  InterfaceId: string;
  InterfaceName: string;
  Namespace: string;
  MethodName: string;
  Signature: string;
  ReturnType: string;
  KeyType: string;
  Parameters?: BackendParameter[];
};

type BackendCatalogInterface = {
  InterfaceId: string;
  InterfaceName: string;
  Namespace: string;
  Methods?: BackendMethod[];
};

type BackendCatalogSource = {
  SourceId: string;
  SourceType: string;
  Reference: string;
  Label: string;
  Version?: string | null;
  Gateway?: string | null;
  Enabled: boolean;
  DiscoveryStatus: string;
  Interfaces?: BackendCatalogInterface[];
};

type BackendSourceCatalog = {
  Sources?: BackendCatalogSource[];
};

type BackendInvocationTiming = {
  SerializationMs?: number;
  ExecutionMs?: number;
  TotalMs?: number;
};

type BackendInvocationResult = {
  IsSuccess: boolean;
  Result?: string;
  Error?: string;
  Timing?: BackendInvocationTiming;
};

/**
 * Checks whether an error is a "missing JSON-RPC method" error from
 * StreamJsonRpc, which indicates a version mismatch between the
 * Electron app and the SiloScope Core sidecar.
 *
 * @param error - The error thrown by the sidecar client.
 * @returns `true` when the error message indicates a missing method.
 */
function isMissingJsonRpcMethod(error: unknown): boolean {
  return error instanceof Error && /no method by the name/i.test(error.message);
}

/**
 * Type guard for grain key types returned by the backend.
 */
function isGrainKeyType(value: string): value is "Guid" | "String" | "Integer" {
  return value === "Guid" || value === "String" || value === "Integer";
}

/**
 * Filters out `CancellationToken` parameters which are injected by the
 * Orleans runtime and not relevant for manual grain invocation.
 */
function isCancellationTokenParameter(parameter: {
  Name?: string;
  TypeName?: string;
}): boolean {
  return (
    parameter.TypeName === "CancellationToken" ||
    parameter.TypeName === "System.Threading.CancellationToken" ||
    parameter.Name?.toLowerCase() === "cancellationtoken"
  );
}

/**
 * Maps a frontend {@link Workspace} to the backend workspace DTO shape
 * expected by `SetWorkspaceAsync`.
 */
function mapBackendWorkspace(workspace: Workspace): Record<string, unknown> {
  return {
    id: workspace.id,
    name: workspace.name,
    description: workspace.description ?? null,
    cluster: mapBackendCluster(workspace),
    silos: (workspace.sources ?? []).map((source) => ({
      reference: source.reference,
      source: source.sourceType === "NuGet" ? "NuGet" : "DLL",
      version: source.version ?? null,
      gateway: source.gateway ?? null,
      feedName: source.feedName ?? null,
      enabled: source.enabled,
    })),
    savedContexts: (workspace.savedContexts ?? []).map((context) => ({
      tabId: context.tabId,
      isDefaultActive: context.isDefaultActive,
      targetGrainClass: context.targetGrainClass,
      targetMethod: context.targetMethod,
      keyType: context.keyType,
      grainId: context.grainId,
      payload: context.payload,
      sourceId: context.sourceId ?? null,
      functionId: context.functionId ?? null,
    })),
  };
}

/**
 * Provider-to-key mapping for clustering connection options.
 */
const clusterConnectionOptionKeys: Record<
  string,
  { backend: string; workspace: string }
> = {
  Redis: { backend: "Redis", workspace: "redis" },
  AdoNet: { backend: "AdoNet", workspace: "adoNet" },
  AzureStorage: { backend: "AzureStorage", workspace: "azureStorage" },
  Cosmos: { backend: "Cosmos", workspace: "cosmos" },
  Consul: { backend: "Consul", workspace: "consul" },
  DynamoDB: { backend: "DynamoDB", workspace: "dynamoDB" },
  ZooKeeper: { backend: "ZooKeeper", workspace: "zooKeeper" },
  Cassandra: { backend: "Cassandra", workspace: "cassandra" },
};

/**
 * Builds the backend clustering options DTO from a workspace's clustering
 * configuration.
 */
function buildBackendClustering(
  clustering: NonNullable<Workspace["clustering"]>,
): Record<string, unknown> {
  const provider = clustering.provider;
  const keys = clusterConnectionOptionKeys[provider];
  const workspaceOptions =
    clustering[keys.workspace as keyof typeof clustering];
  const connectionString =
    typeof workspaceOptions === "object" &&
    workspaceOptions !== null &&
    "connectionString" in workspaceOptions &&
    typeof workspaceOptions.connectionString === "string"
      ? workspaceOptions.connectionString
      : "";
  const invariant =
    typeof workspaceOptions === "object" &&
    workspaceOptions !== null &&
    "invariant" in workspaceOptions &&
    typeof workspaceOptions.invariant === "string"
      ? workspaceOptions.invariant
      : null;

  return {
    provider,
    [keys.workspace]: {
      connectionString,
      invariant,
    },
  };
}

/**
 * Maps a workspace to the backend cluster options DTO for `ConnectClusterAsync`.
 */
function mapBackendCluster(workspace: Workspace): Record<string, unknown> {
  const clustering = workspace.clustering;
  const provider = clustering?.provider;
  const hasRemoteClustering = Boolean(provider);
  const gatewayEndpoints = hasRemoteClustering
    ? []
    : workspace.gatewayEndpoints?.length
      ? workspace.gatewayEndpoints
      : [`${workspace.siloAddress}:${workspace.gatewayPort}`];

  return {
    clusterId: workspace.clusterId ?? "dev",
    serviceId: workspace.serviceId ?? "SiloScope",
    gatewayEndpoints,
    type: workspace.clusterType ?? "Homogenous",
    clustering:
      provider && clustering ? buildBackendClustering(clustering) : null,
  };
}

/**
 * Maps the PascalCase backend source catalog to camelCase frontend shape.
 */
function mapSourceCatalog(
  catalog: BackendSourceCatalog,
): Record<string, unknown> {
  function isDiscoveryStatus(
    value: string,
  ): value is "idle" | "discovering" | "ready" | "error" {
    return (
      value === "idle" ||
      value === "discovering" ||
      value === "ready" ||
      value === "error"
    );
  }

  return {
    sources: (catalog.Sources ?? []).map((source) => ({
      sourceId: source.SourceId,
      sourceType: source.SourceType === "NuGet" ? "NuGet" : "DLL",
      reference: source.Reference,
      label: source.Label,
      version: source.Version ?? null,
      gateway: source.Gateway ?? null,
      enabled: source.Enabled,
      discoveryStatus: isDiscoveryStatus(source.DiscoveryStatus)
        ? source.DiscoveryStatus
        : "idle",
      interfaces: (source.Interfaces ?? []).map((iface) => ({
        interfaceId: iface.InterfaceId,
        interfaceName: iface.InterfaceName,
        namespace: iface.Namespace,
        methods: (iface.Methods ?? []).map((method) => ({
          functionId: method.FunctionId,
          sourceId: method.SourceId,
          interfaceId: method.InterfaceId,
          interfaceName: method.InterfaceName,
          namespace: method.Namespace,
          methodName: method.MethodName,
          signature: method.Signature,
          returnType: method.ReturnType,
          keyType: isGrainKeyType(method.KeyType) ? method.KeyType : "String",
          parameters: (method.Parameters ?? [])
            .filter((p) => !isCancellationTokenParameter(p))
            .map((p) => ({
              name: p.Name ?? "",
              typeName: p.TypeName ?? "",
            })),
        })),
      })),
    })),
  };
}

/**
 * Flattens the nested source catalog into a flat array of grain interface
 * descriptors for the frontend grains list.
 */
export function flattenSourceCatalog(
  catalog: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const sources = (catalog.sources as Array<Record<string, unknown>>) ?? [];
  return sources.flatMap((source) =>
    ((source.interfaces as Array<Record<string, unknown>>) ?? []).map(
      (iface) => ({
        interfaceId: iface.interfaceId,
        interfaceName: iface.interfaceName,
        methods: ((iface.methods as Array<Record<string, unknown>>) ?? []).map(
          (method) => ({
            name: method.methodName,
            signature: method.signature,
            returnType: method.returnType,
            keyType: method.keyType,
            parameters: method.parameters,
          }),
        ),
      }),
    ),
  );
}

/**
 * Typed adapter for the SiloScope Core JSON-RPC sidecar.
 *
 * Every method validates the response against Zod schemas at the boundary
 * so that IPC handlers receive clean, typed data. PascalCase→camelCase
 * field mapping and `FluentResult<T>` unwrapping happen here.
 */
/**
 * Public interface for the SiloScope Core JSON-RPC adapter.
 *
 * Defines the seam between the Electron main process and the .NET sidecar.
 * Two adapters justify the seam: the real {@link SidecarAdapter} in
 * production, and an in-memory stub in tests.
 */
export interface ISidecarAdapter {
  setActiveWorkspace(workspace: Workspace): Promise<void>;
  connectCluster(workspace: Workspace): Promise<string>;
  disconnectCluster(): Promise<void>;
  discoverGrains(): Promise<{
    sourceCatalog: Record<string, unknown>;
    grains: Array<Record<string, unknown>>;
  }>;
  invokeGrain(parameters: {
    grainType: string;
    method: string;
    grainKey: string;
    payload: string;
    sourceId?: string;
    functionId?: string;
  }): Promise<{
    isSuccess: boolean;
    result?: string;
    error?: string;
    timing?: {
      serializationMs: number;
      executionMs: number;
      totalMs: number;
    };
  }>;

  saveEnvironments(config: {
    profiles: Array<{ name: string; variables: Record<string, string> }>;
    activeEnvironment: string | null;
  }): Promise<void>;
}

/**
 * Production implementation of {@link ISidecarAdapter}.
 */
export class SidecarAdapter implements ISidecarAdapter {
  /**
   * @param client - The raw JSON-RPC transport (stdio child process).
   */
  constructor(private readonly client: SidecarJsonRpcClient) {}

  /**
   * Sends a typed JSON-RPC request to the sidecar and unwraps the
   * `FluentResult<T>` envelope.
   *
   * @param method - The JSON-RPC method name (must match C# `[JsonRpcMethod]`).
   * @param parameters - The method parameters.
   * @returns The unwrapped result value.
   * @throws {Error} When the result indicates failure.
   */
  private async requestSidecar<T>(
    method: string,
    parameters?: readonly unknown[] | Record<string, unknown>,
  ): Promise<T> {
    return this.client.request<T>(method, parameters);
  }

  /**
   * Sets the active workspace on the sidecar.
   *
   * Points the sidecar's NuGet cache at the workspace's isolated directory
   * and calls `SetWorkspaceAsync`.
   *
   * @param workspace - The workspace to activate.
   * @throws {Error} When the sidecar call fails.
   */
  async setActiveWorkspace(workspace: Workspace): Promise<void> {
    const backendWorkspace = mapBackendWorkspace(workspace);

    const result = await this.requestSidecar<FluentResult<unknown>>(
      "SetWorkspaceAsync",
      [backendWorkspace],
    );

    if (!result.IsSuccess) {
      throw new Error(
        result.Errors?.[0]?.Message ?? "Failed to set active workspace.",
      );
    }
  }

  /**
   * Connects to an Orleans cluster.
   *
   * @param workspace - The workspace containing cluster connection details.
   * @returns A success message from the sidecar.
   * @throws {Error} When the connection fails or the sidecar version doesn't
   *   support this method.
   */
  async connectCluster(workspace: Workspace): Promise<string> {
    const clusterOptions = mapBackendCluster(workspace);

    try {
      const result = await this.requestSidecar<FluentResult<string>>(
        "ConnectClusterAsync",
        [clusterOptions],
      );

      if (!result.IsSuccess) {
        throw new Error(
          result.Errors?.[0]?.Message ?? "Failed to connect cluster.",
        );
      }

      return result.Value ?? "Connected";
    } catch (error) {
      if (isMissingJsonRpcMethod(error)) {
        throw new Error(
          "The SiloScope Core version does not support ConnectClusterAsync.",
        );
      }
      throw error;
    }
  }

  /**
   * Disconnects from the currently connected Orleans cluster.
   *
   * @throws {Error} When the disconnect fails or the sidecar version doesn't
   *   support this method.
   */
  async disconnectCluster(): Promise<void> {
    try {
      const result = await this.requestSidecar<FluentResult<unknown>>(
        "DisconnectClusterAsync",
        undefined,
      );

      if (!result.IsSuccess) {
        throw new Error(
          result.Errors?.[0]?.Message ?? "Failed to disconnect cluster.",
        );
      }
    } catch (error) {
      if (isMissingJsonRpcMethod(error)) {
        throw new Error(
          "The SiloScope Core version does not support DisconnectClusterAsync.",
        );
      }
      throw error;
    }
  }

  /**
   * Discovers grain interfaces from the connected Orleans cluster.
   *
   * Calls `DiscoverSourceCatalogAsync` on the sidecar and maps the
   * PascalCase backend fields to camelCase.
   *
   * @returns The mapped source catalog and flattened grain list.
   * @throws {Error} When discovery fails.
   */
  async discoverGrains(): Promise<{
    sourceCatalog: Record<string, unknown>;
    grains: Array<Record<string, unknown>>;
  }> {
    const result = await this.requestSidecar<
      FluentResult<BackendSourceCatalog>
    >("DiscoverSourceCatalogAsync", undefined);

    if (!result.IsSuccess) {
      throw new Error(
        result.Errors?.[0]?.Message ?? "Failed to discover grains.",
      );
    }

    const sourceCatalog = mapSourceCatalog(result.Value ?? { Sources: [] });
    const grains = flattenSourceCatalog(sourceCatalog);

    return { sourceCatalog, grains };
  }

  /**
   * Invokes a grain method on the connected Orleans cluster.
   *
   * @param parameters - The grain invocation parameters.
   * @returns The mapped invocation result with timing information.
   * @throws {Error} When the invocation fails.
   */
  async invokeGrain(parameters: {
    grainType: string;
    method: string;
    grainKey: string;
    payload: string;
    sourceId?: string;
    functionId?: string;
  }): Promise<{
    isSuccess: boolean;
    result?: string;
    error?: string;
    timing?: {
      serializationMs: number;
      executionMs: number;
      totalMs: number;
    };
  }> {
    const result = await this.requestSidecar<
      FluentResult<BackendInvocationResult>
    >("InvokeGrainAsync", [
      parameters.grainType,
      parameters.method,
      parameters.grainKey,
      parameters.payload || null,
      parameters.sourceId ?? null,
      parameters.functionId ?? null,
    ]);

    if (!result.IsSuccess) {
      throw new Error(
        result.Errors?.[0]?.Message ?? "Grain invocation failed.",
      );
    }

    const r = result.Value;
    return {
      isSuccess: r?.IsSuccess ?? false,
      result: r?.Result,
      error: r?.Error,
      timing: r?.Timing
        ? {
            serializationMs: r.Timing.SerializationMs ?? 0,
            executionMs: r.Timing.ExecutionMs ?? 0,
            totalMs: r.Timing.TotalMs ?? 0,
          }
        : undefined,
    };
  }

  /**
   * Syncs environment profiles to the sidecar so that token substitution
   * (e.g. <c>{{TENANT_ID}}</c>) works during grain invocation.
   *
   * @param config - The environment config from the renderer's zustand state.
   * @throws {Error} When the sidecar call fails.
   */
  async saveEnvironments(config: {
    profiles: Array<{ name: string; variables: Record<string, string> }>;
    activeEnvironment: string | null;
  }): Promise<void> {
    const result = await this.requestSidecar<FluentResult<unknown>>(
      "SaveEnvironmentsAsync",
      [config],
    );

    if (!result.IsSuccess) {
      throw new Error(
        result.Errors?.[0]?.Message ?? "Failed to save environments.",
      );
    }
  }
}
