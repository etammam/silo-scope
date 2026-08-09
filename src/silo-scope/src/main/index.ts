import { app, shell, BrowserWindow, dialog, ipcMain } from "electron";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getStoragePath, setStoragePath } from "./storage";
import { readFeeds, writeFeeds, verifyStoragePath } from "./feeds-store";
import type { PersistedFeed } from "./feeds-store";
import {
  readEnvironments,
  writeEnvironments,
} from "./environments-store";
import {
  readClusters,
  writeCluster,
  deleteCluster,
  copySourceFile,
  isSourceManaged,
  readRequests,
  writeRequests,
} from "./cluster-store";
import { createNugetFeedRequestSchema } from "../shared/schemas";
import type { NugetFeed, NugetPackage } from "../shared/schemas";
import {
  SidecarJsonRpcClient,
} from "./jsonRpcClient";
import type { Workspace } from "../shared/types";
import { initAutoUpdater, checkForUpdates, downloadUpdate, applyUpdate, setSidecarForUpdater } from "./updater";

const isMac = process.platform === "darwin";

// ─── Sidecar ─────────────────────────────────────────────────────────────────

type FluentResult<T> = {
  IsSuccess: boolean;
  Errors?: Array<{ Message?: string }>;
  Value?: T;
};

const sidecar = new SidecarJsonRpcClient();
sidecar.start();
setSidecarForUpdater(sidecar);

// Forward sidecar log notifications to renderer
sidecar.onNotification((notification) => {
  if (notification.method === "log") {
    const params = notification.params as
      | { level?: string; message?: string; category?: string }
      | undefined;
    if (params?.message) {
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send("siloscope:sidecar-log", {
          timestamp: new Date().toISOString(),
          level: params.level ?? "info",
          category: params.category,
          message: params.message,
        });
      }
    }
  }
});

async function requestSidecar<T>(
  method: string,
  params?: readonly unknown[] | Record<string, unknown>,
): Promise<T> {
  return sidecar.request<T>(method, params);
}

// ─── Cluster connection mappings ─────────────────────────────────────────────

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

function isMissingJsonRpcMethod(error: unknown): boolean {
  return (
    error instanceof Error && /no method by the name/i.test(error.message)
  );
}

// ─── Backend type guards ─────────────────────────────────────────────────────

function isGrainKeyType(
  value: string,
): value is "Guid" | "String" | "Integer" {
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

// ─── Backend → frontend catalog mapping ──────────────────────────────────────

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

// ─── Backend workspace mapping ───────────────────────────────────────────────

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
    savedContexts: (workspace.savedContexts ?? []).map((ctx) => ({
      tabId: ctx.tabId,
      isDefaultActive: ctx.isDefaultActive,
      targetGrainClass: ctx.targetGrainClass,
      targetMethod: ctx.targetMethod,
      keyType: ctx.keyType,
      grainId: ctx.grainId,
      payload: ctx.payload,
      sourceId: ctx.sourceId ?? null,
      functionId: ctx.functionId ?? null,
    })),
  };
}

// ─── Catalog mapping (PascalCase backend → camelCase frontend) ───────────────

function mapSourceCatalog(
  catalog: BackendSourceCatalog,
): Record<string, unknown> {
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

function flattenSourceCatalog(
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

// ─── Window ──────────────────────────────────────────────────────────────────

function createWindow(): void {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "SiloScope",
    titleBarStyle: isMac ? "hiddenInset" : "default",
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  win.on("ready-to-show", () => win.show());

  win.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  const devServerUrl = process.env["ELECTRON_RENDERER_URL"];
  if (!app.isPackaged && devServerUrl) {
    win.loadURL(devServerUrl);
  } else {
    win.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

// ─── Auto-updater IPC ───────────────────────────────────────────────────────

function registerUpdateIpc(): void {
  ipcMain.handle("siloscope:check-for-update", () => {
    checkForUpdates();
  });

  ipcMain.handle("siloscope:download-update", () => {
    downloadUpdate();
  });

  ipcMain.handle("siloscope:apply-update", async () => {
    await applyUpdate();
  });
}

// ─── Window control IPC ──────────────────────────────────────────────────────

function registerWindowIpc(): void {
  ipcMain.handle("siloscope:minimize-window", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.minimize();
  });

  ipcMain.handle("siloscope:maximize-window", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) {
      if (win.isMaximized()) {
        win.unmaximize();
      } else {
        win.maximize();
      }
    }
  });

  ipcMain.handle("siloscope:close-window", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win) win.close();
  });

  ipcMain.handle("siloscope:is-maximized", (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.isMaximized() ?? false;
  });
}

// ─── Storage IPC ─────────────────────────────────────────────────────────────

function registerStorageIpc(): void {
  ipcMain.handle("siloscope:get-storage-path", () => {
    return getStoragePath();
  });

  ipcMain.handle("siloscope:select-storage-folder", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) {
      console.error("[storage] No window found for IPC sender");
      return null;
    }

    const result = await dialog.showOpenDialog(win, {
      title: "Select Storage Folder",
      properties: ["openDirectory", "createDirectory"],
      message:
        "Choose a folder where SiloScope will store your data (feeds, workspaces, environments).",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = result.filePaths[0];
    setStoragePath(selectedPath);
    return selectedPath;
  });

  ipcMain.handle(
    "siloscope:verify-storage-path",
    (_event, storagePath: string) => {
      if (!storagePath) return false;
      return verifyStoragePath(storagePath);
    },
  );
}

// ─── Feeds IPC ───────────────────────────────────────────────────────────────

function persistedToFeed(p: PersistedFeed): NugetFeed {
  return {
    name: p.name,
    url: p.url,
    hasCredentials: p.hasCredentials,
    isDefault: p.isDefault,
  };
}

function requireStoragePath(): string {
  const storagePath = getStoragePath();
  if (!storagePath) {
    throw new Error("Storage folder not configured.");
  }
  return storagePath;
}

function registerFeedsIpc(): void {
  // List
  ipcMain.handle("siloscope:feeds-list", () => {
    try {
      const storagePath = requireStoragePath();
      const persisted = readFeeds(storagePath);

      const feeds: NugetFeed[] = [
        {
          name: "nuget.org",
          url: "https://api.nuget.org/v3/index.json",
          hasCredentials: false,
          isDefault: true,
        },
      ];

      // Add user-configured feeds (non-default)
      for (const p of persisted) {
        feeds.push(persistedToFeed(p));
      }

      return feeds;
    } catch (error) {
      console.error("[feeds:list]", error);
      return [];
    }
  });

  // Create
  ipcMain.handle(
    "siloscope:feeds-create",
    (
      _event,
      request: {
        name: string;
        url: string;
        username?: string;
        password?: string;
        isPasswordClearText?: boolean;
      },
    ) => {
      const validated = createNugetFeedRequestSchema.parse(request);
      const storagePath = requireStoragePath();
      const existing = readFeeds(storagePath);

      const hasCredentials = Boolean(validated.username || validated.password);
      const persisted: PersistedFeed = {
        name: validated.name.trim(),
        url: validated.url.trim(),
        username: validated.username?.trim() || undefined,
        password: validated.password || undefined,
        hasCredentials,
        isDefault: false, // nuget.org is always the built-in default
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Replace feed with same name, or append
      const filtered = existing.filter((f) => f.name !== persisted.name);
      writeFeeds(storagePath, [...filtered, persisted]);

      return persistedToFeed(persisted);
    },
  );

  // Update
  ipcMain.handle(
    "siloscope:feeds-update",
    (
      _event,
      params: {
        name: string;
        feed: {
          name: string;
          url: string;
          username?: string;
          password?: string;
          isPasswordClearText?: boolean;
        };
      },
    ) => {
      const storagePath = requireStoragePath();
      const existing = readFeeds(storagePath);
      const target = existing.find((f) => f.name === params.name);

      if (!target) {
        throw new Error(`Feed "${params.name}" not found.`);
      }

      const updatedName = params.feed.name.trim();
      const updatedUrl = params.feed.url.trim();
      const hasCredentials = Boolean(
        params.feed.username || params.feed.password,
      );

      const updated: PersistedFeed = {
        name: updatedName,
        url: updatedUrl,
        username:
          params.feed.username?.trim() || target.username || undefined,
        password: params.feed.password || target.password || undefined,
        hasCredentials,
        isDefault: target.isDefault,
        createdAt: target.createdAt,
        updatedAt: new Date().toISOString(),
      };

      const filtered = existing.filter(
        (f) => f.name !== params.name && f.name !== updatedName,
      );
      writeFeeds(storagePath, [...filtered, updated]);

      return persistedToFeed(updated);
    },
  );

  // Test connection
  ipcMain.handle(
    "siloscope:feeds-test",
    async (
      _event,
      request: {
        name: string;
        url: string;
        username?: string;
        password?: string;
      },
    ) => {
      // Look up stored credentials if not provided inline (e.g. testing from a feed card)
      let { username, password } = request;
      if (!username && !password) {
        try {
          const storagePath = requireStoragePath();
          const persisted = readFeeds(storagePath);
          const stored = persisted.find((f) => f.name === request.name);
          if (stored) {
            username = stored.username;
            password = stored.password;
          }
        } catch {
          // Feed not in storage yet (testing before saving) — use inline creds only
        }
      }

      const url = buildNuGetServiceIndexUrl(request.url.trim());
      const response = await fetchNuGetWithAuth(
        url,
        username?.trim() || undefined,
        password || undefined,
        timeoutSignal(15_000),
      );

      if (!response.ok) {
        throw new Error(
          `Feed returned HTTP ${response.status}${response.statusText ? `: ${response.statusText}` : ""}`,
        );
      }

      const body = await response.text();
      if (!body.includes('"resources"') && !body.includes('"Resources"')) {
        throw new Error(
          "Response does not appear to be a valid NuGet v3 service index.",
        );
      }

      return true;
    },
  );

  // Search packages
  ipcMain.handle(
    "siloscope:feeds-search",
    async (
      _event,
      params: {
        query: string;
        feedName?: string;
        feedUrl?: string;
        take?: number;
      },
    ) => {
      const { query, feedName, feedUrl, take = 20 } = params;
      const storagePath = requireStoragePath();
      const feeds = readFeeds(storagePath);

      // Resolve which feeds to search
      let targetFeeds: PersistedFeed[];
      if (feedName) {
        const match = feeds.find((f) => f.name === feedName);
        targetFeeds = match ? [match] : [];
      } else if (feedUrl) {
        targetFeeds = [{ name: "_ad-hoc", url: feedUrl, hasCredentials: false, isDefault: false, createdAt: "", updatedAt: "" }];
      } else {
        targetFeeds = feeds;
      }

      if (targetFeeds.length === 0) {
        return [];
      }

      const results = await Promise.allSettled(
        targetFeeds.map(async (feed) => {
          // Resolve the real search endpoint from the service index
          const searchEndpoint = await getServiceIndexResource(
            feed.url,
            "SearchQueryService",
            feed.username,
            feed.password,
          );

          let searchUrl: string;
          if (searchEndpoint) {
            const params = new URLSearchParams({
              q: query,
              take: String(take),
              prerelease: "false",
              semVerLevel: "2.0.0",
            });
            searchUrl = `${searchEndpoint}?${params.toString()}`;
          } else {
            // Fallback: construct URL from base (works for nuget.org, Azure Artifacts)
            searchUrl = buildNuGetSearchUrl(feed.url, query, take);
          }

          console.log("[feeds:search] Fetching", searchUrl);
          const response = await fetchNuGetWithAuth(
            searchUrl,
            feed.username,
            feed.password,
            timeoutSignal(20_000),
          );

          console.log("[feeds:search] Response status:", response.status);
          if (!response.ok) {
            console.log("[feeds:search] Search failed with status", response.status);
            return [];
          }

          const body = await response.json();
          console.log("[feeds:search] Response keys:", Object.keys(body));
          const data = body.data ?? body.Data ?? [];
          console.log("[feeds:search] Results count:", Array.isArray(data) ? data.length : "not an array");

          return (data as Array<Record<string, unknown>>).map(
            (item: Record<string, unknown>) => ({
              pkg: {
                packageId: String(item.id ?? item.Id ?? ""),
                version: String(item.version ?? item.Version ?? ""),
                description:
                  (item.description ?? item.Description ?? null) as
                    | string
                    | null,
                authors:
                  ((item.authors ?? item.Authors) as string) || null,
                downloadCount:
                  (item.totalDownloads ??
                    item.TotalDownloads ??
                    item.downloadCount ??
                    item.DownloadCount ??
                    null) as number | null,
              },
              isDefault: feed.isDefault,
            }),
          );
        }),
      );

      return deduplicateAndSortPackages(results);
    },
  );

  // Get package versions
  ipcMain.handle(
    "siloscope:feeds-get-versions",
    async (
      _event,
      params: {
        packageId: string;
        feedName?: string;
        feedUrl?: string;
      },
    ) => {
      const { packageId, feedName, feedUrl } = params;
      const storagePath = requireStoragePath();
      const feeds = readFeeds(storagePath);

      let targetFeeds: PersistedFeed[];
      if (feedName) {
        const match = feeds.find((f) => f.name === feedName);
        targetFeeds = match ? [match] : [];
      } else if (feedUrl) {
        targetFeeds = [{ name: "_ad-hoc", url: feedUrl, hasCredentials: false, isDefault: false, createdAt: "", updatedAt: "" }];
      } else {
        targetFeeds = feeds;
      }

      if (targetFeeds.length === 0) {
        return [];
      }

      const results = await Promise.allSettled(
        targetFeeds.map(async (feed) => {
          // Resolve the v3 RegistrationsBaseUrl from the service index
          const registrationBase = await getServiceIndexResource(
            feed.url,
            "RegistrationsBaseUrl",
            feed.username,
            feed.password,
          );

          if (registrationBase) {
            // NuGet v3: {RegistrationsBaseUrl}/{lower-id}/index.json
            const encodedId = packageId.toLowerCase();
            const regUrl = `${registrationBase.replace(/\/+$/, "")}/${encodedId}/index.json`;

            const response = await fetchNuGetWithAuth(
              regUrl,
              feed.username,
              feed.password,
              timeoutSignal(20_000),
            );

            if (response.ok) {
              const body = await response.json();
              // v3 registration: body.items[].items[].catalogEntry.version
              const versions: string[] = [];
              const pageItems = body.items ?? body.Items ?? [];
              for (const page of (pageItems as Array<Record<string, unknown>>)) {
                const leafItems = (page.items ?? page.Items ?? []) as Array<Record<string, unknown>>;
                for (const leaf of leafItems) {
                  const entry = (leaf.catalogEntry ?? leaf.CatalogEntry ?? leaf) as Record<string, unknown>;
                  const ver = entry.version ?? entry.Version;
                  if (ver && typeof ver === "string") versions.push(ver);
                }
              }
              return versions.map((v) => ({ version: v, isDefault: feed.isDefault }));
            }
          }

          // Fallback: legacy v2 FindPackagesById()
          const versionsUrl = buildNuGetVersionsUrl(feed.url, packageId);
          const response = await fetchNuGetWithAuth(
            versionsUrl,
            feed.username,
            feed.password,
            timeoutSignal(20_000),
          );

          if (!response.ok) return [];

          const body = await response.json();
          const versions = body.versions ?? body.Versions ?? [];

          return (versions as Array<Record<string, unknown>>).map((v) => ({
            version: String(v.version ?? v.Version ?? v),
            isDefault: feed.isDefault,
          }));
        }),
      );

      return deduplicateAndSortVersions(results);
    },
  );
}

// ─── NuGet URL helpers ───────────────────────────────────────────────────────

function buildNuGetServiceIndexUrl(feedUrl: string): string {
  if (feedUrl.endsWith("/index.json")) return feedUrl;
  return feedUrl.replace(/\/+$/, "") + "/index.json";
}

// Cache of service index resources keyed by feed URL
const serviceIndexCache = new Map<
  string,
  { resources: Array<{ "@id": string; "@type": string }> }
>();

async function getServiceIndexResource(
  feedUrl: string,
  resourceType: string,
  username?: string,
  password?: string,
): Promise<string | null> {
  const indexUrl = buildNuGetServiceIndexUrl(feedUrl);

  let cached = serviceIndexCache.get(indexUrl);
  if (!cached) {
    try {
      const response = await fetchNuGetWithAuth(
        indexUrl,
        username,
        password,
        timeoutSignal(15_000),
      );
      if (!response.ok) return null;
      cached = await response.json();
      if (cached && Array.isArray(cached.resources)) {
        serviceIndexCache.set(indexUrl, cached);
      }
    } catch {
      return null;
    }
  }

  const resource = cached?.resources?.find((r: { "@type": unknown }) => {
    const types = r["@type"];
    // Single string type
    if (typeof types === "string") {
      return types === resourceType || types.startsWith(resourceType + "/");
    }
    // Array of type strings (NuGet v3 spec)
    if (Array.isArray(types)) {
      return types.some(
        (t: unknown) =>
          typeof t === "string" &&
          (t === resourceType || t.startsWith(resourceType + "/")),
      );
    }
    return false;
  });
  return resource?.["@id"] ?? null;
}

function buildNuGetSearchUrl(
  feedUrl: string,
  query: string,
  take: number,
): string {
  // Legacy fallback: append /Search() to the service base
  const base = feedUrl.replace(/\/index\.json$/i, "");
  const params = new URLSearchParams({
    q: query,
    take: String(take),
    prerelease: "false",
    semVerLevel: "2.0.0",
  });
  return `${base}/Search()?${params.toString()}`;
}

function buildNuGetVersionsUrl(feedUrl: string, packageId: string): string {
  const encodedId = encodeURIComponent(packageId);
  const base = feedUrl.replace(/\/index\.json$/i, "");
  return `${base}/FindPackagesById()?id=${encodedId}`;
}

function buildAuthHeaders(
  username?: string,
  password?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (!username && !password) return headers;

  // Token-only: no username provided → try Bearer (GitHub Packages, GitLab, etc.)
  if (!username && password) {
    headers["Authorization"] = `Bearer ${password}`;
    return headers;
  }

  // Username + password/token → Basic auth (Azure Artifacts, private feeds)
  const encoded = Buffer.from(`${username ?? ""}:${password ?? ""}`).toString("base64");
  headers["Authorization"] = `Basic ${encoded}`;
  return headers;
}

async function fetchNuGetWithAuth(
  url: string,
  username?: string,
  password?: string,
  signal?: AbortSignal,
): Promise<Response> {
  // Step 1: try anonymous first (standard NuGet protocol flow)
  let response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });

  // Step 2: if 401/403 and we have credentials, retry with auth
  if (
    (response.status === 401 || response.status === 403) &&
    (username || password)
  ) {
    const headers = buildAuthHeaders(username, password);
    response = await fetch(url, { headers, signal });
  }

  // Step 3: if still failing with Bearer and we have username, fall back to Basic
  if (
    (response.status === 401 || response.status === 403) &&
    !username && password
  ) {
    // Token-only case — some feeds expect the token as Basic password with an empty user
    const encoded = Buffer.from(`:${password}`).toString("base64");
    response = await fetch(url, {
      headers: {
        Accept: "application/json",
        Authorization: `Basic ${encoded}`,
      },
      signal,
    });
  }

  return response;
}

function timeoutSignal(ms: number): AbortSignal {
  return AbortSignal.timeout(ms);
}

function deduplicateAndSortPackages(
  results: PromiseSettledResult<
    Array<{ pkg: NugetPackage; isDefault: boolean }>
  >[],
): NugetPackage[] {
  const seen = new Set<string>();
  const packages: Array<NugetPackage & { _feedPriority: number }> = [];

  for (const outcome of results) {
    if (outcome.status !== "fulfilled") continue;
    for (const { pkg, isDefault } of outcome.value) {
      if (!pkg.packageId || seen.has(pkg.packageId)) continue;
      seen.add(pkg.packageId);
      packages.push({
        ...pkg,
        _feedPriority: isDefault ? 1 : 0,
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

function deduplicateAndSortVersions(
  results: PromiseSettledResult<
    Array<{ version: string; isDefault: boolean }>
  >[],
): string[] {
  const seen = new Set<string>();
  const versions: Array<{ version: string; _feedPriority: number }> = [];

  for (const outcome of results) {
    if (outcome.status !== "fulfilled") continue;
    for (const { version, isDefault } of outcome.value) {
      if (seen.has(version)) continue;
      seen.add(version);
      versions.push({
        version,
        _feedPriority: isDefault ? 1 : 0,
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

// ─── Environments IPC ────────────────────────────────────────────────────────

function registerEnvironmentsIpc(): void {
  ipcMain.handle(
    "siloscope:environments-list",
    (_event, workspaceId: string) => {
      try {
        const storagePath = requireStoragePath();
        return readEnvironments(storagePath, workspaceId);
      } catch (error) {
        console.error("[environments:list]", error);
        return { profiles: [], activeEnvironment: null };
      }
    },
  );

  ipcMain.handle(
    "siloscope:environments-save",
    (
      _event,
      params: {
        workspaceId: string;
        config: { profiles: unknown[]; activeEnvironment: string | null };
      },
    ) => {
      try {
        const storagePath = requireStoragePath();
        const config = {
          profiles: params.config.profiles as Array<{
            name: string;
            variables: Record<string, string>;
          }>,
          activeEnvironment: params.config.activeEnvironment,
        };
        writeEnvironments(storagePath, params.workspaceId, config);
        return true;
      } catch (error) {
        console.error("[environments:save]", error);
        throw error;
      }
    },
  );
}

// ─── Clusters IPC ────────────────────────────────────────────────────────────

function registerClustersIpc(): void {
  // List all persisted clusters
  ipcMain.handle("siloscope:clusters-list", () => {
    try {
      const storagePath = requireStoragePath();
      return readClusters(storagePath);
    } catch (error) {
      console.error("[clusters:list]", error);
      return [];
    }
  });

  // Save (create or update) a cluster
  ipcMain.handle(
    "siloscope:clusters-save",
    (_event, params: { cluster: Record<string, unknown> }) => {
      const storagePath = requireStoragePath();
      // IPC serialization produces plain objects; cast through unknown
      const cluster = params.cluster as unknown as import("../shared/types").Workspace;

      // Copy unmanaged DLL sources into the cluster folder
      const sources = (cluster.sources ?? []).map((source) => {
        if (
          source.sourceType === "DLL" &&
          source.reference &&
          !isSourceManaged(storagePath, cluster.id, source.reference)
        ) {
          try {
            const destPath = copySourceFile(
              storagePath,
              cluster.id,
              source.reference,
            );
            return { ...source, reference: destPath };
          } catch (err) {
            console.warn(
              `[clusters:save] Could not copy source "${source.reference}":`,
              err,
            );
          }
        }
        return source;
      });

      const saved = writeCluster(storagePath, { ...cluster, sources });
      return saved;
    },
  );

  // Request contexts for a cluster
  ipcMain.handle(
    "siloscope:clusters-requests-list",
    (_event, params: { clusterId: string }) => {
      try {
        const storagePath = requireStoragePath();
        return readRequests(storagePath, params.clusterId);
      } catch (error) {
        console.error("[clusters:requests-list]", error);
        return [];
      }
    },
  );

  ipcMain.handle(
    "siloscope:clusters-requests-save",
    (_event, params: { clusterId: string; requests: Record<string, unknown>[] }) => {
      const storagePath = requireStoragePath();
      writeRequests(
        storagePath,
        params.clusterId,
        params.requests as unknown as import("./cluster-store").SavedRequest[],
      );
      return { success: true };
    },
  );

  // Delete a cluster (removes the entire folder)
  ipcMain.handle(
    "siloscope:clusters-delete",
    (_event, params: { id: string }) => {
      try {
        const storagePath = requireStoragePath();
        deleteCluster(storagePath, params.id);
        return { success: true };
      } catch (error) {
        console.error("[clusters:delete]", error);
        throw error;
      }
    },
  );

  // Pick a source file (DLL)
  ipcMain.handle("siloscope:select-source-file", async (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (!win) return null;

    const result = await dialog.showOpenDialog(win, {
      title: "Select DLL",
      properties: ["openFile"],
      filters: [
        { name: "Assemblies", extensions: ["dll", "exe"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }
    return result.filePaths[0];
  });
}

// ─── Sidecar IPC (connect / disconnect / discover / invoke) ──────────────────

// Cached catalog from the last successful discover
let cachedSourceCatalog: Record<string, unknown> | null = null;

// Track last NUGET_PACKAGES path to avoid restarting the sidecar when unchanged
let lastNugetPackagesPath: string | null = null;

function registerSidecarIpc(): void {
  // Sidecar status
  ipcMain.handle("siloscope:sidecar-status", () => {
    return { running: sidecar.isRunning };
  });

  // Restart the sidecar
  ipcMain.handle("siloscope:sidecar-restart", async () => {
    await sidecar.updateEnv({});
    return { running: sidecar.isRunning };
  });

  // Set the active workspace on the sidecar
  // Set the active workspace on the sidecar
  ipcMain.handle(
    "siloscope:set-active-workspace",
    async (_event, params: { workspace: Record<string, unknown> }) => {
      const workspace = params.workspace as unknown as Workspace;
      const backendWorkspace = mapBackendWorkspace(workspace);
      const storagePath = requireStoragePath();

      // Point NuGet cache at this cluster's directory for isolation.
      // Only restart the sidecar if the path actually changed, otherwise
      // the running connection would be killed unnecessarily.
      const nugetRoot = join(storagePath, workspace.id, "nuget");
      mkdirSync(nugetRoot, { recursive: true });
      if (lastNugetPackagesPath !== nugetRoot) {
        lastNugetPackagesPath = nugetRoot;
        await sidecar.updateEnv({ NUGET_PACKAGES: nugetRoot });
      }

      const result = await requestSidecar<FluentResult<unknown>>(
        "SetWorkspaceAsync",
        [backendWorkspace],
      );

      if (!result.IsSuccess) {
        throw new Error(
          result.Errors?.[0]?.Message ?? "Failed to set active workspace.",
        );
      }

      return { workspace };
    },
  );

  // Connect to an Orleans cluster
  ipcMain.handle(
    "siloscope:connect-cluster",
    async (_event, params: { workspace: Record<string, unknown> }) => {
      const workspace = params.workspace as unknown as Workspace;
      const clusterOptions = mapBackendCluster(workspace);

      // Validate sources before attempting connection
      const sources = workspace.sources ?? [];
      for (const source of sources) {
        if (!source.enabled) continue;

        if (source.sourceType === "DLL") {
          const dllPath = source.reference;
          if (!dllPath || !existsSync(dllPath)) {
            const label = source.label || dllPath || "unknown";
            throw new Error(
              `DLL not found: "${label}".\n\n` +
                `The file was moved, renamed, or deleted. ` +
                `Remove this source from the cluster and re-add it with the correct path.`,
            );
          }
        }

        if (source.sourceType === "NuGet") {
          if (!source.reference?.trim()) {
            throw new Error(
              "A NuGet source is missing its package ID. Remove it and re-add the package.",
            );
          }
          if (!source.version?.trim()) {
            throw new Error(
              `NuGet package "${source.reference}" is missing its version. ` +
                `Select a version before connecting.`,
            );
          }
        }
      }

      try {
        const result = await requestSidecar<FluentResult<string>>(
          "ConnectClusterAsync",
          [clusterOptions],
        );

        if (!result.IsSuccess) {
          throw new Error(
            result.Errors?.[0]?.Message ?? "Failed to connect cluster.",
          );
        }

        return { message: result.Value ?? "Connected" };
      } catch (error) {
        if (isMissingJsonRpcMethod(error)) {
          throw new Error(
            "The SiloScope Core version does not support ConnectClusterAsync.",
          );
        }
        throw error;
      }
    },
  );

  // Disconnect from the current cluster
  ipcMain.handle("siloscope:disconnect-cluster", async () => {
    try {
      const result = await requestSidecar<FluentResult<unknown>>(
        "DisconnectClusterAsync",
        undefined,
      );

      if (!result.IsSuccess) {
        throw new Error(
          result.Errors?.[0]?.Message ?? "Failed to disconnect cluster.",
        );
      }

      cachedSourceCatalog = null;
      return { success: true };
    } catch (error) {
      if (isMissingJsonRpcMethod(error)) {
        throw new Error(
          "The SiloScope Core version does not support DisconnectClusterAsync.",
        );
      }
      throw error;
    }
  });

  // Discover grains from the connected cluster
  ipcMain.handle(
    "siloscope:discover-grains",
    async (_event, _params: { workspaceId: string }) => {
      const result = await requestSidecar<FluentResult<BackendSourceCatalog>>(
        "DiscoverSourceCatalogAsync",
        undefined,
      );

      if (!result.IsSuccess) {
        throw new Error(
          result.Errors?.[0]?.Message ?? "Failed to discover grains.",
        );
      }

      const sourceCatalog = mapSourceCatalog(
        result.Value ?? { Sources: [] },
      );
      const grains = flattenSourceCatalog(sourceCatalog);
      cachedSourceCatalog = sourceCatalog;

      return { grains, sourceCatalog };
    },
  );

  // Get cached grains (no sidecar call)
  ipcMain.handle("siloscope:get-grains", async () => {
    if (!cachedSourceCatalog) {
      return { grains: [], sourceCatalog: { sources: [] } };
    }
    const grains = flattenSourceCatalog(cachedSourceCatalog);
    return { grains, sourceCatalog: cachedSourceCatalog };
  });

  // Get cached source catalog (no sidecar call)
  ipcMain.handle("siloscope:get-source-catalog", async () => {
    return {
      sourceCatalog: cachedSourceCatalog ?? { sources: [] },
    };
  });

  // Invoke a grain method
  ipcMain.handle(
    "siloscope:invoke-grain",
    async (
      _event,
      params: {
        grainType: string;
        method: string;
        grainKey: string;
        payload: string;
        sourceId?: string;
        functionId?: string;
      },
    ) => {
      const result = await requestSidecar<FluentResult<BackendInvocationResult>>(
        "InvokeGrainAsync",
        [
          params.grainType,
          params.method,
          params.grainKey,
          params.payload || null,
          params.sourceId ?? null,
          params.functionId ?? null,
        ],
      );

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
    },
  );
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  initAutoUpdater();
  registerWindowIpc();
  registerUpdateIpc();
  registerStorageIpc();
  registerFeedsIpc();
  registerEnvironmentsIpc();
  registerClustersIpc();
  registerSidecarIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// ─── Cleanup on quit ────────────────────────────────────────────────────────

async function cleanupBeforeQuit(): Promise<void> {
  console.info("[siloscope] Cleaning up before quit…");
  try {
    // Disconnect from cluster if connected
    await sidecar
      .request("DisconnectClusterAsync", undefined)
      .catch(() => { /* cluster may not be connected */ });
  } catch {
    // best-effort
  }
  try {
    await sidecar.dispose();
    console.info("[siloscope] Sidecar disposed.");
  } catch (err) {
    console.warn("[siloscope] Sidecar dispose failed:", err);
  }
}

app.on("before-quit", (event) => {
  if ((globalThis as Record<string, unknown>)._cleanupDone) return;
  (globalThis as Record<string, unknown>)._cleanupDone = true;
  event.preventDefault();
  cleanupBeforeQuit().finally(() => {
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
