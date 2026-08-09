import { autoUpdater } from "electron-updater";
import { app, BrowserWindow } from "electron";
import type { AppUpdateStatusEntry } from "../shared/types";
import { SidecarJsonRpcClient } from "./jsonRpcClient";

export type { AppUpdateStatusEntry };

let sidecarRef: SidecarJsonRpcClient | null = null;

/** Register the sidecar reference so applyUpdate can dispose it before restart. */
export function setSidecarForUpdater(sidecar: SidecarJsonRpcClient): void {
  sidecarRef = sidecar;
}

function sendStatus(entry: AppUpdateStatusEntry): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("siloscope:update-status", entry);
    }
  }
}

function isDev(): boolean {
  return !app.isPackaged || process.env["ELECTRON_IS_DEV"] === "1";
}

export function initAutoUpdater(): void {
  // Skip auto-update checks in development — there are no published releases
  if (isDev()) {
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
  // Clean up sidecar before restarting to install the update
  if (sidecarRef) {
    try {
      await sidecarRef
        .request("DisconnectClusterAsync", undefined)
        .catch(() => {});
    } catch { /* best-effort */ }
    try {
      await sidecarRef.dispose();
    } catch { /* best-effort */ }
  }
  autoUpdater.quitAndInstall();
}
