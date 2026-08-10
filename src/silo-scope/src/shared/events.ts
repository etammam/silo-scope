/**
 * Single source of truth for all IPC channel names and custom event names.
 *
 * Imported by the Electron main process (`ipcMain.handle`) and the preload
 * script (`ipcRenderer.invoke`) to keep channel name strings consistent
 * across the process boundary.
 *
 * @module shared/events
 */

/**
 * IPC channel names for renderer ↔ main process communication.
 *
 * Each channel pairs an `ipcMain.handle` registration in the main process
 * with an `ipcRenderer.invoke` call in the preload script.
 */
export const IPC_CHANNELS = {
  /** Window control */
  windowMinimize: "siloscope:minimize-window",
  windowMaximize: "siloscope:maximize-window",
  windowClose: "siloscope:close-window",
  windowIsMaximized: "siloscope:is-maximized",

  /** Storage path management */
  storageGetPath: "siloscope:get-storage-path",
  storageSelectFolder: "siloscope:select-storage-folder",
  storageVerify: "siloscope:verify-storage-path",

  /** NuGet feed management */
  feedsList: "siloscope:feeds-list",
  feedsCreate: "siloscope:feeds-create",
  feedsUpdate: "siloscope:feeds-update",
  feedsTest: "siloscope:feeds-test",
  feedsSearch: "siloscope:feeds-search",
  feedsGetVersions: "siloscope:feeds-get-versions",

  /** Environment profiles */
  environmentsList: "siloscope:environments-list",
  environmentsSave: "siloscope:environments-save",
  environmentsUpdate: "siloscope:environments-update",
  environmentsDelete: "siloscope:environments-delete",

  /** Cluster / workspace persistence */
  clustersList: "siloscope:clusters-list",
  clustersSave: "siloscope:clusters-save",
  clustersDelete: "siloscope:clusters-delete",
  clustersRequestsList: "siloscope:clusters-requests-list",
  clustersRequestsSave: "siloscope:clusters-requests-save",
  selectSourceFile: "siloscope:select-source-file",

  /** Sidecar lifecycle */
  sidecarStatus: "siloscope:sidecar-status",
  sidecarRestart: "siloscope:sidecar-restart",
  setActiveWorkspace: "siloscope:set-active-workspace",
  connectCluster: "siloscope:connect-cluster",
  disconnectCluster: "siloscope:disconnect-cluster",
  discoverGrains: "siloscope:discover-grains",
  getGrains: "siloscope:get-grains",
  getSourceCatalog: "siloscope:get-source-catalog",
  invokeGrain: "siloscope:invoke-grain",

  /** Auto-update */
  checkForUpdate: "siloscope:check-for-update",
  downloadUpdate: "siloscope:download-update",
  applyUpdate: "siloscope:apply-update",

  /** Main → renderer push notifications */
  sidecarLog: "siloscope:sidecar-log",
  updateStatus: "siloscope:update-status",
  connectionProgress: "siloscope:connection-progress",
  applicationMenuAction: "siloscope:application-menu-action",
} as const;

/**
 * CustomEvent names used for renderer-internal communication.
 *
 * These are dispatched on `window` and listened for within the renderer
 * process. They do not cross the Electron process boundary.
 */
export const CUSTOM_EVENTS = {
  /** A single workspace was loaded or saved */
  workspaceLoaded: "siloscope:workspace-loaded",
  /** The full workspace list was loaded from persistence */
  workspacesLoaded: "siloscope:workspaces-loaded",
  /** A file was picked via the native dialog */
  filePicked: "filePicked",
  /** A native application menu action was triggered */
  applicationMenuAction: "siloscope:application-menu-action",
  /** The user requested the application to close (Cmd+Q / Ctrl+Q) */
  requestApplicationClose: "siloscope:request-application-close",
} as const;
