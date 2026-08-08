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
};

contextBridge.exposeInMainWorld("api", api);
