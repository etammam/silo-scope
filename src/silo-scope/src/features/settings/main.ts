import { app, BrowserWindow } from "electron";
import electronUpdater from "electron-updater";
import { SidecarJsonRpcClient } from "../../main/sidecar/json-rpc-client";
import type { ApplicationUpdateStatusEntry } from "../settings/schema";

const { autoUpdater } = electronUpdater;

let sidecarRef: SidecarJsonRpcClient | null = null;
let cachedLocalInfo: ApplicationUpdateStatusEntry["localInfo"] | undefined;

/**
 * Set to true when quitAndInstall() is about to be called so the before-quit
 * handler can let the update installer proceed without cleanup interference.
 */
let isUpdatePending = false;

/** Returns true when an update is about to be applied via quitAndInstall. */
export function getIsUpdatePending(): boolean {
  return isUpdatePending;
}

/** Register the sidecar reference so applyUpdate can dispose it before restart. */
export function setSidecarForUpdater(sidecar: SidecarJsonRpcClient): void {
  sidecarRef = sidecar;
}

function sendStatus(entry: ApplicationUpdateStatusEntry): void {
  // Cache the first localInfo we see and attach it to every status entry
  // so the renderer never loses version / release-url details.
  if (entry.localInfo) {
    cachedLocalInfo = entry.localInfo;
  }

  const enriched: ApplicationUpdateStatusEntry = {
    ...entry,
    localInfo: entry.localInfo ?? cachedLocalInfo,
  };

  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("siloscope:update-status", enriched);
    }
  }
}

function isDev(): boolean {
  return !app.isPackaged || process.env["ELECTRON_IS_DEV"] === "1";
}

function buildLocalInfo(): NonNullable<
  ApplicationUpdateStatusEntry["localInfo"]
> {
  const dev = isDev();
  return {
    version: app.getVersion(),
    hash: "",
    baseUrl: "https://github.com/etammam/silo-scope/releases/latest/download",
    channel: dev ? "dev" : "latest",
    name: app.getName(),
    identifier: "siloscope.app",
  };
}

export function broadcastUpdateState(): void {
  sendStatus({
    status: "idle",
    message: isDev()
      ? "Auto-update disabled in development."
      : "Ready to check for updates.",
    timestamp: Date.now(),
    localInfo: buildLocalInfo(),
  });
}

export function initAutoUpdater(): void {
  const dev = isDev();

  // Always broadcast local build info so the renderer can show version / release URL
  broadcastUpdateState();

  // Skip auto-update event listeners and checks in development
  if (dev) {
    console.info("[updater] Skipping auto-update in development mode.");
    return;
  }

  autoUpdater.autoDownload = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.logger = console;

  autoUpdater.on("checking-for-update", () => {
    sendStatus({
      status: "checking",
      message: "Checking for updates…",
      timestamp: Date.now(),
    });
  });

  autoUpdater.on("update-available", (info) => {
    sendStatus({
      status: "update-available",
      message: `Version ${info.version} available.`,
      timestamp: Date.now(),
      version: info.version,
    });
  });

  autoUpdater.on("update-not-available", () => {
    sendStatus({
      status: "no-update",
      message: "You're on the latest version.",
      timestamp: Date.now(),
    });
  });

  autoUpdater.on("download-progress", (progress) => {
    sendStatus({
      status: "downloading",
      message: `Downloading update…`,
      timestamp: Date.now(),
      progress: progress.percent,
    });
  });

  autoUpdater.on("update-downloaded", (info) => {
    sendStatus({
      status: "download-complete",
      message: `Version ${info.version} downloaded. Restart to apply.`,
      timestamp: Date.now(),
      version: info.version,
    });
  });

  autoUpdater.on("error", (error) => {
    console.error("[updater]", error);
    sendStatus({
      status: "error",
      message: error.message,
      timestamp: Date.now(),
    });
  });

  // Check for updates shortly after startup (production only)
  setTimeout(() => checkForUpdates(), 5_000);
}

export function checkForUpdates(): void {
  if (isDev()) return;
  autoUpdater.checkForUpdates().catch((err) => {
    console.error("[updater] check failed:", err);
    sendStatus({
      status: "error",
      message: `Update check failed: ${err.message}`,
      timestamp: Date.now(),
    });
  });
}

export function downloadUpdate(): void {
  autoUpdater.downloadUpdate().catch((err) => {
    console.error("[updater] download failed:", err);
    sendStatus({
      status: "error",
      message: `Download failed: ${err.message}`,
      timestamp: Date.now(),
    });
  });
}

export async function applyUpdate(): Promise<void> {
  isUpdatePending = true;

  // Clean up sidecar before restarting to install the update
  if (sidecarRef) {
    try {
      await sidecarRef
        .request("DisconnectClusterAsync", undefined)
        .catch(() => {});
    } catch {
      /* best-effort */
    }
    try {
      await sidecarRef.dispose();
    } catch {
      /* best-effort */
    }
  }
  autoUpdater.quitAndInstall();
}
