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
import { clusterConfigSchema } from "../shared/schemas";
import type { Workspace } from "../shared/schemas";

export type { Workspace };

const clusterFileName = "cluster.json";

/**
 * Folder-per-cluster layout (stable by workspace.id, not name or clusterId):
 *
 *   {storagePath}/
 *     {workspaceId}/           ← one folder per cluster
 *       cluster.json            ← cluster config
 *       environments.json       ← environment profiles
 *       sources/                ← copied DLLs
 */
function clusterDir(storagePath: string, id: string): string {
  const dir = join(storagePath, id);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function clusterFilePath(storagePath: string, id: string): string {
  return join(clusterDir(storagePath, id), clusterFileName);
}

function sourcesDir(storagePath: string, id: string): string {
  const dir = join(clusterDir(storagePath, id), "sources");
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

// ─── Read ────────────────────────────────────────────────────────────────────

export function readClusters(storagePath: string): Workspace[] {
  try {
    const entries = readdirSync(storagePath, { withFileTypes: true });
    const clusters: Workspace[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const filePath = join(storagePath, entry.name, clusterFileName);
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
        // corrupt JSON in this folder — skip
      }
    }

    return clusters;
  } catch {
    return [];
  }
}

// ─── Write ───────────────────────────────────────────────────────────────────

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

// ─── Delete ──────────────────────────────────────────────────────────────────

/** Removes the entire cluster folder (including environments.json and sources). */
export function deleteCluster(storagePath: string, id: string): void {
  const dir = join(storagePath, id);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}

// ─── Source file management ──────────────────────────────────────────────────

/** Copy a DLL (or any file) into the cluster's sources/ folder. Returns the absolute destination path. */
export function copySourceFile(
  storagePath: string,
  id: string,
  sourcePath: string,
): string {
  const destDir = sourcesDir(storagePath, id);
  const destPath = join(destDir, basename(sourcePath));
  copyFileSync(sourcePath, destPath);
  return destPath;
}

/** Returns true when `reference` is already inside the cluster directory (already managed). */
export function isSourceManaged(
  storagePath: string,
  id: string,
  reference: string,
): boolean {
  return resolve(reference).startsWith(clusterDir(storagePath, id) + "/");
}
