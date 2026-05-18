import { Electroview } from "electrobun/view";
import { type CSSProperties, type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { SiloScopeRPC } from "../shared/rpc";
import type { GrainKeyType } from "../shared/types";
import { ActivityBar, type ActivityView } from "./components/ActivityBar";
import { NavigationSidebar } from "./components/NavigationSidebar";
import { RequestWorkbench } from "./components/RequestWorkbench";
import { ResponseTelemetryPane, type ResponsePaneTab } from "./components/ResponseTelemetryPane";
import { buildSourceCatalogFromGrains, findCatalogFunction } from "./catalog";
import { useAppStore } from "./store";

type PaneLayout = "horizontal" | "vertical";
type WorkbenchTheme = "dark" | "light";

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
        window.dispatchEvent(new CustomEvent(applicationMenuEventName, { detail: action }));
        if (action === "newWorkspace") {
          resetWorkspaceState();
          return;
        }

        console.log("applicationMenuAction", action);
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
    logs,
    clearLogs,
    setSelectedGrain,
    setSelectedFunction,
    setSelectedMethod,
    sourceCatalog,
    workspace,
  } = useAppStore();
  const [activeView, setActiveView] = useState<ActivityView>("workspace");
  const [theme, setTheme] = useState<WorkbenchTheme>(() => readStoredTheme());
  const [isActivityBarVisible, setIsActivityBarVisible] = useState(true);
  const [isNavigationVisible, setIsNavigationVisible] = useState(true);
  const [isResponseVisible, setIsResponseVisible] = useState(true);
  const [responseTab, setResponseTab] = useState<ResponsePaneTab>("response");
  const [paneLayout, setPaneLayout] = useState<PaneLayout>("horizontal");
  const [horizontalResponseSize, setHorizontalResponseSize] = useState(320);
  const [verticalResponseSize, setVerticalResponseSize] = useState(260);
  const handleNewWorkspace = useCallback(() => resetWorkspaceState(), []);

  useEffect(() => {
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  useEffect(() => {
    const handleApplicationMenuAction = (event: Event) => {
      const action = (event as CustomEvent<string>).detail;
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

    window.addEventListener(applicationMenuEventName, handleApplicationMenuAction);
    return () => window.removeEventListener(applicationMenuEventName, handleApplicationMenuAction);
  }, []);

  const responseSize = paneLayout === "horizontal" ? horizontalResponseSize : verticalResponseSize;
  const effectiveSourceCatalog = useMemo(() => {
    return sourceCatalog.sources.length > 0 ? sourceCatalog : buildSourceCatalogFromGrains(grains, workspace);
  }, [grains, sourceCatalog, workspace]);

  useEffect(() => {
    if (!workspace) {
      return;
    }

    void refreshWorkspaceCatalog(workspace.id);
  }, [workspace?.id]);

  const handleSelectFunction = useCallback(
    (functionId: string | null) => {
      const selectedFunction = findCatalogFunction(effectiveSourceCatalog, functionId);

      if (!selectedFunction) {
        setSelectedFunction(null);
        setSelectedGrain(null);
        setSelectedMethod(null);
        return;
      }

      setSelectedGrain(selectedFunction.interfaceId);
      setSelectedMethod(selectedFunction.methodName);
      setSelectedFunction(selectedFunction.functionId);
    },
    [effectiveSourceCatalog, setSelectedFunction, setSelectedGrain, setSelectedMethod],
  );

  const shellStyle = {
    "--response-size": `${responseSize}px`,
  } as CSSProperties;

  const handleResizeStart = useCallback(
    (event: ReactMouseEvent<HTMLDivElement>) => {
      const container = event.currentTarget.parentElement;
      if (!container) {
        return;
      }

      event.preventDefault();
      const bounds = container.getBoundingClientRect();

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (paneLayout === "horizontal") {
          const nextSize = clamp(bounds.right - moveEvent.clientX, 180, bounds.width * 0.65);
          setHorizontalResponseSize(nextSize);
          return;
        }

        const nextSize = clamp(bounds.bottom - moveEvent.clientY, 180, bounds.height * 0.7);
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

  const handleInvoke = useCallback(
    (request: GrainInvocationRequest) => {
      setResponseTab("response");
      void invokeGrain(request);
    },
    [],
  );

  return (
    <div
      className="app-shell"
      data-activity-visible={isActivityBarVisible}
      data-navigation-visible={isNavigationVisible}
      data-pane-layout={paneLayout}
      data-response-visible={isResponseVisible}
      data-theme={theme}
      style={shellStyle}
    >
      {isActivityBarVisible && <ActivityBar activeView={activeView} onViewChange={setActiveView} />}

      <header className="app-titlebar electrobun-webkit-app-region-drag">
        <div className="app-titlebar__spacer" />
        <div className="app-titlebar__command">SiloScope</div>
        <div className="app-titlebar__actions">
          <button
            aria-label={isNavigationVisible ? "Collapse navigation panel" : "Expand navigation panel"}
            aria-pressed={!isNavigationVisible}
            className="titlebar-action titlebar-action--navigation electrobun-webkit-app-region-no-drag"
            onClick={() => setIsNavigationVisible((visible) => !visible)}
            title={isNavigationVisible ? "Collapse navigation panel" : "Expand navigation panel"}
            type="button"
          >
            <span aria-hidden="true" className="titlebar-navigation__icon" />
          </button>
          <button
            aria-label={paneLayout === "horizontal" ? "Stack request and response panels" : "Place request and response panels side by side"}
            aria-pressed={paneLayout === "vertical"}
            className="titlebar-action titlebar-action--layout electrobun-webkit-app-region-no-drag"
            onClick={() => setPaneLayout((layout) => (layout === "horizontal" ? "vertical" : "horizontal"))}
            title={paneLayout === "horizontal" ? "Stack request and response panels" : "Place request and response panels side by side"}
            type="button"
          >
            <span aria-hidden="true" className="titlebar-layout__icon" />
          </button>
          <button
            aria-label={isResponseVisible ? "Collapse response panel" : "Expand response panel"}
            aria-pressed={!isResponseVisible}
            className="titlebar-action titlebar-action--response electrobun-webkit-app-region-no-drag"
            onClick={() => setIsResponseVisible((visible) => !visible)}
            title={isResponseVisible ? "Collapse response panel" : "Expand response panel"}
            type="button"
          >
            <span aria-hidden="true" className="titlebar-response__icon" />
          </button>
          <button
            aria-label="Settings"
            aria-pressed={activeView === "settings"}
            className="titlebar-action titlebar-settings electrobun-webkit-app-region-no-drag"
            onClick={() => setActiveView("settings")}
            title="Settings"
            type="button"
          >
            <span aria-hidden="true" className="titlebar-settings__icon" />
          </button>
        </div>
      </header>

      {isNavigationVisible && (
        <NavigationSidebar
          activeView={activeView}
          grains={grains}
          isConnected={isConnected}
          logs={logs}
          onClearLogs={clearLogs}
          onSelectFunction={handleSelectFunction}
          onSelectGrain={setSelectedGrain}
          onNewWorkspace={handleNewWorkspace}
          onThemeChange={setTheme}
          selectedFunctionId={selectedFunctionId}
          selectedGrain={selectedGrain}
          sourceCatalog={effectiveSourceCatalog}
          theme={theme}
          workspace={workspace}
        />
      )}

      <main className="app-shell__content">
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
            aria-orientation={paneLayout === "horizontal" ? "vertical" : "horizontal"}
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
          />
        )}
      </main>
    </div>
  );
}

function readStoredTheme(): WorkbenchTheme {
  if (typeof window === "undefined") {
    return "dark";
  }

  const storedTheme = window.localStorage.getItem(themeStorageKey);
  return storedTheme === "light" || storedTheme === "dark" ? storedTheme : "dark";
}

function resetWorkspaceState() {
  const store = useAppStore.getState();
  store.setWorkspace(null);
  store.setGrains([]);
  store.setSourceCatalog({ sources: [] });
  store.setSelectedFunction(null);
  store.setInvocationResult(null);
}

async function refreshWorkspaceCatalog(workspaceId: string) {
  try {
    const response = await electroview.rpc!.request.getGrains({ workspaceId });
    const store = useAppStore.getState();

    store.setGrains(response.grains);
    store.setSourceCatalog(response.sourceCatalog ?? buildSourceCatalogFromGrains(response.grains, store.workspace));
  } catch (error) {
    const store = useAppStore.getState();
    store.setGrains([]);
    store.setSourceCatalog({ sources: [] });
    store.addLog({
      timestamp: new Date().toISOString(),
      level: "error",
      message: error instanceof Error ? error.message : "Failed to refresh workspace catalog.",
    });
  }
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
