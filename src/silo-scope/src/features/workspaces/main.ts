/**
 * IPC handlers for workspace / cluster management.
 *
 * @module features/workspaces/main
 */

import { BrowserWindow, dialog, ipcMain } from "electron";
import {
  readClusters,
  writeCluster,
  deleteCluster,
  copySourceFile,
  isSourceManaged,
  readRequests,
  writeRequests,
} from "./persistence";
import { IPC_CHANNELS } from "../../shared/events";

/**
 * Registers all workspace/cluster IPC handlers.
 *
 * @param getStoragePath - Function returning the current storage directory.
 */
export function registerWorkspaceIpc(
  getStoragePath: () => string | null,
): void {
  function requireStoragePath(): string {
    const path = getStoragePath();
    if (!path) throw new Error("Storage folder not configured.");
    return path;
  }

  ipcMain.handle(IPC_CHANNELS.clustersList, () => {
    try {
      return readClusters(requireStoragePath());
    } catch (error) {
      console.error("[clusters:list]", error);
      return [];
    }
  });

  ipcMain.handle(
    IPC_CHANNELS.clustersSave,
    (_event, params: { cluster: Record<string, unknown> }) => {
      const storagePath = requireStoragePath();
      const cluster = params.cluster as unknown as import("./schema").Workspace;

      const sources = (cluster.sources ?? []).map((source) => {
        if (
          source.sourceType === "DLL" &&
          source.reference &&
          !isSourceManaged(storagePath, cluster.id, source.reference)
        ) {
          try {
            const destPath = copySourceFile(
              storagePath,
              cluster.id,
              source.reference,
            );
            return { ...source, reference: destPath };
          } catch (error) {
            console.warn(
              `[clusters:save] Could not copy source "${source.reference}":`,
              error,
            );
          }
        }
        return source;
      });

      return writeCluster(storagePath, { ...cluster, sources });
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.clustersRequestsList,
    (_event, params: { clusterId: string }) => {
      try {
        return readRequests(requireStoragePath(), params.clusterId);
      } catch (error) {
        console.error("[clusters:requests-list]", error);
        return [];
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.clustersRequestsSave,
    (
      _event,
      params: { clusterId: string; requests: Record<string, unknown>[] },
    ) => {
      writeRequests(
        requireStoragePath(),
        params.clusterId,
        params.requests as unknown as import("./persistence").SavedRequest[],
      );
      return { success: true };
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.clustersDelete,
    (_event, params: { id: string }) => {
      try {
        deleteCluster(requireStoragePath(), params.id);
        return { success: true };
      } catch (error) {
        console.error("[clusters:delete]", error);
        throw error;
      }
    },
  );

  ipcMain.handle(IPC_CHANNELS.selectSourceFile, async (event) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window) return null;

    const result = await dialog.showOpenDialog(window, {
      title: "Select DLL",
      properties: ["openFile"],
      filters: [
        { name: "Assemblies", extensions: ["dll", "exe"] },
        { name: "All Files", extensions: ["*"] },
      ],
    });

    if (result.canceled || result.filePaths.length === 0) return null;
    return result.filePaths[0];
  });
}
