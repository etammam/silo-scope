import { Electroview } from "electrobun/view";
import { type CSSProperties, type MouseEvent as ReactMouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import type { SiloScopeRPC } from "../shared/rpc";
import { ActivityBar, type ActivityView } from "./components/ActivityBar";
import { NavigationSidebar } from "./components/NavigationSidebar";
import { RequestWorkbench } from "./components/RequestWorkbench";
import { ResponseTelemetryPane, type ResponsePaneTab } from "./components/ResponseTelemetryPane";
import { buildSourceCatalogFromGrains, findCatalogFunction } from "./catalog";
import { useAppStore } from "./store";

type PaneLayout = "horizontal" | "vertical";
type WorkbenchTheme = "dark" | "light";

const themeStorageKey = "siloscope.theme";

Electroview.defineRPC<SiloScopeRPC>({
  handlers: {
    requests: {
      setWorkspace: ({ workspace }) => {
        useAppStore.getState().setWorkspace(workspace);
        return true;
      },
    },
    messages: {
      requestGrains: ({ workspaceId }) => {
        console.log("requestGrains for", workspaceId);
      },
    },
  },
});

function App() {
  const {
    grains,
    invocationResult,
    isConnected,
    selectedGrain,
    selectedFunctionId,
    selectedMethod,
    setInvocationResult,
    setSelectedGrain,
    setSelectedFunction,
    setSelectedMethod,
    sourceCatalog,
    workspace,
  } = useAppStore();
  const [activeView, setActiveView] = useState<ActivityView>("workspace");
  const [theme, setTheme] = useState<WorkbenchTheme>(() => readStoredTheme());
  const [isNavigationVisible, setIsNavigationVisible] = useState(true);
  const [isResponseVisible, setIsResponseVisible] = useState(true);
  const [responseTab, setResponseTab] = useState<ResponsePaneTab>("response");
  const [paneLayout, setPaneLayout] = useState<PaneLayout>("horizontal");
  const [horizontalResponseSize, setHorizontalResponseSize] = useState(320);
  const [verticalResponseSize, setVerticalResponseSize] = useState(260);

  useEffect(() => {
    window.localStorage.setItem(themeStorageKey, theme);
  }, [theme]);

  const responseSize = paneLayout === "horizontal" ? horizontalResponseSize : verticalResponseSize;
  const effectiveSourceCatalog = useMemo(() => {
    return sourceCatalog.sources.length > 0 ? sourceCatalog : buildSourceCatalogFromGrains(grains, workspace);
  }, [grains, sourceCatalog, workspace]);

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

  return (
    <div
      className="app-shell"
      data-navigation-visible={isNavigationVisible}
      data-pane-layout={paneLayout}
      data-response-visible={isResponseVisible}
      data-theme={theme}
      style={shellStyle}
    >
      <ActivityBar activeView={activeView} onViewChange={setActiveView} />

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
          onSelectFunction={handleSelectFunction}
          onSelectGrain={setSelectedGrain}
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
          onInvoke={(request) => {
            setInvocationResult({
              isSuccess: false,
              error: `Invocation pending: ${request.grainType}.${request.method}`,
            });
          }}
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

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export default App;
