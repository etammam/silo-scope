import { Check, Copy, CircleCheck, CircleX, Clock, Hash, Loader2, Zap } from "lucide-react";
import { useMemo, useState } from "react";
import type { InvocationResult, InvocationTiming } from "../../shared/types";
import { MonacoEditor } from "./MonacoEditor";

export type ResponsePaneTab = "response" | "timing";
export type ResponseViewMode = "pretty" | "raw";

type InvocationHistoryEntry = {
  timestamp: number;
  isSuccess: boolean;
  timing: { totalMs: number; executionMs: number; serializationMs: number } | null;
};

type ResponseTelemetryPaneProps = {
  activeTab: ResponsePaneTab;
  onTabChange: (tab: ResponsePaneTab) => void;
  result: InvocationResult | null;
  isInvoking?: boolean;
  theme: "vscode-dark" | "vscode-light" | "github-dark" | "github-light";
  invocationHistory?: InvocationHistoryEntry[];
  fontFamily?: string;
  fontSize?: number;
};

export function ResponseTelemetryPane({
  activeTab,
  onTabChange,
  result,
  isInvoking = false,
  theme,
  invocationHistory = [],
  fontFamily,
  fontSize,
}: ResponseTelemetryPaneProps) {
  const [viewMode, setViewMode] = useState<ResponseViewMode>("pretty");
  const [copied, setCopied] = useState(false);
  const output = useMemo(() => formatResult(result), [result]);
  const rawOutput = useMemo(
    () => (result ? (result.result ?? result.error ?? "Empty result") : ""),
    [result],
  );
  const displayed = result && viewMode === "raw" ? rawOutput : output;

  const badge = isInvoking
    ? { tone: "invoking" as const, label: "Requesting", Icon: Loader2 }
    : result
      ? result.isSuccess
        ? { tone: "success" as const, label: "Success", Icon: CircleCheck }
        : { tone: "error" as const, label: "Error", Icon: CircleX }
      : { tone: "idle" as const, label: "Idle", Icon: Clock };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(displayed);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <aside className="response-pane" aria-labelledby="response-pane-title">
      {/* ── Toolbar ── */}
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

        <div className="response-pane__toolbar-right">
          <span
            className={`response-pane__badge response-pane__badge--${badge.tone}`}
          >
            <badge.Icon aria-hidden="true" width={10} height={10} />
            {badge.label}
          </span>

          {result && (
            <>
              {result.timing && (
                <span className="response-pane__latency">
                  <Zap aria-hidden="true" width={10} height={10} />
                  {result.timing.totalMs}ms
                </span>
              )}
              <div
                aria-label="Response view mode"
                className="response-pane__view-toggle"
                role="group"
              >
                <button
                  aria-pressed={viewMode === "pretty"}
                  onClick={() => setViewMode("pretty")}
                  type="button"
                >
                  Pretty
                </button>
                <button
                  aria-pressed={viewMode === "raw"}
                  onClick={() => setViewMode("raw")}
                  type="button"
                >
                  Raw
                </button>
              </div>
              <button
                aria-label="Copy response"
                className={`response-pane__copy-button ${copied ? "response-pane__copy-button--copied" : ""}`}
                onClick={() => void handleCopy()}
                type="button"
              >
                {copied ? (
                  <Check aria-hidden="true" width={11} height={11} />
                ) : (
                  <Copy aria-hidden="true" width={11} height={11} />
                )}
                {copied ? "Copied" : "Copy"}
              </button>
            </>
          )}
        </div>
      </div>

      {/* ── Response tab ── */}
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
                <span className="response-pane__section-header-meta">
                  <Hash aria-hidden="true" width={10} height={10} />
                  {formatBytes(displayed.length)}
                </span>
              </div>
              <MonacoEditor
                value={displayed}
                onChange={() => undefined}
                readOnly
                theme={theme}
                fontFamily={fontFamily}
                fontSize={fontSize}
              />
            </>
          ) : isInvoking ? (
            <div className="response-pane__empty-state response-pane__empty-state--waiting">
              <div className="response-pane__waiting-indicator">
                <Loader2 aria-hidden="true" width={24} height={24} className="response-pane__waiting-spinner" />
              </div>
              <strong>Waiting for response…</strong>
              <span>The grain is processing your request.</span>
            </div>
          ) : (
            <div className="response-pane__empty-state">
              <div className="response-pane__empty-state-icon">
                <Zap aria-hidden="true" width={28} height={28} />
              </div>
              <strong>No response yet</strong>
              <span>Invoke a grain to see the serialized result here.</span>
              <span className="response-pane__empty-state-hint">
                Use <kbd>Cmd+Enter</kbd> or click Invoke
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── Timing tab ── */}
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

      {/* ── Status bar ── */}
      <div className="response-pane__status-bar">
        <span className="response-pane__status-bar-status">
          {result ? (result.isSuccess ? "200 OK" : "Error") : "Idle"}
        </span>
        {result?.timing && (
          <span className="response-pane__status-bar-timing">
            {result.timing.totalMs}ms total
            <span className="response-pane__status-bar-sep">·</span>
            {result.timing.executionMs}ms exec
          </span>
        )}
      </div>
    </aside>
  );
}

/* ── Timing sub-components ── */

type TimingEntry = { label: string; value: number; fraction: number };

function BreakdownBars({ timing }: { timing: InvocationTiming | null }) {
  const total = timing?.totalMs ?? 0;
  const exec = timing?.executionMs ?? 0;
  const ser = timing?.serializationMs ?? 0;

  if (total <= 0) return null;

  const items: TimingEntry[] = [
    { label: "Serialization", value: ser, fraction: total > 0 ? ser / total : 0 },
    { label: "Execution", value: exec, fraction: total > 0 ? exec / total : 0 },
  ];

  return (
    <div className="response-pane__timing-breakdown">
      <div className="response-pane__timing-breakdown-header">
        Call Breakdown
        <span className="response-pane__timing-breakdown-total">{formatMs(total)}</span>
      </div>

      {/* Stacked horizontal bar */}
      <div className="response-pane__stacked-bar" aria-hidden="true">
        {items.map((item) => (
          <span
            key={item.label}
            className={`response-pane__stacked-segment response-pane__stacked-segment--${item.label.toLowerCase()}`}
            style={{ flex: item.fraction > 0 ? item.fraction : undefined, minWidth: item.value > 0 ? "2px" : undefined }}
          />
        ))}
        {total - ser - exec > 0 && (
          <span
            className="response-pane__stacked-segment response-pane__stacked-segment--overhead"
            style={{ flex: (total - ser - exec) / total }}
          />
        )}
      </div>

      {/* Legend */}
      <div className="response-pane__timing-legend">
        {items.map((item) => (
          <div key={item.label} className="response-pane__timing-legend-item">
            <span className={`response-pane__timing-legend-swatch response-pane__timing-legend-swatch--${item.label.toLowerCase()}`} />
            <span className="response-pane__timing-legend-label">{item.label}</span>
            <span className="response-pane__timing-legend-value">{formatMs(item.value)}</span>
          </div>
        ))}
        {total - ser - exec > 0 && (
          <div className="response-pane__timing-legend-item">
            <span className="response-pane__timing-legend-swatch response-pane__timing-legend-swatch--overhead" />
            <span className="response-pane__timing-legend-label">Overhead</span>
            <span className="response-pane__timing-legend-value">{formatMs(total - ser - exec)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

function Sparkline({ points, maxVal, height }: { points: number[]; maxVal: number; height: number }) {
  if (points.length < 2) return null;
  const w = 100;
  const h = height;
  const pad = 0;
  const stepX = (w - pad * 2) / (points.length - 1);
  const normY = (v: number) => h - pad - (maxVal > 0 ? (v / maxVal) * (h - pad * 2) : 0);

  const pathD = points
    .map((v, i) => `${i === 0 ? "M" : "L"} ${pad + i * stepX} ${normY(v)}`)
    .join(" ");

  // Area fill path
  const areaD = `${pathD} L ${pad + (points.length - 1) * stepX} ${h - pad} L ${pad} ${h - pad} Z`;

  return (
    <svg
      className="timing-dashboard__sparkline"
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={areaD} className="timing-dashboard__sparkline-area" />
      <path d={pathD} className="timing-dashboard__sparkline-line" fill="none" />
    </svg>
  );
}

const DIST_BUCKETS = [
  { max: 10, label: "<10ms", cls: "fast" as const },
  { max: 50, label: "10–50ms", cls: "mid" as const },
  { max: 200, label: "50–200ms", cls: "slow" as const },
  { max: Infinity, label: "200ms+", cls: "tail" as const },
];

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

  const timings = history
    .filter((h) => h.timing)
    .map((h) => h.timing!.totalMs)
    .sort((a, b) => a - b);

  const p50 = percentile(timings, 50);
  const p95 = percentile(timings, 95);
  const p99 = percentile(timings, 99);
  const maxTotal = timings.length > 0 ? timings[timings.length - 1] : 0;

  // Distribution buckets
  const buckets = DIST_BUCKETS.map((bucket) => ({
    ...bucket,
    count: timings.filter((t) => t <= bucket.max).length,
  }));
  // Make counts non-cumulative
  for (let i = buckets.length - 1; i > 0; i--) {
    buckets[i] = { ...buckets[i], count: buckets[i].count - buckets[i - 1].count };
  }
  const bucketMax = Math.max(...buckets.map((b) => b.count), 1);

  // Sparkline data (last 30 calls)
  const sparklinePoints = history
    .slice(0, 30)
    .reverse()
    .map((h) => h.timing?.totalMs ?? 0);

  const isEmpty = totalCalls === 0 && !currentTiming;

  if (isEmpty) {
    return (
      <div className="timing-dashboard__empty-state">
        <Clock aria-hidden="true" width={24} height={24} />
        <span>No invocations yet. Invoke a grain to see timing data.</span>
      </div>
    );
  }

  return (
    <div className="timing-dashboard">
      {/* Stats */}
      <div className="timing-dashboard__section">
        <div className="timing-dashboard__section-header">Calls</div>
        <div className="timing-dashboard__stats">
          <div className="timing-dashboard__stat">
            <span className="timing-dashboard__stat-value">{totalCalls}</span>
            <span className="timing-dashboard__stat-label">Total</span>
          </div>
          <div className="timing-dashboard__stat timing-dashboard__stat--success">
            <span className="timing-dashboard__stat-value">{successCount}</span>
            <span className="timing-dashboard__stat-label">Success</span>
          </div>
          <div className="timing-dashboard__stat timing-dashboard__stat--error">
            <span className="timing-dashboard__stat-value">{failureCount}</span>
            <span className="timing-dashboard__stat-label">Failed</span>
          </div>
          <div className="timing-dashboard__stat">
            <span className="timing-dashboard__stat-value">{successRate.toFixed(1)}%</span>
            <span className="timing-dashboard__stat-label">Rate</span>
          </div>
        </div>
      </div>

      {timings.length > 0 && (
        <>
          {/* Sparkline trend */}
          <div className="timing-dashboard__section">
            <div className="timing-dashboard__section-header">
              Latency Trend
              <span className="timing-dashboard__section-header-extra">{formatMs(maxTotal)} peak</span>
            </div>
            <div className="timing-dashboard__sparkline-container">
              <Sparkline points={sparklinePoints} maxVal={maxTotal} height={48} />
              <div className="timing-dashboard__sparkline-labels">
                <span>{formatMs(Math.min(...sparklinePoints))}</span>
                <span>{formatMs(maxTotal)}</span>
              </div>
            </div>
          </div>

          {/* Percentiles */}
          <div className="timing-dashboard__section">
            <div className="timing-dashboard__section-header">Percentiles</div>
            <div className="timing-dashboard__stats timing-dashboard__stats--perf">
              <div className="timing-dashboard__stat">
                <span className="timing-dashboard__stat-value">{formatMs(p50)}</span>
                <span className="timing-dashboard__stat-label">P50</span>
              </div>
              <div className="timing-dashboard__stat">
                <span className="timing-dashboard__stat-value">{formatMs(p95)}</span>
                <span className="timing-dashboard__stat-label">P95</span>
              </div>
              <div className="timing-dashboard__stat">
                <span className="timing-dashboard__stat-value">{formatMs(p99)}</span>
                <span className="timing-dashboard__stat-label">P99</span>
              </div>
            </div>
          </div>

          {/* Distribution */}
          <div className="timing-dashboard__section">
            <div className="timing-dashboard__section-header">Distribution</div>
            <div className="timing-dashboard__distribution">
              {buckets.map((bucket) => (
                <div key={bucket.label} className="timing-dashboard__dist-row">
                  <span className="timing-dashboard__dist-label">{bucket.label}</span>
                  <span className="timing-dashboard__dist-bar-wrapper">
                    <span
                      className={`timing-dashboard__dist-bar timing-dashboard__dist-bar--${bucket.cls}`}
                      style={{ width: `${Math.max((bucket.count / bucketMax) * 100, bucket.count > 0 ? 2 : 0)}%` }}
                    />
                  </span>
                  <span className="timing-dashboard__dist-count">{bucket.count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Timeline bars */}
          <div className="timing-dashboard__section">
            <div className="timing-dashboard__section-header">
              Timeline
              <span className="timing-dashboard__section-header-extra">last {Math.min(20, totalCalls)}</span>
            </div>
            <div className="timing-dashboard__timeline">
              {history.slice(0, 20).map((entry, index) => {
                const ms = entry.timing?.totalMs ?? 0;
                const h = maxTotal > 0 ? Math.max(3, (ms / maxTotal) * 100) : 3;
                return (
                  <div
                    key={index}
                    className={`timing-dashboard__timeline-bar ${entry.isSuccess ? "timing-dashboard__timeline-bar--success" : "timing-dashboard__timeline-bar--error"}`}
                    style={{ height: `${h}%` }}
                    title={`${entry.isSuccess ? "Success" : "Failed"}: ${ms > 0 ? formatMs(ms) : "N/A"}`}
                  />
                );
              })}
            </div>
            <div className="timing-dashboard__timeline-scale">
              <span>0</span>
              <span>{formatMs(maxTotal)}</span>
            </div>
          </div>
        </>
      )}

      {currentTiming && <BreakdownBars timing={currentTiming} />}
    </div>
  );
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(idx, sorted.length - 1))];
}

/* ── Formatters ── */

function formatResult(result: InvocationResult | null): string {
  if (!result) return JSON.stringify({ status: "idle" }, null, 2);
  if (result.isSuccess && result.result) {
    try {
      return JSON.stringify(JSON.parse(result.result), null, 2);
    } catch {
      return result.result;
    }
  }
  if (!result.isSuccess && result.error) return result.error;
  return "Empty result";
}

function formatMs(value: number): string {
  return `${value.toFixed(value < 10 && value > 0 ? 1 : 0)} ms`;
}

function formatBytes(value: number): string {
  if (value < 1024) return `${value} B`;
  return `${(value / 1024).toFixed(1)} KB`;
}
