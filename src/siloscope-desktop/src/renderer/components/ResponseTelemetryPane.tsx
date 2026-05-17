import { useMemo } from "react";
import type { InvocationResult, InvocationTiming } from "../../shared/types";
import { MonacoEditor } from "./MonacoEditor";

type ResponseTelemetryPaneProps = {
  result: InvocationResult | null;
  theme: "dark" | "light";
};

export function ResponseTelemetryPane({ result, theme }: ResponseTelemetryPaneProps) {
  const output = useMemo(() => formatResult(result), [result]);

  return (
    <aside className="response-pane" aria-labelledby="response-pane-title">
      <div className="response-pane__toolbar">
        <span id="response-pane-title">Response</span>
        <span>{result ? (result.isSuccess ? "Success" : "Error") : "Idle"}</span>
      </div>

      <div className="response-pane__section response-pane__section--editor">
        <div className="response-pane__section-header">
          <span>Output</span>
          <span>Read-only</span>
        </div>
        <MonacoEditor value={output} onChange={() => undefined} readOnly theme={theme} />
      </div>

      <div className="response-pane__section response-pane__section--timing">
        <div className="response-pane__section-header">
          <span>Timing</span>
          <span>{formatTotal(result?.timing)}</span>
        </div>
        <TimingBars timing={result?.timing ?? null} />
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

  return (
    <dl className="response-pane__timing" aria-label="Invocation timing">
      {items.map((item) => (
        <div key={item.label} className="response-pane__timing-row">
          <dt>{item.label}</dt>
          <dd>
            <span className="response-pane__bar-track" aria-hidden="true">
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
  );
}

function formatResult(result: InvocationResult | null): string {
  if (!result) {
    return JSON.stringify({ status: "idle" }, null, 2);
  }

  return JSON.stringify(
    {
      status: result.isSuccess ? "success" : "error",
      output: coerceOutput(result.result),
      error: result.error ?? null,
    },
    null,
    2,
  );
}

function coerceOutput(value: string | undefined): unknown {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function formatTotal(timing: InvocationTiming | undefined): string {
  return timing ? formatMs(timing.totalMs) : "No run";
}

function formatMs(value: number): string {
  return `${value.toFixed(value < 10 && value > 0 ? 1 : 0)} ms`;
}
