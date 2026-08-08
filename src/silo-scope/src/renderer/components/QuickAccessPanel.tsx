import {
  Box,
  Briefcase,
  Folder,
  Layers,
  Package,
  Play,
  Search,
  Square,
  X,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type {
  EnvironmentProfile,
  NugetFeed,
  SourceCatalogFunction,
  SourceOwnedCatalog,
  Workspace,
} from "../../shared/types";

type SearchResultType =
  | "workspace"
  | "feed"
  | "interface"
  | "function"
  | "command"
  | "environment";

interface SearchResult {
  id: string;
  type: SearchResultType;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  data: unknown;
}

interface QuickAccessPanelProps {
  isOpen: boolean;
  onClose: () => void;
  workspaces: Workspace[];
  feeds: NugetFeed[];
  sourceCatalog: SourceOwnedCatalog;
  workspace: Workspace | null;
  isConnected: boolean;
  environments: EnvironmentProfile[];
  activeEnvironment: string | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onSelectFeed: () => void;
  onSelectInterface: (interfaceId: string) => void;
  onSelectFunction: (functionId: string) => void;
  onConnectCluster: () => void;
  onDisconnectCluster: () => void;
  onSwitchEnvironment: (envName: string) => void;
}

export function QuickAccessPanel({
  isOpen,
  onClose,
  workspaces,
  feeds,
  sourceCatalog,
  workspace,
  isConnected,
  environments,
  activeEnvironment,
  onSelectWorkspace,
  onSelectFeed,
  onSelectInterface,
  onSelectFunction,
  onConnectCluster,
  onDisconnectCluster,
  onSwitchEnvironment,
}: QuickAccessPanelProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const allResults: SearchResult[] = [];

    // Commands
    if (workspace && !isConnected) {
      const text = `connect cluster ${workspace.name}`.toLowerCase();
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        allResults.push({
          id: "command:connect",
          type: "command",
          title: "Connect cluster",
          subtitle: `Connect to ${workspace.name}`,
          icon: Play,
          data: "connect",
        });
      }
    }

    if (isConnected) {
      const text = "disconnect cluster".toLowerCase();
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        allResults.push({
          id: "command:disconnect",
          type: "command",
          title: "Disconnect cluster",
          subtitle: "Disconnect from current cluster",
          icon: Square,
          data: "disconnect",
        });
      }
    }

    // Environments
    for (const env of environments) {
      const text =
        `${env.name} environment ${activeEnvironment === env.name ? "active" : ""}`.toLowerCase();
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        allResults.push({
          id: `environment:${env.name}`,
          type: "environment",
          title: env.name,
          subtitle:
            activeEnvironment === env.name
              ? "Active environment"
              : "Environment profile",
          icon: Layers,
          data: env,
        });
      }
    }

    // Workspaces / clusters
    for (const workspace of workspaces) {
      const text =
        `${workspace.name} ${workspace.siloAddress} ${workspace.clusterId ?? ""}`.toLowerCase();
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        allResults.push({
          id: `workspace:${workspace.id}`,
          type: "workspace",
          title: workspace.name,
          subtitle: workspace.siloAddress,
          icon: Briefcase,
          data: workspace,
        });
      }
    }

    // Feeds
    for (const feed of feeds) {
      const text = `${feed.name} ${feed.url}`.toLowerCase();
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        allResults.push({
          id: `feed:${feed.name}`,
          type: "feed",
          title: feed.name,
          subtitle: feed.url,
          icon: Package,
          data: feed,
        });
      }
    }

    // Interfaces and functions from source catalog
    for (const source of sourceCatalog.sources) {
      for (const catalogInterface of source.interfaces) {
        const interfaceText =
          `${catalogInterface.interfaceName} ${catalogInterface.namespace}`.toLowerCase();
        if (!normalizedQuery || interfaceText.includes(normalizedQuery)) {
          allResults.push({
            id: `interface:${catalogInterface.interfaceId}`,
            type: "interface",
            title: catalogInterface.interfaceName,
            subtitle: `${source.label} / ${catalogInterface.namespace}`,
            icon: Folder,
            data: {
              interfaceId: catalogInterface.interfaceId,
              sourceId: source.sourceId,
            },
          });
        }

        for (const method of catalogInterface.methods) {
          const methodText =
            `${method.methodName} ${method.signature} ${method.returnType}`.toLowerCase();
          const paramText = method.parameters
            .map((p) => `${p.name} ${p.typeName}`)
            .join(" ")
            .toLowerCase();
          if (
            !normalizedQuery ||
            methodText.includes(normalizedQuery) ||
            paramText.includes(normalizedQuery)
          ) {
            allResults.push({
              id: `function:${method.functionId}`,
              type: "function",
              title: method.signature,
              subtitle: `${source.label} / ${catalogInterface.interfaceName}`,
              icon: Box,
              data: method,
            });
          }
        }
      }
    }

    return allResults;
  }, [
    query,
    workspaces,
    feeds,
    sourceCatalog,
    workspace,
    isConnected,
    environments,
    activeEnvironment,
  ]);

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0);
  }, [results.length]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setSelectedIndex(0);
      requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev < results.length - 1 ? prev + 1 : 0));
        return;
      }

      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((prev) => (prev > 0 ? prev - 1 : results.length - 1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        const result = results[selectedIndex];
        if (result) {
          handleSelect(result);
        }
        return;
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, results, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) {
      return;
    }

    const selectedItem = listRef.current.children[selectedIndex] as
      | HTMLElement
      | undefined;
    if (selectedItem) {
      selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      switch (result.type) {
        case "workspace": {
          const workspace = result.data as Workspace;
          onSelectWorkspace(workspace.id);
          break;
        }
        case "feed": {
          onSelectFeed();
          break;
        }
        case "interface": {
          const { interfaceId } = result.data as {
            interfaceId: string;
            sourceId: string;
          };
          onSelectInterface(interfaceId);
          break;
        }
        case "function": {
          const method = result.data as SourceCatalogFunction;
          onSelectFunction(method.functionId);
          break;
        }
        case "command": {
          const command = result.data as string;
          if (command === "connect") {
            onConnectCluster();
          } else if (command === "disconnect") {
            onDisconnectCluster();
          }
          break;
        }
        case "environment": {
          const env = result.data as EnvironmentProfile;
          onSwitchEnvironment(env.name);
          break;
        }
      }
      onClose();
    },
    [
      onSelectWorkspace,
      onSelectFeed,
      onSelectInterface,
      onSelectFunction,
      onConnectCluster,
      onDisconnectCluster,
      onSwitchEnvironment,
      onClose,
    ],
  );

  if (!isOpen) {
    return null;
  }

  const groupedResults = groupResults(results);

  return (
    <div
      className="quick-access-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
      role="dialog"
      aria-modal="true"
      aria-label="Quick access"
    >
      <div className="quick-access-panel">
        <div className="quick-access-input-row">
          <Search
            aria-hidden="true"
            className="quick-access-search-icon"
            width={16}
            height={16}
          />
          <input
            ref={inputRef}
            aria-label="Search commands, environments, feeds, clusters, interfaces and grains"
            className="quick-access-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands, environments, feeds, clusters, interfaces and grains..."
            type="text"
            value={query}
          />
          {query && (
            <button
              aria-label="Clear search"
              className="quick-access-clear"
              onClick={() => {
                setQuery("");
                inputRef.current?.focus();
              }}
              type="button"
            >
              <X aria-hidden="true" width={14} height={14} />
            </button>
          )}
        </div>

        {results.length > 0 ? (
          <ul className="quick-access-results" ref={listRef} role="listbox">
            {groupedResults.map((group) => (
              <li key={group.type} className="quick-access-group">
                <div className="quick-access-group-label">
                  {formatGroupLabel(group.type)}
                </div>
                <ul className="quick-access-group-items" role="group">
                  {group.items.map((result) => {
                    const globalIndex = results.indexOf(result);
                    const isSelected = globalIndex === selectedIndex;
                    const Icon = result.icon;

                    return (
                      <li key={result.id} role="presentation">
                        <button
                          aria-selected={isSelected}
                          className={`quick-access-item ${isSelected ? "quick-access-item--selected" : ""}`}
                          onClick={() => handleSelect(result)}
                          onMouseEnter={() => setSelectedIndex(globalIndex)}
                          role="option"
                          type="button"
                        >
                          <Icon
                            aria-hidden="true"
                            className="quick-access-item-icon"
                            width={16}
                            height={16}
                          />
                          <span className="quick-access-item-text">
                            <span className="quick-access-item-title">
                              {highlightMatch(result.title, query)}
                            </span>
                            <span className="quick-access-item-subtitle">
                              {result.subtitle}
                            </span>
                          </span>
                          <span className="quick-access-item-badge">
                            {formatTypeLabel(result.type)}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            ))}
          </ul>
        ) : (
          <div className="quick-access-empty">
            <Search
              aria-hidden="true"
              className="quick-access-empty-icon"
              width={32}
              height={32}
            />
            <span>No results found</span>
          </div>
        )}

        <div className="quick-access-footer">
          <span>
            {results.length > 0 ? `${results.length} results` : "No results"}
          </span>
          <span className="quick-access-footer-shortcuts">
            <kbd>↑</kbd>
            <kbd>↓</kbd> to navigate
            <kbd>↵</kbd> to select
            <kbd>esc</kbd> to close
          </span>
        </div>
      </div>
    </div>
  );
}

interface GroupedResults {
  type: SearchResultType;
  items: SearchResult[];
}

function groupResults(results: SearchResult[]): GroupedResults[] {
  const order: SearchResultType[] = [
    "command",
    "environment",
    "workspace",
    "feed",
    "interface",
    "function",
  ];
  const groups = new Map<SearchResultType, SearchResult[]>();

  for (const result of results) {
    const existing = groups.get(result.type) ?? [];
    existing.push(result);
    groups.set(result.type, existing);
  }

  const result: GroupedResults[] = [];
  for (const type of order) {
    const items = groups.get(type);
    if (items && items.length > 0) {
      result.push({ type, items });
    }
  }

  return result;
}

function formatGroupLabel(type: SearchResultType): string {
  switch (type) {
    case "command":
      return "Commands";
    case "environment":
      return "Environments";
    case "workspace":
      return "Clusters";
    case "feed":
      return "Feeds";
    case "interface":
      return "Interfaces";
    case "function":
      return "Grains";
  }
}

function formatTypeLabel(type: SearchResultType): string {
  switch (type) {
    case "command":
      return "Command";
    case "environment":
      return "Environment";
    case "workspace":
      return "Cluster";
    case "feed":
      return "Feed";
    case "interface":
      return "Interface";
    case "function":
      return "Grain";
  }
}

function highlightMatch(text: string, query: string) {
  if (!query.trim()) {
    return text;
  }

  const normalizedQuery = query.trim().toLowerCase();
  const index = text.toLowerCase().indexOf(normalizedQuery);

  if (index === -1) {
    return text;
  }

  const before = text.slice(0, index);
  const match = text.slice(index, index + query.trim().length);
  const after = text.slice(index + query.trim().length);

  return (
    <>
      {before}
      <mark className="quick-access-highlight">{match}</mark>
      {after}
    </>
  );
}
