import { Electroview } from "electrobun/view";
import {
  Briefcase,
  ChevronDown,
  FilePlus,
  FolderOpen,
  LayoutTemplate,
  Minus,
  PanelLeftClose,
  PanelRightClose,
  Play,
  Radar,
  Save,
  SlidersHorizontal,
  Square,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { SiloScopeRPC } from "../shared/rpc";
import type {
  GrainKeyType,
  SourceCatalogFunction,
  Workspace,
} from "../shared/types";
import {
  buildSourceCatalogFromGrains,
  findCatalogFunction,
  findCatalogSource,
} from "./catalog";
import { ActivityBar, type ActivityView } from "./components/ActivityBar";
import {
  NavigationSidebar,
  NuGetRegistryManager,
} from "./components/NavigationSidebar";
import { RequestWorkbench } from "./components/RequestWorkbench";
import {
  ResponseTelemetryPane,
  type ResponsePaneTab,
} from "./components/ResponseTelemetryPane";
import { SettingsPage } from "./components/SettingsPage";
import { WorkspacesPage } from "./components/WorkspacesPage";
import { useAppStore } from "./store";

type PaneLayout = "horizontal" | "vertical";
type WorkbenchTheme = "dark" | "light" | "vscode-dark" | "vscode-light";

const themeStorageKey = "siloscope.theme";
const applicationMenuEventName = "siloscope:application-menu-action";

type GrainInvocationRequest = {
  grainType: string;
  grainKey: string;
  keyType: GrainKeyType;
  method: string;
  payload: string;
  sourceId?: string;
  functionId?: string;
};

const rendererRpc = Electroview.defineRPC<SiloScopeRPC>({
  handlers: {
    requests: {
      setWorkspace: ({ workspace }) => {
        useAppStore.getState().setWorkspace(workspace);
        return true;
      },
    },
    messages: {
      requestGrains: ({ workspaceId }) => {
        void refreshWorkspaceCatalog(workspaceId);
      },
      logEntry: ({ entry }) => {
        useAppStore.getState().addLog(entry);
      },
      applicationMenuAction: ({ action }) => {
        window.dispatchEvent(
          new CustomEvent(applicationMenuEventName, { detail: action }),
        );

        if (action === "openWorkspace") {
          void loadWorkspace();
          return;
        }

        if (action === "saveWorkspace") {
          void saveCurrentWorkspace();
          return;
        }
      },
      filePicked: ({ paths }) => {
        window.dispatchEvent(new CustomEvent("filePicked", { detail: { paths } }));
      },
    },
  },
});

const electroview = new Electroview({ rpc: rendererRpc });

function App() {
  const {
    grains,
    invocationResult,
    isConnected,
    selectedGrain,
    selectedFunctionId,
    selectedMethod,
    nugetFeeds,
    setWorkspace,
    setSelectedGrain,
    setSelectedFunction,
    setSelectedMethod,
    sourceCatalog,
    workspace,
    fontFamily,
    fontSize,
    setFontFamily,
    setFontSize,
  } = useAppStore();
  const [activeView, setActiveView] = useState<ActivityView>("workspace");
  const [theme, setTheme] = useState<WorkbenchTheme>(() => readStoredTheme());
  const [isActivityBarVisible, setIsActivityBarVisible] = useState(true);
  const [isNavigationVisible, setIsNavigationVisible] = useState(true);
  const [isResponseVisible, setIsResponseVisible] = useState(true);
  const [responseTab, setResponseTab] = useState<ResponsePaneTab>("response");
  const [invocationHistory, setInvocationHistory] = useState<
    { timestamp: number; isSuccess: boolean; timing: { totalMs: number; executionMs: number; serializationMs: number } | null }[]
  >([]);
  const [paneLayout, setPaneLayout] = useState<PaneLayout>("horizontal");
  const [horizontalResponseSize, setHorizontalResponseSize] = useState(420);
  const [verticalResponseSize, setVerticalResponseSize] = useState(260);
  const [navigationSize, setNavigationSize] = useState(280);
  const [functionTabs, setFunctionTabs] = useState<string[]>([]);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [isWorkspaceMenuOpen, setIsWorkspaceMenuOpen] = useState(false);
  const platform = useMemo(() => {
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("mac")) return "mac";
    if (ua.includes("win")) return "win";
    return "linux";
  }, []);
  const [isMaximized, setIsMaximized] = useState(false);
  const handleMinimize = useCallback(async () => {
    await electroview.rpc?.request.minimizeWindow();
  }, []);
  const handleMaximize = useCallback(async () => {
    const result = await electroview.rpc?.request.maximizeWindow();
    setIsMaximized(result?.isMaximized ?? false);
  }, []);
  const handleClose = useCallback(async () => {
    await electroview.rpc?.request.closeWindow();
  }, []);
  const handleNewWorkspace = useCallback(() => {
    setActiveView("workspaces");
  }, []);
  useEffect(() => {
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    void refreshNugetFeeds();
    void refreshPersistedWorkspaces();
  }, []);

  useEffect(() => {
    const handleWorkspaceLoaded = (event: Event) => {
      const loadedWorkspace = (event as CustomEvent<Workspace>).detail;
      setWorkspaces((current) => upsertWorkspace(current, loadedWorkspace));
    };
    const handleWorkspacesLoaded = (event: Event) => {
      const loadedWorkspaces = (event as CustomEvent<Workspace[]>).detail;
      setWorkspaces(loadedWorkspaces);
    };

    window.addEventListener(
      "siloscope:workspace-loaded",
      handleWorkspaceLoaded,
    );
    window.addEventListener(
      "siloscope:workspaces-loaded",
      handleWorkspacesLoaded,
    );
    return () => {
      window.removeEventListener(
        "siloscope:workspace-loaded",
        handleWorkspaceLoaded,
      );
      window.removeEventListener(
        "siloscope:workspaces-loaded",
        handleWorkspacesLoaded,
      );
    };
  }, []);

  useEffect(() => {
    if (!isWorkspaceMenuOpen) {
      return;
    }

    const handleClickOutside = (event: MouseEvent) => {
      const workspaceEl = document.querySelector(".app-titlebar__workspace");
      if (workspaceEl && !workspaceEl.contains(event.target as Node)) {
        setIsWorkspaceMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isWorkspaceMenuOpen]);

  useEffect(() => {
    if (invocationResult) {
      setInvocationHistory((prev) => [
        {
          timestamp: Date.now(),
          isSuccess: invocationResult.isSuccess,
          timing: invocationResult.timing ?? null,
        },
        ...prev.slice(0, 49),
      ]);
    }
  }, [invocationResult]);

  useEffect(() => {
    const handleApplicationMenuAction = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
      if (action === "newWorkspace") {
        setActiveView("workspaces");
      }

      if (action === "toggleActivityBar") {
        setIsActivityBarVisible((visible) => !visible);
      }

      if (action === "toggleNavigationSidebar") {
        setIsNavigationVisible((visible) => !visible);
      }

      if (action === "toggleTelemetryPane") {
        setIsResponseVisible((visible) => !visible);
      }
    };

    window.addEventListener(
      applicationMenuEventName,
      handleApplicationMenuAction,
    );
    return () =>
      window.removeEventListener(
        applicationMenuEventName,
        handleApplicationMenuAction,
      );
  }, []);

  const responseSize =
    paneLayout === "horizontal" ? horizontalResponseSize : verticalResponseSize;
  const effectiveSourceCatalog = useMemo(() => {
    return sourceCatalog.sources.length > 0
      ? sourceCatalog
      : buildSourceCatalogFromGrains(grains, workspace);
  }, [grains, sourceCatalog, workspace]);
  useEffect(() => {
    if (!workspace || !isConnected) {
      return;
    }

    void refreshWorkspaceCatalog(workspace.id);
  }, [isConnected, workspace?.id]);

  const handleSelectFunction = useCallback(
    (functionId: string | null) => {
      const selectedFunction = findCatalogFunction(
        effectiveSourceCatalog,
        functionId,
      );

      if (!selectedFunction) {
        setSelectedFunction(null);
        setSelectedGrain(null);
        setSelectedMethod(null);
        return;
      }

      setFunctionTabs((current) =>
        current.includes(selectedFunction.functionId)
          ? current
          : [...current, selectedFunction.functionId],
      );
      setSelectedGrain(selectedFunction.interfaceId);
      setSelectedMethod(selectedFunction.methodName);
      setSelectedFunction(selectedFunction.functionId);
    },
    [
      effectiveSourceCatalog,
      setSelectedFunction,
      setSelectedGrain,
      setSelectedMethod,
    ],
  );

  const handleCloseFunctionTab = useCallback(
    (functionId: string) => {
      const tabIndex = functionTabs.indexOf(functionId);
      const nextTabs = functionTabs.filter((tabId) => tabId !== functionId);
      setFunctionTabs(nextTabs);

      if (selectedFunctionId !== functionId) {
        return;
      }

      const nextFunctionId = nextTabs[tabIndex] ?? nextTabs[tabIndex - 1] ?? null;
      if (nextFunctionId) {
        handleSelectFunction(nextFunctionId);
        return;
      }

      setSelectedFunction(null);
      setSelectedGrain(null);
      setSelectedMethod(null);
    },
    [
      functionTabs,
      handleSelectFunction,
      selectedFunctionId,
      setSelectedFunction,
      setSelectedGrain,
      setSelectedMethod,
    ],
  );

  const shellStyle = {
    "--response-size": `${responseSize}px`,
    "--navigation-size": `${navigationSize}px`,
  } as CSSProperties;

  const handleNavigationResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      event.preventDefault();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        const activityOffset = isActivityBarVisible ? 48 : 0;
        setNavigationSize(
          clamp(moveEvent.clientX - activityOffset, 220, 460),
        );
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [isActivityBarVisible],
  );

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const container = event.currentTarget.parentElement;
      if (!container) {
        return;
      }

      event.preventDefault();
      const bounds = container.getBoundingClientRect();
      const minSize = Math.min(150, bounds.width * 0.2);
      const maxSize = bounds.width * 0.65;

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (paneLayout === "horizontal") {
          const nextSize = clamp(
            bounds.right - moveEvent.clientX,
            minSize,
            maxSize,
          );
          setHorizontalResponseSize(nextSize);
          return;
        }

        const vMinSize = Math.min(100, bounds.height * 0.15);
        const vMaxSize = bounds.height * 0.7;
        const nextSize = clamp(
          bounds.bottom - moveEvent.clientY,
          vMinSize,
          vMaxSize,
        );
        setVerticalResponseSize(nextSize);
      };

      const handleMouseUp = () => {
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [paneLayout],
  );

  const handleInvoke = useCallback((request: GrainInvocationRequest) => {
    void invokeGrain(request);
  }, []);

  const handleSelectWorkspace = useCallback(
    (workspaceId: string) => {
      const nextWorkspace = workspaces.find(
        (candidate) => candidate.id === workspaceId,
      );
      if (!nextWorkspace) {
        return;
      }

      setWorkspace(nextWorkspace);
      useAppStore.getState().setGrains([]);
      useAppStore.getState().setSourceCatalog({ sources: [] });
      useAppStore.getState().setInvocationResult(null);
      useAppStore.getState().setIsConnected(false);
      setFunctionTabs([]);
    },
    [setWorkspace, workspaces],
  );

  const handleCreateWorkspace = useCallback(
    (nextWorkspace: Workspace) => {
      setWorkspaces((current) => upsertWorkspace(current, nextWorkspace));
      setWorkspace(nextWorkspace);
      useAppStore.getState().setGrains([]);
      useAppStore.getState().setSourceCatalog({ sources: [] });
      useAppStore.getState().setSelectedFunction(null);
      useAppStore.getState().setInvocationResult(null);
      useAppStore.getState().setIsConnected(false);
      setFunctionTabs([]);
      void persistWorkspace(nextWorkspace);
    },
    [setWorkspace],
  );

  const handleUpdateWorkspace = useCallback(
    (nextWorkspace: Workspace) => {
      setWorkspaces((current) => upsertWorkspace(current, nextWorkspace));
      if (workspace?.id === nextWorkspace.id) {
        setWorkspace(nextWorkspace);
      }
      void persistWorkspace(nextWorkspace);
    },
    [setWorkspace, workspace],
  );

  const handleDeleteWorkspace = useCallback(
    (workspaceId: string) => {
      setWorkspaces((current) => current.filter((w) => w.id !== workspaceId));
      if (workspace?.id === workspaceId) {
        setWorkspace(null);
        useAppStore.getState().setGrains([]);
        useAppStore.getState().setSourceCatalog({ sources: [] });
        useAppStore.getState().setSelectedFunction(null);
        useAppStore.getState().setInvocationResult(null);
        useAppStore.getState().setIsConnected(false);
        setFunctionTabs([]);
      }
    },
    [setWorkspace, workspace],
  );

  const handleEditWorkspace = useCallback(() => {
    setActiveView("workspaces");
  }, []);

  return (
    <div
      className="app-shell"
      data-activity-visible={isActivityBarVisible}
      data-navigation-visible={isNavigationVisible}
      data-pane-layout={paneLayout}
      data-platform={platform}
      data-response-visible={isResponseVisible}
      data-theme={theme}
      style={shellStyle}
    >
      {isActivityBarVisible && (
        <ActivityBar
          activeView={activeView}
          onViewChange={setActiveView}
        />
      )}

      <header className="app-titlebar electrobun-webkit-app-region-drag">
        <div className="app-titlebar__workspace electrobun-webkit-app-region-no-drag">
          <button
            aria-expanded={isWorkspaceMenuOpen}
            aria-haspopup="menu"
            className="workspace-menu__trigger"
            onClick={() => setIsWorkspaceMenuOpen((open) => !open)}
            type="button"
          >
            <Briefcase aria-hidden="true" width={13} height={13} />
            <span>{workspace?.name ?? "My Workspace"}</span>
            <ChevronDown aria-hidden="true" width={12} height={12} />
          </button>
          <span
            className={`workspace-connection-state ${isConnected ? "workspace-connection-state--connected" : ""}`}
            title={isConnected ? "Connected" : "Disconnected"}
          >
            <span aria-hidden="true" />
            {isConnected ? "Connected" : "Disconnected"}
          </span>
          <button
            aria-label={isConnected ? "Disconnect cluster" : "Connect cluster"}
            aria-pressed={isConnected}
            className="workspace-connection-toggle"
            disabled={!workspace || (!isConnected && !workspace)}
            onClick={() => {
              if (isConnected) {
                void disconnectCluster();
                return;
              }

              void connectCluster();
            }}
            title={isConnected ? "Disconnect cluster" : "Connect cluster"}
            type="button"
          >
            {isConnected ? (
              <Square aria-hidden="true" width={12} height={12} />
            ) : (
              <Play aria-hidden="true" width={12} height={12} />
            )}
          </button>
          {isWorkspaceMenuOpen && (
            <div className="workspace-menu" role="menu">
              {workspaces.length === 0 ? (
                <div className="workspace-menu__empty">
                  <Briefcase aria-hidden="true" width={28} height={28} />
                  <strong>No clusters</strong>
                  <span>Create a cluster from the Clusters view</span>
                </div>
              ) : (
                <>
                  <div className="workspace-menu__current">
                    <strong>Clusters</strong>
                  </div>
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      aria-pressed={workspace?.id === ws.id}
                      className={`workspace-menu__cluster ${workspace?.id === ws.id ? "workspace-menu__cluster--active" : ""}`}
                      role="menuitem"
                      type="button"
                      onClick={() => {
                        setIsWorkspaceMenuOpen(false);
                        handleSelectWorkspace(ws.id);
                      }}
                    >
                      <Briefcase aria-hidden="true" width={13} height={13} />
                      <span className="workspace-menu__cluster-name">{ws.name}</span>
                      {workspace?.id === ws.id && (
                        <span className="workspace-menu__cluster-status">
                          {isConnected ? "Connected" : "Active"}
                        </span>
                      )}
                    </button>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
        <div className="app-titlebar__command">Siloscope Workbench</div>
        <div className="app-titlebar__actions">
          <button
            aria-label={
              isNavigationVisible
                ? "Collapse navigation panel"
                : "Expand navigation panel"
            }
            aria-pressed={!isNavigationVisible}
            className="titlebar-action titlebar-action--navigation electrobun-webkit-app-region-no-drag"
            onClick={() => setIsNavigationVisible((visible) => !visible)}
            title={
              isNavigationVisible
                ? "Collapse navigation panel"
                : "Expand navigation panel"
            }
            type="button"
          >
            <PanelLeftClose
              aria-hidden="true"
              className="titlebar-navigation__icon"
              width={16}
              height={16}
            />
          </button>
          <button
            aria-label={
              paneLayout === "horizontal"
                ? "Stack request and response panels"
                : "Place request and response panels side by side"
            }
            aria-pressed={paneLayout === "vertical"}
            className="titlebar-action titlebar-action--layout electrobun-webkit-app-region-no-drag"
            onClick={() =>
              setPaneLayout((layout) =>
                layout === "horizontal" ? "vertical" : "horizontal",
              )
            }
            title={
              paneLayout === "horizontal"
                ? "Stack request and response panels"
                : "Place request and response panels side by side"
            }
            type="button"
          >
            <LayoutTemplate
              aria-hidden="true"
              className="titlebar-layout__icon"
              width={16}
              height={16}
            />
          </button>
          <button
            aria-label={
              isResponseVisible
                ? "Collapse response panel"
                : "Expand response panel"
            }
            aria-pressed={!isResponseVisible}
            className="titlebar-action titlebar-action--response electrobun-webkit-app-region-no-drag"
            onClick={() => setIsResponseVisible((visible) => !visible)}
            title={
              isResponseVisible
                ? "Collapse response panel"
                : "Expand response panel"
            }
            type="button"
          >
            <PanelRightClose
              aria-hidden="true"
              className="titlebar-response__icon"
              width={16}
              height={16}
            />
          </button>
        </div>
        {platform !== "mac" && (
          <div className="app-titlebar__window-controls electrobun-webkit-app-region-no-drag">
            <button
              aria-label="Minimize window"
              className="window-control window-control--minimize"
              onClick={handleMinimize}
              type="button"
            >
              <Minus aria-hidden="true" width={14} height={14} />
            </button>
            <button
              aria-label={isMaximized ? "Restore window" : "Maximize window"}
              className="window-control window-control--maximize"
              onClick={handleMaximize}
              type="button"
            >
              {isMaximized ? (
                <svg aria-hidden="true" height="14" viewBox="0 0 24 24" width="14">
                  <rect fill="none" height="14" rx="1.5" stroke="currentColor" strokeWidth="2" width="14" x="5" y="5" />
                  <rect fill="none" height="8" rx="1" stroke="currentColor" strokeWidth="2" width="8" x="9" y="9" />
                </svg>
              ) : (
                <svg aria-hidden="true" height="14" viewBox="0 0 24 24" width="14">
                  <rect fill="none" height="14" rx="1.5" stroke="currentColor" strokeWidth="2" width="14" x="5" y="5" />
                </svg>
              )}
            </button>
            <button
              aria-label="Close window"
              className="window-control window-control--close"
              onClick={handleClose}
              type="button"
            >
              <X aria-hidden="true" width={14} height={14} />
            </button>
          </div>
        )}
      </header>

      {isNavigationVisible && (
        <NavigationSidebar
          activeView={activeView}
          grains={grains}
          isConnected={isConnected}
          onConnectCluster={connectCluster}
          onDisconnectCluster={disconnectCluster}
          onDiscoverGrains={discoverWorkspaceGrains}
          onLoadWorkspace={loadWorkspace}
          onSaveWorkspace={saveCurrentWorkspace}
          onSelectWorkspace={handleSelectWorkspace}
          onEditWorkspace={handleEditWorkspace}
          onSelectFunction={handleSelectFunction}
          onSelectGrain={setSelectedGrain}
          onNewWorkspace={handleNewWorkspace}
          selectedFunctionId={selectedFunctionId}
          selectedGrain={selectedGrain}
          sourceCatalog={effectiveSourceCatalog}
          workspace={workspace}
          workspaces={workspaces}
        />
      )}
      {isNavigationVisible && (
        <div
          aria-label="Resize navigation sidebar"
          aria-orientation="vertical"
          className="navigation-resizer"
          onMouseDown={handleNavigationResizeStart}
          role="separator"
          tabIndex={0}
        />
      )}

      <main className="app-shell__content">
        {activeView === "nuget" ? (
          <NuGetRegistryManager
            feeds={nugetFeeds}
            onCreateFeed={createNugetFeed}
            onTestFeed={testNugetFeed}
            onUpdateFeed={updateNugetFeed}
          />
        ) : activeView === "settings" ? (
          <SettingsPage
            theme={theme}
            onThemeChange={setTheme}
            fontFamily={fontFamily}
            onFontFamilyChange={setFontFamily}
            fontSize={fontSize}
            onFontSizeChange={setFontSize}
          />
        ) : activeView === "workspaces" ? (
          <WorkspacesPage
            workspaces={workspaces}
            activeWorkspace={workspace}
            onSelectWorkspace={handleSelectWorkspace}
            onCreateWorkspace={handleCreateWorkspace}
            onUpdateWorkspace={handleUpdateWorkspace}
            onDeleteWorkspace={handleDeleteWorkspace}
            onLoadWorkspace={loadWorkspace}
            onSaveWorkspace={saveCurrentWorkspace}
            onPickFile={pickFile}
            nugetFeeds={nugetFeeds}
            searchNugetPackages={searchNugetPackages}
            getNugetPackageVersions={getNugetPackageVersions}
          />
        ) : (
          <>
          <div className="workbench-tabs" role="tablist" aria-label="Open functions">
          {functionTabs.length > 0 ? (
            functionTabs.map((functionId) => {
              const tabFunction = findCatalogFunction(
                effectiveSourceCatalog,
                functionId,
              );
              const tabSource = findCatalogSource(
                effectiveSourceCatalog,
                tabFunction?.sourceId ?? null,
              );
              return (
                <div
                  aria-label={`${formatFunctionTabLabel(tabFunction, functionId)} ${formatFunctionTabContext(tabFunction, tabSource)}`}
                  aria-selected={selectedFunctionId === functionId}
                  className="workbench-tabs__tab"
                  key={functionId}
                  onClick={() => handleSelectFunction(functionId)}
                  role="tab"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      handleSelectFunction(functionId);
                    }
                  }}
                  title={formatFunctionTabContext(tabFunction, tabSource)}
                >
                  <span className="workbench-tabs__primary">
                    <span className="workbench-tabs__kind">RPC</span>
                    <span className="workbench-tabs__name">
                      {formatFunctionTabLabel(tabFunction, functionId)}
                    </span>
                  </span>
                  <button
                    aria-label={`Close ${formatFunctionTabLabel(tabFunction, functionId)}`}
                    className="workbench-tabs__close"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleCloseFunctionTab(functionId);
                    }}
                    type="button"
                  >
                    <X aria-hidden="true" width={12} height={12} />
                  </button>
                  <span className="workbench-tabs__meta">
                    {formatFunctionTabContext(tabFunction, tabSource)}
                  </span>
                </div>
              );
            })
          ) : (
            <div className="workbench-tabs__empty">Select a function from Sources</div>
          )}
          <button
            aria-label="Open a function from Sources"
            className="workbench-tabs__add"
            disabled
            type="button"
          >
            +
          </button>
        </div>
        <section className="workbench-tab-panel" aria-label="Function workbench">
          <RequestWorkbench
            grains={grains}
            onInvoke={handleInvoke}
            onSelectFunction={handleSelectFunction}
            onSelectGrain={setSelectedGrain}
            onSelectMethod={setSelectedMethod}
            selectedFunctionId={selectedFunctionId}
            selectedGrain={selectedGrain}
            selectedMethod={selectedMethod}
            sourceCatalog={effectiveSourceCatalog}
            theme={theme}
          />
          {isResponseVisible && (
            <div
              aria-label="Resize request and response panels"
              aria-orientation={
                paneLayout === "horizontal" ? "vertical" : "horizontal"
              }
              className="workbench-resizer"
              onMouseDown={handleResizeStart}
              role="separator"
              tabIndex={0}
            />
          )}
          {isResponseVisible && (
            <ResponseTelemetryPane
              activeTab={responseTab}
              onTabChange={setResponseTab}
              result={invocationResult}
              theme={theme}
              invocationHistory={invocationHistory}
              fontFamily={fontFamily}
              fontSize={fontSize}
            />
          )}
        </section>
        </>
        )}
      </main>
    </div>
  );
}

function formatFunctionTabLabel(
  catalogFunction: SourceCatalogFunction | null,
  fallback: string,
): string {
  if (!catalogFunction) {
    return fallback;
  }

  return catalogFunction.methodName || catalogFunction.signature;
}

function formatFunctionTabContext(
  catalogFunction: SourceCatalogFunction | null,
  source: { label: string } | null,
): string {
  if (!catalogFunction) {
    return "Function";
  }

  const sourceLabel = source?.label ? `${source.label} / ` : "";
  return `${sourceLabel}${catalogFunction.interfaceName}`;
}

function readStoredTheme(): WorkbenchTheme {
  if (typeof window === "undefined") {
    return "light";
  }

  const storedTheme = window.localStorage.getItem(themeStorageKey);
  return storedTheme === "light" || storedTheme === "dark"
    ? storedTheme
    : "light";
}

async function setActiveWorkspace(workspace: Workspace): Promise<boolean> {
  try {
    const response = await electroview.rpc!.request.setActiveWorkspace({
      workspace,
    });
    useAppStore.getState().setWorkspace(response.workspace);
    return true;
  } catch (error) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to set active workspace.",
    });
    return false;
  }
}

function upsertWorkspace(
  workspaces: Workspace[],
  workspace: Workspace,
): Workspace[] {
  const existingIndex = workspaces.findIndex(
    (candidate) => candidate.id === workspace.id,
  );
  if (existingIndex === -1) {
    return [...workspaces, workspace];
  }

  return workspaces.map((candidate, index) =>
    index === existingIndex ? workspace : candidate,
  );
}

async function refreshPersistedWorkspaces() {
  try {
    const response = await electroview.rpc!.request.getWorkspaces();
    const store = useAppStore.getState();
    const workspaces = response.workspaces;

    window.dispatchEvent(
      new CustomEvent<Workspace[]>("siloscope:workspaces-loaded", {
        detail: workspaces,
      }),
    );
    if (!store.workspace && workspaces.length > 0) {
      store.setWorkspace(workspaces[0]);
      await setActiveWorkspace(workspaces[0]);
    }
  } catch (error) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to load persisted workspaces.",
    });
  }
}

async function persistWorkspace(workspace: Workspace) {
  try {
    await electroview.rpc!.request.saveWorkspace({
      workspace,
      path: undefined,
    });
    await setActiveWorkspace(workspace);
    addWorkspaceToSession(workspace);
  } catch (error) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message:
        error instanceof Error ? error.message : "Failed to persist workspace.",
    });
  }
}

async function loadWorkspace(path?: string) {
  try {
    const response = await electroview.rpc!.request.loadWorkspace(
      path ? { path } : undefined,
    );
    const store = useAppStore.getState();

    store.setWorkspace(response.workspace);
    addWorkspaceToSession(response.workspace);
    store.setIsConnected(false);
    store.setInvocationResult(null);
    await refreshWorkspaceCatalog(response.workspace.id);
    store.addLog({
      timestamp: new Date().toISOString(),
      level: "info",
      message: `Workspace loaded: ${response.workspace.name}`,
    });
  } catch (error) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message:
        error instanceof Error ? error.message : "Failed to load workspace.",
    });
  }
}

function addWorkspaceToSession(workspace: Workspace) {
  window.dispatchEvent(
    new CustomEvent<Workspace>("siloscope:workspace-loaded", {
      detail: workspace,
    }),
  );
}

async function saveCurrentWorkspace(path?: string) {
  const workspace = useAppStore.getState().workspace;
  if (!workspace) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "warn",
      message: "No workspace loaded to save.",
    });
    return;
  }

  try {
    await electroview.rpc!.request.saveWorkspace({ workspace, path });
    addWorkspaceToSession(workspace);
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "info",
      message: `Workspace saved: ${workspace.name}`,
    });
  } catch (error) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message:
        error instanceof Error ? error.message : "Failed to save workspace.",
    });
  }
}

async function connectCluster() {
  const workspace = useAppStore.getState().workspace;
  if (!workspace) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "warn",
      message: "Load a workspace before connecting.",
    });
    return;
  }

  try {
    if (!(await setActiveWorkspace(workspace))) {
      return;
    }

    const response = await electroview.rpc!.request.connectCluster({
      workspace,
    });
    const store = useAppStore.getState();
    store.setIsConnected(true);
    store.addLog({
      timestamp: new Date().toISOString(),
      level: "info",
      message: response.message,
    });
    await refreshWorkspaceCatalog(workspace.id);
  } catch (error) {
    const store = useAppStore.getState();
    store.setIsConnected(false);
    store.addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message:
        error instanceof Error ? error.message : "Failed to connect cluster.",
    });
  }
}

async function disconnectCluster() {
  try {
    await electroview.rpc!.request.disconnectCluster();
    const store = useAppStore.getState();
    store.setIsConnected(false);
    store.addLog({
      timestamp: new Date().toISOString(),
      level: "info",
      message: "Cluster disconnected.",
    });
  } catch (error) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to disconnect cluster.",
    });
  }
}

async function refreshWorkspaceCatalog(workspaceId: string) {
  try {
    const workspace = useAppStore.getState().workspace;
    if (workspace) {
      if (!(await setActiveWorkspace(workspace))) {
        return;
      }
    }

    const response = await electroview.rpc!.request.discoverGrains({
      workspaceId,
    });
    const store = useAppStore.getState();

    store.setGrains(response.grains);
    store.setSourceCatalog(
      response.sourceCatalog ??
        buildSourceCatalogFromGrains(response.grains, store.workspace),
    );
  } catch (error) {
    const store = useAppStore.getState();
    store.setGrains([]);
    store.setSourceCatalog({ sources: [] });
    store.addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message:
        error instanceof Error
          ? error.message
          : "Failed to refresh workspace catalog.",
    });
  }
}

async function discoverWorkspaceGrains() {
  const workspace = useAppStore.getState().workspace;
  if (!workspace) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "warn",
      message: "Load a workspace before discovering grains.",
    });
    return;
  }

  await refreshWorkspaceCatalog(workspace.id);
}

function pickFile(options?: { allowedFileTypes?: string; canChooseFiles?: boolean; canChooseDirectory?: boolean; allowsMultipleSelection?: boolean }) {
  electroview.rpc!.send.openFileDialog({
    canChooseFiles: options?.canChooseFiles ?? true,
    canChooseDirectories: options?.canChooseDirectory ?? false,
    allowsMultipleSelection: options?.allowsMultipleSelection ?? false,
    allowedFileTypes: options?.allowedFileTypes,
  });
}

async function searchNugetPackages(query: string, feedName?: string, take?: number) {
  try {
    const response = await electroview.rpc!.request.searchNugetPackages({ query, feedName, take: take ?? 20 });
    return response.packages;
  } catch (error) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message: error instanceof Error ? error.message : "Failed to search NuGet packages.",
    });
    return [];
  }
}

async function getNugetPackageVersions(packageId: string, feedName?: string) {
  try {
    const response = await electroview.rpc!.request.getNugetPackageVersions({ packageId, feedName });
    return response.versions;
  } catch (error) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message: error instanceof Error ? error.message : "Failed to get NuGet package versions.",
    });
    return [];
  }
}

async function refreshNugetFeeds() {
  try {
    const response = await electroview.rpc!.request.listNugetFeeds();
    useAppStore.getState().setNugetFeeds(response.feeds);
  } catch (error) {
    useAppStore.getState().addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message:
        error instanceof Error ? error.message : "Failed to load NuGet feeds.",
    });
  }
}

async function createNugetFeed(request: {
  name: string;
  url: string;
  username?: string;
  password?: string;
}) {
  const response = await electroview.rpc!.request.createNugetFeed({
    ...request,
    isPasswordClearText: true,
  });
  const store = useAppStore.getState();
  store.setNugetFeeds([
    ...store.nugetFeeds.filter((feed) => feed.name !== response.feed.name),
    response.feed,
  ]);
}

async function testNugetFeed(request: {
  name: string;
  url: string;
  username?: string;
  password?: string;
}) {
  await electroview.rpc!.request.testNugetFeed({
    ...request,
    isPasswordClearText: true,
  });
}

async function updateNugetFeed(
  name: string,
  request: {
    name: string;
    url: string;
    username?: string;
    password?: string;
  },
) {
  const response = await electroview.rpc!.request.updateNugetFeed({
    name,
    feed: {
      ...request,
      isPasswordClearText: true,
    },
  });
  const store = useAppStore.getState();
  store.setNugetFeeds([
    ...store.nugetFeeds.filter((feed) => feed.name !== name && feed.name !== response.feed.name),
    response.feed,
  ]);
}

async function invokeGrain(request: GrainInvocationRequest) {
  try {
    const result = await electroview.rpc!.request.invokeGrain({
      grainType: request.grainType,
      method: request.method,
      grainKey: request.grainKey,
      payload: request.payload,
      sourceId: request.sourceId,
      functionId: request.functionId,
    });

    useAppStore.getState().setInvocationResult(result);
  } catch (error) {
    useAppStore.getState().setInvocationResult({
      isSuccess: false,
      error: error instanceof Error ? error.message : "Failed to invoke grain.",
    });
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default App;
