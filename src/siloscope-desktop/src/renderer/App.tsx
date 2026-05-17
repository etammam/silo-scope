import { Electroview } from "electrobun/view";
import { useState } from "react";
import type { SiloScopeRPC } from "../shared/rpc";
import { ActivityBar, type ActivityView } from "./components/ActivityBar";
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
  const { workspace, isConnected } = useAppStore();
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

      <aside className="navigation-sidebar" aria-label={`${activeView} navigation`}>
        <div className="navigation-sidebar__header">
          <span>{activeView}</span>
        </div>

        <div className="navigation-sidebar__section">
          <div className="navigation-sidebar__section-title">Connection</div>
          <div className="navigation-sidebar__row">
            <span className="navigation-sidebar__dot" />
            <span>{isConnected ? "Connected" : "Disconnected"}</span>
          </div>
        </div>

        <div className="navigation-sidebar__section">
          <div className="navigation-sidebar__section-title">Workspace</div>
          <div className="navigation-sidebar__row">
            <span className="navigation-sidebar__file-icon" />
            <span>{workspace?.name ?? "No workspace loaded"}</span>
          </div>
        </div>
      </aside>

      <main className="app-shell__content">
        <section className="workspace-summary" aria-labelledby="workspace-summary-title">
          <div className="workspace-summary__toolbar">
            <span>{activeView}</span>
            <button type="button">Open Workspace</button>
          </div>

          <div className="workspace-summary__body">
            <p className="workspace-summary__eyebrow">Orleans Workbench</p>
            <h1 id="workspace-summary-title">Ready to inspect a cluster</h1>
            <p className="workspace-summary__subtitle">
              Load a workspace to discover grains, connect gateways, and invoke methods.
            </p>

            <dl className="workspace-summary__status">
              <div>
                <dt>Connection</dt>
                <dd>{isConnected ? "Connected" : "Disconnected"}</dd>
              </div>
              <div>
                <dt>Workspace</dt>
                <dd>{workspace?.name ?? "No workspace loaded"}</dd>
              </div>
            </dl>

            <div className="workspace-summary__quickstart" aria-label="Quick actions">
              <button type="button">
                <span className="quickstart-icon quickstart-icon--folder" aria-hidden="true" />
                <span>
                  <strong>Open workspace</strong>
                  <small>Load a portable SiloScope workspace file</small>
                </span>
              </button>
              <button type="button">
                <span className="quickstart-icon quickstart-icon--plug" aria-hidden="true" />
                <span>
                  <strong>Connect cluster</strong>
                  <small>Attach to a running Orleans gateway</small>
                </span>
              </button>
              <button type="button">
                <span className="quickstart-icon quickstart-icon--grain" aria-hidden="true" />
                <span>
                  <strong>Discover grains</strong>
                  <small>Reflect DLL or package interfaces</small>
                </span>
              </button>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
