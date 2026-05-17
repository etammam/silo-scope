import type { ActivityView } from "./ActivityBar";
import type { GrainInterfaceDescriptor, Workspace } from "../../shared/types";

type NavigationSidebarProps = {
  activeView: ActivityView;
  grains: GrainInterfaceDescriptor[];
  isConnected: boolean;
  selectedGrain: string | null;
  workspace: Workspace | null;
  onSelectGrain: (grainId: string | null) => void;
};

export function NavigationSidebar({
  activeView,
  grains,
  isConnected,
  selectedGrain,
  workspace,
  onSelectGrain,
}: NavigationSidebarProps) {
  return (
    <aside className="navigation-sidebar" aria-label={`${activeView} navigation`}>
      <div className="navigation-sidebar__header">
        <span>{activeView}</span>
      </div>

      <section className="navigation-sidebar__section" aria-labelledby="workspace-select-title">
        <div className="navigation-sidebar__section-title" id="workspace-select-title">
          Workspace
        </div>
        <label className="navigation-sidebar__select-label">
          <span>Active workspace</span>
          <select value={workspace?.id ?? "none"} disabled={!workspace}>
            <option value="none">No workspace loaded</option>
            {workspace && <option value={workspace.id}>{workspace.name}</option>}
          </select>
        </label>
      </section>

      <section className="navigation-sidebar__section" aria-labelledby="silo-registry-title">
        <div className="navigation-sidebar__section-title" id="silo-registry-title">
          Silo Registry
        </div>
        {workspace ? (
          <label className="navigation-sidebar__check-row">
            <input type="checkbox" defaultChecked />
            <span>{workspace.siloAddress}:{workspace.gatewayPort}</span>
          </label>
        ) : (
          <div className="navigation-sidebar__empty">No silo sources</div>
        )}
      </section>

      <section className="navigation-sidebar__section" aria-labelledby="grains-tree-title">
        <div className="navigation-sidebar__section-title" id="grains-tree-title">
          Discovered Grains
        </div>
        {grains.length > 0 ? (
          <ul className="navigation-sidebar__tree">
            {grains.map((grain) => (
              <li key={grain.interfaceId}>
                <button
                  aria-pressed={selectedGrain === grain.interfaceId}
                  onClick={() => onSelectGrain(grain.interfaceId)}
                  type="button"
                >
                  <span className="navigation-sidebar__grain-icon" aria-hidden="true" />
                  <span>{grain.interfaceName}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="navigation-sidebar__empty">No grains discovered</div>
        )}
      </section>

      <section className="navigation-sidebar__section" aria-labelledby="connection-title">
        <div className="navigation-sidebar__section-title" id="connection-title">
          Connection
        </div>
        <div className="navigation-sidebar__row">
          <span className="navigation-sidebar__dot" />
          <span>{isConnected ? "Connected" : "Disconnected"}</span>
        </div>
      </section>
    </aside>
  );
}
