import { useMemo, useState } from "react";
import type { ActivityView } from "./ActivityBar";
import type { GrainInterfaceDescriptor, Workspace } from "../../shared/types";

type NavigationSidebarProps = {
  activeView: ActivityView;
  theme: "dark" | "light";
  onThemeChange: (theme: "dark" | "light") => void;
} & WorkspaceNavigatorProps;

type WorkspaceNavigatorProps = {
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
  theme,
  workspace,
  onSelectGrain,
  onThemeChange,
}: NavigationSidebarProps) {
  const title = formatViewTitle(activeView);

  return (
    <aside className="navigation-sidebar" aria-label={`${activeView} navigation`}>
      <div className="navigation-sidebar__header">
        <span>{title}</span>
      </div>

      {activeView === "workspace" && (
        <WorkspaceNavigator
          grains={grains}
          isConnected={isConnected}
          onSelectGrain={onSelectGrain}
          selectedGrain={selectedGrain}
          workspace={workspace}
        />
      )}

      {activeView === "nuget" && <NuGetRegistryManager />}

      {activeView === "settings" && <SystemSettings onThemeChange={onThemeChange} theme={theme} />}
    </aside>
  );
}

function WorkspaceNavigator({
  grains,
  isConnected,
  selectedGrain,
  workspace,
  onSelectGrain,
}: WorkspaceNavigatorProps) {
  const grainGroups = useMemo(() => groupGrainsByNamespace(grains), [grains]);
  const [collapsedNamespaces, setCollapsedNamespaces] = useState<Set<string>>(() => new Set());

  const toggleNamespace = (namespaceName: string) => {
    setCollapsedNamespaces((current) => {
      const next = new Set(current);
      if (next.has(namespaceName)) {
        next.delete(namespaceName);
      } else {
        next.add(namespaceName);
      }
      return next;
    });
  };

  return (
    <>
      <section className="navigation-sidebar__section" aria-labelledby="workspace-select-title">
        <div className="navigation-sidebar__section-title" id="workspace-select-title">
          Workspace
        </div>
        <label className="navigation-sidebar__select-label">
          <span>Active workspace</span>
          <select value={workspace?.id ?? "none"} disabled={!workspace} onChange={() => undefined}>
            <option value="none">No workspace loaded</option>
            {workspace && <option value={workspace.id}>{workspace.name}</option>}
          </select>
        </label>
        <div className="navigation-sidebar__command-row">
          <button className="navigation-sidebar__command" type="button">
            Import
          </button>
          <button className="navigation-sidebar__command" type="button" disabled={!workspace}>
            Export
          </button>
        </div>
      </section>

      <section className="navigation-sidebar__section" aria-labelledby="silo-registry-title">
        <div className="navigation-sidebar__section-title" id="silo-registry-title">
          Silo Registry
        </div>
        {workspace ? (
          <div className="navigation-sidebar__sources">
            <label className="navigation-sidebar__check-row">
              <input type="checkbox" defaultChecked />
              <span className="navigation-sidebar__source-type">DLL</span>
              <span>{workspace.siloAddress}:{workspace.gatewayPort}</span>
            </label>
            <label className="navigation-sidebar__check-row">
              <input type="checkbox" defaultChecked />
              <span className="navigation-sidebar__source-type">NuGet</span>
              <span>nuget.org</span>
            </label>
          </div>
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
            {grainGroups.map((group) => (
              <li key={group.namespaceName}>
                <button
                  aria-label={`${group.namespaceName} ${group.grains.length}`}
                  aria-expanded={!collapsedNamespaces.has(group.namespaceName)}
                  className="navigation-sidebar__namespace"
                  onClick={() => toggleNamespace(group.namespaceName)}
                  type="button"
                >
                  <span className="navigation-sidebar__disclosure" aria-hidden="true" />
                  <span>{group.namespaceName}</span>
                  <small>{group.grains.length}</small>
                </button>
                {!collapsedNamespaces.has(group.namespaceName) && (
                  <ul className="navigation-sidebar__tree navigation-sidebar__tree--nested">
                    {group.grains.map((grain) => (
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
                )}
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
    </>
  );
}

function NuGetRegistryManager() {
  return (
    <>
      <section className="navigation-sidebar__section" aria-labelledby="nuget-sources-title">
        <div className="navigation-sidebar__section-title" id="nuget-sources-title">
          Package Sources
        </div>
        <label className="navigation-sidebar__select-label">
          <span>Active source</span>
          <select defaultValue="nuget">
            <option value="nuget">nuget.org</option>
          </select>
        </label>
      </section>

      <section className="navigation-sidebar__section" aria-labelledby="nuget-search-title">
        <div className="navigation-sidebar__section-title" id="nuget-search-title">
          Registry Search
        </div>
        <label className="navigation-sidebar__select-label">
          <span>Package ID</span>
          <input placeholder="Orleans package" />
        </label>
        <button className="navigation-sidebar__command" type="button">
          Search Packages
        </button>
      </section>

      <section className="navigation-sidebar__section" aria-labelledby="nuget-results-title">
        <div className="navigation-sidebar__section-title" id="nuget-results-title">
          Results
        </div>
        <div className="navigation-sidebar__empty">No packages loaded</div>
      </section>
    </>
  );
}

function SystemSettings({
  onThemeChange,
  theme,
}: {
  onThemeChange: (theme: "dark" | "light") => void;
  theme: "dark" | "light";
}) {
  return (
    <>
      <section className="navigation-sidebar__section" aria-labelledby="settings-app-title">
        <div className="navigation-sidebar__section-title" id="settings-app-title">
          Application
        </div>
        <label className="navigation-sidebar__check-row">
          <input type="checkbox" defaultChecked />
          <span>Use native titlebar</span>
        </label>
        <label className="navigation-sidebar__check-row">
          <input type="checkbox" defaultChecked />
          <span>Disable text selection</span>
        </label>
      </section>

      <section className="navigation-sidebar__section" aria-labelledby="settings-core-title">
        <div className="navigation-sidebar__section-title" id="settings-core-title">
          Core Sidecar
        </div>
        <div className="navigation-sidebar__row">
          <span className="navigation-sidebar__file-icon" />
          <span>Auto discover executable</span>
        </div>
        <button className="navigation-sidebar__command" type="button">
          Choose Executable
        </button>
      </section>

      <section className="navigation-sidebar__section" aria-labelledby="settings-theme-title">
        <div className="navigation-sidebar__section-title" id="settings-theme-title">
          Theme
        </div>
        <label className="navigation-sidebar__select-label">
          <span>Workbench theme</span>
          <select
            value={theme}
            onChange={(event) => onThemeChange(event.target.value as "dark" | "light")}
          >
            <option value="dark">Codex Dark</option>
            <option value="light">Codex Light</option>
          </select>
        </label>
      </section>
    </>
  );
}

function formatViewTitle(view: ActivityView): string {
  if (view === "nuget") {
    return "NuGet";
  }

  return view;
}

function groupGrainsByNamespace(grains: GrainInterfaceDescriptor[]) {
  const groups = new Map<string, GrainInterfaceDescriptor[]>();

  for (const grain of grains) {
    const namespaceName = getNamespaceName(grain.interfaceName);
    groups.set(namespaceName, [...(groups.get(namespaceName) ?? []), grain]);
  }

  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([namespaceName, groupedGrains]) => ({
      namespaceName,
      grains: groupedGrains.sort((left, right) => left.interfaceName.localeCompare(right.interfaceName)),
    }));
}

function getNamespaceName(interfaceName: string): string {
  const lastDot = interfaceName.lastIndexOf(".");
  return lastDot > 0 ? interfaceName.slice(0, lastDot) : "Application";
}
