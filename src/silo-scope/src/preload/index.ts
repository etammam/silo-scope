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
      const handler = (_event: Electron.IpcRendererEvent, state: { isMaximized: boolean }) =>
        callback(state);
      ipcRenderer.on("siloscope:window-state", handler);
      return () => {
        ipcRenderer.removeListener("siloscope:window-state", handler);
      };
    },
  },
};

contextBridge.exposeInMainWorld("api", api);
