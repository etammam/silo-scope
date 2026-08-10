import {
    Box,
    Briefcase,
    Folder,
    Globe,
    Layers,
    Moon,
    Package,
    PanelLeft,
    PanelLeftOpen,
    PanelRight,
    Play,
    Plus,
    Rows3,
    Search,
    Settings,
    Square,
    Sun,
    Terminal,
    X,
    type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ActivityView } from "../../../../renderer/layout/ActivityBar";
import type { EnvironmentProfile } from "../../../environments/schema";
import type { NugetFeed } from "../../../feeds/schema";
import type {
    SourceCatalogFunction,
    SourceOwnedCatalog,
} from "../../../grain-invocation/schema";
import type { Workspace } from "../../../workspaces/schema";
import "./quick-access-panel.css";

type SearchResultType =
  | "workspace"
  | "feed"
  | "interface"
  | "function"
  | "command"
  | "environment";

type ResultGroup =
  | "commands"
  | "views"
  | "panels"
  | "appearance"
  | "environments"
  | "clusters"
  | "feeds"
  | "interfaces"
  | "grains";

type PanelId = "activityBar" | "navigation" | "response" | "logs";
type PaneLayout = "horizontal" | "vertical";
type WorkbenchTheme =
  | "vscode-dark"
  | "vscode-light"
  | "github-dark"
  | "github-light";

interface CommandItem {
  run: () => void;
}

interface SearchResult {
  id: string;
  type: SearchResultType;
  group?: ResultGroup;
  badge?: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  data: unknown;
}

export interface QuickAccessActions {
  setActiveView: (view: ActivityView) => void;
  togglePanel: (panel: PanelId) => void;
  setPaneLayout: (layout: PaneLayout) => void;
  setTheme: (theme: WorkbenchTheme) => void;
  adjustFontSize: (delta: number) => void;
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
  actions: QuickAccessActions;
  currentTheme: WorkbenchTheme;
  currentFontSize: number;
  paneLayout: PaneLayout;
  onSelectWorkspace?: (workspaceId: string) => void;
  onSelectInterface?: (interfaceId: string) => void;
  onSelectFunction?: (functionId: string) => void;
  onConnectCluster?: () => void;
  onDisconnectCluster?: () => void;
  onCancelConnect?: () => void;
  connectionStatus?: string;
  onSwitchEnvironment?: (envName: string) => void;
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
  actions,
  currentTheme,
  currentFontSize,
  paneLayout,
  onSelectWorkspace,
  onSelectInterface,
  onSelectFunction,
  onConnectCluster,
  onDisconnectCluster,
  onCancelConnect,
  connectionStatus,
  onSwitchEnvironment,
}: QuickAccessPanelProps) {
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const results = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const allResults: SearchResult[] = [];

    // ── Commands (connect/disconnect/cancel) ──
    if (workspace && connectionStatus === "connecting") {
      if (!normalizedQuery || "cancel connection".includes(normalizedQuery)) {
        allResults.push({
          id: "command:cancel-connect",
          type: "command",
          group: "commands",
          title: "Cancel connection",
          subtitle: `Cancel connecting to ${workspace.name}`,
          icon: X,
          data: { run: () => onCancelConnect?.() },
        });
      }
    }
    if (workspace && !isConnected && connectionStatus !== "connecting") {
      const text = `connect cluster ${workspace.name}`.toLowerCase();
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        allResults.push({
          id: "command:connect",
          type: "command",
          group: "commands",
          title: "Connect cluster",
          subtitle: `Connect to ${workspace.name}`,
          icon: Play,
          data: { run: () => onConnectCluster?.() },
        });
      }
    }
    if (isConnected) {
      if (!normalizedQuery || "disconnect cluster".includes(normalizedQuery)) {
        allResults.push({
          id: "command:disconnect",
          type: "command",
          group: "commands",
          title: "Disconnect cluster",
          subtitle: "Disconnect from current cluster",
          icon: Square,
          data: { run: () => onDisconnectCluster?.() },
        });
      }
    }

    // ── Views (Module 1) ──
    const VIEWS: Array<{
      id: string;
      title: string;
      view: ActivityView;
      icon: LucideIcon;
    }> = [
      {
        id: "view:workspace",
        title: "Go to Workspace",
        view: "workspace",
        icon: Folder,
      },
      {
        id: "view:clusters",
        title: "Go to Clusters",
        view: "workspaces",
        icon: Briefcase,
      },
      {
        id: "view:environments",
        title: "Go to Environments",
        view: "environments",
        icon: Globe,
      },
      {
        id: "view:feeds",
        title: "Go to NuGet Feeds",
        view: "nuget",
        icon: Package,
      },
      {
        id: "view:settings",
        title: "Go to Settings",
        view: "settings",
        icon: Settings,
      },
    ];
    for (const v of VIEWS) {
      if (!normalizedQuery || v.title.toLowerCase().includes(normalizedQuery)) {
        allResults.push({
          id: v.id,
          type: "command",
          group: "views",
          badge: "View",
          title: v.title,
          subtitle: "Navigate",
          icon: v.icon,
          data: { run: () => actions.setActiveView(v.view) },
        });
      }
    }

    // ── Panels (Module 2) ──
    const PANELS: Array<{
      id: string;
      title: string;
      subtitle: string;
      panel: PanelId;
      icon: LucideIcon;
    }> = [
      {
        id: "panel:activity",
        title: "Toggle Activity Bar",
        subtitle: "Show or hide the activity bar",
        panel: "activityBar",
        icon: PanelLeft,
      },
      {
        id: "panel:navigation",
        title: "Toggle Navigation Sidebar",
        subtitle: "Show or hide the navigation sidebar",
        panel: "navigation",
        icon: PanelLeftOpen,
      },
      {
        id: "panel:response",
        title: "Toggle Response Pane",
        subtitle: "Show or hide the response telemetry pane",
        panel: "response",
        icon: PanelRight,
      },
      {
        id: "panel:logs",
        title: "Toggle Backend Logs",
        subtitle: "Show or hide the backend log panel",
        panel: "logs",
        icon: Terminal,
      },
    ];
    for (const p of PANELS) {
      if (!normalizedQuery || p.title.toLowerCase().includes(normalizedQuery)) {
        allResults.push({
          id: p.id,
          type: "command",
          group: "panels",
          badge: "Panel",
          title: p.title,
          subtitle: p.subtitle,
          icon: p.icon,
          data: { run: () => actions.togglePanel(p.panel) },
        });
      }
    }

    // Layout toggle
    if (
      !normalizedQuery ||
      "layout".includes(normalizedQuery) ||
      "stack".includes(normalizedQuery) ||
      "side by side".includes(normalizedQuery)
    ) {
      const isVertical = paneLayout === "vertical";
      allResults.push({
        id: "panel:layout",
        type: "command",
        group: "panels",
        badge: "Layout",
        title: isVertical ? "Layout: Side by Side" : "Layout: Stack Vertically",
        subtitle: isVertical
          ? "Place request and response panels side by side"
          : "Stack request and response panels",
        icon: isVertical ? PanelRight : Rows3,
        data: {
          run: () =>
            actions.setPaneLayout(isVertical ? "horizontal" : "vertical"),
        },
      });
    }

    // ── Appearance (Module 3) ──
    const THEMES: Array<{
      theme: WorkbenchTheme;
      label: string;
      icon: LucideIcon;
    }> = [
      { theme: "vscode-dark", label: "VS Code Dark", icon: Moon },
      { theme: "vscode-light", label: "VS Code Light", icon: Sun },
      { theme: "github-dark", label: "GitHub Dark", icon: Moon },
      { theme: "github-light", label: "GitHub Light", icon: Sun },
    ];
    for (const t of THEMES) {
      if (
        !normalizedQuery ||
        `theme ${t.label}`.toLowerCase().includes(normalizedQuery)
      ) {
        allResults.push({
          id: `appearance:theme:${t.theme}`,
          type: "command",
          group: "appearance",
          badge: "Theme",
          title: `Theme: ${t.label}`,
          subtitle:
            currentTheme === t.theme ? "Current theme" : "Switch to this theme",
          icon: t.icon,
          data: { run: () => actions.setTheme(t.theme) },
        });
      }
    }
    if (
      !normalizedQuery ||
      "font".includes(normalizedQuery) ||
      "increase".includes(normalizedQuery)
    ) {
      allResults.push({
        id: "appearance:font_up",
        type: "command",
        group: "appearance",
        badge: "Font",
        title: "Increase Font Size",
        subtitle: `Current: ${currentFontSize}px → ${Math.min(32, currentFontSize + 1)}px`,
        icon: Plus,
        data: { run: () => actions.adjustFontSize(1) },
      });
    }
    if (
      !normalizedQuery ||
      "font".includes(normalizedQuery) ||
      "decrease".includes(normalizedQuery)
    ) {
      allResults.push({
        id: "appearance:font_down",
        type: "command",
        group: "appearance",
        badge: "Font",
        title: "Decrease Font Size",
        subtitle: `Current: ${currentFontSize}px → ${Math.max(8, currentFontSize - 1)}px`,
        icon: Plus,
        data: { run: () => actions.adjustFontSize(-1) },
      });
    }

    // ── Environments ──
    for (const env of environments) {
      const text =
        `${env.name} environment ${activeEnvironment === env.name ? "active" : ""}`.toLowerCase();
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        allResults.push({
          id: `environment:${env.name}`,
          type: "environment",
          group: "environments",
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

    // ── Workspaces / clusters ──
    for (const ws of workspaces) {
      const text =
        `${ws.name} ${ws.siloAddress} ${ws.clusterId ?? ""}`.toLowerCase();
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        allResults.push({
          id: `workspace:${ws.id}`,
          type: "workspace",
          group: "clusters",
          title: ws.name,
          subtitle: ws.siloAddress,
          icon: Briefcase,
          data: ws,
        });
      }
    }

    // ── Feeds ──
    for (const feed of feeds) {
      const text = `${feed.name} ${feed.url}`.toLowerCase();
      if (!normalizedQuery || text.includes(normalizedQuery)) {
        allResults.push({
          id: `feed:${feed.name}`,
          type: "feed",
          group: "feeds",
          title: feed.name,
          subtitle: feed.url,
          icon: Package,
          data: feed,
        });
      }
    }

    // ── Interfaces & functions ──
    for (const source of sourceCatalog.sources) {
      for (const iface of source.interfaces) {
        const ifaceText =
          `${iface.interfaceName} ${iface.namespace}`.toLowerCase();
        if (!normalizedQuery || ifaceText.includes(normalizedQuery)) {
          allResults.push({
            id: `interface:${iface.interfaceId}`,
            type: "interface",
            group: "interfaces",
            title: iface.interfaceName,
            subtitle: `${source.label} / ${iface.namespace}`,
            icon: Folder,
            data: { interfaceId: iface.interfaceId, sourceId: source.sourceId },
          });
        }
        for (const method of iface.methods) {
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
              group: "grains",
              title: method.signature,
              subtitle: `${source.label} / ${iface.interfaceName}`,
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
    actions,
    currentTheme,
    currentFontSize,
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
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [isOpen]);

  // Keyboard shortcuts
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setSelectedIndex((p) => (p < results.length - 1 ? p + 1 : 0));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setSelectedIndex((p) => (p > 0 ? p - 1 : results.length - 1));
        return;
      }
      if (event.key === "Enter") {
        event.preventDefault();
        const r = results[selectedIndex];
        if (r) handleSelect(r);
        return;
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose, results, selectedIndex]);

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return;
    const selectedItem = listRef.current.children[selectedIndex] as
      | HTMLElement
      | undefined;
    if (selectedItem)
      selectedItem.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [selectedIndex]);

  const handleSelect = useCallback(
    (result: SearchResult) => {
      switch (result.type) {
        case "command": {
          (result.data as CommandItem).run();
          break;
        }
        case "workspace": {
          const ws = result.data as Workspace;
          actions.setActiveView("workspace");
          onSelectWorkspace?.(ws.id);
          break;
        }
        case "feed": {
          actions.setActiveView("nuget");
          break;
        }
        case "interface": {
          const { interfaceId } = result.data as {
            interfaceId: string;
            sourceId: string;
          };
          actions.setActiveView("workspace");
          onSelectInterface?.(interfaceId);
          break;
        }
        case "function": {
          const method = result.data as SourceCatalogFunction;
          actions.setActiveView("workspace");
          onSelectFunction?.(method.functionId);
          break;
        }
        case "environment": {
          const env = result.data as EnvironmentProfile;
          onSwitchEnvironment?.(env.name);
          break;
        }
      }
      onClose();
    },
    [
      actions,
      onClose,
      onSelectWorkspace,
      onSelectInterface,
      onSelectFunction,
      onSwitchEnvironment,
    ],
  );

  if (!isOpen) return null;

  const groupedResults = groupResults(results);

  return (
    <div
      className="quick-access-overlay"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
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
            aria-label="Search commands, views, panels, environments, clusters, feeds, interfaces and grains"
            className="quick-access-input"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search anything…"
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
              <li key={group.group} className="quick-access-group">
                <div className="quick-access-group-label">
                  {formatGroupLabel(group.group)}
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
                            {result.badge ?? formatTypeLabel(result.type)}
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

/* ── Grouping ── */

interface GroupedResults {
  group: ResultGroup;
  items: SearchResult[];
}

function groupResults(results: SearchResult[]): GroupedResults[] {
  const ORDER: ResultGroup[] = [
    "commands",
    "views",
    "panels",
    "appearance",
    "environments",
    "clusters",
    "feeds",
    "interfaces",
    "grains",
  ];
  const groups = new Map<ResultGroup, SearchResult[]>();
  for (const r of results) {
    const key = r.group ?? (r.type as unknown as ResultGroup);
    const existing = groups.get(key) ?? [];
    existing.push(r);
    groups.set(key, existing);
  }
  const out: GroupedResults[] = [];
  for (const g of ORDER) {
    const items = groups.get(g);
    if (items?.length) out.push({ group: g, items });
  }
  return out;
}

const GROUP_LABELS: Record<ResultGroup, string> = {
  commands: "Commands",
  views: "Views",
  panels: "Panels & Layout",
  appearance: "Appearance",
  environments: "Environments",
  clusters: "Clusters",
  feeds: "Feeds",
  interfaces: "Interfaces",
  grains: "Grains",
};

function formatGroupLabel(group: ResultGroup): string {
  return GROUP_LABELS[group] ?? group;
}

function formatTypeLabel(type: SearchResultType): string {
  switch (type) {
    case "command":
      return "Command";
    case "environment":
      return "Env";
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
  if (!query.trim()) return text;
  const q = query.trim().toLowerCase();
  const idx = text.toLowerCase().indexOf(q);
  if (idx === -1) return text;
  const before = text.slice(0, idx);
  const match = text.slice(idx, idx + query.trim().length);
  const after = text.slice(idx + query.trim().length);
  return (
    <>
      {before}
      <mark className="quick-access-highlight">{match}</mark>
      {after}
    </>
  );
}
