import electronUpdater from "electron-updater";

const { autoUpdater } = electronUpdater;
import { app, BrowserWindow } from "electron";
import type { ApplicationUpdateStatusEntry } from "../settings/schema";
import { SidecarJsonRpcClient } from "../../main/sidecar/json-rpc-client";

let sidecarRef: SidecarJsonRpcClient | null = null;

/** Register the sidecar reference so applyUpdate can dispose it before restart. */
export function setSidecarForUpdater(sidecar: SidecarJsonRpcClient): void {
  sidecarRef = sidecar;
}

function sendStatus(entry: ApplicationUpdateStatusEntry): void {
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

  // Send local build info so the renderer can show version / release URL
  sendStatus({
    status: "idle",
    message: "Ready to check for updates.",
    timestamp: Date.now(),
    localInfo: {
      version: app.getVersion(),
      hash: "",
      baseUrl: "https://github.com/etammam/silo-scope/releases/latest/download",
      channel: "latest",
      name: app.getName(),
      identifier: "siloscope.app",
    },
  });

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
