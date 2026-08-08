import { app, shell, BrowserWindow, dialog, ipcMain } from "electron";
import { join } from "node:path";
import { getStoragePath, setStoragePath } from "./storage";
import { readFeeds, writeFeeds, verifyStoragePath } from "./feeds-store";
import type { PersistedFeed } from "./feeds-store";
import { createNugetFeedRequestSchema } from "../shared/schemas";
import type { NugetFeed, NugetPackage } from "../shared/schemas";

const isMac = process.platform === "darwin";

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

  const resource = cached?.resources?.find(
    (r: { "@type": string }) => r["@type"] === resourceType,
  );
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

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  registerWindowIpc();
  registerStorageIpc();
  registerFeedsIpc();
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
