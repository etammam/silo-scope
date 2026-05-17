import { Electroview } from "electrobun/view";
import { useState } from "react";
import type { SiloScopeRPC } from "../shared/rpc";
import { ActivityBar, type ActivityView } from "./components/ActivityBar";
import { NavigationSidebar } from "./components/NavigationSidebar";
import { RequestWorkbench } from "./components/RequestWorkbench";
import { ResponseTelemetryPane } from "./components/ResponseTelemetryPane";
import { useAppStore } from "./store";

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
    selectedMethod,
    setInvocationResult,
    setSelectedGrain,
    setSelectedMethod,
    workspace,
  } = useAppStore();
  const [activeView, setActiveView] = useState<ActivityView>("workspace");
  const [theme, setTheme] = useState<"dark" | "light">("dark");
  const [isResponseVisible, setIsResponseVisible] = useState(true);

  return (
    <div className="app-shell" data-response-visible={isResponseVisible} data-theme={theme}>
      <ActivityBar activeView={activeView} onViewChange={setActiveView} />

      <header className="app-titlebar electrobun-webkit-app-region-drag">
        <div className="app-titlebar__spacer" />
        <div className="app-titlebar__command">SiloScope</div>
        <div className="app-titlebar__actions">
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

      <NavigationSidebar
        activeView={activeView}
        grains={grains}
        isConnected={isConnected}
        onSelectGrain={setSelectedGrain}
        onThemeChange={setTheme}
        selectedGrain={selectedGrain}
        theme={theme}
        workspace={workspace}
      />

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
          selectedGrain={selectedGrain}
          selectedMethod={selectedMethod}
          theme={theme}
        />
        {isResponseVisible && <ResponseTelemetryPane result={invocationResult} theme={theme} />}
      </main>
    </div>
  );
}

export default App;
