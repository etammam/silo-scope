import { Electroview } from "electrobun/view";
import type { SiloScopeRPC } from "../shared/rpc";
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

  return (
    <div className="container">
      <h1>SiloScope</h1>
      <p className="subtitle">Orleans Cluster Dashboard</p>

      <div className="welcome-section">
        <h2>Connection Status</h2>
        <p>Connected: {isConnected ? "Yes" : "No"}</p>
        {workspace && <p>Workspace: {workspace.name}</p>}
      </div>
    </div>
  );
}

export default App;