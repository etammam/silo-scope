import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { environmentConfigSchema } from "../shared/schemas";
import type { EnvironmentConfig } from "../shared/types";

export type { EnvironmentConfig };

const environmentsFileName = "environments.json";

/**
 * Folder-per-cluster layout:
 *
 *   {storagePath}/
 *     {workspaceId}/           ← one folder per cluster (stable ID, not name)
 *       environments.json       ← environment profiles
 *       (future: .dll files, tests, etc.)
 */
function workspaceDir(storagePath: string, workspaceId: string): string {
  const dir = join(storagePath, workspaceId);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function environmentsFilePath(storagePath: string, workspaceId: string): string {
  return join(workspaceDir(storagePath, workspaceId), environmentsFileName);
}

export function readEnvironments(
  storagePath: string,
  workspaceId: string,
): EnvironmentConfig {
  const filePath = environmentsFilePath(storagePath, workspaceId);
  if (!existsSync(filePath)) {
    return { profiles: [], activeEnvironment: null };
  }
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = environmentConfigSchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.warn(
      "[environments-store] Invalid environments.json — returning empty config. Errors:",
      result.error.flatten(),
    );
    return { profiles: [], activeEnvironment: null };
  } catch {
    return { profiles: [], activeEnvironment: null };
  }
}

export function writeEnvironments(
  storagePath: string,
  workspaceId: string,
  config: EnvironmentConfig,
): void {
  // Validate before writing
  const result = environmentConfigSchema.safeParse(config);
  if (!result.success) {
    throw new Error(
      `Cannot write invalid environments: ${result.error.flatten().formErrors.join("; ")}`,
    );
  }
  const filePath = environmentsFilePath(storagePath, workspaceId);
  writeFileSync(filePath, JSON.stringify(result.data, null, 2), "utf-8");
}

export function verifyStoragePath(storagePath: string): boolean {
  try {
    const testDir = join(storagePath, ".siloscope-test");
    mkdirSync(testDir, { recursive: true });
    const testFile = join(testDir, ".write-test");
    writeFileSync(testFile, "test", "utf-8");
    const content = readFileSync(testFile, "utf-8");
    if (content === "test") {
      unlinkSync(testFile);
      rmSync(testDir, { recursive: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
