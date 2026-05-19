import { useMemo, useState } from "react";
import { ChevronRight, ChevronDown } from "lucide-react";
import type {
  GrainInterfaceDescriptor,
  LogEntry,
  NugetFeed,
  SourceCatalogInterface,
  SourceCatalogSource,
  SourceOwnedCatalog,
  Workspace,
} from "../../shared/types";
import { buildSourceCatalogFromGrains } from "../catalog";
import type { ActivityView } from "./ActivityBar";

const defaultNugetFeed: NugetFeed = {
  name: "nuget.org",
  url: "https://api.nuget.org/v3/index.json",
  hasCredentials: false,
  isDefault: true,
};

type NavigationSidebarProps = {
  activeView: ActivityView;
  theme: "dark" | "light" | "vscode-dark" | "vscode-light";
  logs?: LogEntry[];
  onClearLogs?: () => void;
  onConnectCluster?: () => Promise<void>;
  onDisconnectCluster?: () => Promise<void>;
  onDiscoverGrains?: () => Promise<void>;
  onLoadWorkspace?: () => Promise<void>;
  onSaveWorkspace?: () => Promise<void>;
  onThemeChange: (theme: "dark" | "light" | "vscode-dark" | "vscode-light") => void;
} & WorkspaceNavigatorProps;

type WorkspaceNavigatorProps = {
  grains: GrainInterfaceDescriptor[];
  isConnected: boolean;
  sourceCatalog?: SourceOwnedCatalog;
  selectedFunctionId?: string | null;
  selectedGrain: string | null;
  workspace: Workspace | null;
  workspaces?: Workspace[];
  onConnectCluster?: () => Promise<void>;
  onDisconnectCluster?: () => Promise<void>;
  onDiscoverGrains?: () => Promise<void>;
  onLoadWorkspace?: () => Promise<void>;
  onNewWorkspace?: () => void;
  onSaveWorkspace?: () => Promise<void>;
  onSelectWorkspace?: (workspaceId: string) => void;
  onEditWorkspace?: () => void;
  onSelectFunction?: (functionId: string | null) => void;
  onSelectGrain: (grainId: string | null) => void;
};

export function NavigationSidebar({
  activeView,
  grains,
  isConnected,
  logs = [],
  onClearLogs,
  onConnectCluster,
  onDisconnectCluster,
  onDiscoverGrains,
  onLoadWorkspace,
  onNewWorkspace,
  onSaveWorkspace,
  onSelectWorkspace,
  onEditWorkspace,
  onSelectFunction,
  selectedGrain,
  selectedFunctionId,
  sourceCatalog,
  theme,
  workspace,
  workspaces,
  onSelectGrain,
  onThemeChange,
}: NavigationSidebarProps) {
  const title = formatViewTitle(activeView);

  return (
    <aside
      className="navigation-sidebar"
      aria-label={`${activeView} navigation`}
    >
      <div className="navigation-sidebar__header">
        <span>{title}</span>
      </div>

      {activeView !== "settings" && (
        <WorkspaceNavigator
          grains={grains}
          isConnected={isConnected}
          onConnectCluster={onConnectCluster}
          onDisconnectCluster={onDisconnectCluster}
          onDiscoverGrains={onDiscoverGrains}
          onLoadWorkspace={onLoadWorkspace}
          onNewWorkspace={onNewWorkspace}
          onSaveWorkspace={onSaveWorkspace}
          onSelectWorkspace={onSelectWorkspace}
          onEditWorkspace={onEditWorkspace}
          onSelectFunction={onSelectFunction}
          onSelectGrain={onSelectGrain}
          selectedFunctionId={selectedFunctionId}
          selectedGrain={selectedGrain}
          sourceCatalog={sourceCatalog}
          workspace={workspace}
          workspaces={workspaces}
        />
      )}

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
  const [collapsedSources, setCollapsedSources] = useState<Set<string>>(
    () => new Set(),
  );
  const [collapsedInterfaces, setCollapsedInterfaces] = useState<Set<string>>(
    () => new Set(),
  );
  const [disabledSourceIds, setDisabledSourceIds] = useState<Set<string>>(
    () => new Set(),
  );

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
    <div className="navigation-sidebar__workspace-content">
      <section
        className="navigation-sidebar__section navigation-sidebar__section--sources"
        aria-labelledby="source-catalog-title"
      >
        <div
          className="navigation-sidebar__section-title"
          id="source-catalog-title"
        >
          Sources
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
        <div className="navigation-sidebar__sources-container">
          {filteredSources.length > 0 ? (
            <ul className="navigation-sidebar__tree navigation-sidebar__catalog">
            {filteredSources.map((source) => (
              <li key={source.sourceId} className="navigation-sidebar__source-item">
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
                    {collapsedSources.has(source.sourceId) ? (
                      <ChevronRight
                        aria-hidden="true"
                        className="navigation-sidebar__disclosure"
                        width={14}
                        height={14}
                      />
                    ) : (
                      <ChevronDown
                        aria-hidden="true"
                        className="navigation-sidebar__disclosure"
                        width={14}
                        height={14}
                      />
                    )}
                    <span className="navigation-sidebar__source-main">
                      <span className="navigation-sidebar__source-name">
                        {source.label}
                      </span>
                      <span className="navigation-sidebar__source-meta">
                        <span className="navigation-sidebar__source-type">
                          {source.sourceType}
                        </span>
                        <span>{formatSourceDetail(source)}</span>
                      </span>
                    </span>
                    <small>{source.discoveryStatus}</small>
                  </button>
                </div>
                {source.interfaces.length > 0 && !collapsedSources.has(source.sourceId) && (
                  <div className="navigation-sidebar__source-children">
                    <SourceInterfaceTree
                      collapsedInterfaces={collapsedInterfaces}
                      onSelectFunction={onSelectFunction}
                      onSelectGrain={onSelectGrain}
                      onToggleInterface={toggleInterface}
                      selectedFunctionId={selectedFunctionId}
                      selectedGrain={selectedGrain}
                      source={source}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        ) : (
            <div className="navigation-sidebar__empty">
              {workspace
                ? isConnected
                  ? "No functions discovered"
                  : "Connect to discover source functions"
                : "No workspace loaded"}
            </div>
          )}
        </div>
      </section>

    </div>
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
    return (
      <div className="navigation-sidebar__empty navigation-sidebar__empty--nested">
        No functions discovered
      </div>
    );
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
              onClick={() =>
                onToggleInterface(source.sourceId, catalogInterface.interfaceId)
              }
              type="button"
            >
              {isCollapsed ? (
                <ChevronRight
                  aria-hidden="true"
                  className="navigation-sidebar__disclosure"
                  width={14}
                  height={14}
                />
              ) : (
                <ChevronDown
                  aria-hidden="true"
                  className="navigation-sidebar__disclosure"
                  width={14}
                  height={14}
                />
              )}
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
                        selectedFunctionId
                          ? selectedFunctionId === method.functionId
                          : selectedGrain === method.interfaceId
                      }
                      onClick={() => {
                        onSelectFunction?.(method.functionId);
                        if (!onSelectFunction) {
                          onSelectGrain(method.interfaceId);
                        }
                      }}
                      type="button"
                    >
                      <span
                        className="navigation-sidebar__grain-icon"
                        aria-hidden="true"
                      />
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

export function NuGetRegistryManager({
  feeds,
  onCreateFeed,
  onTestFeed,
  onUpdateFeed,
}: {
  feeds: NugetFeed[];
  onCreateFeed?: (request: {
    name: string;
    url: string;
    username?: string;
    password?: string;
  }) => Promise<void>;
  onTestFeed?: (request: {
    name: string;
    url: string;
    username?: string;
    password?: string;
  }) => Promise<void>;
  onUpdateFeed?: (
    name: string,
    request: {
      name: string;
      url: string;
      username?: string;
      password?: string;
    },
  ) => Promise<void>;
}) {
  const [editingFeedName, setEditingFeedName] = useState<string | null>(null);
  const [feedName, setFeedName] = useState("");
  const [feedUrl, setFeedUrl] = useState("");
  const [feedUsername, setFeedUsername] = useState("");
  const [feedPassword, setFeedPassword] = useState("");
  const [status, setStatus] = useState("Ready");
  const availableFeeds = useMemo(
    () => [
      defaultNugetFeed,
      ...feeds.filter((feed) => feed.name !== defaultNugetFeed.name),
    ],
    [feeds],
  );
  const editableFeeds = availableFeeds.filter((feed) => !feed.isDefault);
  const isEditing = editingFeedName !== null;
  const canSubmit = Boolean(feedName.trim() && feedUrl.trim());

  const resetForm = () => {
    setEditingFeedName(null);
    setFeedName("");
    setFeedUrl("");
    setFeedUsername("");
    setFeedPassword("");
  };

  const editFeed = (feed: NugetFeed) => {
    setEditingFeedName(feed.name);
    setFeedName(feed.name);
    setFeedUrl(feed.url);
    setFeedUsername("");
    setFeedPassword("");
    setStatus(`Editing ${feed.name}`);
  };

  const buildRequest = () => ({
    name: feedName.trim(),
    url: feedUrl.trim(),
    username: feedUsername.trim() || undefined,
    password: feedPassword || undefined,
  });

  const handleTestFeed = async () => {
    if (!canSubmit || !onTestFeed) {
      return;
    }

    setStatus("Testing connection");
    try {
      await onTestFeed(buildRequest());
      setStatus("Connection succeeded");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Connection failed");
    }
  };

  const handleSaveFeed = async () => {
    if (!canSubmit || !onCreateFeed) {
      return;
    }

    setStatus(isEditing ? "Saving feed" : "Connecting and saving");
    try {
      if (isEditing && editingFeedName && onUpdateFeed) {
        await onUpdateFeed(editingFeedName, buildRequest());
      } else {
        await onCreateFeed(buildRequest());
      }
      setStatus(isEditing ? "Feed updated" : "Feed connected and saved");
      resetForm();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Feed save failed");
    }
  };

  return (
    <section className="feed-manager" aria-labelledby="feed-manager-title">
      <header className="feed-manager__header">
        <div>
          <span>NuGet</span>
          <h2 id="feed-manager-title">Package feeds</h2>
          <p>Configure package registries used by NuGet workspace sources.</p>
        </div>
      </header>

      <div className="feed-manager__content">
        <section className="feed-manager__panel" aria-labelledby="feed-form-title">
          <div>
            <h3 id="feed-form-title">{isEditing ? "Edit feed" : "New feed"}</h3>
            <p>{isEditing ? "Update a saved feed connection." : "Test a registry before saving it."}</p>
          </div>
          <div className="feed-manager__form">
            <label>
              <span>Name</span>
              <input
                aria-label="Feed name"
                value={feedName}
                onChange={(event) => setFeedName(event.target.value)}
                placeholder="github"
              />
            </label>
            <label>
              <span>URL</span>
              <input
                aria-label="Feed URL"
                value={feedUrl}
                onChange={(event) => setFeedUrl(event.target.value)}
                placeholder="https://nuget.pkg.github.com/org/index.json"
              />
            </label>
            <label>
              <span>Username</span>
              <input
                aria-label="Feed username"
                value={feedUsername}
                onChange={(event) => setFeedUsername(event.target.value)}
                placeholder="Optional"
              />
            </label>
            <label>
              <span>Token</span>
              <input
                aria-label="Feed token"
                value={feedPassword}
                onChange={(event) => setFeedPassword(event.target.value)}
                placeholder={isEditing ? "Leave blank to clear credentials" : "Optional"}
                type="password"
              />
            </label>
          </div>
          <div className="feed-manager__actions">
            <button
              className="feed-manager__ghost-button"
              disabled={!canSubmit || !onTestFeed}
              onClick={handleTestFeed}
              type="button"
            >
              Test connection
            </button>
            <button
              className="feed-manager__primary-button"
              disabled={!canSubmit || !onCreateFeed}
              onClick={handleSaveFeed}
              type="button"
            >
              {isEditing ? "Save changes" : "Connect and save"}
            </button>
            {isEditing && (
              <button className="feed-manager__ghost-button" onClick={resetForm} type="button">
                Cancel edit
              </button>
            )}
          </div>
          <div className="feed-manager__status" role="status">{status}</div>
        </section>

        <section className="feed-manager__panel" aria-labelledby="configured-feeds-title">
          <div>
            <h3 id="configured-feeds-title">Configured feeds</h3>
            <p>Default nuget.org is always available. Saved feeds appear below.</p>
          </div>
          <ul className="feed-manager__feeds" aria-label="Configured feeds">
            <li className="feed-manager__feed-card" data-default="true">
              <div>
                <strong>{defaultNugetFeed.name}</strong>
                <span>{defaultNugetFeed.url}</span>
              </div>
              <small>Default</small>
            </li>
            {editableFeeds.map((feed) => (
              <li className="feed-manager__feed-card" key={feed.name}>
                <div>
                  <strong>{feed.name}</strong>
                  <span>{feed.url}</span>
                </div>
                <small>{feed.hasCredentials ? "Authenticated" : "Public"}</small>
                <button className="feed-manager__ghost-button" onClick={() => editFeed(feed)} type="button">
                  Edit
                </button>
              </li>
            ))}
          </ul>
          {editableFeeds.length === 0 ? (
            <div className="feed-manager__empty">
              <strong>No saved feeds yet</strong>
              <span>Add a private or corporate NuGet feed, test it, then save it for workspace sources.</span>
            </div>
        ) : (
            <div className="feed-manager__hint">
              Use Edit to rotate tokens or update feed endpoints.
            </div>
        )}
        </section>
      </div>
    </section>
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
  onThemeChange: (theme: "dark" | "light" | "vscode-dark" | "vscode-light") => void;
  theme: "dark" | "light" | "vscode-dark" | "vscode-light";
}) {
  return (
    <div className="navigation-sidebar__workspace-content">
      <section
        className="navigation-sidebar__section"
        aria-labelledby="settings-app-title"
      >
        <div
          className="navigation-sidebar__section-title"
          id="settings-app-title"
        >
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

      <section
        className="navigation-sidebar__section"
        aria-labelledby="settings-core-title"
      >
        <div
          className="navigation-sidebar__section-title"
          id="settings-core-title"
        >
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

      <section
        className="navigation-sidebar__section"
        aria-labelledby="settings-theme-title"
      >
        <div
          className="navigation-sidebar__section-title"
          id="settings-theme-title"
        >
          Theme
        </div>
        <label className="navigation-sidebar__select-label">
<span>Workbench theme</span>
            <select
              value={theme}
              onChange={(event) =>
                onThemeChange(
                  event.target.value as
                    | "dark"
                    | "light"
                    | "vscode-dark"
                    | "vscode-light",
                )
              }
            >
              <option value="dark">Codex Dark</option>
              <option value="light">Codex Light</option>
              <option value="vscode-dark">VSCode Dark</option>
              <option value="vscode-light">VSCode Light</option>
            </select>
        </label>
      </section>

      <section
        className="navigation-sidebar__section"
        aria-labelledby="settings-logs-title"
      >
        <div className="navigation-sidebar__section-heading">
          <div
            className="navigation-sidebar__section-title"
            id="settings-logs-title"
          >
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
                <span className="navigation-sidebar__log-level">
                  {entry.level}
                </span>
                <span className="navigation-sidebar__log-message">
                  {entry.message}
                </span>
                <time>{formatLogTime(entry.timestamp)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <div className="navigation-sidebar__empty">No logs captured</div>
        )}
      </section>
    </div>
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
  if (view === "workspace") {
    return "Collections";
  }

  if (view === "nuget") {
    return "NuGet";
  }

  return view;
}

function filterCatalogSources(
  sources: SourceCatalogSource[],
  query: string,
): SourceCatalogSource[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return sources;
  }

  return sources.flatMap((source) => {
    const sourceMatches = matchesSource(source, normalizedQuery);
    const interfaces = source.interfaces.flatMap((catalogInterface) => {
      const interfaceMatches = matchesInterface(
        catalogInterface,
        normalizedQuery,
      );
      const methods = catalogInterface.methods.filter((method) => {
        return (
          sourceMatches ||
          interfaceMatches ||
          method.methodName.toLowerCase().includes(normalizedQuery) ||
          method.signature.toLowerCase().includes(normalizedQuery) ||
          method.returnType.toLowerCase().includes(normalizedQuery) ||
          method.parameters.some((parameter) =>
            `${parameter.name} ${parameter.typeName}`
              .toLowerCase()
              .includes(normalizedQuery),
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

function matchesInterface(
  catalogInterface: SourceCatalogInterface,
  query: string,
): boolean {
  return `${catalogInterface.namespace} ${catalogInterface.interfaceName}`
    .toLowerCase()
    .includes(query);
}

function formatSourceDetail(source: SourceCatalogSource): string {
  return source.version
    ? `${source.reference} @ ${source.version}`
    : source.reference;
}
