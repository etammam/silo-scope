import { app } from "electron";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface StorageConfig {
  storagePath: string | null;
}

const configFileName = "config.json";

function configFilePath(): string {
  const userDataPath = app.getPath("userData");
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true });
  }
  return join(userDataPath, configFileName);
}

export function getStorageConfig(): StorageConfig {
  try {
    const filePath = configFilePath();
    if (!existsSync(filePath)) {
      return { storagePath: null };
    }
    const raw = readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw);
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      (typeof parsed.storagePath === "string" || parsed.storagePath === null)
    ) {
      return { storagePath: parsed.storagePath };
    }
    return { storagePath: null };
  } catch {
    return { storagePath: null };
  }
}

export function setStorageConfig(config: StorageConfig): void {
  const filePath = configFilePath();
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(filePath, JSON.stringify(config, null, 2), "utf-8");
}

export function getStoragePath(): string | null {
  return getStorageConfig().storagePath;
}

export function setStoragePath(path: string): void {
  setStorageConfig({ storagePath: path });
}
