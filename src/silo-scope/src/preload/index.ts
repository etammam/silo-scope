/**
 * Electron preload script — exposes a typed {@link RendererApi} to the
 * renderer process via `contextBridge.exposeInMainWorld`.
 *
 * Every method is a thin wrapper around `ipcRenderer.invoke` using channel
 * name constants from {@link ../shared/events!IPC_CHANNELS} so that channel
 * names stay consistent between the main process and the preload.
 *
 * Event subscriptions return an unsubscribe function that removes the
 * listener via `ipcRenderer.removeListener`.
 */

import { contextBridge, ipcRenderer } from "electron";
import type { RendererApi } from "../shared/api";
import { IPC_CHANNELS } from "../shared/events";

const api: RendererApi = {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },

  /** Window control actions */
  window: {
    minimize: () => ipcRenderer.invoke(IPC_CHANNELS.windowMinimize),
    maximize: () => ipcRenderer.invoke(IPC_CHANNELS.windowMaximize),
    close: () => ipcRenderer.invoke(IPC_CHANNELS.windowClose),
    isMaximized: () => ipcRenderer.invoke(IPC_CHANNELS.windowIsMaximized),
  },

  /** Storage path management */
  storage: {
    getPath: () => ipcRenderer.invoke(IPC_CHANNELS.storageGetPath),
    selectFolder: () => ipcRenderer.invoke(IPC_CHANNELS.storageSelectFolder),
    verify: (path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.storageVerify, path),
  },

  /** NuGet feed management */
  feeds: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.feedsList),
    create: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.feedsCreate, request),
    update: (name, request) =>
      ipcRenderer.invoke(IPC_CHANNELS.feedsUpdate, { name, feed: request }),
    test: (request) =>
      ipcRenderer.invoke(IPC_CHANNELS.feedsTest, request),
    search: (query, feedName, take) =>
      ipcRenderer.invoke(IPC_CHANNELS.feedsSearch, {
        query,
        feedName,
        take,
      }),
    getVersions: (packageId, feedName) =>
      ipcRenderer.invoke(IPC_CHANNELS.feedsGetVersions, {
        packageId,
        feedName,
      }),
  },

  /** Environment profiles */
  environments: {
    list: (workspaceId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.environmentsList, workspaceId),
    save: (workspaceId: string, config) =>
      ipcRenderer.invoke(IPC_CHANNELS.environmentsSave, {
        workspaceId,
        config,
      }),
  },

  /** Auto-update */
  updates: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.checkForUpdate),
    download: () => ipcRenderer.invoke(IPC_CHANNELS.downloadUpdate),
    apply: () => ipcRenderer.invoke(IPC_CHANNELS.applyUpdate),
    onStatus: (
      callback: (entry: {
        status: string;
        message: string;
        timestamp: number;
        progress?: number;
      }) => void,
    ) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        entry: {
          status: string;
          message: string;
          timestamp: number;
          progress?: number;
        },
      ) => callback(entry);
      ipcRenderer.on(IPC_CHANNELS.updateStatus, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.updateStatus, handler);
      };
    },
  },

  /** Sidecar lifecycle */
  sidecar: {
    status: () => ipcRenderer.invoke(IPC_CHANNELS.sidecarStatus),
    restart: () => ipcRenderer.invoke(IPC_CHANNELS.sidecarRestart),
  },

  /** Sidecar log forwarding (main → renderer push) */
  onSidecarLog: (
    callback: (entry: {
      timestamp: string;
      level: string;
      category?: string;
      message: string;
    }) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      entry: {
        timestamp: string;
        level: string;
        category?: string;
        message: string;
      },
    ) => callback(entry);
    ipcRenderer.on(IPC_CHANNELS.sidecarLog, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.sidecarLog, handler);
    };
  },

  /** Application menu actions (main → renderer push) */
  onApplicationMenuAction: (
    callback: (action: string) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      action: string,
    ) => callback(action);
    ipcRenderer.on(IPC_CHANNELS.applicationMenuAction, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.applicationMenuAction, handler);
    };
  },

  /** Connection progress updates (main → renderer push) */
  onConnectionProgress: (
    callback: (entry: { message: string }) => void,
  ) => {
    const handler = (
      _event: Electron.IpcRendererEvent,
      entry: { message: string },
    ) => callback(entry);
    ipcRenderer.on(IPC_CHANNELS.connectionProgress, handler);
    return () => {
      ipcRenderer.removeListener(IPC_CHANNELS.connectionProgress, handler);
    };
  },

  /** Cluster / workspace management */
  clusters: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.clustersList),
    save: (cluster) =>
      ipcRenderer.invoke(IPC_CHANNELS.clustersSave, { cluster }),
    remove: (id: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.clustersDelete, { id }),
    pickSourceFile: () =>
      ipcRenderer.invoke(IPC_CHANNELS.selectSourceFile),
    connect: (cluster) =>
      ipcRenderer.invoke(IPC_CHANNELS.connectCluster, {
        workspace: cluster,
      }),
    disconnect: () =>
      ipcRenderer.invoke(IPC_CHANNELS.disconnectCluster),
    setActive: (cluster) =>
      ipcRenderer.invoke(IPC_CHANNELS.setActiveWorkspace, {
        workspace: cluster,
      }),
    discoverGrains: (workspaceId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.discoverGrains, { workspaceId }),
    getGrains: () =>
      ipcRenderer.invoke(IPC_CHANNELS.getGrains),
    getSourceCatalog: () =>
      ipcRenderer.invoke(IPC_CHANNELS.getSourceCatalog),
    invokeGrain: (params) =>
      ipcRenderer.invoke(IPC_CHANNELS.invokeGrain, params),
    requests: {
      list: (clusterId: string) =>
        ipcRenderer.invoke(IPC_CHANNELS.clustersRequestsList, { clusterId }),
      save: (clusterId, requests) =>
        ipcRenderer.invoke(IPC_CHANNELS.clustersRequestsSave, {
          clusterId,
          requests,
        }),
    },
  },
};

contextBridge.exposeInMainWorld("api", api);
