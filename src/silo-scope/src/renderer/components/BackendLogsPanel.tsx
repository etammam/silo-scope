import {
  Copy,
  ExternalLink,
  Search,
  SquareTerminal,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { LogEntry } from "../../shared/types";

type LogLevelFilter = LogEntry["level"] | "all";

export function BackendLogStatusButton({
  entries,
  isOpen,
  onToggle,
}: {
  entries: LogEntry[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  const errors = entries.filter((entry) => entry.level === "error").length;
  const latest = entries.at(-1);

  return (
    <button
      aria-expanded={isOpen}
      aria-label="Toggle backend logs panel"
      className="global-status-bar__logs"
      data-level={latest?.level ?? "idle"}
      onClick={() => onToggle()}
      type="button"
    >
      <SquareTerminal aria-hidden="true" width={13} height={13} />
      <span>Backend Logs</span>
      <small>{entries.length}</small>
      {errors > 0 && <strong>{errors} errors</strong>}
      {latest && <em>{latest.message}</em>}
    </button>
  );
}

export function BackendLogsPanel({
  entries,
  onClear,
  onClose,
  onOpenLogDirectory,
}: {
  entries: LogEntry[];
  onClear: () => void;
  onClose: () => void;
  onOpenLogDirectory: () => Promise<{ success: boolean; path: string }>;
}) {
  const [query, setQuery] = useState("");
  const [level, setLevel] = useState<LogLevelFilter>("all");
  const [follow, setFollow] = useState(true);
  const [notice, setNotice] = useState<string | null>(null);
  const viewportRef = useRef<HTMLDivElement>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const visibleEntries = useMemo(
    () =>
      entries.filter((entry) => {
        if (level !== "all" && entry.level !== level) {
          return false;
        }

        if (!normalizedQuery) {
          return true;
        }

        return [entry.message, entry.category, entry.exception]
          .filter(Boolean)
          .join("\n")
          .toLowerCase()
          .includes(normalizedQuery);
      }),
    [entries, level, normalizedQuery],
  );

  useEffect(() => {
    if (follow) {
      viewportRef.current?.scrollTo?.({
        top: viewportRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [follow, visibleEntries.length]);

  const copyVisibleLogs = async () => {
    try {
      await navigator.clipboard.writeText(visibleEntries.map(formatLogText).join("\n"));
      setNotice(`${visibleEntries.length} line${visibleEntries.length === 1 ? "" : "s"} copied`);
    } catch {
      setNotice("Copy failed");
    }
  };

  const openLogs = async () => {
    try {
      const result = await onOpenLogDirectory();
      setNotice(result.success ? `Opened ${result.path}` : "Could not open logs folder");
    } catch {
      setNotice("Could not open logs folder");
    }
  };

  return (
    <section className="backend-logs-panel" aria-label="Backend logs panel">
      <header className="backend-logs-panel__toolbar">
        <div className="backend-logs-panel__tabs" role="tablist" aria-label="Bottom panel views">
          <button aria-selected="true" role="tab" type="button">
            LOGS
          </button>
        </div>
        <span aria-live="polite" className="backend-logs-panel__summary">
          {notice ?? `${visibleEntries.length} / ${entries.length} lines`}
        </span>
        <label className="backend-logs-panel__search">
          <Search aria-hidden="true" width={13} height={13} />
          <input
            aria-label="Search backend logs"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filter logs"
            type="search"
            value={query}
          />
        </label>
        <select
          aria-label="Filter log level"
          className="backend-logs-panel__level"
          onChange={(event) => setLevel(event.target.value as LogLevelFilter)}
          value={level}
        >
          <option value="all">All levels</option>
          <option value="debug">Debug</option>
          <option value="info">Info</option>
          <option value="warn">Warn</option>
          <option value="error">Error</option>
        </select>
        <button
          aria-pressed={follow}
          className="backend-logs-panel__tool"
          onClick={() => setFollow((enabled) => !enabled)}
          type="button"
        >
          Follow
        </button>
        <button aria-label="Copy visible logs" className="backend-logs-panel__icon" onClick={() => void copyVisibleLogs()} type="button">
          <Copy aria-hidden="true" width={14} height={14} />
        </button>
        <button aria-label="Open logs folder" className="backend-logs-panel__icon" onClick={() => void openLogs()} type="button">
          <ExternalLink aria-hidden="true" width={14} height={14} />
        </button>
        <button aria-label="Clear logs" className="backend-logs-panel__icon" onClick={() => onClear()} type="button">
          <Trash2 aria-hidden="true" width={14} height={14} />
        </button>
        <button aria-label="Close logs panel" className="backend-logs-panel__icon" onClick={() => onClose()} type="button">
          <X aria-hidden="true" width={14} height={14} />
        </button>
      </header>
      <div className="backend-logs-panel__viewport" ref={viewportRef} role="log" aria-live="polite">
        {visibleEntries.length === 0 ? (
          <div className="backend-logs-panel__empty">
            {entries.length === 0 ? "Waiting for backend output..." : "No log entries match the filter."}
          </div>
        ) : (
          visibleEntries.map((entry, index) => (
            <div className="panel-log-line" data-level={entry.level} key={`${entry.timestamp}-${index}-${entry.message}`}>
              <time dateTime={entry.timestamp}>{formatTimestamp(entry.timestamp)}</time>
              <strong>{entry.level.toUpperCase().padEnd(5, "\u00a0")}</strong>
              <span className="panel-log-line__process">(core)</span>
              {entry.category && <span className="panel-log-line__category">{entry.category}</span>}
              <span className="panel-log-line__message">{entry.message}</span>
              {entry.exception && <pre className="panel-log-line__exception">{entry.exception}</pre>}
            </div>
          ))
        )}
      </div>
    </section>
  );
}

export function formatLogText(entry: LogEntry): string {
  const category = entry.category ? ` ${entry.category}` : "";
  const suffix = entry.exception ? `\n${entry.exception}` : "";
  return `[${formatTimestamp(entry.timestamp)}] ${entry.level.toUpperCase().padEnd(5, " ")} (core)${category}: ${entry.message}${suffix}`;
}

function formatTimestamp(timestamp: string): string {
  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    return timestamp;
  }

  return date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
    hour12: false,
  });
}
