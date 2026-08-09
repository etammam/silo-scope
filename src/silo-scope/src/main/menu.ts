/**
 * Native macOS application menu.
 *
 * Only applied on Darwin. Menu actions that need renderer-side handling
 * dispatch {@link CUSTOM_EVENTS.applicationMenuAction} on the focused window;
 * everything else uses built-in Electron roles.
 *
 * @module main/menu
 */

import { BrowserWindow, Menu, shell } from "electron";
import { CUSTOM_EVENTS, IPC_CHANNELS } from "../shared/events";

const IS_MAC_OS = process.platform === "darwin";

/**
 * Sends the given menu action name to the focused window's renderer.
 * Silently no-ops when no window is focused.
 */
function sendMenuAction(action: string): void {
  const win = BrowserWindow.getFocusedWindow();
  if (win) {
    win.webContents.send(IPC_CHANNELS.applicationMenuAction, action);
  }
}

/**
 * Builds and sets the native application menu. Only applies on macOS.
 */
export function initMenu(): void {
  if (!IS_MAC_OS) return;

  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "SiloScope",
      submenu: [
        { label: "About SiloScope", role: "about" },
        {
          label: "Check for Updates…",
          click: () => sendMenuAction("check-for-updates"),
        },
        { type: "separator" },
        {
          label: "Settings…",
          accelerator: "Cmd+,",
          click: () => sendMenuAction("open-settings"),
        },
        { type: "separator" },
        { role: "services", label: "Services" },
        { type: "separator" },
        { role: "hide", label: "Hide SiloScope" },
        { role: "hideOthers", label: "Hide Others" },
        { role: "unhide", label: "Show All" },
        { type: "separator" },
        { role: "quit", label: "Quit SiloScope" },
      ],
    },
    {
      label: "File",
      submenu: [
        {
          label: "Close Window",
          accelerator: "Cmd+W",
          role: "close",
        },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo", label: "Undo" },
        { role: "redo", label: "Redo" },
        { type: "separator" },
        { role: "cut", label: "Cut" },
        { role: "copy", label: "Copy" },
        { role: "paste", label: "Paste" },
        { role: "selectAll", label: "Select All" },
      ],
    },
    {
      label: "View",
      submenu: [
        {
          label: "Toggle Activity Bar",
          click: () => sendMenuAction("toggle-activity-bar"),
        },
        {
          label: "Toggle Navigation Sidebar",
          accelerator: "Cmd+B",
          click: () => sendMenuAction("toggle-navigation"),
        },
        {
          label: "Toggle Response Pane",
          accelerator: "Cmd+J",
          click: () => sendMenuAction("toggle-response"),
        },
        {
          label: "Toggle Backend Logs",
          accelerator: "Cmd+Shift+L",
          click: () => sendMenuAction("toggle-logs"),
        },
        { type: "separator" },
        {
          label: "Increase Font Size",
          accelerator: "Cmd+=",
          click: () => sendMenuAction("increase-font-size"),
        },
        {
          label: "Decrease Font Size",
          accelerator: "Cmd+-",
          click: () => sendMenuAction("decrease-font-size"),
        },
        { type: "separator" },
        { role: "reload", label: "Reload" },
        { role: "forceReload", label: "Force Reload" },
        { role: "toggleDevTools", label: "Toggle Developer Tools" },
        { type: "separator" },
        { role: "resetZoom", label: "Actual Size" },
        { role: "zoomIn", label: "Zoom In" },
        { role: "zoomOut", label: "Zoom Out" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Toggle Full Screen" },
      ],
    },
    {
      label: "Cluster",
      submenu: [
        {
          label: "Connect",
          click: () => sendMenuAction("connect-cluster"),
        },
        {
          label: "Disconnect",
          click: () => sendMenuAction("disconnect-cluster"),
        },
        { type: "separator" },
        {
          label: "Go to Workspace",
          accelerator: "Cmd+1",
          click: () => sendMenuAction("go-workspace"),
        },
        {
          label: "Go to Clusters",
          accelerator: "Cmd+2",
          click: () => sendMenuAction("go-clusters"),
        },
      ],
    },
    {
      label: "Environments",
      submenu: [
        {
          label: "Go to Environments",
          accelerator: "Cmd+3",
          click: () => sendMenuAction("go-environments"),
        },
      ],
    },
    {
      label: "Feeds",
      submenu: [
        {
          label: "Go to NuGet Feeds",
          accelerator: "Cmd+4",
          click: () => sendMenuAction("go-feeds"),
        },
      ],
    },
    {
      label: "Window",
      role: "window",
      submenu: [
        { role: "minimize", label: "Minimize" },
        { role: "zoom", label: "Zoom" },
        { type: "separator" },
        { role: "front", label: "Bring All to Front" },
      ],
    },
    {
      label: "Help",
      role: "help",
      submenu: [
        {
          label: "SiloScope on GitHub",
          click: () =>
            shell.openExternal("https://github.com/etammam/silo-scope"),
        },
        {
          label: "Report an Issue",
          click: () =>
            shell.openExternal(
              "https://github.com/etammam/silo-scope/issues/new",
            ),
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}
