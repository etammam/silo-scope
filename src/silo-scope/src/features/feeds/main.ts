/**
 * IPC handlers for NuGet package feed management.
 *
 * Handles listing, creating, updating, testing, and searching NuGet
 * package feeds. Includes a full NuGet v3 protocol client for service
 * index resolution, authenticated search, and version enumeration.
 *
 * @module main/feeds
 */

import { ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/events";
import {
  createNugetFeedRequestSchema,
  type NugetFeed,
  type NugetPackage,
  type PersistedFeed,
} from "../feeds/schema";
import { readFeeds, writeFeeds } from "../feeds/persistence";

/**
 * Module-level reference to the storage path getter, set during
 * {@link registerFeedsIpc}.
 */
let getStoragePath: () => string | null = () => null;

/**
 * Resolves the storage path, throwing if not yet configured.
 *
 * @returns The user-selected storage directory path.
 * @throws {Error} When the storage folder has not been configured.
 */
function requireStoragePath(): string {
  const storagePath = getStoragePath();
  if (!storagePath) {
    throw new Error("Storage folder not configured.");
  }
  return storagePath;
}

/**
 * Maps a persisted feed record to the public {@link NugetFeed} shape
 * exposed to the renderer (strips internal fields like credentials).
 *
 * @param persisted - The stored feed record.
 * @returns The public feed shape.
 */
function persistedToFeed(persisted: PersistedFeed): NugetFeed {
  return {
    name: persisted.name,
    url: persisted.url,
    hasCredentials: persisted.hasCredentials,
    isDefault: persisted.isDefault,
  };
}

/**
 * Registers all NuGet feed IPC handlers on the main process.
 *
 * @param storagePathGetter - Function that returns the current storage path.
 */
export function registerFeedsIpc(
  storagePathGetter: () => string | null,
): void {
  getStoragePath = storagePathGetter;

  ipcMain.handle(IPC_CHANNELS.feedsList, () => {
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

      for (const p of persisted) {
        feeds.push(persistedToFeed(p));
      }

      return feeds;
    } catch (error) {
      console.error("[feeds:list]", error);
      return [];
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.feedsCreate,
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
        isDefault: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const filtered = existing.filter((f) => f.name !== persisted.name);
      writeFeeds(storagePath, [...filtered, persisted]);

      return persistedToFeed(persisted);
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.feedsUpdate,
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

  ipcMain.handle(
    IPC_CHANNELS.feedsTest,
    async (
      _event,
      request: {
        name: string;
        url: string;
        username?: string;
        password?: string;
      },
    ) => {
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
          // Feed not in storage yet — use inline credentials only
        }
      }

      const url = buildNuGetServiceIndexUrl(request.url.trim());
      const response = await fetchNuGetWithAuth(
        url,
        username?.trim() || undefined,
        password || undefined,
        timeoutSignal(15000),
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

  ipcMain.handle(
    IPC_CHANNELS.feedsSearch,
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

      let targetFeeds: PersistedFeed[];
      if (feedName) {
        const match = feeds.find((f) => f.name === feedName);
        targetFeeds = match ? [match] : [];
      } else if (feedUrl) {
        targetFeeds = [
          {
            name: "_ad-hoc",
            url: feedUrl,
            hasCredentials: false,
            isDefault: false,
            createdAt: "",
            updatedAt: "",
          },
        ];
      } else {
        targetFeeds = feeds;
      }

      if (targetFeeds.length === 0) {
        return [];
      }

      const results = await Promise.allSettled(
        targetFeeds.map(async (feed) => {
          const searchEndpoint = await getServiceIndexResource(
            feed.url,
            "SearchQueryService",
            feed.username,
            feed.password,
          );

          let searchUrl: string;
          if (searchEndpoint) {
            const searchParams = new URLSearchParams({
              q: query,
              take: String(take),
              prerelease: "false",
              semVerLevel: "2.0.0",
            });
            searchUrl = `${searchEndpoint}?${searchParams.toString()}`;
          } else {
            searchUrl = buildNuGetSearchUrl(feed.url, query, take);
          }

          console.log("[feeds:search] Fetching", searchUrl);
          const response = await fetchNuGetWithAuth(
            searchUrl,
            feed.username,
            feed.password,
            timeoutSignal(20000),
          );

          console.log("[feeds:search] Response status:", response.status);
          if (!response.ok) {
            console.log(
              "[feeds:search] Search failed with status",
              response.status,
            );
            return [];
          }

          const body = await response.json();
          console.log("[feeds:search] Response keys:", Object.keys(body));
          const data = body.data ?? body.Data ?? [];
          console.log(
            "[feeds:search] Results count:",
            Array.isArray(data) ? data.length : "not an array",
          );

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

  ipcMain.handle(
    IPC_CHANNELS.feedsGetVersions,
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
        targetFeeds = [
          {
            name: "_ad-hoc",
            url: feedUrl,
            hasCredentials: false,
            isDefault: false,
            createdAt: "",
            updatedAt: "",
          },
        ];
      } else {
        targetFeeds = feeds;
      }

      if (targetFeeds.length === 0) {
        return [];
      }

      const results = await Promise.allSettled(
        targetFeeds.map(async (feed) => {
          const registrationBase = await getServiceIndexResource(
            feed.url,
            "RegistrationsBaseUrl",
            feed.username,
            feed.password,
          );

          if (registrationBase) {
            const encodedId = packageId.toLowerCase();
            const regUrl = `${registrationBase.replace(/\/+$/, "")}/${encodedId}/index.json`;

            const response = await fetchNuGetWithAuth(
              regUrl,
              feed.username,
              feed.password,
              timeoutSignal(20000),
            );

            if (response.ok) {
              const body = await response.json();
              const versions: string[] = [];
              const pageItems = body.items ?? body.Items ?? [];
              for (const page of (
                pageItems as Array<Record<string, unknown>>
              )) {
                const leafItems = (page.items ?? page.Items ?? []) as Array<Record<string, unknown>>;
                for (const leaf of leafItems) {
                  const entry = (
                    leaf.catalogEntry ?? leaf.CatalogEntry ?? leaf
                  ) as Record<string, unknown>;
                  const ver = entry.version ?? entry.Version;
                  if (ver && typeof ver === "string") versions.push(ver);
                }
              }
              return versions.map((v) => ({
                version: v,
                isDefault: feed.isDefault,
              }));
            }
          }

          const versionsUrl = buildNuGetVersionsUrl(feed.url, packageId);
          const response = await fetchNuGetWithAuth(
            versionsUrl,
            feed.username,
            feed.password,
            timeoutSignal(20000),
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

/**
 * NuGet protocol helpers — service index resolution, authentication,
 * URL construction, and result deduplication.
 */

/**
 * Builds a NuGet v3 service index URL from a feed base URL.
 *
 * @param feedUrl - The feed base URL (may already end with /index.json).
 * @returns The service index URL.
 */
function buildNuGetServiceIndexUrl(feedUrl: string): string {
  if (feedUrl.endsWith("/index.json")) return feedUrl;
  return feedUrl.replace(/\/+$/, "") + "/index.json";
}

/** In-memory cache of NuGet v3 service index responses, keyed by index URL. */
const serviceIndexCache = new Map<
  string,
  { resources: Array<{ "@id": string; "@type": string }> }
>();

/**
 * Resolves a specific resource URL from a feed's service index.
 *
 * Fetches and caches the service index on first call, then looks up
 * the resource by its `@type` identifier (e.g. `SearchQueryService`).
 *
 * @param feedUrl - The feed base URL.
 * @param resourceType - The `@type` string to match (supports prefix matching).
 * @param username - Optional feed username.
 * @param password - Optional feed password or token.
 * @returns The resolved resource URL, or `null` if not found.
 */
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
        timeoutSignal(15000),
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
    if (typeof types === "string") {
      return types === resourceType || types.startsWith(resourceType + "/");
    }
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

/**
 * Builds a legacy NuGet v2 search URL as a fallback when the v3 service
 * index does not expose a `SearchQueryService` resource.
 *
 * @param feedUrl - The feed base URL.
 * @param query - The package search query.
 * @param take - Maximum results to return.
 * @returns The legacy search URL.
 */
function buildNuGetSearchUrl(
  feedUrl: string,
  query: string,
  take: number,
): string {
  const base = feedUrl.replace(/\/index\.json$/i, "");
  const searchParams = new URLSearchParams({
    q: query,
    take: String(take),
    prerelease: "false",
    semVerLevel: "2.0.0",
  });
  return `${base}/Search()?${searchParams.toString()}`;
}

/**
 * Builds a legacy NuGet v2 `FindPackagesById()` URL as a fallback when
 * the v3 service index does not expose a `RegistrationsBaseUrl` resource.
 *
 * @param feedUrl - The feed base URL.
 * @param packageId - The package identifier.
 * @returns The legacy versions URL.
 */
function buildNuGetVersionsUrl(feedUrl: string, packageId: string): string {
  const encodedId = encodeURIComponent(packageId);
  const base = feedUrl.replace(/\/index\.json$/i, "");
  return `${base}/FindPackagesById()?id=${encodedId}`;
}

/**
 * Builds HTTP authentication headers from feed credentials.
 *
 * - No credentials → anonymous (Accept header only).
 * - Token-only (password, no username) → Bearer auth.
 * - Username + password/token → Basic auth.
 *
 * @param username - Optional feed username.
 * @param password - Optional feed password or personal access token.
 * @returns Headers object suitable for `fetch`.
 */
function buildAuthHeaders(
  username?: string,
  password?: string,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (!username && !password) return headers;

  if (!username && password) {
    headers["Authorization"] = `Bearer ${password}`;
    return headers;
  }

  const encoded = Buffer.from(`${username ?? ""}:${password ?? ""}`).toString(
    "base64",
  );
  headers["Authorization"] = `Basic ${encoded}`;
  return headers;
}

/**
 * Fetches a NuGet feed URL with a 3-step authentication fallback:
 *
 * 1. Anonymous first (standard NuGet protocol flow).
 * 2. With credentials if 401/403 and credentials are provided.
 * 3. Token-as-Basic fallback for feeds that reject Bearer tokens.
 *
 * @param url - The URL to fetch.
 * @param username - Optional feed username.
 * @param password - Optional feed password or token.
 * @param signal - Optional abort signal for timeout handling.
 * @returns The fetch {@link Response}.
 */
async function fetchNuGetWithAuth(
  url: string,
  username?: string,
  password?: string,
  signal?: AbortSignal,
): Promise<Response> {
  let response = await fetch(url, {
    headers: { Accept: "application/json" },
    signal,
  });

  if (
    (response.status === 401 || response.status === 403) &&
    (username || password)
  ) {
    const headers = buildAuthHeaders(username, password);
    response = await fetch(url, { headers, signal });
  }

  if (
    (response.status === 401 || response.status === 403) &&
    !username &&
    password
  ) {
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

/**
 * Creates an {@link AbortSignal} that fires after the given timeout.
 *
 * @param milliseconds - Timeout duration in milliseconds.
 * @returns An abort signal.
 */
function timeoutSignal(milliseconds: number): AbortSignal {
  return AbortSignal.timeout(milliseconds);
}

/**
 * Deduplicates and sorts package search results across multiple feeds.
 * Results from the default feed (nuget.org) are prioritized.
 *
 * @param results - Settled promises from per-feed search calls.
 * @returns Deduplicated, sorted package list.
 */
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

/**
 * Deduplicates and sorts version lists across multiple feeds.
 * Versions from the default feed are prioritized.
 *
 * @param results - Settled promises from per-feed version calls.
 * @returns Deduplicated, sorted version strings.
 */
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
