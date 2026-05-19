import { useMemo } from "react";
import type { InvocationResult, InvocationTiming } from "../../shared/types";
import { MonacoEditor } from "./MonacoEditor";

export type ResponsePaneTab = "response" | "timing";

type ResponseTelemetryPaneProps = {
  activeTab: ResponsePaneTab;
  onTabChange: (tab: ResponsePaneTab) => void;
  result: InvocationResult | null;
  theme: "dark" | "light" | "vscode-dark" | "vscode-light";
};

export function ResponseTelemetryPane({
  activeTab,
  onTabChange,
  result,
  theme,
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
              <MonacoEditor value={output} onChange={() => undefined} readOnly theme={theme} />
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
          <div className="response-pane__section-header">
            <span>Breakdown</span>
            <span>{formatTotal(result?.timing)}</span>
          </div>
          <TimingBars timing={result?.timing ?? null} />
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

function formatTotal(timing: InvocationTiming | undefined): string {
  return timing ? formatMs(timing.totalMs) : "No run";
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
