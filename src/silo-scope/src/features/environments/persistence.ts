/**
 * Environment profile persistence — JSON file read/write for environment
 * variable profiles stored per workspace.
 *
 * @module features/environments/persistence
 */

import { existsSync, mkdirSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { environmentConfigSchema, type EnvironmentConfig } from "./schema";

const ENVIRONMENTS_FILE_NAME = "environments.json";

/**
 * Ensures the per-workspace directory exists and returns its path.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param workspaceId - The stable workspace identifier.
 * @returns The workspace directory path.
 */
function workspaceDirectory(
  storagePath: string,
  workspaceId: string,
): string {
  const directory = join(storagePath, workspaceId);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  return directory;
}

/**
 * Returns the path to a workspace's `environments.json` file.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param workspaceId - The stable workspace identifier.
 * @returns The `environments.json` file path.
 */
function environmentsFilePath(
  storagePath: string,
  workspaceId: string,
): string {
  return join(
    workspaceDirectory(storagePath, workspaceId),
    ENVIRONMENTS_FILE_NAME,
  );
}

/**
 * Reads environment profiles for a workspace from disk.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param workspaceId - The workspace identifier.
 * @returns The environment configuration, or an empty default.
 */
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

/**
 * Persists environment configuration to disk, validating against the
 * environment schema before writing.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param workspaceId - The workspace identifier.
 * @param configuration - The environment configuration to persist.
 * @throws {Error} When the configuration fails schema validation.
 */
export function writeEnvironments(
  storagePath: string,
  workspaceId: string,
  configuration: EnvironmentConfig,
): void {
  const result = environmentConfigSchema.safeParse(configuration);
  if (!result.success) {
    throw new Error(
      `Cannot write invalid environments: ${result.error.flatten().formErrors.join("; ")}`,
    );
  }
  const filePath = environmentsFilePath(storagePath, workspaceId);
  writeFileSync(filePath, JSON.stringify(result.data, null, 2), "utf-8");
}

/**
 * Verifies that the given path is writable by creating and removing a
 * test directory with a file inside.
 *
 * @param storagePath - The path to test.
 * @returns `true` when the path is writable.
 */
export function verifyStoragePath(storagePath: string): boolean {
  try {
    const testDirectory = join(storagePath, ".siloscope-test");
    mkdirSync(testDirectory, { recursive: true });
    const testFile = join(testDirectory, ".write-test");
    writeFileSync(testFile, "test", "utf-8");
    const content = readFileSync(testFile, "utf-8");
    if (content === "test") {
      unlinkSync(testFile);
      rmSync(testDirectory, { recursive: true });
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
