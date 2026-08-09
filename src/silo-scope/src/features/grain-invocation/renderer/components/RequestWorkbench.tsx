import { AlertTriangle, Code, FileJson, Info, Loader2, Play } from "lucide-react";
import type * as Monaco from "monaco-editor";
import { useEffect, useMemo, useRef, useState } from "react";
import type { SourceCatalogFunction, SourceOwnedCatalog } from "../../schema";
import type { EnvironmentProfile } from "../../../environments/schema";
import type { GrainInterfaceDescriptor, GrainKeyType, GrainMethodDescriptor } from "../../../workspaces/schema";
import { findCatalogFunction, findCatalogSource } from "../utils/catalog";
import { classifyTokens, findMissingTokens } from "../../../environments/renderer/utils/environment-substitution";
import {
  findMockTokens,
  hasMockTokens,
  substituteMockTokens,
} from "../../../../renderer/shared/mock-tokens";
import { InlineAutocomplete } from "../../../../renderer/shared/components/InlineAutocomplete";
import { MonacoEditor } from "../../../../renderer/shared/components/MonacoEditor";
import "./request-workbench.css";

type RequestWorkbenchProps = {
  grains: GrainInterfaceDescriptor[];
  sourceCatalog?: SourceOwnedCatalog;
  selectedFunctionId?: string | null;
  selectedGrain: string | null;
  selectedMethod: string | null;
  theme: "vscode-dark" | "vscode-light" | "github-dark" | "github-light";
  onSelectGrain: (grainId: string | null) => void;
  onSelectFunction?: (functionId: string | null) => void;
  onSelectMethod: (methodName: string | null) => void;
  requestState: RequestState;
  onRequestStateChange: (nextState: RequestState) => void;
  environments?: EnvironmentProfile[];
  activeEnvironment?: string | null;
  isInvoking?: boolean;
  onInvoke: (request: {
    grainType: string;
    grainKey: string;
    keyType: GrainKeyType;
    method: string;
    payload: string;
    sourceId?: string;
    functionId?: string;
  }) => void;
};

type RequestTab = "payload" | "context" | "docs";

export type RequestState = {
  grainKey: string;
  keyType: GrainKeyType;
  payload: string;
};

export function RequestWorkbench({
  grains,
  sourceCatalog,
  selectedFunctionId,
  selectedGrain,
  selectedMethod,
  theme,
  requestState,
  onRequestStateChange,
  environments = [],
  activeEnvironment,
  isInvoking = false,
  onInvoke,
}: RequestWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<RequestTab>("payload");
  const grainKeyInputRef = useRef<HTMLInputElement>(null);
  const isMacShortcut = useMemo(() => navigator.userAgent.includes("Mac"), []);

  const activeFunction = useMemo(
    () =>
      findCatalogFunction(
        sourceCatalog ?? { sources: [] },
        selectedFunctionId ?? null,
      ),
    [selectedFunctionId, sourceCatalog],
  );
  const activeSource = useMemo(
    () =>
      findCatalogSource(
        sourceCatalog ?? { sources: [] },
        activeFunction?.sourceId ?? null,
      ),
    [activeFunction, sourceCatalog],
  );
  const activeInterface = useMemo(
    () =>
      activeSource?.interfaces.find(
        (catalogInterface) =>
          catalogInterface.interfaceId === activeFunction?.interfaceId,
      ) ?? null,
    [activeFunction, activeSource],
  );
  const activeGrain = useMemo(
    () => grains.find((grain) => grain.interfaceId === selectedGrain) ?? null,
    [grains, selectedGrain],
  );
  const methods = useMemo(
    () =>
      activeInterface?.methods.map(toGrainMethod) ?? activeGrain?.methods ?? [],
    [activeGrain, activeInterface],
  );
  const activeMethod = activeFunction
    ? toGrainMethod(activeFunction)
    : (methods.find((method) => method.name === selectedMethod) ?? null);

  const payloadError = useMemo(
    () => validateJson(requestState.payload),
    [requestState.payload],
  );
  const payloadLineCount = useMemo(
    () => requestState.payload.split("\n").length,
    [requestState.payload],
  );

  const activeEnvVars = useMemo(() => {
    const env = environments.find((e) => e.name === activeEnvironment);
    return env?.variables ?? {};
  }, [environments, activeEnvironment]);

  const missingGrainKeyTokens = useMemo(
    () => findMissingTokens(requestState.grainKey, activeEnvVars),
    [requestState.grainKey, activeEnvVars],
  );
  const missingPayloadTokens = useMemo(
    () => findMissingTokens(requestState.payload, activeEnvVars),
    [requestState.payload, activeEnvVars],
  );
  const missingEnvKeys = useMemo(
    () =>
      Array.from(new Set([...missingGrainKeyTokens, ...missingPayloadTokens])),
    [missingGrainKeyTokens, missingPayloadTokens],
  );
  const hasValidGrainKeyTokens = useMemo(() => {
    const classified = classifyTokens(requestState.grainKey, activeEnvVars);
    return classified.valid.length > 0;
  }, [requestState.grainKey, activeEnvVars]);
  const hasMockGrainKeyTokens = useMemo(
    () => hasMockTokens(requestState.grainKey),
    [requestState.grainKey],
  );

  const canInvoke = Boolean(
    (activeFunction || activeGrain) &&
      activeMethod &&
      requestState.grainKey.trim() &&
      !payloadError &&
      missingEnvKeys.length === 0,
  );

  function textToMonacoRange(text: string, start: number, end: number) {
    const before = text.slice(0, start);
    const lines = before.split("\n");
    const lineNumber = lines.length;
    const lineStart = lines[lines.length - 1].length;
    const startColumn = lineStart + 1;
    const endColumn = lineStart + 1 + (end - start);
    return {
      startLineNumber: lineNumber,
      startColumn,
      endLineNumber: lineNumber,
      endColumn,
    };
  }

  const { monacoMarkers, monacoDecorations } = useMemo(() => {
    const classified = classifyTokens(requestState.payload, activeEnvVars);
    const markers: Monaco.editor.IMarkerData[] = classified.missing.map(
      (match) => ({
        severity: 8,
        message: `Missing environment variable: ${match.key}`,
        ...textToMonacoRange(requestState.payload, match.start, match.end),
      }),
    );
    const envDecorations = classified.valid.map((match) => ({
      ...textToMonacoRange(requestState.payload, match.start, match.end),
      key: match.key,
      className: "env-token-valid" as const,
    }));
    const mockMatches = findMockTokens(requestState.payload);
    const mockDecorations = mockMatches.map((match) => ({
      ...textToMonacoRange(requestState.payload, match.start, match.end),
      key: match.field,
      className: "mock-token" as const,
    }));
    return {
      monacoMarkers: markers,
      monacoDecorations: [...envDecorations, ...mockDecorations],
    };
  }, [requestState.payload, activeEnvVars]);

  const handleInvoke = () => {
    if ((!activeGrain && !activeFunction) || !activeMethod || !canInvoke) {
      return;
    }
    const request = {
      grainType: activeFunction?.interfaceId ?? activeGrain!.interfaceName,
      grainKey: substituteMockTokens(requestState.grainKey.trim()),
      keyType: requestState.keyType,
      method: activeFunction?.methodName ?? activeMethod.name,
      payload: substituteMockTokens(requestState.payload),
      ...(activeFunction
        ? {
            sourceId: activeFunction.sourceId,
            functionId: activeFunction.functionId,
          }
        : {}),
    };
    onInvoke(request);
  };

  useEffect(() => {
    const handleKeyDown = (event: globalThis.KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && canInvoke) {
        event.preventDefault();
        handleInvoke();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [canInvoke, handleInvoke]);

  const methodLabel = activeFunction?.methodName ?? activeMethod?.name ?? null;
  const grainLabel = activeFunction?.interfaceName ?? activeGrain?.interfaceName ?? null;

  return (
    <section
      className="request-workbench"
      aria-labelledby="request-workbench-title"
    >
      <h2 className="request-workbench__sr-title" id="request-workbench-title">
        Request
      </h2>

      {/* ── Request line: the primary interaction surface ── */}
      <div className="request-workbench__request-line">
        <div className="request-workbench__request-line-inner">
          {/* Grain identity group */}
          <div className="request-workbench__identity-group">
            <label className="request-workbench__field">
              <span className="request-workbench__field-label">Grain ID</span>
              <InlineAutocomplete
                envVars={Object.keys(activeEnvVars)}
                warnUnresolved={!activeEnvironment}
              >
                <input
                  ref={grainKeyInputRef}
                  aria-invalid={missingGrainKeyTokens.length > 0}
                  autoComplete="off"
                  data-1p-ignore="true"
                  data-env-error={missingGrainKeyTokens.length > 0}
                  data-env-valid={
                    hasValidGrainKeyTokens && missingGrainKeyTokens.length === 0
                  }
                  data-mock-valid={hasMockGrainKeyTokens}
                  placeholder="Primary key"
                  title={
                    missingGrainKeyTokens.length > 0
                      ? `Missing: ${missingGrainKeyTokens.join(", ")}`
                      : undefined
                  }
                  value={requestState.grainKey}
                  onChange={(event) =>
                    onRequestStateChange({
                      ...requestState,
                      grainKey: event.target.value,
                    })
                  }
                />
              </InlineAutocomplete>
            </label>

            <label className="request-workbench__field request-workbench__field--compact">
              <span className="request-workbench__field-label">Key Type</span>
              <select
                aria-label="Key type"
                value={requestState.keyType}
                onChange={(event) =>
                  onRequestStateChange({
                    ...requestState,
                    keyType: event.target.value as GrainKeyType,
                  })
                }
              >
                <option value="String">String</option>
                <option value="Guid">Guid</option>
                <option value="Integer">Integer</option>
              </select>
            </label>
          </div>

          {/* Method badge */}
          <div className="request-workbench__method-badge">
            <div className="request-workbench__method-badge-content">
              <span className="request-workbench__method-badge-label">
                {methodLabel ?? "No method"}
              </span>
              {grainLabel && (
                <span className="request-workbench__method-badge-grain">
                  {grainLabel}
                </span>
              )}
            </div>
            <span
              className={`request-workbench__key-type-pill request-workbench__key-type-pill--${requestState.keyType.toLowerCase()}`}
            >
              {requestState.keyType}
            </span>
          </div>

          {/* Invoke button */}
          <button
            className={`request-workbench__invoke-button ${isInvoking ? "request-workbench__invoke-button--invoking" : ""}`}
            disabled={!canInvoke || isInvoking}
            onClick={handleInvoke}
            type="button"
          >
            {isInvoking ? (
              <Loader2 aria-hidden="true" width={14} height={14} className="request-workbench__invoke-spinner" />
            ) : (
              <Play aria-hidden="true" width={14} height={14} />
            )}
            <span>{isInvoking ? "Invoking…" : "Invoke"}</span>
            {!isInvoking && (
              <kbd className="request-workbench__invoke-shortcut">
                {isMacShortcut ? "⌘↵" : "Ctrl↵"}
              </kbd>
            )}
          </button>
        </div>
      </div>

      {/* ── Method info strip ── */}
      <div className="request-workbench__method-strip">
        <div className="request-workbench__method-strip-item">
          <Info aria-hidden="true" width={12} height={12} />
          <span>
            <strong>{grainLabel ?? "—"}</strong>
            <span className="request-workbench__method-strip-sep">·</span>
            {methodLabel ?? "—"}
          </span>
        </div>
        <div className="request-workbench__method-strip-item">
          <span className="request-workbench__method-strip-meta">
            {activeFunction?.returnType ?? activeMethod?.returnType ?? "unknown"}
          </span>
        </div>
        <div className="request-workbench__method-strip-item">
          <span className="request-workbench__method-strip-meta">
            {formatParameterCount(
              activeFunction?.parameters ?? activeMethod?.parameters ?? [],
            )}
          </span>
        </div>
      </div>

      {/* ── Tabs ── */}
      <div
        className="request-workbench__tabs"
        aria-label="Request sections"
        role="tablist"
      >
        <button
          aria-selected={activeTab === "payload"}
          onClick={() => setActiveTab("payload")}
          role="tab"
          type="button"
        >
          <FileJson aria-hidden="true" width={13} height={13} />
          Payload
        </button>
        <button
          aria-selected={activeTab === "context"}
          onClick={() => setActiveTab("context")}
          role="tab"
          type="button"
        >
          <Info aria-hidden="true" width={13} height={13} />
          Context
        </button>
        <button
          aria-selected={activeTab === "docs"}
          onClick={() => setActiveTab("docs")}
          role="tab"
          type="button"
        >
          <Code aria-hidden="true" width={13} height={13} />
          Docs
        </button>
      </div>

      {/* ── Tab panels ── */}
      {activeTab === "payload" && (
        <div className="request-workbench__payload-panel">
          <div className="request-workbench__editor">
            <div className="request-workbench__editor-header">
              <span className="request-workbench__editor-title">Request Payload</span>
              <span className="request-workbench__editor-meta">
                {payloadLineCount} {payloadLineCount === 1 ? "line" : "lines"}
              </span>
            </div>
            <MonacoEditor
              value={requestState.payload}
              onChange={(payload) =>
                onRequestStateChange({ ...requestState, payload })
              }
              theme={theme}
              markers={monacoMarkers}
              decorations={monacoDecorations}
              envVars={Object.keys(activeEnvVars)}
            />
          </div>

          <div className="request-workbench__editor-footer">
            <span
              className={
                payloadError
                  ? "request-workbench__status request-workbench__status--error"
                  : "request-workbench__status request-workbench__status--ok"
              }
            >
              {payloadError ?? "JSON valid"}
            </span>
          </div>

          {missingEnvKeys.length > 0 && (
            <div className="request-workbench__env-banner" role="alert">
              <AlertTriangle aria-hidden="true" width={14} height={14} />
              <div>
                <strong>
                  Missing {missingEnvKeys.length} environment variable
                  {missingEnvKeys.length === 1 ? "" : "s"}
                </strong>
                <span className="request-workbench__env-banner-keys">
                  {missingEnvKeys.join(", ")}
                </span>
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "docs" && (
        <div className="request-workbench__docs" aria-label="Documentation">
          <div className="docs-section">
            <h3 className="docs-section__heading">Method Signature</h3>
            <p className="docs-section__desc">
              Full C# method signature for invoking this grain method.
            </p>
            <div className="docs-signature">
              <code>
                {activeFunction?.signature ??
                  activeMethod?.signature ??
                  "Task InvokeAsync(string grainId, object payload)"}
              </code>
            </div>
          </div>

          <div className="docs-section">
            <h3 className="docs-section__heading">Request Payload</h3>
            <p className="docs-section__desc">
              Map each parameter name to its corresponding JSON value.
            </p>
            <div className="docs-section__sub">
              <h4>
                Parameters (
                {visibleParameters(
                  activeFunction?.parameters ?? activeMethod?.parameters ?? [],
                ).length}
                )
              </h4>
              {visibleParameters(
                activeFunction?.parameters ?? activeMethod?.parameters ?? [],
              ).length > 0 ? (
                <table className="docs-params-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>C# Type</th>
                      <th>JSON</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleParameters(
                      activeFunction?.parameters ?? activeMethod?.parameters ?? [],
                    ).map((param) => (
                      <tr key={param.name}>
                        <td><code>{param.name}</code></td>
                        <td><span className="docs-cs-type">{param.typeName}</span></td>
                        <td><span className="docs-json-example">{defaultJsonValue(param.typeName)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="docs-empty">
                  No parameters required — send <code>{"{}"}</code>
                </p>
              )}
            </div>
          </div>

          <div className="docs-section">
            <h3 className="docs-section__heading">Response</h3>
            <p className="docs-section__desc">
              The return type determines the response shape.
            </p>
            <div className="docs-section__sub">
              <h4>Return Type</h4>
              <code className="docs-cs-type docs-cs-type--block">
                {activeFunction?.returnType ?? activeMethod?.returnType ?? "Task"}
              </code>
              <h4>Example</h4>
              <pre className="docs-response-example">
                {formatResponseExample(
                  activeFunction?.returnType ?? activeMethod?.returnType ?? "void",
                )}
              </pre>
            </div>
          </div>

          <div className="docs-section">
            <h3 className="docs-section__heading">Key Information</h3>
            <div className="docs-key-info">
              {[
                ["Grain Interface", activeFunction?.interfaceName ?? activeGrain?.interfaceName],
                ["Namespace", activeFunction?.namespace],
                ["Key Type", activeFunction?.keyType ?? activeMethod?.keyType],
                ["Source", activeSource?.sourceId],
              ].map(([label, value]) => (
                <div className="docs-info-row" key={label}>
                  <span className="docs-info-label">{label}</span>
                  <span className="docs-info-value">{value ?? "N/A"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {activeTab === "context" && (
        <div className="request-workbench__context" aria-label="Context">
          <div className="context-group">
            <h3 className="context-group__heading">Grain Identity</h3>
            <div className="context-cards">
              <div className="context-card">
                <span className="context-card__label">Grain ID</span>
                <span className="context-card__value context-card__value--mono">
                  {requestState.grainKey || "(enter grain key)"}
                </span>
              </div>
              <div className="context-card">
                <span className="context-card__label">Key Type</span>
                <span className="context-card__value">{requestState.keyType}</span>
              </div>
              <div className="context-card">
                <span className="context-card__label">Interface</span>
                <span className="context-card__value context-card__value--mono">
                  {grainLabel ?? "N/A"}
                </span>
              </div>
              <div className="context-card">
                <span className="context-card__label">Method</span>
                <span className="context-card__value context-card__value--mono">
                  {methodLabel ?? "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="context-group">
            <h3 className="context-group__heading">Source</h3>
            <div className="context-cards context-cards--auto">
              <div className="context-card">
                <span className="context-card__label">Source ID</span>
                <span className="context-card__value context-card__value--mono">
                  {activeSource?.sourceId ?? "N/A"}
                </span>
              </div>
              <div className="context-card">
                <span className="context-card__label">Source Type</span>
                <span className="context-card__value">
                  {activeSource?.sourceType ?? "N/A"}
                </span>
              </div>
              <div className="context-card context-card--full">
                <span className="context-card__label">Discovery Status</span>
                <span
                  className={`context-card__badge context-card__badge--${activeSource?.discoveryStatus?.toLowerCase() ?? "unknown"}`}
                >
                  {activeSource?.discoveryStatus ?? "Unknown"}
                </span>
              </div>
            </div>
          </div>

          <div className="context-group">
            <h3 className="context-group__heading">Invocation Details</h3>
            <div className="context-details">
              <div className="context-detail-row">
                <span className="context-detail-row__label">Full Signature</span>
                <code className="context-detail-row__signature">
                  {activeFunction?.signature ?? activeMethod?.signature ?? "N/A"}
                </code>
              </div>
              <div className="context-detail-row">
                <span className="context-detail-row__label">Return Type</span>
                <span className="context-detail-row__value context-detail-row__value--mono">
                  {activeFunction?.returnType ?? activeMethod?.returnType ?? "Task"}
                </span>
              </div>
              <div className="context-detail-row">
                <span className="context-detail-row__label">Function ID</span>
                <span className="context-detail-row__value context-detail-row__value--mono">
                  {activeFunction?.functionId ?? "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

/* ── Helpers ── */

function toGrainMethod(
  catalogFunction: SourceCatalogFunction,
): GrainMethodDescriptor {
  return {
    name: catalogFunction.methodName,
    parameters: visibleParameters(catalogFunction.parameters),
    signature: catalogFunction.signature,
    returnType: catalogFunction.returnType,
    keyType: catalogFunction.keyType,
  };
}

export function createPayloadTemplate(
  catalogFunction: SourceCatalogFunction,
): string {
  const parameters = visibleParameters(catalogFunction.parameters);
  if (parameters.length === 0) {
    return "{\n}";
  }
  const lines = parameters.map((parameter) => {
    return `  "${parameter.name}": ${defaultJsonValue(parameter.typeName)}`;
  });
  return `{\n${lines.join(",\n")}\n}`;
}

function formatParameterCount(
  parameters: GrainMethodDescriptor["parameters"],
): string {
  const visible = visibleParameters(parameters);
  const count = visible.length;
  if (count === 0) return "0 params";
  return `${count} param${count === 1 ? "" : "s"}`;
}

function visibleParameters<T extends { name: string; typeName: string }>(
  parameters: T[],
): T[] {
  return parameters.filter(
    (parameter) => !isCancellationTokenParameter(parameter),
  );
}

function isCancellationTokenParameter(parameter: {
  name: string;
  typeName: string;
}): boolean {
  return (
    parameter.typeName === "CancellationToken" ||
    parameter.typeName === "System.Threading.CancellationToken" ||
    parameter.name.toLowerCase() === "cancellationtoken"
  );
}

function defaultJsonValue(typeName: string): string {
  const nt = typeName.toLowerCase();
  if (nt.includes("int") || nt.includes("double") || nt.includes("float") || nt.includes("decimal")) return "0";
  if (nt.includes("bool")) return "false";
  if (nt.endsWith("[]") || nt.includes("list") || nt.includes("array")) return "[]";
  return '""';
}

function validateJson(value: string): string | null {
  try {
    JSON.parse(substituteMockTokens(value));
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON";
  }
}

function formatResponseExample(returnType: string | null | undefined): string {
  if (!returnType || returnType === "void" || returnType === "Task" || returnType === "ValueTask") {
    return `{\n  "isSuccess": true,\n  "error": null\n}`;
  }
  const n = returnType.toLowerCase();
  if (n.includes("string")) return `{\n  "isSuccess": true,\n  "value": "example"\n}`;
  if (n.includes("int") || n.includes("long") || n.includes("double") || n.includes("float") || n.includes("decimal")) return `{\n  "isSuccess": true,\n  "value": 42\n}`;
  if (n.includes("bool")) return `{\n  "isSuccess": true,\n  "value": true\n}`;
  if (n.endsWith("[]") || n.includes("list") || n.includes("array")) return `{\n  "isSuccess": true,\n  "value": [\n    { },\n    { }\n  ]\n}`;
  if (n.includes("dictionary") || n.includes("map")) return `{\n  "isSuccess": true,\n  "value": {\n    "key": "value"\n  }\n}`;
  return `{\n  "isSuccess": true,\n  "value": {\n    /* ${returnType} */\n  }\n}`;
}
