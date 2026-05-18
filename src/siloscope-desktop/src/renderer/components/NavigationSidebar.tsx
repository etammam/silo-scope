import { useMemo, useState } from "react";
import type { ActivityView } from "./ActivityBar";
import type {
  GrainInterfaceDescriptor,
  LogEntry,
  SourceCatalogInterface,
  SourceCatalogSource,
  SourceOwnedCatalog,
  Workspace,
} from "../../shared/types";
import { buildSourceCatalogFromGrains } from "../catalog";

type NavigationSidebarProps = {
  activeView: ActivityView;
  theme: "dark" | "light";
  logs?: LogEntry[];
  onClearLogs?: () => void;
  onThemeChange: (theme: "dark" | "light") => void;
} & WorkspaceNavigatorProps;

type WorkspaceNavigatorProps = {
  grains: GrainInterfaceDescriptor[];
  isConnected: boolean;
  sourceCatalog?: SourceOwnedCatalog;
  selectedFunctionId?: string | null;
  selectedGrain: string | null;
  workspace: Workspace | null;
  onNewWorkspace?: () => void;
  onSelectFunction?: (functionId: string | null) => void;
  onSelectGrain: (grainId: string | null) => void;
};

export function NavigationSidebar({
  activeView,
  grains,
  isConnected,
  logs = [],
  onClearLogs,
  onNewWorkspace,
  onSelectFunction,
  selectedGrain,
  selectedFunctionId,
  sourceCatalog,
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
          onNewWorkspace={onNewWorkspace}
          onSelectFunction={onSelectFunction}
          onSelectGrain={onSelectGrain}
          selectedFunctionId={selectedFunctionId}
          selectedGrain={selectedGrain}
          sourceCatalog={sourceCatalog}
          workspace={workspace}
        />
      )}

      {activeView === "nuget" && <NuGetRegistryManager />}

      {activeView === "settings" && (
        <SystemSettings
          logs={logs}
          onClearLogs={onClearLogs}
          onThemeChange={onThemeChange}
          theme={theme}
        />
      )}
    </aside>
  );
}

function WorkspaceNavigator({
  grains,
  isConnected,
  onNewWorkspace,
  onSelectFunction,
  selectedGrain,
  selectedFunctionId,
  sourceCatalog,
  workspace,
  onSelectGrain,
}: WorkspaceNavigatorProps) {
  const catalog = useMemo(
    () => sourceCatalog ?? buildSourceCatalogFromGrains(grains, workspace),
    [grains, sourceCatalog, workspace],
  );
  const [catalogQuery, setCatalogQuery] = useState("");
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(() => new Set());
  const [collapsedInterfaces, setCollapsedInterfaces] = useState<Set<string>>(() => new Set());
  const [disabledSourceIds, setDisabledSourceIds] = useState<Set<string>>(() => new Set());

  const filteredSources = useMemo(
    () =>
      filterCatalogSources(
        catalog.sources.map((source) => ({
          ...source,
          enabled: source.enabled && !disabledSourceIds.has(source.sourceId),
        })),
        catalogQuery,
      ),
    [catalog.sources, catalogQuery, disabledSourceIds],
  );

  const toggleSource = (sourceId: string) => {
    setCollapsedSources((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const toggleSourceEnabled = (sourceId: string) => {
    setDisabledSourceIds((current) => {
      const next = new Set(current);
      if (next.has(sourceId)) {
        next.delete(sourceId);
      } else {
        next.add(sourceId);
      }
      return next;
    });
  };

  const toggleInterface = (sourceId: string, interfaceId: string) => {
    const key = `${sourceId}:${interfaceId}`;
    setCollapsedInterfaces((current) => {
      const next = new Set(current);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  return (
    <>
      <section className="navigation-sidebar__section" aria-labelledby="workspace-select-title">
        <div className="navigation-sidebar__section-heading">
          <div className="navigation-sidebar__section-title" id="workspace-select-title">
            Workspace
          </div>
          <button
            aria-label="New workspace"
            className="navigation-sidebar__icon-command"
            disabled={!onNewWorkspace}
            onClick={onNewWorkspace}
            title="New workspace"
            type="button"
          >
            <span className="navigation-sidebar__new-workspace-icon" aria-hidden="true" />
          </button>
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

      <section className="navigation-sidebar__section" aria-labelledby="source-catalog-title">
        <div className="navigation-sidebar__section-title" id="source-catalog-title">
          Function Catalog
        </div>
        <label className="navigation-sidebar__select-label">
          <span>Search catalog</span>
          <input
            aria-label="Search catalog"
            placeholder="Source, interface, method"
            value={catalogQuery}
            onChange={(event) => setCatalogQuery(event.target.value)}
          />
        </label>
        {filteredSources.length > 0 ? (
          <ul className="navigation-sidebar__tree navigation-sidebar__catalog">
            {filteredSources.map((source) => (
              <li key={source.sourceId}>
                <div className="navigation-sidebar__source-row">
                  <input
                    aria-label={`${source.label} enabled`}
                    checked={source.enabled}
                    onChange={() => toggleSourceEnabled(source.sourceId)}
                    type="checkbox"
                  />
                  <button
                    aria-label={`${source.label} ${source.interfaces.length}`}
                    aria-expanded={!collapsedSources.has(source.sourceId)}
                    className="navigation-sidebar__source"
                    onClick={() => toggleSource(source.sourceId)}
                    type="button"
                  >
                    <span className="navigation-sidebar__disclosure" aria-hidden="true" />
                    <span className="navigation-sidebar__source-main">
                      <span className="navigation-sidebar__source-name">{source.label}</span>
                      <span className="navigation-sidebar__source-meta">
                        <span className="navigation-sidebar__source-type">{source.sourceType}</span>
                        <span>{formatSourceDetail(source)}</span>
                      </span>
                    </span>
                    <small>{source.discoveryStatus}</small>
                  </button>
                </div>
                {!collapsedSources.has(source.sourceId) && (
                  <SourceInterfaceTree
                    collapsedInterfaces={collapsedInterfaces}
                    onSelectFunction={onSelectFunction}
                    onSelectGrain={onSelectGrain}
                    onToggleInterface={toggleInterface}
                    selectedFunctionId={selectedFunctionId}
                    selectedGrain={selectedGrain}
                    source={source}
                  />
                )}
              </li>
            ))}
          </ul>
        ) : (
          <div className="navigation-sidebar__empty">
            {workspace ? "No functions discovered" : "No workspace loaded"}
          </div>
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

function SourceInterfaceTree({
  collapsedInterfaces,
  onSelectFunction,
  onSelectGrain,
  onToggleInterface,
  selectedFunctionId,
  selectedGrain,
  source,
}: {
  collapsedInterfaces: Set<string>;
  onSelectFunction?: (functionId: string | null) => void;
  onSelectGrain: (grainId: string | null) => void;
  onToggleInterface: (sourceId: string, interfaceId: string) => void;
  selectedFunctionId?: string | null;
  selectedGrain: string | null;
  source: SourceCatalogSource;
}) {
  if (source.interfaces.length === 0) {
    return <div className="navigation-sidebar__empty navigation-sidebar__empty--nested">No functions discovered</div>;
  }

  return (
    <ul className="navigation-sidebar__tree navigation-sidebar__tree--nested">
      {source.interfaces.map((catalogInterface) => {
        const key = `${source.sourceId}:${catalogInterface.interfaceId}`;
        const isCollapsed = collapsedInterfaces.has(key);

        return (
          <li key={catalogInterface.interfaceId}>
            <button
              aria-label={`${catalogInterface.interfaceName} ${catalogInterface.methods.length}`}
              aria-expanded={!isCollapsed}
              className="navigation-sidebar__interface"
              onClick={() => onToggleInterface(source.sourceId, catalogInterface.interfaceId)}
              type="button"
            >
              <span className="navigation-sidebar__disclosure" aria-hidden="true" />
              <span>
                <span>{catalogInterface.interfaceName}</span>
                <small>{catalogInterface.namespace}</small>
              </span>
              <small>{catalogInterface.methods.length}</small>
            </button>
            {!isCollapsed && (
              <ul className="navigation-sidebar__tree navigation-sidebar__tree--nested navigation-sidebar__tree--methods">
                {catalogInterface.methods.map((method) => (
                  <li key={method.functionId}>
                    <button
                      aria-pressed={
                        selectedFunctionId ? selectedFunctionId === method.functionId : selectedGrain === method.interfaceId
                      }
                      onClick={() => {
                        onSelectFunction?.(method.functionId);
                        if (!onSelectFunction) {
                          onSelectGrain(method.interfaceId);
                        }
                      }}
                      type="button"
                    >
                      <span className="navigation-sidebar__grain-icon" aria-hidden="true" />
                      <span>{method.signature}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        );
      })}
    </ul>
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
  logs,
  onClearLogs,
  onThemeChange,
  theme,
}: {
  logs: LogEntry[];
  onClearLogs?: () => void;
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

      <section className="navigation-sidebar__section" aria-labelledby="settings-logs-title">
        <div className="navigation-sidebar__section-heading">
          <div className="navigation-sidebar__section-title" id="settings-logs-title">
            Logs
          </div>
          <button
            className="navigation-sidebar__mini-command"
            disabled={logs.length === 0 || !onClearLogs}
            onClick={onClearLogs}
            type="button"
          >
            Clear
          </button>
        </div>
        {logs.length > 0 ? (
          <ol className="navigation-sidebar__logs" aria-label="Core logs">
            {logs.slice(-8).map((entry, index) => (
              <li
                className="navigation-sidebar__log-entry"
                data-level={entry.level}
                key={`${entry.timestamp}-${index}`}
              >
                <span className="navigation-sidebar__log-level">{entry.level}</span>
                <span className="navigation-sidebar__log-message">{entry.message}</span>
                <time>{formatLogTime(entry.timestamp)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="navigation-sidebar__empty">No logs captured</div>
        )}
      </section>
    </>
  );
}

function formatLogTime(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatViewTitle(view: ActivityView): string {
  if (view === "nuget") {
    return "NuGet";
  }

  return view;
}

function filterCatalogSources(sources: SourceCatalogSource[], query: string): SourceCatalogSource[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return sources;
  }

  return sources.flatMap((source) => {
    const sourceMatches = matchesSource(source, normalizedQuery);
    const interfaces = source.interfaces.flatMap((catalogInterface) => {
      const interfaceMatches = matchesInterface(catalogInterface, normalizedQuery);
      const methods = catalogInterface.methods.filter((method) => {
        return (
          sourceMatches ||
          interfaceMatches ||
          method.methodName.toLowerCase().includes(normalizedQuery) ||
          method.signature.toLowerCase().includes(normalizedQuery) ||
          method.returnType.toLowerCase().includes(normalizedQuery) ||
          method.parameters.some((parameter) =>
            `${parameter.name} ${parameter.typeName}`.toLowerCase().includes(normalizedQuery),
          )
        );
      });

      return methods.length > 0 || interfaceMatches
        ? [
            {
              ...catalogInterface,
              methods: methods.length > 0 ? methods : catalogInterface.methods,
            },
          ]
        : [];
    });

    if (sourceMatches || interfaces.length > 0) {
      return [
        {
          ...source,
          interfaces: interfaces.length > 0 ? interfaces : source.interfaces,
        },
      ];
    }

    return [];
  });
}

function matchesSource(source: SourceCatalogSource, query: string): boolean {
  return `${source.label} ${source.reference} ${source.version ?? ""} ${source.sourceType}`
    .toLowerCase()
    .includes(query);
}

function matchesInterface(catalogInterface: SourceCatalogInterface, query: string): boolean {
  return `${catalogInterface.namespace} ${catalogInterface.interfaceName}`.toLowerCase().includes(query);
}

function formatSourceDetail(source: SourceCatalogSource): string {
  return source.version ? `${source.reference} @ ${source.version}` : source.reference;
}
