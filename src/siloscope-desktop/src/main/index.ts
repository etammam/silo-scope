import Electrobun, {
  ApplicationMenu,
  BrowserView,
  BrowserWindow,
  Updater,
  Utils,
  type UpdateStatusEntry,
} from "electrobun/bun";
import type { SiloScopeRPC } from "../shared/rpc";
import type {
  AppUpdateInfo,
  AppUpdateLocalInfo,
  AppUpdateState,
  AppUpdateStatusEntry,
  ClusterConnectionProvider,
  ClusterType,
  LogEntry,
  NugetFeed,
  NugetPackage,
  SourceOwnedCatalog,
  UnsavedRequestContextSummary,
  Workspace,
  WorkspaceSource,
} from "../shared/types";
import { installApplicationMenu } from "./applicationMenu";
import { SidecarJsonRpcClient } from "./jsonRpcClient";

const sidecar = new SidecarJsonRpcClient();
sidecar.start();
let pageZoom = 1;
let closeWasConfirmed = false;
let closeConfirmationRequestInFlight = false;
let sidecarDisposeStarted = false;
let latestUnsavedRequests: UnsavedRequestContextSummary[] = [];
let mainWindow: BrowserWindow<any>;
let latestUpdateInfo: AppUpdateInfo | null = null;

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
    Clustering?: {
      Provider?: ClusterConnectionProvider | number | string;
      provider?: ClusterConnectionProvider | number | string;
      Redis?: BackendConnectionStringOptions | null;
      redis?: BackendConnectionStringOptions | null;
      AdoNet?: BackendConnectionStringOptions | null;
      adoNet?: BackendConnectionStringOptions | null;
      AzureStorage?: BackendConnectionStringOptions | null;
      azureStorage?: BackendConnectionStringOptions | null;
      Cosmos?: BackendConnectionStringOptions | null;
      cosmos?: BackendConnectionStringOptions | null;
      Consul?: BackendConnectionStringOptions | null;
      consul?: BackendConnectionStringOptions | null;
      DynamoDB?: BackendConnectionStringOptions | null;
      dynamoDB?: BackendConnectionStringOptions | null;
      ZooKeeper?: BackendConnectionStringOptions | null;
      zooKeeper?: BackendConnectionStringOptions | null;
      Cassandra?: BackendConnectionStringOptions | null;
      cassandra?: BackendConnectionStringOptions | null;
    } | null;
  };
  Silos?: Array<{
    Reference: string;
    Source: string;
    Version?: string | null;
    Gateway?: string | null;
    FeedName?: string | null;
    Enabled: boolean;
  }>;
  SavedContexts?: BackendSavedRequestContext[];
};

type BackendConnectionStringOptions = {
  ConnectionString?: string;
  connectionString?: string;
  Invariant?: string | null;
  invariant?: string | null;
};

type BackendSavedRequestContext = {
  TabId: string;
  IsDefaultActive: boolean;
  TargetGrainClass: string;
  TargetMethod: string;
  KeyType: "Guid" | "String" | "Integer" | string;
  GrainId: string;
  Payload: string;
  SourceId?: string | null;
  FunctionId?: string | null;
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
  timestamp?: string;
  Level?: string;
  level?: string;
  Category?: string;
  category?: string;
  Message?: string;
  message?: string;
  Exception?: string | null;
  exception?: string | null;
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

        latestUnsavedRequests = [];
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
          const resolvedSourceUrl =
            sourceUrl ?? (await resolveFeedUrlByName(feedName));
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

        return {
          packages: await searchNugetPackagesAcrossAllFeeds(query, take ?? 20),
        };
      },
      getNugetPackageVersions: async ({ packageId, sourceUrl, feedName }) => {
        if (feedName || sourceUrl) {
          try {
            const resolvedSourceUrl =
              sourceUrl ?? (await resolveFeedUrlByName(feedName));
            const result = await requestSidecar<FluentResult<string[]>>(
              "GetNugetPackageVersionsAsync",
              [packageId, resolvedSourceUrl ?? null, feedName ?? null],
            );
            if (!result.IsSuccess) {
              throw new Error(
                result.Errors?.[0]?.Message ??
                  "Failed to get NuGet package versions.",
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

        return {
          versions: await getNugetPackageVersionsAcrossAllFeeds(packageId),
        };
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
      getBackendLogs: async () => {
        const result = await requestSidecar<FluentResult<BackendLogEntry[]>>(
          "GetLogsAsync",
        );

        if (!result.IsSuccess) {
          throw new Error(result.Errors?.[0]?.Message ?? "Failed to load backend logs.");
        }

        return {
          entries: (result.Value ?? [])
            .map(mapLogEntry)
            .filter((entry): entry is LogEntry => entry !== null),
        };
      },
      openBackendLogDirectory: async () => {
        const result = await requestSidecar<FluentResult<string>>(
          "GetLogDirectoryAsync",
        );

        if (!result.IsSuccess || !result.Value) {
          throw new Error(result.Errors?.[0]?.Message ?? "Failed to locate backend logs.");
        }

        return { success: Utils.openPath(result.Value), path: result.Value };
      },
      getAppUpdateState: async (): Promise<AppUpdateState> =>
        getAppUpdateState(),
      checkForAppUpdate: async (): Promise<AppUpdateState> => {
        latestUpdateInfo = mapUpdateInfo(await Updater.checkForUpdate());
        return getAppUpdateState();
      },
      downloadAppUpdate: async (): Promise<AppUpdateState> => {
        await Updater.downloadUpdate();
        latestUpdateInfo = mapUpdateInfo(Updater.updateInfo());
        return getAppUpdateState();
      },
      applyAppUpdate: async (): Promise<{ success: boolean }> => {
        closeWasConfirmed = true;
        await Updater.applyUpdate();
        return { success: true };
      },
      minimizeWindow: async (): Promise<{ success: boolean }> => {
        mainWindow.minimize();
        return { success: true };
      },
      maximizeWindow: async (): Promise<{
        success: boolean;
        isMaximized: boolean;
      }> => {
        const isMaximized = Boolean(mainWindow.isMaximized());
        if (isMaximized) {
          mainWindow.unmaximize();
        } else {
          mainWindow.maximize();
        }
        return { success: true, isMaximized: !isMaximized };
      },
      closeWindow: async (): Promise<{ success: boolean }> => {
        console.log("[close-guard:bun] renderer requested closeWindow");
        closeWasConfirmed = true;
        Utils.quit();
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
      openFileDialog: async ({
        allowedFileTypes,
        canChooseFiles,
        canChooseDirectories,
        allowsMultipleSelection,
      }) => {
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
          console.log(
            "[openFileDialog] opening dialog with opts:",
            JSON.stringify(dialogOpts),
          );
          const result = await Utils.openFileDialog(dialogOpts);
          console.log(
            "[openFileDialog] dialog result:",
            JSON.stringify(result),
          );
          rpc.send.filePicked({ paths: result });
        } catch (error) {
          console.error(
            "[openFileDialog] dialog failed:",
            error instanceof Error ? error.message : error,
          );
          rpc.send.filePicked({ paths: [] });
        }
      },
      updateUnsavedRequestContexts: ({ requests, contexts }) => {
        latestUnsavedRequests = requests;
        console.log(
          "[close-guard:bun] dirty request contexts updated",
          requests.map((request) => request.label),
          "contextCount=",
          contexts.length,
        );
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

async function searchNugetPackagesAcrossAllFeeds(
  query: string,
  take: number,
): Promise<NugetPackage[]> {
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
    if (a._feedPriority !== b._feedPriority)
      return a._feedPriority - b._feedPriority;
    return a.packageId.localeCompare(b.packageId);
  });

  return packages.map(({ _feedPriority, ...pkg }) => pkg);
}

async function getNugetPackageVersionsAcrossAllFeeds(
  packageId: string,
): Promise<string[]> {
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
        return result.Value.map((v) => ({
          version: v,
          _feedIsDefault: feed.IsDefault,
        }));
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
    if (a._feedPriority !== b._feedPriority)
      return a._feedPriority - b._feedPriority;
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
  const clustering = workspace.Cluster?.Clustering;
  const clusteringProvider = normalizeClusterConnectionProvider(
    clustering?.Provider ?? clustering?.provider,
  );

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
    clustering: clusteringProvider
      ? buildWorkspaceClustering(clusteringProvider, clustering)
      : null,
    gatewayEndpoints:
      workspace.Cluster?.GatewayEndpoints ?? (gateway ? [gateway] : []),
    orleansVersion: "10.0",
    environmentVariables: {},
    savedContexts: (workspace.SavedContexts ?? []).map(mapSavedRequestContext),
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
        feedName: source.FeedName ?? null,
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
      FeedName: source.feedName ?? null,
      Enabled: source.enabled,
    })),
    EnvironmentVariables: workspace.environmentVariables ?? {},
    SavedContexts: (workspace.savedContexts ?? []).map(
      mapBackendSavedRequestContext,
    ),
  };
}

function mapSavedRequestContext(
  context: BackendSavedRequestContext,
): NonNullable<Workspace["savedContexts"]>[number] {
  return {
    tabId: context.TabId,
    isDefaultActive: context.IsDefaultActive,
    targetGrainClass: context.TargetGrainClass,
    targetMethod: context.TargetMethod,
    keyType: isGrainKeyType(context.KeyType) ? context.KeyType : "String",
    grainId: context.GrainId,
    payload: context.Payload,
    sourceId: context.SourceId ?? null,
    functionId: context.FunctionId ?? null,
  };
}

function mapBackendSavedRequestContext(
  context: NonNullable<Workspace["savedContexts"]>[number],
): BackendSavedRequestContext {
  return {
    TabId: context.tabId,
    IsDefaultActive: context.isDefaultActive,
    TargetGrainClass: context.targetGrainClass,
    TargetMethod: context.targetMethod,
    KeyType: context.keyType,
    GrainId: context.grainId,
    Payload: context.payload,
    SourceId: context.sourceId ?? null,
    FunctionId: context.functionId ?? null,
  };
}

function mapBackendCluster(workspace: Workspace) {
  const clustering = workspace.clustering;
  const provider = clustering?.provider;
  const hasRemoteClustering = Boolean(provider);
  const gatewayEndpoints = hasRemoteClustering
    ? []
    : workspace.gatewayEndpoints?.length
      ? workspace.gatewayEndpoints
      : [`${workspace.siloAddress}:${workspace.gatewayPort}`];

  return {
    ClusterId: workspace.clusterId ?? "dev",
    ServiceId: workspace.serviceId ?? "SiloScope",
    Type: workspace.clusterType ?? "Homogenous",
    GatewayEndpoints: gatewayEndpoints,
    Clustering: provider && clustering ? buildBackendClustering(clustering) : null,
  };
}

const clusterConnectionProviderByEnumValue: Record<number, ClusterConnectionProvider> = {
  2: "Redis",
  3: "AdoNet",
  4: "AzureStorage",
  5: "Cosmos",
  6: "Consul",
  7: "DynamoDB",
  8: "ZooKeeper",
  9: "Cassandra",
};

const clusterConnectionOptionKeys = {
  Redis: { backend: "Redis", workspace: "redis" },
  AdoNet: { backend: "AdoNet", workspace: "adoNet" },
  AzureStorage: { backend: "AzureStorage", workspace: "azureStorage" },
  Cosmos: { backend: "Cosmos", workspace: "cosmos" },
  Consul: { backend: "Consul", workspace: "consul" },
  DynamoDB: { backend: "DynamoDB", workspace: "dynamoDB" },
  ZooKeeper: { backend: "ZooKeeper", workspace: "zooKeeper" },
  Cassandra: { backend: "Cassandra", workspace: "cassandra" },
} as const satisfies Record<
  ClusterConnectionProvider,
  { backend: string; workspace: string }
>;

function normalizeClusterConnectionProvider(
  provider: ClusterConnectionProvider | number | string | undefined,
): ClusterConnectionProvider | null {
  if (typeof provider === "number") {
    return clusterConnectionProviderByEnumValue[provider] ?? null;
  }

  if (!provider) return null;

  const normalized = Object.keys(clusterConnectionOptionKeys).find(
    (candidate) => candidate.toLowerCase() === provider.toLowerCase(),
  );

  return (normalized as ClusterConnectionProvider | undefined) ?? null;
}

function buildWorkspaceClustering(
  provider: ClusterConnectionProvider,
  clustering: NonNullable<BackendWorkspaceInfo["Cluster"]>["Clustering"],
): NonNullable<Workspace["clustering"]> {
  const keys = clusterConnectionOptionKeys[provider];
  const backendOptions = clustering?.[keys.backend as keyof NonNullable<typeof clustering>]
    ?? clustering?.[keys.workspace as keyof NonNullable<typeof clustering>];
  const connectionString = isBackendConnectionStringOptions(backendOptions)
    ? backendOptions.ConnectionString ?? backendOptions.connectionString ?? ""
    : "";

  return {
    provider,
    [keys.workspace]: {
      connectionString,
      invariant: isBackendConnectionStringOptions(backendOptions)
        ? backendOptions.Invariant ?? backendOptions.invariant ?? null
        : null,
    },
  };
}

function buildBackendClustering(
  clustering: NonNullable<Workspace["clustering"]>,
): Record<string, unknown> {
  const provider = clustering.provider;
  const keys = clusterConnectionOptionKeys[provider];
  const workspaceOptions = clustering[keys.workspace as keyof typeof clustering];
  const connectionString =
    typeof workspaceOptions === "object"
      && workspaceOptions !== null
      && "connectionString" in workspaceOptions
      && typeof workspaceOptions.connectionString === "string"
      ? workspaceOptions.connectionString
      : "";
  const invariant =
    typeof workspaceOptions === "object"
      && workspaceOptions !== null
      && "invariant" in workspaceOptions
      && typeof workspaceOptions.invariant === "string"
      ? workspaceOptions.invariant
      : null;

  return {
    Provider: provider,
    [keys.backend]: { ConnectionString: connectionString, Invariant: invariant },
  };
}

function isBackendConnectionStringOptions(
  value: unknown,
): value is BackendConnectionStringOptions {
  return typeof value === "object" && value !== null;
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
  const message = entry.Message ?? entry.message;
  if (!message) {
    return null;
  }

  return {
    timestamp: entry.Timestamp ?? entry.timestamp ?? new Date().toISOString(),
    level: mapLogLevel(entry.Level ?? entry.level),
    category: entry.Category ?? entry.category,
    message,
    exception: entry.Exception ?? entry.exception ?? null,
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

async function getAppUpdateState(): Promise<AppUpdateState> {
  return {
    localInfo: mapUpdateLocalInfo(await Updater.getLocalInfo()),
    updateInfo: latestUpdateInfo,
    statusHistory: Updater.getStatusHistory().map(mapUpdateStatusEntry),
  };
}

function mapUpdateLocalInfo(
  info: Partial<AppUpdateLocalInfo>,
): AppUpdateLocalInfo {
  return {
    version: info.version ?? "",
    hash: info.hash ?? "",
    baseUrl: info.baseUrl ?? "",
    channel: info.channel ?? "",
    name: info.name ?? "",
    identifier: info.identifier ?? "",
  };
}

function mapUpdateInfo(
  info: Partial<AppUpdateInfo> | undefined,
): AppUpdateInfo | null {
  if (!info) {
    return null;
  }

  return {
    version: info.version ?? "",
    hash: info.hash ?? "",
    updateAvailable: Boolean(info.updateAvailable),
    updateReady: Boolean(info.updateReady),
    error: info.error ?? "",
  };
}

function mapUpdateStatusEntry(entry: UpdateStatusEntry): AppUpdateStatusEntry {
  return {
    status: entry.status,
    message: entry.message,
    timestamp: entry.timestamp,
    progress: entry.details?.progress,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function createMainWindow() {
  const useMacNativeTrafficLights = process.platform === "darwin";
  const window = new BrowserWindow({
    title: "SiloScope",
    url: "views://renderer/index.html",
    rpc,
    titleBarStyle: useMacNativeTrafficLights ? "hiddenInset" : "default",
    ...(useMacNativeTrafficLights
      ? {
          trafficLightOffset: {
            x: 12,
            y: 10,
          },
        }
      : {}),
    frame: {
      x: 100,
      y: 100,
      width: 1200,
      height: 800,
    },
  });

  Electrobun.events.on(`close-${window.id}`, () => {
    console.log(
      "[close-guard:bun] window close event",
      "confirmed=",
      closeWasConfirmed,
      "dirtyCount=",
      latestUnsavedRequests.length,
      "hasWebviewRpc=",
      Boolean(window.webview?.rpc),
    );
  });

  return window;
}

mainWindow = createMainWindow();
Updater.onStatusChange((entry) => {
  latestUpdateInfo = mapUpdateInfo(Updater.updateInfo()) ?? latestUpdateInfo;
  void getAppUpdateState().then((state) => {
    mainWindow.webview.rpc?.send.appUpdateStatusChanged({
      state,
      entry: mapUpdateStatusEntry(entry),
    });
  });
});
void checkForAppUpdateOnLaunch();

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

async function checkForAppUpdateOnLaunch(): Promise<void> {
  const localInfo = await Updater.getLocalInfo();
  if (localInfo.channel === "dev" || !localInfo.baseUrl) {
    return;
  }

  try {
    latestUpdateInfo = mapUpdateInfo(await Updater.checkForUpdate());
  } catch (error) {
    console.warn(
      "[updater] automatic update check failed",
      error instanceof Error ? error.message : error,
    );
  }
}

Electrobun.events.on(
  "before-quit",
  async (event: { response?: { allow: boolean } }) => {
    console.log(
      "[close-guard:bun] before-quit",
      "confirmed=",
      closeWasConfirmed,
      "dirtyCount=",
      latestUnsavedRequests.length,
    );
    if (!closeWasConfirmed && latestUnsavedRequests.length > 0) {
      const hasWebviewRpc = Boolean(mainWindow.webview?.rpc);
      if (!hasWebviewRpc) {
        console.warn(
          "[close-guard:bun] renderer unavailable during before-quit; native window close already removed the webview, allowing shutdown",
        );
        console.log("App shutting down...");
        await disposeSidecarOnce();
        return;
      }

      event.response = { allow: false };
      console.log(
        "[close-guard:bun] preventing quit as fallback",
        latestUnsavedRequests.map((request) => request.label),
        "hasWebviewRpc=",
        hasWebviewRpc,
      );
      if (!closeConfirmationRequestInFlight) {
        requestRendererCloseConfirmation("before-quit", mainWindow);
      }
      return;
    }

    console.log("App shutting down...");
    await disposeSidecarOnce();
  },
);

function requestRendererCloseConfirmation(
  source: "before-quit",
  window: BrowserWindow<any>,
): void {
  if (closeConfirmationRequestInFlight) {
    console.log(
      "[close-guard:bun] renderer confirmation already requested",
      "source=",
      source,
    );
    return;
  }

  closeConfirmationRequestInFlight = true;
  console.log(
    "[close-guard:bun] requesting renderer close confirmation",
    "source=",
    source,
    "dirtyCount=",
    latestUnsavedRequests.length,
    "hasWebviewRpc=",
    Boolean(window.webview?.rpc),
  );

  try {
    window.show();
    window.activate();
    window.webview.rpc?.send.applicationMenuAction({
      action: "quitApplication",
    });
  } catch (error) {
    console.error(
      "[close-guard:bun] failed to request renderer confirmation",
      error instanceof Error ? error.message : error,
    );
  } finally {
    setTimeout(() => {
      closeConfirmationRequestInFlight = false;
    }, 500);
  }
}

async function disposeSidecarOnce(): Promise<void> {
  if (sidecarDisposeStarted) {
    return;
  }

  sidecarDisposeStarted = true;
  await sidecar.dispose();
}
