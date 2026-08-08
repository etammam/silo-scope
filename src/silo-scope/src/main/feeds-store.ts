import { existsSync, mkdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { persistedFeedArraySchema } from "../shared/schemas";
import type { PersistedFeed } from "../shared/schemas";

export type { PersistedFeed };

function feedsFilePath(storagePath: string): string {
  return join(storagePath, "feeds.json");
}

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
    console.warn("[feeds-store] Invalid feeds.json — returning empty list. Errors:", result.error.flatten());
    return [];
  } catch {
    return [];
  }
}

export function writeFeeds(storagePath: string, feeds: PersistedFeed[]): void {
  const filePath = feedsFilePath(storagePath);
  // Validate before writing
  const result = persistedFeedArraySchema.safeParse(feeds);
  if (!result.success) {
    throw new Error(
      `Cannot write invalid feeds: ${result.error.flatten().formErrors.join("; ")}`,
    );
  }
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(result.data, null, 2), "utf-8");
}

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
