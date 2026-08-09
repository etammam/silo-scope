/**
 * IPC handlers for grain discovery and invocation via the sidecar.
 *
 * @module features/grain-invocation/main
 */

import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { BrowserWindow, ipcMain } from "electron";
import { IPC_CHANNELS } from "../../shared/events";
import type { ISidecarAdapter } from "../../main/sidecar/adapter";
import type { SidecarJsonRpcClient } from "../../main/sidecar/json-rpc-client";
import { flattenSourceCatalog } from "../../main/sidecar/adapter";

/** Cached source catalog from the last successful discover. */
let cachedSourceCatalog: Record<string, unknown> | null = null;

/** Tracks the last NUGET_PACKAGES path to avoid unnecessary sidecar restarts. */
let lastNugetPackagesPath: string | null = null;

/**
 * Sends a connection progress update to all open renderer windows.
 *
 * @param message - The human-readable progress message.
 */
function broadcastConnectionProgress(message: string): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IPC_CHANNELS.connectionProgress, { message });
    }
  }
}

/**
 * Registers all grain-invocation IPC handlers.
 *
 * @param adapter - The typed sidecar adapter.
 * @param sidecar - The raw sidecar client (for status/restart).
 * @param getStoragePath - Function returning the current storage directory.
 */
export function registerGrainInvocationIpc(
  adapter: ISidecarAdapter,
  sidecar: SidecarJsonRpcClient,
  getStoragePath: () => string | null,
): void {
  function requireStoragePath(): string {
    const path = getStoragePath();
    if (!path) throw new Error("Storage folder not configured.");
    return path;
  }

  ipcMain.handle(IPC_CHANNELS.sidecarStatus, () => ({
    running: sidecar.isRunning,
  }));

  ipcMain.handle(IPC_CHANNELS.sidecarRestart, async () => {
    await sidecar.updateEnv({});
    return { running: sidecar.isRunning };
  });

  ipcMain.handle(
    IPC_CHANNELS.setActiveWorkspace,
    async (_event, params: { workspace: Record<string, unknown> }) => {
      const workspace =
        params.workspace as unknown as import("../workspaces/schema").Workspace;
      const storagePath = requireStoragePath();

      const nugetRoot = join(storagePath, workspace.id, "nuget");
      mkdirSync(nugetRoot, { recursive: true });
      if (lastNugetPackagesPath !== nugetRoot) {
        lastNugetPackagesPath = nugetRoot;
        broadcastConnectionProgress("Configuring package cache…");
        await sidecar.updateEnv({ NUGET_PACKAGES: nugetRoot });
        sidecar.start();
      }

      broadcastConnectionProgress("Preparing workspace on sidecar…");
      await adapter.setActiveWorkspace(workspace);
      return { workspace: params.workspace };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.connectCluster,
    async (_event, params: { workspace: Record<string, unknown> }) => {
      const workspace =
        params.workspace as unknown as import("../workspaces/schema").Workspace;
      const sources = workspace.sources ?? [];
      for (const source of sources) {
        if (!source.enabled) continue;
        if (source.sourceType === "DLL") {
          const dllPath = source.reference;
          if (!dllPath || !existsSync(dllPath)) {
            throw new Error(
              `DLL not found: "${source.label || dllPath || "unknown"}".`,
            );
          }
        }
        if (source.sourceType === "NuGet") {
          if (!source.reference?.trim())
            throw new Error("A NuGet source is missing its package ID.");
          if (!source.version?.trim())
            throw new Error(
              `NuGet package "${source.reference}" is missing its version.`,
            );
        }
      }
      broadcastConnectionProgress("Connecting to Orleans cluster…");
      const message = await adapter.connectCluster(workspace);
      return { message };
    },
  );

  ipcMain.handle(IPC_CHANNELS.disconnectCluster, async () => {
    await adapter.disconnectCluster();
    cachedSourceCatalog = null;
    return { success: true };
  });

  ipcMain.handle(
    IPC_CHANNELS.discoverGrains,
    async (_event, _params: { workspaceId: string }) => {
      broadcastConnectionProgress("Discovering grain interfaces…");
      const { sourceCatalog, grains } = await adapter.discoverGrains();
      cachedSourceCatalog = sourceCatalog;
      return { grains, sourceCatalog };
    },
  );

  ipcMain.handle(IPC_CHANNELS.getGrains, async () => {
    if (!cachedSourceCatalog)
      return { grains: [], sourceCatalog: { sources: [] } };
    return {
      grains: flattenSourceCatalog(cachedSourceCatalog),
      sourceCatalog: cachedSourceCatalog,
    };
  });

  ipcMain.handle(IPC_CHANNELS.getSourceCatalog, async () => ({
    sourceCatalog: cachedSourceCatalog ?? { sources: [] },
  }));

  ipcMain.handle(
    IPC_CHANNELS.invokeGrain,
    async (
      _event,
      params: {
        grainType: string;
        method: string;
        grainKey: string;
        payload: string;
        sourceId?: string;
        functionId?: string;
      },
    ) => adapter.invokeGrain(params),
  );
}
