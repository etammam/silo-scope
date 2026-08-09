/**
 * Workspace (cluster) persistence — JSON file CRUD under a user-selected
 * storage directory.
 *
 * Layout:
 * ```
 * {storagePath}/
 *   {workspaceId}/
 *     cluster.json         ← workspace configuration
 *     environments.json     ← environment profiles
 *     requests.json         ← saved request contexts
 *     sources/              ← copied DLL assemblies
 * ```
 *
 * @module features/workspaces/persistence
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  copyFileSync,
} from "node:fs";
import { basename, join, resolve } from "node:path";
import { clusterConfigSchema } from "./schema";
import type { Workspace } from "./schema";

const CLUSTER_FILE_NAME = "cluster.json";

/**
 * Ensures the per-cluster directory exists and returns its path.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param workspaceId - The stable workspace identifier.
 * @returns The cluster directory path.
 */
function clusterDirectory(storagePath: string, workspaceId: string): string {
  const directory = join(storagePath, workspaceId);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  return directory;
}

/**
 * Returns the full path to a cluster's `cluster.json` file.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param workspaceId - The stable workspace identifier.
 * @returns The `cluster.json` file path.
 */
function clusterFilePath(storagePath: string, workspaceId: string): string {
  return join(clusterDirectory(storagePath, workspaceId), CLUSTER_FILE_NAME);
}

/**
 * Ensures the per-cluster `sources/` subdirectory exists and returns its path.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param workspaceId - The stable workspace identifier.
 * @returns The sources directory path.
 */
function sourcesDirectory(storagePath: string, workspaceId: string): string {
  const directory = join(
    clusterDirectory(storagePath, workspaceId),
    "sources",
  );
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  return directory;
}

/**
 * Reads all persisted workspace configurations from disk.
 *
 * Scans the storage directory for subdirectories containing a valid
 * `cluster.json` file. Corrupt or invalid files are silently skipped.
 *
 * @param storagePath - The user-selected storage root directory.
 * @returns Valid workspace configurations found on disk.
 */
export function readClusters(storagePath: string): Workspace[] {
  try {
    const entries = readdirSync(storagePath, { withFileTypes: true });
    const clusters: Workspace[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const filePath = join(storagePath, entry.name, CLUSTER_FILE_NAME);
      if (!existsSync(filePath)) continue;

      try {
        const raw = readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        const result = clusterConfigSchema.safeParse(parsed);
        if (result.success) {
          clusters.push(result.data);
        } else {
          console.warn(
            `[cluster-store] Invalid cluster.json in "${entry.name}" — skipping. Errors:`,
            result.error.flatten(),
          );
        }
      } catch {
        /* Corrupt JSON in this folder — skip. */
      }
    }

    return clusters;
  } catch {
    return [];
  }
}

/**
 * Writes a workspace configuration to disk, validating it against the
 * workspace schema first.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param cluster - The workspace configuration to persist.
 * @returns The validated and persisted workspace.
 * @throws {Error} When the workspace fails schema validation.
 */
export function writeCluster(
  storagePath: string,
  cluster: Workspace,
): Workspace {
  const result = clusterConfigSchema.safeParse(cluster);
  if (!result.success) {
    throw new Error(
      `Cannot write invalid cluster: ${result.error.flatten().fieldErrors ? JSON.stringify(result.error.flatten().fieldErrors) : result.error.flatten().formErrors.join("; ")}`,
    );
  }
  const filePath = clusterFilePath(storagePath, result.data.id);
  writeFileSync(filePath, JSON.stringify(result.data, null, 2), "utf-8");
  return result.data;
}

/**
 * Deletes an entire workspace folder from disk, including environments,
 * sources, and request contexts.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param workspaceId - The stable workspace identifier to delete.
 */
export function deleteCluster(
  storagePath: string,
  workspaceId: string,
): void {
  const directory = join(storagePath, workspaceId);
  if (existsSync(directory)) {
    rmSync(directory, { recursive: true, force: true });
  }
}

/**
 * A saved grain invocation request context, keyed by tab identifier.
 */
export interface SavedRequest {
  tabId: string;
  grainId: string;
  payload: unknown;
  targetGrainClass: string;
  targetMethod: string;
  keyType: string;
  sourceId?: string | null;
  functionId?: string | null;
}

/**
 * Returns the path to a workspace's `requests.json` file.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param clusterId - The workspace identifier.
 * @returns The `requests.json` file path.
 */
function requestsFilePath(storagePath: string, clusterId: string): string {
  return join(storagePath, clusterId, "requests.json");
}

/**
 * Reads saved request contexts for a workspace from disk.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param clusterId - The workspace identifier.
 * @returns Saved request contexts, or an empty array if none exist.
 */
export function readRequests(
  storagePath: string,
  clusterId: string,
): SavedRequest[] {
  try {
    const path = requestsFilePath(storagePath, clusterId);
    if (!existsSync(path)) return [];
    const raw = readFileSync(path, "utf-8");
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry: unknown) =>
        typeof entry === "object" &&
        entry !== null &&
        "tabId" in entry &&
        "grainId" in entry &&
        "keyType" in entry,
    ) as SavedRequest[];
  } catch {
    return [];
  }
}

/**
 * Attempts to parse a string as JSON. Returns the original string if
 * parsing fails (the value may not be JSON at all).
 *
 * @param value - The string to parse.
 * @returns The parsed value, or the original string.
 */
function parsePayload(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/**
 * Persists request contexts to disk, deduplicating by `tabId`
 * (latest write wins).
 *
 * @param storagePath - The user-selected storage root directory.
 * @param clusterId - The workspace identifier.
 * @param requests - The request contexts to persist.
 */
export function writeRequests(
  storagePath: string,
  clusterId: string,
  requests: SavedRequest[],
): void {
  const path = requestsFilePath(storagePath, clusterId);
  const seen = new Set<string>();
  const deduplicated: Array<Record<string, unknown>> = [];
  for (const request of requests) {
    if (!seen.has(request.tabId)) {
      seen.add(request.tabId);
      deduplicated.push({
        tabId: request.tabId,
        grainId: request.grainId,
        payload:
          typeof request.payload === "string"
            ? parsePayload(request.payload)
            : request.payload,
        targetGrainClass: request.targetGrainClass,
        targetMethod: request.targetMethod,
        keyType: request.keyType,
        sourceId: request.sourceId ?? null,
        functionId: request.functionId ?? null,
      });
    }
  }
  writeFileSync(path, JSON.stringify(deduplicated, null, 2), "utf-8");
}

/**
 * Copies a DLL (or any source file) into the workspace's `sources/`
 * subdirectory.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param workspaceId - The workspace identifier.
 * @param sourcePath - The absolute path to the source file.
 * @returns The absolute destination path of the copied file.
 */
export function copySourceFile(
  storagePath: string,
  workspaceId: string,
  sourcePath: string,
): string {
  const destinationDirectory = sourcesDirectory(storagePath, workspaceId);
  const destinationPath = join(destinationDirectory, basename(sourcePath));
  copyFileSync(sourcePath, destinationPath);
  return destinationPath;
}

/**
 * Checks whether a source file reference is already inside the workspace
 * directory (i.e. already managed by persistence).
 *
 * @param storagePath - The user-selected storage root directory.
 * @param workspaceId - The workspace identifier.
 * @param reference - The file path to check.
 * @returns `true` when the reference points inside the workspace directory.
 */
export function isSourceManaged(
  storagePath: string,
  workspaceId: string,
  reference: string,
): boolean {
  return resolve(reference).startsWith(
    clusterDirectory(storagePath, workspaceId) + "/",
  );
}
