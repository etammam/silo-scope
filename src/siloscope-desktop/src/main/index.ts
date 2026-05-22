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
      testNugetFeed: async ({
        name,
        url,
        username,
        password,
        isPasswordClearText,
      }) => {
        const result = await requestSidecar<FluentResult<null>>(
          "TestNugetFeedAsync",
          [
            {
              Name: name,
              Url: url,
              Username: username ?? null,
              Password: password ?? null,
              IsPasswordClearText: isPasswordClearText ?? true,
            },
          ],
          "TestNugetFeed",
        );

        if (!result.IsSuccess) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to test NuGet feed.",
          );
        }

        return { success: true };
      },
      updateNugetFeed: async ({
        name,
        feed: { name: feedName, url, username, password, isPasswordClearText },
      }) => {
        const result = await requestSidecar<FluentResult<BackendNugetFeed>>(
          "UpdateNugetFeedAsync",
          [
            name,
            {
              Name: feedName,
              Url: url,
              Username: username ?? null,
              Password: password ?? null,
              IsPasswordClearText: isPasswordClearText ?? true,
            },
          ],
          "UpdateNugetFeed",
        );

        if (!result.IsSuccess || !result.Value) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to update NuGet feed.",
          );
        }

        return { feed: mapNugetFeed(result.Value) };
      },
      searchNugetPackages: async ({ query, sourceUrl, feedName, take }) => {
        if (feedName || sourceUrl) {
          const resolvedSourceUrl = sourceUrl ?? (await resolveFeedUrlByName(feedName));
          const result = await requestSidecar<
            FluentResult<BackendNugetPackage[]>
          >(
            "SearchNugetPackagesAsync",
            [query, resolvedSourceUrl ?? null, feedName ?? null, take ?? 20],
            "SearchNugetPackages",
          );

          if (!result.IsSuccess) {
            throw new Error(
              result.Errors?.[0]?.Message ?? "Failed to search NuGet packages.",
            );
          }

          return { packages: (result.Value ?? []).map(mapNugetPackage) };
        }

        return { packages: await searchNugetPackagesAcrossAllFeeds(query, take ?? 20) };
      },
      getNugetPackageVersions: async ({ packageId, sourceUrl, feedName }) => {
        if (feedName || sourceUrl) {
          try {
            const resolvedSourceUrl = sourceUrl ?? (await resolveFeedUrlByName(feedName));
            const result = await requestSidecar<FluentResult<string[]>>(
              "GetNugetPackageVersionsAsync",
              [packageId, resolvedSourceUrl ?? null, feedName ?? null],
            );
            if (!result.IsSuccess) {
              throw new Error(
                result.Errors?.[0]?.Message ?? "Failed to get NuGet package versions.",
              );
            }
            return { versions: result.Value ?? [] };
          } catch (error) {
            console.warn(
              `[getNugetPackageVersions] single-feed query failed for "${feedName}":`,
              error instanceof Error ? error.message : error,
            );
            return { versions: [] };
          }
        }

        return { versions: await getNugetPackageVersionsAcrossAllFeeds(packageId) };
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
      minimizeWindow: async (): Promise<{ success: boolean }> => {
        mainWindow.minimize();
        return { success: true };
      },
      maximizeWindow: async (): Promise<{ success: boolean; isMaximized: boolean }> => {
        const isMaximized = Boolean(mainWindow.isMaximized());
        if (isMaximized) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        return { success: true, isMaximized: !isMaximized };
      },
      closeWindow: async (): Promise<{ success: boolean }> => {
        mainWindow.close();
        return { success: true };
      },
    },
    messages: {
      connectionChanged: ({ isConnected }) => {
        console.log("connectionChanged", isConnected);
      },
      logEntry: ({ entry }) => {
        console.log("logEntry", entry);
      },
      openFileDialog: async ({ allowedFileTypes, canChooseFiles, canChooseDirectories, allowsMultipleSelection }) => {
        try {
          const dialogOpts: {
            canChooseFiles: boolean;
            canChooseDirectory: boolean;
            allowsMultipleSelection: boolean;
            allowedFileTypes?: string;
          } = {
            canChooseFiles: canChooseFiles ?? true,
            canChooseDirectory: canChooseDirectories ?? false,
            allowsMultipleSelection: allowsMultipleSelection ?? false,
          };
          if (allowedFileTypes !== undefined && allowedFileTypes.length > 0) {
            dialogOpts.allowedFileTypes = allowedFileTypes;
          }
          console.log("[openFileDialog] opening dialog with opts:", JSON.stringify(dialogOpts));
          const result = await Utils.openFileDialog(dialogOpts);
          console.log("[openFileDialog] dialog result:", JSON.stringify(result));
          rpc.send.filePicked({ paths: result });
        } catch (error) {
          console.error("[openFileDialog] dialog failed:", error instanceof Error ? error.message : error);
          rpc.send.filePicked({ paths: [] });
        }
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

async function resolveFeedUrlByName(feedName?: string): Promise<string | null> {
  if (!feedName) return null;
  const result = await requestSidecar<FluentResult<BackendNugetFeed[]>>(
    "ListNugetFeedsAsync",
    undefined,
    "ListNugetFeeds",
  );
  if (!result.IsSuccess || !result.Value) {
    return null;
  }
  const feed = result.Value.find((f) => f.Name === feedName);
  return feed ? feed.Url : null;
}

async function listConfiguredFeeds(): Promise<BackendNugetFeed[]> {
  const result = await requestSidecar<FluentResult<BackendNugetFeed[]>>(
    "ListNugetFeedsAsync",
    undefined,
    "ListNugetFeeds",
  );
  if (!result.IsSuccess || !result.Value) {
    return [];
  }
  return result.Value;
}

async function searchNugetPackagesAcrossAllFeeds(query: string, take: number): Promise<NugetPackage[]> {
  const feeds = await listConfiguredFeeds();
  if (feeds.length === 0) {
    return [];
  }

  const searchResults = await Promise.allSettled(
    feeds.map(async (feed) => {
      const result = await requestSidecar<FluentResult<BackendNugetPackage[]>>(
        "SearchNugetPackagesAsync",
        [query, feed.Url, feed.Name, take],
        "SearchNugetPackages",
      );
      if (!result.IsSuccess || !result.Value) {
        return [] as Array<{ pkg: BackendNugetPackage; isDefault: boolean }>;
      }
      return result.Value.map((pkg) => ({ pkg, isDefault: feed.IsDefault }));
    }),
  );

  const seen = new Set<string>();
  const packages: Array<NugetPackage & { _feedPriority: number }> = [];

  for (const outcome of searchResults) {
    if (outcome.status !== "fulfilled") continue;
    for (const entry of outcome.value) {
      const id = entry.pkg.PackageId;
      if (seen.has(id)) continue;
      seen.add(id);
      packages.push({
        packageId: entry.pkg.PackageId,
        version: entry.pkg.Version,
        description: entry.pkg.Description ?? null,
        authors: entry.pkg.Authors ?? null,
        downloadCount: entry.pkg.DownloadCount ?? null,
        _feedPriority: entry.isDefault ? 1 : 0,
      });
    }
  }

  packages.sort((a, b) => {
    if (a._feedPriority !== b._feedPriority) return a._feedPriority - b._feedPriority;
    return a.packageId.localeCompare(b.packageId);
  });

  return packages.map(({ _feedPriority, ...pkg }) => pkg);
}

async function getNugetPackageVersionsAcrossAllFeeds(packageId: string): Promise<string[]> {
  const feeds = await listConfiguredFeeds();
  if (feeds.length === 0) {
    return [];
  }

  const versionResults = await Promise.allSettled(
    feeds.map(async (feed) => {
      try {
        const result = await requestSidecar<FluentResult<string[]>>(
          "GetNugetPackageVersionsAsync",
          [packageId, feed.Url, feed.Name],
        );
        if (!result.IsSuccess || !result.Value) {
          return [] as Array<{ version: string; _feedIsDefault: boolean }>;
        }
        return result.Value.map((v) => ({ version: v, _feedIsDefault: feed.IsDefault }));
      } catch (error) {
        console.warn(
          `[getNugetPackageVersionsAcrossAllFeeds] feed "${feed.Name}" failed:`,
          error instanceof Error ? error.message : error,
        );
        return [] as Array<{ version: string; _feedIsDefault: boolean }>;
      }
    }),
  );

  const seen = new Set<string>();
  const versions: Array<{ version: string; _feedPriority: number }> = [];

  for (const outcome of versionResults) {
    if (outcome.status !== "fulfilled") continue;
    for (const entry of outcome.value) {
      if (seen.has(entry.version)) continue;
      seen.add(entry.version);
      versions.push({
        version: entry.version,
        _feedPriority: entry._feedIsDefault ? 1 : 0,
      });
    }
  }

  versions.sort((a, b) => {
    if (a._feedPriority !== b._feedPriority) return a._feedPriority - b._feedPriority;
    return a.version.localeCompare(b.version);
  });

  return versions.map(({ _feedPriority, ...rest }) => rest.version);
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
