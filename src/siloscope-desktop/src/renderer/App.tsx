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

  return (
    <div className="app-shell">
      <ActivityBar activeView={activeView} onViewChange={setActiveView} />

      <header className="app-titlebar electrobun-webkit-app-region-drag">
        <div className="app-titlebar__spacer" />
        <div className="app-titlebar__command">SiloScope</div>
        <div className="app-titlebar__actions">
          <button
            aria-label="Settings"
            aria-pressed={activeView === "settings"}
            className="titlebar-settings electrobun-webkit-app-region-no-drag"
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
        selectedGrain={selectedGrain}
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
        />
        <ResponseTelemetryPane result={invocationResult} />
      </main>
    </div>
  );
}

export default App;
