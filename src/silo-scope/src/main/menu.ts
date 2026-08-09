/**
 * Native macOS application menu.
 *
 * Only applied on Darwin. Menu actions that need renderer-side handling
 * dispatch {@link CUSTOM_EVENTS.applicationMenuAction} on the focused window;
 * everything else uses built-in Electron roles.
 *
 * @module main/menu
 */

import { BrowserWindow, Menu, app, nativeImage, shell } from "electron";
import { join } from "node:path";
import { IPC_CHANNELS } from "../shared/events";

const IS_MAC_OS = process.platform === "darwin";

/** Paths resolved at module load — stable for the process lifetime. */
const resourcesDir = join(__dirname, "../../resources");
const aboutIconPath = join(resourcesDir, "icon.png");

type AboutTheme = "vscode-dark" | "vscode-light" | "github-dark" | "github-light";

interface AboutColors {
  bg: string;
  bgAlt: string;
  text: string;
  textMuted: string;
  textSubtle: string;
  accent: string;
  accentHover: string;
  border: string;
}

const ABOUT_THEMES: Record<AboutTheme, AboutColors> = {
  "vscode-dark": {
    bg: "#1f1f1f",
    bgAlt: "#2b2b2b",
    text: "#cccccc",
    textMuted: "#999999",
    textSubtle: "#666666",
    accent: "#007acc",
    accentHover: "#1a8ad4",
    border: "#3c3c3c",
  },
  "vscode-light": {
    bg: "#ffffff",
    bgAlt: "#f3f3f3",
    text: "#333333",
    textMuted: "#6e6e6e",
    textSubtle: "#999999",
    accent: "#007acc",
    accentHover: "#106ebe",
    border: "#e5e5e5",
  },
  "github-dark": {
    bg: "#0d1117",
    bgAlt: "#161b22",
    text: "#e6edf3",
    textMuted: "#8b949e",
    textSubtle: "#656d76",
    accent: "#58a6ff",
    accentHover: "#79c0ff",
    border: "#30363d",
  },
  "github-light": {
    bg: "#ffffff",
    bgAlt: "#f6f8fa",
    text: "#24292f",
    textMuted: "#656d76",
    textSubtle: "#8b949e",
    accent: "#0969da",
    accentHover: "#0550ae",
    border: "#d0d7de",
  },
};

/**
 * Opens a lightweight custom About window that respects the app's active theme.
 *
 * Reads the theme from the main renderer window's localStorage and applies
 * the matching VS Code / GitHub color palette. Falls back to vscode-dark.
 */
async function showAboutWindow(): Promise<void> {
  const existing = BrowserWindow.getAllWindows().find(
    (w) => w.title === "About SiloScope",
  );
  if (existing) {
    existing.focus();
    return;
  }

  const mainWindow = BrowserWindow.getFocusedWindow()
    ?? BrowserWindow.getAllWindows().find((w) => !w.isDestroyed());

  let themeKey: AboutTheme = "vscode-dark";
  try {
    if (mainWindow) {
      const stored = await mainWindow.webContents.executeJavaScript(
        `localStorage.getItem("siloscope.theme")`,
      );
      if (stored && stored in ABOUT_THEMES) {
        themeKey = stored as AboutTheme;
      }
    }
  } catch {
    // DevTools may not be open / webContents unavailable — keep the default.
  }

  const c = ABOUT_THEMES[themeKey];
  const isDark = themeKey.includes("dark");

  const iconDataUri = nativeImage
    .createFromPath(aboutIconPath)
    .resize({ width: 80, height: 80 })
    .toDataURL();

  const version = app.getVersion();
  const year = new Date().getFullYear();

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>About SiloScope</title>
<style>
  :root {
    --bg: ${c.bg};
    --bg-alt: ${c.bgAlt};
    --text: ${c.text};
    --text-muted: ${c.textMuted};
    --text-subtle: ${c.textSubtle};
    --accent: ${c.accent};
    --accent-hover: ${c.accentHover};
    --border: ${c.border};
  }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100vh;
    background: var(--bg);
    color: var(--text);
    -webkit-app-region: drag;
    user-select: none;
    text-align: center;
    padding: 32px 24px;
  }
  .icon-wrap {
    position: relative;
    margin-bottom: 20px;
  }
  .icon-wrap img {
    width: 80px;
    height: 80px;
    border-radius: 18px;
    display: block;
    ${isDark
      ? "box-shadow: 0 4px 24px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06);"
      : "box-shadow: 0 4px 16px rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04);"
  }
  }
  h1 {
    font-size: 17px;
    font-weight: 700;
    letter-spacing: -0.01em;
    margin-bottom: 2px;
    color: var(--text);
  }
  .version {
    font-size: 12px;
    font-weight: 500;
    color: var(--text-muted);
    margin-bottom: 18px;
  }
  .divider {
    width: 48px;
    height: 1px;
    background: var(--border);
    margin: 0 auto 16px;
  }
  .credits {
    font-size: 13px;
    font-weight: 500;
    color: var(--text);
    margin-bottom: 4px;
  }
  .copyright {
    font-size: 11px;
    color: var(--text-muted);
    margin-bottom: 14px;
  }
  .link {
    font-size: 11px;
    color: var(--accent);
    text-decoration: none;
    -webkit-app-region: no-drag;
    transition: color 0.15s;
  }
  .link:hover { color: var(--accent-hover); text-decoration: underline; }

  @keyframes fadeIn {
    from { opacity: 0; transform: translateY(6px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .fade-in {
    animation: fadeIn 0.25s ease-out both;
  }
  .fade-in:nth-child(1) { animation-delay: 0.04s; }
  .fade-in:nth-child(2) { animation-delay: 0.08s; }
  .fade-in:nth-child(3) { animation-delay: 0.12s; }
  .fade-in:nth-child(4) { animation-delay: 0.16s; }
  .fade-in:nth-child(5) { animation-delay: 0.20s; }
  .fade-in:nth-child(6) { animation-delay: 0.24s; }
</style>
</head>
<body>
  <div class="icon-wrap fade-in">
    <img src="${iconDataUri}" alt="SiloScope icon" />
  </div>
  <h1 class="fade-in">SiloScope</h1>
  <p class="version fade-in">Version ${version}</p>
  <div class="divider fade-in"></div>
  <p class="credits fade-in">Islam Abouzeid</p>
  <p class="copyright fade-in">&copy; ${year} The SiloScope Authors</p>
  <a class="link" href="https://github.com/etammam/silo-scope">github.com/etammam/silo-scope</a>
</body>
</html>`;

  const aboutWindow = new BrowserWindow({
    width: 320,
    height: 370,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    title: "About SiloScope",
    titleBarStyle: "hiddenInset",
    show: false,
    webPreferences: {
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  aboutWindow.loadURL(
    `data:text/html;charset=utf-8,${encodeURIComponent(html)}`,
  );

  aboutWindow.on("ready-to-show", () => aboutWindow.show());

  aboutWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url);
    return { action: "deny" };
  });

  aboutWindow.on("closed", () => {
    aboutWindow.destroy();
  });
}

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
        { label: "About SiloScope", click: () => showAboutWindow() },
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
