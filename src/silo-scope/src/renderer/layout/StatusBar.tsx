import { PanelLeftClose, Plug, Server, SquareTerminal } from "lucide-react";
import type { LogEntry } from "../../features/logs/schema";
import type { ConnectionStatus } from "../../features/workspaces/renderer/state";
import { ConnectionStatusBar } from "./ConnectionStatusBar";
import { SidecarStatus } from "./SidecarStatus";
import "./status-bar.css";

export type StatusBarProps = {
  connectionStatus: ConnectionStatus;
  connectionStep: string;
  connectionError: string | null;
  clusterName?: string;
  onDismissError: () => void;
  sidecarCheckStatus: () => Promise<{ running: boolean }>;
  sidecarRestart: () => Promise<{ running: boolean }>;
  logs: LogEntry[];
  isLogPanelVisible: boolean;
  onToggleLogPanel: () => void;
  isNavigationVisible: boolean;
  onToggleNavigation: () => void;
};

export function StatusBar({
  connectionStatus,
  connectionStep,
  connectionError,
  clusterName,
  onDismissError,
  sidecarCheckStatus,
  sidecarRestart,
  logs,
  isLogPanelVisible,
  onToggleLogPanel,
  isNavigationVisible,
  onToggleNavigation,
}: StatusBarProps) {
  const errors = logs.filter((e) => e.level === "error").length;

  return (
    <footer
      className="status-bar"
      role="status"
      aria-label="Application status bar"
    >
      {/* ── Left items ── */}
      <div className="status-bar__left">
        <button
          aria-label={
            isNavigationVisible ? "Hide grain explorer" : "Show grain explorer"
          }
          className="status-bar__item"
          onClick={onToggleNavigation}
          title={
            isNavigationVisible ? "Hide grain explorer" : "Show grain explorer"
          }
          type="button"
        >
          <PanelLeftClose
            aria-hidden="true"
            className="status-bar__item-icon"
            width={12}
            height={12}
          />
        </button>

        <span className="status-bar__divider" aria-hidden="true" />

        <span className="status-bar__item">
          <Plug
            aria-hidden="true"
            className="status-bar__item-icon"
            width={12}
            height={12}
          />
          <ConnectionStatusBar
            status={connectionStatus}
            step={connectionStep}
            error={connectionError}
            clusterName={clusterName}
            onDismissError={onDismissError}
          />
        </span>

        <span className="status-bar__divider" aria-hidden="true" />

        <span className="status-bar__item">
          <Server
            aria-hidden="true"
            className="status-bar__item-icon"
            width={12}
            height={12}
          />
          <SidecarStatus
            checkStatus={sidecarCheckStatus}
            restart={sidecarRestart}
          />
        </span>
      </div>

      {/* ── Right items ── */}
      <div className="status-bar__right">
        <button
          aria-expanded={isLogPanelVisible}
          aria-label={`Backend logs — ${logs.length} entries${errors > 0 ? `, ${errors} errors` : ""}`}
          className="status-bar__item"
          onClick={onToggleLogPanel}
          type="button"
        >
          <SquareTerminal
            aria-hidden="true"
            className="status-bar__item-icon"
            width={12}
            height={12}
          />
          <span className="status-bar__log-count">{logs.length}</span>
          {errors > 0 && (
            <span className="status-bar__log-errors">{errors}</span>
          )}
        </button>
      </div>
    </footer>
  );
}
