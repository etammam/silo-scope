import { useMemo } from "react";
import type { InvocationResult, InvocationTiming } from "../../shared/types";
import { MonacoEditor } from "./MonacoEditor";

export type ResponsePaneTab = "response" | "timing";

type InvocationHistoryEntry = {
  timestamp: number;
  isSuccess: boolean;
  timing: { totalMs: number; executionMs: number; serializationMs: number } | null;
};

type ResponseTelemetryPaneProps = {
  activeTab: ResponsePaneTab;
  onTabChange: (tab: ResponsePaneTab) => void;
  result: InvocationResult | null;
  theme: "dark" | "light" | "vscode-dark" | "vscode-light";
  invocationHistory?: InvocationHistoryEntry[];
  fontFamily?: string;
  fontSize?: number;
};

export function ResponseTelemetryPane({
  activeTab,
  onTabChange,
  result,
  theme,
  invocationHistory = [],
  fontFamily,
  fontSize,
}: ResponseTelemetryPaneProps) {
  const output = useMemo(() => formatResult(result), [result]);

  return (
    <aside className="response-pane" aria-labelledby="response-pane-title">
      <div className="response-pane__toolbar">
        <div className="response-pane__tabs" role="tablist" aria-label="Response views">
          <button
            aria-controls="response-output-panel"
            aria-selected={activeTab === "response"}
            id="response-pane-title"
            onClick={() => onTabChange("response")}
            role="tab"
            type="button"
          >
            Response
          </button>
          <button
            aria-controls="response-timing-panel"
            aria-selected={activeTab === "timing"}
            onClick={() => onTabChange("timing")}
            role="tab"
            type="button"
          >
            Timing
          </button>
        </div>
      </div>

      {activeTab === "response" && (
        <div
          aria-labelledby="response-pane-title"
          className={`response-pane__section ${result ? "response-pane__section--editor" : "response-pane__section--empty"}`}
          id="response-output-panel"
          role="tabpanel"
        >
          {result ? (
            <>
              <div className="response-pane__section-header">
                <span>Output</span>
                <span>Read-only</span>
              </div>
              <MonacoEditor value={output} onChange={() => undefined} readOnly theme={theme} fontFamily={fontFamily} fontSize={fontSize} />
            </>
          ) : (
            <div className="response-pane__empty-state">
              <div aria-hidden="true" className="response-pane__empty-mark">
                <span />
              </div>
              <strong>No response yet</strong>
              <span>Invoke a grain to inspect the serialized result here.</span>
            </div>
          )}
        </div>
      )}

      {activeTab === "timing" && (
        <div
          aria-label="Timing"
          className="response-pane__section response-pane__section--timing"
          id="response-timing-panel"
          role="tabpanel"
        >
          <TimingDashboard
            currentTiming={result?.timing ?? null}
            history={invocationHistory}
          />
        </div>
      )}

      <div className="response-pane__status-bar">
        <span>{result ? (result.isSuccess ? "Success" : "Error") : "Idle"}</span>
        <span>{result ? "Response received" : "No response yet"}</span>
      </div>
    </aside>
  );
}

function TimingBars({ timing }: { timing: InvocationTiming | null }) {
  const items = [
    { label: "Serialization", value: timing?.serializationMs ?? 0 },
    { label: "Execution", value: timing?.executionMs ?? 0 },
    { label: "Total", value: timing?.totalMs ?? 0 },
  ];
  const max = Math.max(...items.map((item) => item.value), 1);
  const total = timing?.totalMs ?? 0;

  return (
    <div className="response-pane__timing-dashboard">
      <dl className="response-pane__timing-summary" aria-label="Timing summary">
        <div>
          <dt>Total</dt>
          <dd>{formatMs(total)}</dd>
        </div>
        <div>
          <dt>Execution</dt>
          <dd>{formatPercent(timing?.executionMs ?? 0, total)}</dd>
        </div>
        <div>
          <dt>Serialization</dt>
          <dd>{formatPercent(timing?.serializationMs ?? 0, total)}</dd>
        </div>
      </dl>

      <dl className="response-pane__timing" aria-label="Invocation timing">
        {items.map((item) => (
          <div key={item.label} className="response-pane__timing-row">
            <dt>{item.label}</dt>
            <dd>
              <span
                aria-label={`${item.label}: ${formatMs(item.value)}`}
                className="response-pane__bar-track"
                role="img"
              >
                <span
                  className="response-pane__bar-fill"
                  style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 4 : 0)}%` }}
                />
              </span>
              <span>{formatMs(item.value)}</span>
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function TimingDashboard({
  currentTiming,
  history,
}: {
  currentTiming: InvocationTiming | null;
  history: InvocationHistoryEntry[];
}) {
  const totalCalls = history.length;
  const successCount = history.filter((h) => h.isSuccess).length;
  const failureCount = totalCalls - successCount;
  const successRate = totalCalls > 0 ? (successCount / totalCalls) * 100 : 0;

  const avgTotal =
    totalCalls > 0
      ? history.reduce((sum, h) => sum + (h.timing?.totalMs ?? 0), 0) / totalCalls
      : 0;
  const minTotal =
    totalCalls > 0
      ? Math.min(...history.filter((h) => h.timing).map((h) => h.timing!.totalMs))
      : 0;
  const maxTotal =
    totalCalls > 0
      ? Math.max(...history.filter((h) => h.timing).map((h) => h.timing!.totalMs))
      : 0;

  return (
    <div className="timing-dashboard">
      <div className="timing-dashboard__header">
        <span>Call History</span>
      </div>

      <div className="timing-dashboard__stats">
        <div className="timing-dashboard__stat">
          <span className="timing-dashboard__stat-label">Total Calls</span>
          <span className="timing-dashboard__stat-value">{totalCalls}</span>
        </div>
        <div className="timing-dashboard__stat timing-dashboard__stat--success">
          <span className="timing-dashboard__stat-label">Success</span>
          <span className="timing-dashboard__stat-value">{successCount}</span>
        </div>
        <div className="timing-dashboard__stat timing-dashboard__stat--error">
          <span className="timing-dashboard__stat-label">Failed</span>
          <span className="timing-dashboard__stat-value">{failureCount}</span>
        </div>
        <div className="timing-dashboard__stat">
          <span className="timing-dashboard__stat-label">Success Rate</span>
          <span className="timing-dashboard__stat-value">{successRate.toFixed(1)}%</span>
        </div>
      </div>

      {totalCalls > 0 && (
        <>
          <div className="timing-dashboard__header timing-dashboard__header--secondary">
            <span>Performance</span>
          </div>

          <div className="timing-dashboard__stats timing-dashboard__stats--secondary">
            <div className="timing-dashboard__stat">
              <span className="timing-dashboard__stat-label">Avg</span>
              <span className="timing-dashboard__stat-value">{formatMs(avgTotal)}</span>
            </div>
            <div className="timing-dashboard__stat">
              <span className="timing-dashboard__stat-label">Min</span>
              <span className="timing-dashboard__stat-value">{formatMs(minTotal)}</span>
            </div>
            <div className="timing-dashboard__stat">
              <span className="timing-dashboard__stat-label">Max</span>
              <span className="timing-dashboard__stat-value">{formatMs(maxTotal)}</span>
            </div>
          </div>

          <div className="timing-dashboard__timeline">
            <div className="timing-dashboard__timeline-label">Timeline (last {Math.min(20, totalCalls)} calls)</div>
            <div className="timing-dashboard__timeline-bars">
              {history.slice(0, 20).map((entry, index) => (
                <div
                  key={index}
                  className={`timing-dashboard__timeline-bar ${entry.isSuccess ? "timing-dashboard__timeline-bar--success" : "timing-dashboard__timeline-bar--error"}`}
                  style={{
                    height: entry.timing
                      ? `${Math.min(100, (entry.timing.totalMs / maxTotal) * 100)}%`
                      : "0%",
                  }}
                  title={`${entry.isSuccess ? "Success" : "Failed"}: ${entry.timing ? formatMs(entry.timing.totalMs) : "N/A"}`}
                />
              ))}
            </div>
          </div>
        </>
      )}

      {currentTiming && (
        <>
          <div className="timing-dashboard__header timing-dashboard__header--secondary">
            <span>Current Call Breakdown</span>
          </div>
          <TimingBars timing={currentTiming} />
        </>
      )}

      {totalCalls === 0 && !currentTiming && (
        <div className="timing-dashboard__empty">
          No invocations yet. Invoke a grain to see timing data.
        </div>
      )}
    </div>
  );
}

function formatResult(result: InvocationResult | null): string {
  if (!result) {
    return JSON.stringify({ status: "idle" }, null, 2);
  }

  if (result.isSuccess && result.result) {
    try {
      return JSON.stringify(JSON.parse(result.result), null, 2);
    } catch {
      return result.result;
    }
  }

  if (!result.isSuccess && result.error) {
    return result.error;
  }

  return "Empty result";
}

function formatMs(value: number): string {
  return `${value.toFixed(value < 10 && value > 0 ? 1 : 0)} ms`;
}

function formatPercent(value: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }

  return `${Math.round((value / total) * 100)}%`;
}
