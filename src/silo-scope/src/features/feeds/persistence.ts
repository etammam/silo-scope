/**
 * NuGet feed persistence — JSON file read/write for configured package
 * feeds stored under the user-selected storage directory.
 *
 * @module features/feeds/persistence
 */

import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { persistedFeedArraySchema, type PersistedFeed } from "./schema";

/**
 * Returns the path to the `feeds.json` file under the storage directory.
 *
 * @param storagePath - The user-selected storage root directory.
 * @returns The `feeds.json` file path.
 */
function feedsFilePath(storagePath: string): string {
  return join(storagePath, "feeds.json");
}

/**
 * Reads all persisted NuGet feed configurations from disk.
 *
 * @param storagePath - The user-selected storage root directory.
 * @returns Persisted feed records, or an empty array if none exist.
 */
export function readFeeds(storagePath: string): PersistedFeed[] {
  const filePath = feedsFilePath(storagePath);
  if (!existsSync(filePath)) {
    return [];
  }
  try {
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    const result = persistedFeedArraySchema.safeParse(parsed);
    if (result.success) {
      return result.data;
    }
    console.warn(
      "[feeds-store] Invalid feeds.json — returning empty list. Errors:",
      result.error.flatten(),
    );
    return [];
  } catch {
    return [];
  }
}

/**
 * Persists NuGet feed configurations to disk, validating against the
 * feed schema before writing.
 *
 * @param storagePath - The user-selected storage root directory.
 * @param feeds - The feed records to persist.
 * @throws {Error} When the feed data fails schema validation.
 */
export function writeFeeds(storagePath: string, feeds: PersistedFeed[]): void {
  const filePath = feedsFilePath(storagePath);
  const result = persistedFeedArraySchema.safeParse(feeds);
  if (!result.success) {
    throw new Error(
      `Cannot write invalid feeds: ${result.error.flatten().formErrors.join("; ")}`,
    );
  }
  const directory = dirname(filePath);
  if (!existsSync(directory)) {
    mkdirSync(directory, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(result.data, null, 2), "utf-8");
}

/**
 * Verifies that the given path is writable by creating and removing a
 * test file.
 *
 * @param storagePath - The path to test.
 * @returns `true` when the path is writable.
 */
export function verifyStoragePath(storagePath: string): boolean {
  try {
    const testFile = join(storagePath, ".siloscope-test");
    writeFileSync(testFile, "test", "utf-8");
    const content = readFileSync(testFile, "utf-8");
    if (content === "test") {
      unlinkSync(testFile);
      return true;
    }
    return false;
  } catch {
    return false;
  }
}
