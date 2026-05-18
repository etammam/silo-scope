import Electrobun, {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  Utils,
} from "electrobun/bun";
import type { SiloScopeRPC } from "../shared/rpc";
import type {
  ClusterType,
  LogEntry,
  NugetFeed,
  NugetPackage,
  SourceOwnedCatalog,
  Workspace,
  WorkspaceSource,
} from "../shared/types";
import { installApplicationMenu } from "./applicationMenu";
import { SidecarJsonRpcClient } from "./jsonRpcClient";

const sidecar = new SidecarJsonRpcClient();
sidecar.start();
let pageZoom = 1;

type FluentResult<T> = {
  IsSuccess: boolean;
  Errors?: Array<{ Message?: string }>;
  Value?: T;
};

type BackendSourceOwnedCatalog = {
  Sources?: Array<{
    SourceId: string;
    SourceType: "DLL" | "NuGet" | string;
    Reference: string;
    Label: string;
    Version?: string | null;
    Gateway?: string | null;
    Enabled: boolean;
    DiscoveryStatus: "idle" | "discovering" | "ready" | "error" | string;
    Interfaces?: Array<{
      InterfaceId: string;
      InterfaceName: string;
      Namespace: string;
      Methods?: Array<{
        FunctionId: string;
        SourceId: string;
        InterfaceId: string;
        InterfaceName: string;
        Namespace: string;
        MethodName: string;
        Signature: string;
        ReturnType: string;
        KeyType: "Guid" | "String" | "Integer" | string;
        Parameters?: Array<{ Name: string; TypeName: string }>;
      }>;
    }>;
  }>;
};

type BackendWorkspaceInfo = {
  Id: string;
  Name: string;
  Description?: string | null;
  Cluster?: {
    ClusterId?: string;
    ServiceId?: string;
    Type?: "Homogenous" | "Heterogeneous" | string;
    GatewayEndpoints?: string[];
  };
  Silos?: Array<{
    Reference: string;
    Source: string;
    Version?: string | null;
    Gateway?: string | null;
    Enabled: boolean;
  }>;
};

type BackendNugetFeed = {
  Name: string;
  Url: string;
  HasCredentials: boolean;
  IsDefault: boolean;
};

type BackendNugetPackage = {
  PackageId: string;
  Version: string;
  Description?: string | null;
  Authors?: string | null;
  DownloadCount?: number | null;
};

type BackendLogEntry = {
  Timestamp?: string;
  Level?: string;
  Category?: string;
  Message?: string;
  Exception?: string | null;
};

type BackendInvocationResult = {
  IsSuccess: boolean;
  Result?: string;
  ErrorMessage?: string;
  Timing?: {
    SerializationMs?: number;
    ExecutionMs?: number;
    TotalMs?: number;
  };
};

const rpc = BrowserView.defineRPC<SiloScopeRPC>({
  handlers: {
    requests: {
      loadWorkspace: async (params) => {
        const result = await requestSidecar<FluentResult<BackendWorkspaceInfo>>(
          "LoadWorkspaceAsync",
          [params?.path ?? null],
          "LoadWorkspace",
        );

        if (!result.IsSuccess || !result.Value) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to load workspace.",
          );
        }

        return { workspace: mapWorkspace(result.Value) };
      },
      setActiveWorkspace: async ({ workspace }) => {
        const result = await requestSidecar<FluentResult<BackendWorkspaceInfo>>(
          "SetWorkspaceAsync",
          [mapBackendWorkspace(workspace)],
          "SetWorkspace",
        );

        if (!result.IsSuccess || !result.Value) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to set active workspace.",
          );
        }

        return { workspace: mapWorkspace(result.Value) };
      },
      saveWorkspace: async ({ workspace, path }) => {
        const result = await requestSidecar<FluentResult<unknown>>(
          "SaveWorkspaceAsync",
          [mapBackendWorkspace(workspace), path ?? null],
          "SaveWorkspace",
        );

        if (!result.IsSuccess) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to save workspace.",
          );
        }

        return { success: true };
      },
      connectCluster: async ({ workspace }) => {
        const result = await requestSidecar<FluentResult<string>>(
          "ConnectClusterAsync",
          [mapBackendCluster(workspace)],
          "ConnectCluster",
        );

        if (!result.IsSuccess) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to connect cluster.",
          );
        }

        return { message: result.Value ?? "Connected" };
      },
      disconnectCluster: async () => {
        const result = await requestSidecar<FluentResult<unknown>>(
          "DisconnectClusterAsync",
          undefined,
          "DisconnectCluster",
        );

        if (!result.IsSuccess) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to disconnect cluster.",
          );
        }

        return { success: true };
      },
      discoverGrains: async ({ workspaceId: _workspaceId }) => {
        console.log("discoverGrains", _workspaceId);
        const sourceCatalog = await discoverSourceCatalog();

        return {
          grains: flattenSourceCatalog(sourceCatalog),
          sourceCatalog,
        };
      },
      getGrains: async ({ workspaceId: _workspaceId }) => {
        console.log("getGrains", _workspaceId);
        const sourceCatalog = await discoverSourceCatalog();

        return {
          grains: flattenSourceCatalog(sourceCatalog),
          sourceCatalog,
        };
      },
      getSourceCatalog: async ({ workspaceId: _workspaceId }) => {
        console.log("getSourceCatalog", _workspaceId);
        return { sourceCatalog: await discoverSourceCatalog() };
      },
      listNugetFeeds: async () => {
        const result = await requestSidecar<FluentResult<BackendNugetFeed[]>>(
          "ListNugetFeedsAsync",
          undefined,
          "ListNugetFeeds",
        );

        if (!result.IsSuccess) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to list NuGet feeds.",
          );
        }

        return { feeds: (result.Value ?? []).map(mapNugetFeed) };
      },
      createNugetFeed: async ({
        name,
        url,
        username,
        password,
        isPasswordClearText,
      }) => {
        const result = await requestSidecar<FluentResult<BackendNugetFeed>>(
          "CreateNugetFeedAsync",
          [
            {
              Name: name,
              Url: url,
              Username: username ?? null,
              Password: password ?? null,
              IsPasswordClearText: isPasswordClearText ?? true,
            },
          ],
          "CreateNugetFeed",
        );

        if (!result.IsSuccess || !result.Value) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to create NuGet feed.",
          );
        }

        return { feed: mapNugetFeed(result.Value) };
      },
      searchNugetPackages: async ({ query, sourceUrl, feedName, take }) => {
        const result = await requestSidecar<
          FluentResult<BackendNugetPackage[]>
        >(
          "SearchNugetPackagesAsync",
          [query, sourceUrl ?? null, feedName ?? null, take ?? 20],
          "SearchNugetPackages",
        );

        if (!result.IsSuccess) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to search NuGet packages.",
          );
        }

        return { packages: (result.Value ?? []).map(mapNugetPackage) };
      },
      addNugetPackageSource: async ({
        packageId,
        version,
        gateway,
        sourceUrl,
        feedName,
      }) => {
        const result = await requestSidecar<FluentResult<BackendWorkspaceInfo>>(
          "AddNugetPackageSourceAsync",
          [
            packageId,
            version,
            gateway ?? null,
            sourceUrl ?? null,
            feedName ?? null,
          ],
          "AddNugetPackageSource",
        );

        if (!result.IsSuccess || !result.Value) {
          throw new Error(
            result.Errors?.[0]?.Message ??
              "Failed to add NuGet package source.",
          );
        }

        return { workspace: mapWorkspace(result.Value) };
      },
      invokeGrain: async ({
        grainType,
        method,
        grainKey,
        payload,
        sourceId,
        functionId,
      }) => {
        console.log(
          "invokeGrain",
          grainType,
          method,
          grainKey,
          payload,
          sourceId,
          functionId,
        );
        const result = await requestSidecar<
          FluentResult<BackendInvocationResult>
        >(
          "InvokeGrainAsync",
          [
            grainType,
            method,
            grainKey,
            payload,
            sourceId ?? null,
            functionId ?? null,
          ],
          "InvokeGrain",
        );

        if (!result.IsSuccess) {
          return {
            isSuccess: false,
            error: result.Errors?.[0]?.Message ?? "Failed to invoke grain.",
          };
        }

        return {
          isSuccess: result.Value?.IsSuccess ?? false,
          result: result.Value?.Result,
          error: result.Value?.ErrorMessage,
          timing: mapInvocationTiming(result.Value),
        };
      },
      getWorkspaces: async () => {
        const result = await requestSidecar<
          FluentResult<BackendWorkspaceInfo[]>
        >("ListWorkspacesAsync", undefined, "ListWorkspaces");

        if (!result.IsSuccess) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to list workspaces.",
          );
        }

        return { workspaces: (result.Value ?? []).map(mapWorkspace) };
      },
    },
    messages: {
      connectionChanged: ({ isConnected }) => {
        console.log("connectionChanged", isConnected);
      },
      logEntry: ({ entry }) => {
        console.log("logEntry", entry);
      },
    },
  },
});

async function requestSidecar<T>(
  method: string,
  params?: readonly unknown[] | Record<string, unknown>,
  fallbackMethod?: string,
): Promise<T> {
  try {
    return await sidecar.request<T>(method, params);
  } catch (error) {
    if (!fallbackMethod || !isMissingJsonRpcMethod(error)) {
      throw error;
    }

    return sidecar.request<T>(fallbackMethod, params);
  }
}

function isMissingJsonRpcMethod(error: unknown): boolean {
  return error instanceof Error && /no method by the name/i.test(error.message);
}

async function discoverSourceCatalog(): Promise<SourceOwnedCatalog> {
  const result = await requestSidecar<FluentResult<BackendSourceOwnedCatalog>>(
    "DiscoverSourceCatalogAsync",
    undefined,
    "DiscoverSourceCatalog",
  );

  if (!result.IsSuccess) {
    throw new Error(
      result.Errors?.[0]?.Message ?? "Failed to discover source catalog.",
    );
  }

  return mapSourceCatalog(result.Value ?? {});
}

function mapNugetFeed(feed: BackendNugetFeed): NugetFeed {
  return {
    name: feed.Name,
    url: feed.Url,
    hasCredentials: feed.HasCredentials,
    isDefault: feed.IsDefault,
  };
}

function mapNugetPackage(packageInfo: BackendNugetPackage): NugetPackage {
  return {
    packageId: packageInfo.PackageId,
    version: packageInfo.Version,
    description: packageInfo.Description ?? null,
    authors: packageInfo.Authors ?? null,
    downloadCount: packageInfo.DownloadCount ?? null,
  };
}

function mapWorkspace(workspace: BackendWorkspaceInfo): Workspace {
  const gateway = workspace.Cluster?.GatewayEndpoints?.[0] ?? "";
  const [siloAddress, gatewayPortRaw] = gateway.split(":");
  const gatewayPort = Number(gatewayPortRaw);

  // Backend sends Type as number: 0 = Homogenous, 1 = Heterogeneous
  const clusterTypeNum = workspace.Cluster?.Type as number | undefined;
  const isHeterogeneous =
    clusterTypeNum === 1 || workspace.Cluster?.Type === "Heterogeneous";
  const clusterType: ClusterType = isHeterogeneous
    ? "Heterogeneous"
    : "Homogenous";

  const result: Workspace = {
    id: workspace.Id,
    name: workspace.Name,
    description: workspace.Description ?? null,
    siloAddress: siloAddress || "127.0.0.1",
    gatewayPort: Number.isFinite(gatewayPort) ? gatewayPort : 30000,
    clusterId: workspace.Cluster?.ClusterId ?? "dev",
    serviceId: workspace.Cluster?.ServiceId ?? "SiloScope",
    clusterType,
    gatewayEndpoints:
      workspace.Cluster?.GatewayEndpoints ?? (gateway ? [gateway] : []),
    orleansVersion: "10.0",
    environmentVariables: {},
    sources: (workspace.Silos ?? []).map(
      (source): WorkspaceSource => ({
        sourceId: `${source.Source}:${source.Reference}:${source.Version ?? ""}:${source.Gateway ?? ""}`,
        sourceType: source.Source.toLowerCase() === "nuget" ? "NuGet" : "DLL",
        reference: source.Reference,
        label:
          source.Source.toLowerCase() === "nuget" && source.Version
            ? `${source.Reference} ${source.Version}`
            : source.Reference,
        version: source.Version ?? null,
        gateway: source.Gateway ?? null,
        enabled: source.Enabled,
      }),
    ),
  };
  return result;
}

function mapBackendWorkspace(workspace: Workspace): BackendWorkspaceInfo & {
  EnvironmentVariables: Record<string, string>;
} {
  return {
    Id: workspace.id,
    Name: workspace.name,
    Description: workspace.description ?? null,
    Cluster: mapBackendCluster(workspace),
    Silos: (workspace.sources ?? []).map((source) => ({
      Reference: source.reference,
      Source: source.sourceType === "NuGet" ? "nuget" : "DLL",
      Version: source.version ?? null,
      Gateway: source.gateway ?? null,
      Enabled: source.enabled,
    })),
    EnvironmentVariables: workspace.environmentVariables ?? {},
  };
}

function mapBackendCluster(workspace: Workspace) {
  const gatewayEndpoints = workspace.gatewayEndpoints?.length
    ? workspace.gatewayEndpoints
    : [`${workspace.siloAddress}:${workspace.gatewayPort}`];

  return {
    ClusterId: workspace.clusterId ?? "dev",
    ServiceId: workspace.serviceId ?? "SiloScope",
    Type: workspace.clusterType ?? "Homogenous",
    GatewayEndpoints: gatewayEndpoints,
  };
}

function mapSourceCatalog(
  catalog: BackendSourceOwnedCatalog,
): SourceOwnedCatalog {
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
      interfaces: (source.Interfaces ?? []).map((catalogInterface) => ({
        interfaceId: catalogInterface.InterfaceId,
        interfaceName: catalogInterface.InterfaceName,
        namespace: catalogInterface.Namespace,
        methods: (catalogInterface.Methods ?? []).map((method) => ({
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
            .filter((parameter) => !isCancellationTokenParameter(parameter))
            .map((parameter) => ({
              name: parameter.Name,
              typeName: parameter.TypeName,
            })),
        })),
      })),
    })),
  };
}

function flattenSourceCatalog(catalog: SourceOwnedCatalog) {
  return catalog.sources.flatMap((source) =>
    source.interfaces.map((catalogInterface) => ({
      interfaceId: catalogInterface.interfaceId,
      interfaceName: catalogInterface.interfaceName,
      methods: catalogInterface.methods.map((method) => ({
        name: method.methodName,
        signature: method.signature,
        returnType: method.returnType,
        keyType: method.keyType,
        parameters: method.parameters,
      })),
    })),
  );
}

function mapInvocationTiming(result: BackendInvocationResult | undefined) {
  if (!result?.Timing) {
    return undefined;
  }

  return {
    serializationMs: result.Timing.SerializationMs ?? 0,
    executionMs: result.Timing.ExecutionMs ?? 0,
    totalMs: result.Timing.TotalMs ?? 0,
  };
}

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

function isGrainKeyType(value: string): value is "Guid" | "String" | "Integer" {
  return value === "Guid" || value === "String" || value === "Integer";
}

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

function mapLogEntry(params: unknown): LogEntry | null {
  if (!params || typeof params !== "object") {
    return null;
  }

  const entry = params as BackendLogEntry;
  if (!entry.Message) {
    return null;
  }

  const categoryPrefix = entry.Category ? `[${entry.Category}] ` : "";
  const exceptionSuffix = entry.Exception ? `\n${entry.Exception}` : "";

  return {
    timestamp: entry.Timestamp ?? new Date().toISOString(),
    level: mapLogLevel(entry.Level),
    message: `${categoryPrefix}${entry.Message}${exceptionSuffix}`,
  };
}

function mapLogLevel(level?: string): LogEntry["level"] {
  switch (level?.toLowerCase()) {
    case "trace":
    case "debug":
      return "debug";
    case "warning":
    case "warn":
      return "warn";
    case "error":
    case "critical":
      return "error";
    default:
      return "info";
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

const mainWindow = new BrowserWindow({
  title: "SiloScope",
  url: "views://renderer/index.html",
  rpc,
  titleBarStyle: "hiddenInset",
  trafficLightOffset: {
    x: 12,
    y: 10,
  },
  frame: {
    x: 100,
    y: 100,
    width: 1200,
    height: 800,
  },
});

sidecar.onNotification(({ method, params }) => {
  if (method !== "log") {
    return;
  }

  const entry = mapLogEntry(params);
  if (!entry) {
    return;
  }

  mainWindow.webview.rpc?.send.logEntry({ entry });
});

installApplicationMenu({
  ApplicationMenu,
  events: Electrobun.events,
  onMenuAction: (action) => {
    if (action === "openDocumentation") {
      Utils.openExternal("https://github.com/etammam/silo-scope");
      return;
    }

    if (action === "showAbout") {
      void Utils.showMessageBox({
        type: "info",
        title: "About SiloScope",
        message: "SiloScope",
        detail: "Version 1.0.0\nOrleans cluster workbench",
        buttons: ["OK"],
        defaultId: 0,
      });
      return;
    }

    if (action === "zoomIn" || action === "zoomOut") {
      pageZoom = clamp(
        action === "zoomIn" ? pageZoom + 0.1 : pageZoom - 0.1,
        0.7,
        1.6,
      );
      mainWindow.setPageZoom(pageZoom);
      return;
    }

    mainWindow.webview.rpc?.send.applicationMenuAction({ action });
  },
});

console.log("SiloScope app started!");

Electrobun.events.on("before-quit", async () => {
  console.log("App shutting down...");
  await sidecar.dispose();
});
