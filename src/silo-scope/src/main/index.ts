/**
 * SiloScope Electron main process entry point.
 *
 * Spawns the .NET sidecar, registers all feature IPC handlers, creates
 * the application window, and manages the application lifecycle.
 *
 * @module main/index
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { join } from "node:path";
import { registerEnvironmentsIpc } from "../features/environments/main";
import { registerFeedsIpc } from "../features/feeds/main";
import { verifyStoragePath } from "../features/feeds/persistence";
import { registerGrainInvocationIpc } from "../features/grain-invocation/main";
import {
  applyUpdate,
  broadcastUpdateState,
  checkForUpdates,
  downloadUpdate,
  initAutoUpdater,
  setSidecarForUpdater,
} from "../features/settings/main";
import { registerWorkspaceIpc } from "../features/workspaces/main";
import { IPC_CHANNELS } from "../shared/events";
import { initMenu } from "./menu";
import { SidecarAdapter } from "./sidecar/adapter";
import { SidecarJsonRpcClient } from "./sidecar/json-rpc-client";
import { getStoragePath, setStoragePath } from "./storage";

// Must precede ready — macOS reads CFBundleName for the app menu title.
// In packaged builds electron-builder sets it via Info.plist; this covers dev.
if (process.platform === "darwin") app.name = "SiloScope";

const IS_MAC_OS = process.platform === "darwin";

const iconPath = join(__dirname, "../../resources/icon.png");

/**
 * JSON-RPC client connected to the SiloScope Core sidecar process over stdio.
 */
const sidecar = new SidecarJsonRpcClient();

/**
 * Typed adapter wrapping the raw sidecar client. Owns PascalCase→camelCase
 * mapping and FluentResult unwrapping.
 */
const adapter = new SidecarAdapter(sidecar);

sidecar.start();
setSidecarForUpdater(sidecar);

sidecar.onNotification((notification) => {
  if (notification.method === "log") {
    const parameters = notification.params as
      | { level?: string; message?: string; category?: string }
      | undefined;
    if (parameters?.message) {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(IPC_CHANNELS.sidecarLog, {
          timestamp: new Date().toISOString(),
          level: parameters.level ?? "info",
          category: parameters.category,
          message: parameters.message,
        });
      }
    }
  }
});

/**
 * Creates the main application window with context isolation enabled.
 *
 * In development, loads from the Vite dev server. In production, loads
 * the built renderer HTML from disk.
 */
function createWindow(): void {
  const window = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    show: false,
    title: "SiloScope",
    titleBarStyle: IS_MAC_OS ? "hiddenInset" : "default",
    icon: iconPath,
    webPreferences: {
      preload: join(__dirname, "../preload/index.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  window.on("page-title-updated", function (e) {
    e.preventDefault();
  });

  window.on("ready-to-show", () => window.show());

  // Re-broadcast update state once the page finishes loading so the renderer
  // receives version / release info even if the initial sendStatus in
  // initAutoUpdater fired before the preload listener was registered.
  window.webContents.on("did-finish-load", () => {
    broadcastUpdateState();
  });

  window.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  const devServerUrl = process.env["ELECTRON_RENDERER_URL"];
  if (!app.isPackaged && devServerUrl) {
    window.loadURL(devServerUrl);
  } else {
    window.loadFile(join(__dirname, "../renderer/index.html"));
  }
}

/**
 * Registers IPC handlers for auto-update check/download/apply actions.
 */
function registerUpdateIpc(): void {
  ipcMain.handle("siloscope:check-for-update", () => {
    checkForUpdates();
  });

  ipcMain.handle("siloscope:download-update", () => {
    downloadUpdate();
  });

  ipcMain.handle("siloscope:apply-update", async () => {
    await applyUpdate();
  });
}

/**
 * Registers IPC handlers for native window controls (minimize, maximize,
 * close, and is-maximized query).
 */
function registerWindowIpc(): void {
  ipcMain.handle("siloscope:minimize-window", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.minimize();
  });

  ipcMain.handle("siloscope:maximize-window", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) {
      if (window.isMaximized()) {
        window.unmaximize();
      } else {
        window.maximize();
      }
    }
  });

  ipcMain.handle("siloscope:close-window", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (window) window.close();
  });

  ipcMain.handle("siloscope:is-maximized", (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    return window?.isMaximized() ?? false;
  });
}

/**
 * Registers IPC handlers for storage folder selection and verification.
 */
function registerStorageIpc(): void {
  ipcMain.handle("siloscope:get-storage-path", () => {
    return getStoragePath();
  });

  ipcMain.handle("siloscope:select-storage-folder", async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) {
      console.error("[storage] No window found for IPC sender");
      return null;
    }

    const result = await dialog.showOpenDialog(window, {
      title: "Select Storage Folder",
      properties: ["openDirectory", "createDirectory"],
      message:
        "Choose a folder where SiloScope will store your data (feeds, workspaces, environments).",
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    const selectedPath = result.filePaths[0];
    setStoragePath(selectedPath);
    return selectedPath;
  });

  ipcMain.handle(
    "siloscope:verify-storage-path",
    (_event, storagePath: string) => {
      if (!storagePath) return false;
      return verifyStoragePath(storagePath);
    },
  );
}

/**
 * Application startup — initializes the auto-updater, registers all
 * feature IPC handlers, and creates the main window.
 */
// Required for Windows notifications and taskbar grouping (see electron-builder gotcha #8)
if (process.platform === "win32") {
  app.setAppUserModelId("app.siloscope.desktop");
}

app.whenReady().then(() => {
  if (IS_MAC_OS) {
    app.dock!.setIcon(iconPath);
  }
  initMenu();
  registerWindowIpc();
  registerUpdateIpc();
  registerStorageIpc();
  registerFeedsIpc(getStoragePath);
  registerEnvironmentsIpc(getStoragePath);
  registerWorkspaceIpc(getStoragePath);
  registerGrainInvocationIpc(adapter, sidecar, getStoragePath);
  createWindow();
  initAutoUpdater();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

/**
 * Best-effort cleanup before the application quits.
 *
 * Disposes the sidecar process first to prevent automatic restarts,
 * then attempts a graceful cluster disconnect if the sidecar is still
 * running. Failures are silently ignored since the app is shutting down.
 */
async function cleanupBeforeQuit(): Promise<void> {
  console.info("[siloscope] Cleaning up before quit…");
  try {
    await sidecar.dispose();
    console.info("[siloscope] Sidecar disposed.");
  } catch (error) {
    console.warn("[siloscope] Sidecar dispose failed:", error);
  }
}

app.on("before-quit", (event) => {
  if ((globalThis as Record<string, unknown>).cleanupDone) return;
  (globalThis as Record<string, unknown>).cleanupDone = true;
  event.preventDefault();
  cleanupBeforeQuit().finally(() => {
    app.quit();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
