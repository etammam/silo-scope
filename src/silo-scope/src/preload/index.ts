import { contextBridge, ipcRenderer } from "electron";
import type { RendererApi } from "../shared/api";

const api: RendererApi = {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
  },
  window: {
    minimize: () => ipcRenderer.invoke("siloscope:minimize-window"),
    maximize: () => ipcRenderer.invoke("siloscope:maximize-window"),
    close: () => ipcRenderer.invoke("siloscope:close-window"),
    isMaximized: () => ipcRenderer.invoke("siloscope:is-maximized"),
    onStateChange: (callback: (state: { isMaximized: boolean }) => void) => {
      const handler = (
        _event: Electron.IpcRendererEvent,
        state: { isMaximized: boolean },
      ) => callback(state);
      ipcRenderer.on("siloscope:window-state", handler);
      return () => {
        ipcRenderer.removeListener("siloscope:window-state", handler);
      };
    },
  },
  storage: {
    getPath: () => ipcRenderer.invoke("siloscope:get-storage-path"),
    selectFolder: () => ipcRenderer.invoke("siloscope:select-storage-folder"),
    verify: (path: string) =>
      ipcRenderer.invoke("siloscope:verify-storage-path", path),
  },
  feeds: {
    list: () => ipcRenderer.invoke("siloscope:feeds-list"),
    create: (request) => ipcRenderer.invoke("siloscope:feeds-create", request),
    update: (name, request) =>
      ipcRenderer.invoke("siloscope:feeds-update", { name, feed: request }),
    test: (request) => ipcRenderer.invoke("siloscope:feeds-test", request),
    search: (query, feedName, take) =>
      ipcRenderer.invoke("siloscope:feeds-search", {
        query,
        feedName,
        take,
      }),
    getVersions: (packageId, feedName) =>
      ipcRenderer.invoke("siloscope:feeds-get-versions", {
        packageId,
        feedName,
      }),
  },
  environments: {
    list: (workspaceId: string) =>
      ipcRenderer.invoke("siloscope:environments-list", workspaceId),
    save: (workspaceId: string, config) =>
      ipcRenderer.invoke("siloscope:environments-save", {
        workspaceId,
        config,
      }),
  },
  sidecar: {
    status: () => ipcRenderer.invoke("siloscope:sidecar-status"),
    restart: () => ipcRenderer.invoke("siloscope:sidecar-restart"),
  },
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
    ipcRenderer.on("siloscope:sidecar-log", handler);
    return () => {
      ipcRenderer.removeListener("siloscope:sidecar-log", handler);
    };
  },
  clusters: {
    list: () => ipcRenderer.invoke("siloscope:clusters-list"),
    save: (cluster) =>
      ipcRenderer.invoke("siloscope:clusters-save", { cluster }),
    remove: (id: string) =>
      ipcRenderer.invoke("siloscope:clusters-delete", { id }),
    pickSourceFile: () =>
      ipcRenderer.invoke("siloscope:select-source-file"),
    connect: (cluster) =>
      ipcRenderer.invoke("siloscope:connect-cluster", { workspace: cluster }),
    disconnect: () =>
      ipcRenderer.invoke("siloscope:disconnect-cluster"),
    setActive: (cluster) =>
      ipcRenderer.invoke("siloscope:set-active-workspace", { workspace: cluster }),
    discoverGrains: (workspaceId: string) =>
      ipcRenderer.invoke("siloscope:discover-grains", { workspaceId }),
    getGrains: () =>
      ipcRenderer.invoke("siloscope:get-grains"),
    getSourceCatalog: () =>
      ipcRenderer.invoke("siloscope:get-source-catalog"),
    invokeGrain: (params) =>
      ipcRenderer.invoke("siloscope:invoke-grain", params),
    requests: {
      list: (clusterId: string) =>
        ipcRenderer.invoke("siloscope:clusters-requests-list", { clusterId }),
      save: (clusterId, requests) =>
        ipcRenderer.invoke("siloscope:clusters-requests-save", { clusterId, requests }),
    },
  },
};

contextBridge.exposeInMainWorld("api", api);
