import { AlertTriangle, Play } from "lucide-react";
import type * as Monaco from "monaco-editor";
import { useMemo, useRef, useState } from "react";
import type {
  EnvironmentProfile,
  GrainInterfaceDescriptor,
  GrainKeyType,
  GrainMethodDescriptor,
  SourceCatalogFunction,
  SourceOwnedCatalog,
} from "../../shared/types";
import { findCatalogFunction, findCatalogSource } from "../catalog";
import { classifyTokens, findMissingTokens } from "../envSubstitution";
import {
  findMockTokens,
  hasMockTokens,
  substituteMockTokens,
} from "../mockTokens";
import { InlineAutocomplete } from "./InlineAutocomplete";
import { MonacoEditor } from "./MonacoEditor";

type RequestWorkbenchProps = {
  grains: GrainInterfaceDescriptor[];
  sourceCatalog?: SourceOwnedCatalog;
  selectedFunctionId?: string | null;
  selectedGrain: string | null;
  selectedMethod: string | null;
  theme: "dark" | "light" | "vscode-dark" | "vscode-light";
  onSelectGrain: (grainId: string | null) => void;
  onSelectFunction?: (functionId: string | null) => void;
  onSelectMethod: (methodName: string | null) => void;
  requestState: RequestState;
  onRequestStateChange: (nextState: RequestState) => void;
  environments?: EnvironmentProfile[];
  activeEnvironment?: string | null;
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
  onInvoke,
}: RequestWorkbenchProps) {
  const [activeTab, setActiveTab] = useState<RequestTab>("payload");
  const grainKeyInputRef = useRef<HTMLInputElement>(null);
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
  const expectsSourceOwnedSelection = Boolean(
    sourceCatalog?.sources.some((source) => source.interfaces.length > 0),
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
    (!expectsSourceOwnedSelection || activeFunction) &&
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

  return (
    <section
      className="request-workbench"
      aria-labelledby="request-workbench-title"
    >
      <h2 className="request-workbench__sr-title" id="request-workbench-title">
        Request
      </h2>

      <div className="request-workbench__request-line">
        <label className="request-workbench__grain-id-label">
          <span>Grain ID</span>
          <InlineAutocomplete envVars={Object.keys(activeEnvVars)}>
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

        <label>
          <span>Key type</span>
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

        <div
          className="request-workbench__grain-summary"
          aria-label="Grain selection summary"
        >
          <div>
            <span>Grain</span>
            <small>{requestState.keyType} key</small>
          </div>
          <strong>
            {activeFunction?.methodName ??
              activeMethod?.name ??
              "No method selected"}
          </strong>
          <small>
            {activeFunction?.interfaceName ??
              activeGrain?.interfaceName ??
              "No grain selected"}
          </small>
        </div>

        <button
          className="request-workbench__invoke-button"
          disabled={!canInvoke}
          onClick={handleInvoke}
          type="button"
        >
          <Play aria-hidden="true" width={12} height={12} />
          Invoke Grain
        </button>
      </div>

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
          Payload
        </button>
        <button
          aria-selected={activeTab === "context"}
          onClick={() => setActiveTab("context")}
          role="tab"
          type="button"
        >
          Context
        </button>
        <button
          aria-selected={activeTab === "docs"}
          onClick={() => setActiveTab("docs")}
          role="tab"
          type="button"
        >
          Docs
        </button>
      </div>

      {activeTab === "payload" && (
        <>
          <div
            className="request-workbench__selection"
            aria-label="Selected function"
          >
            <div>
              <span>Interface</span>
              <strong>
                {activeFunction?.interfaceName ??
                  activeGrain?.interfaceName ??
                  "No grain selected"}
              </strong>
            </div>
            <div>
              <span>Method</span>
              <strong>
                {activeFunction?.methodName ??
                  activeMethod?.name ??
                  "No method selected"}
              </strong>
            </div>
            <div>
              <span>Return</span>
              <strong>
                {activeFunction?.returnType ??
                  activeMethod?.returnType ??
                  "unknown"}
              </strong>
            </div>
            <div>
              <span>Parameters</span>
              <strong>
                {formatParameterList(
                  visibleParameters(
                    activeFunction?.parameters ??
                      activeMethod?.parameters ??
                      [],
                  ),
                )}
              </strong>
            </div>
          </div>

          <div className="request-workbench__editor">
            <div className="request-workbench__editor-header">
              <span>Payload</span>
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

          <div className="request-workbench__trigger-bar">
            <span
              className={
                payloadError
                  ? "request-workbench__status request-workbench__status--error"
                  : "request-workbench__status"
              }
            >
              {payloadError ?? "JSON valid"}
            </span>
          </div>

          {missingEnvKeys.length > 0 && (
            <div className="request-workbench__env-error-banner" role="alert">
              <AlertTriangle aria-hidden="true" width={14} height={14} />
              <div>
                <strong>
                  Missing environment variable
                  {missingEnvKeys.length > 1 ? "s" : ""}
                </strong>
                <span>{missingEnvKeys.join(", ")}</span>
                <small>
                  {missingGrainKeyTokens.length > 0 &&
                  missingPayloadTokens.length > 0
                    ? "(in Grain ID and Payload)"
                    : missingGrainKeyTokens.length > 0
                      ? "(in Grain ID)"
                      : missingPayloadTokens.length > 0
                        ? "(in Payload)"
                        : ""}
                </small>
              </div>
            </div>
          )}
        </>
      )}

      {activeTab === "docs" && (
        <div className="request-workbench__docs" aria-label="Documentation">
          <div className="docs-section">
            <h3>Method Signature</h3>
            <p>Full C# method signature for invoking this grain method.</p>
            <div className="docs-signature">
              <code>
                {activeFunction?.signature ??
                  activeMethod?.signature ??
                  "Task InvokeAsync(string grainId, object payload)"}
              </code>
            </div>
          </div>

          <div className="docs-section">
            <h3>Request Payload</h3>
            <p>
              The request payload is a JSON object containing the method
              parameters. Map each parameter name to its corresponding value
              using the appropriate C# type.
            </p>
            <div className="docs-parameters">
              <h4>
                Parameters (
                {
                  visibleParameters(
                    activeFunction?.parameters ??
                      activeMethod?.parameters ??
                      [],
                  ).length
                }
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
                      <th>JSON Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleParameters(
                      activeFunction?.parameters ??
                        activeMethod?.parameters ??
                        [],
                    ).map((param) => (
                      <tr key={param.name}>
                        <td>
                          <code>{param.name}</code>
                        </td>
                        <td>
                          <span className="docs-cs-type">{param.typeName}</span>
                        </td>
                        <td>
                          <span className="docs-json-example">
                            {defaultJsonValue(param.typeName)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="docs-empty">
                  No parameters required - send an empty JSON object{" "}
                  <code>{"{}"}</code>
                </p>
              )}
            </div>
          </div>

          <div className="docs-section">
            <h3>Response Payload</h3>
            <p>
              The response payload contains the return value from the grain
              method. The JSON structure depends on the return type of the
              method.
            </p>
            <div className="docs-response">
              <h4>Return Type</h4>
              <code className="docs-cs-type">
                {activeFunction?.returnType ??
                  activeMethod?.returnType ??
                  "Task (async void)"}
              </code>
              <div className="docs-response-example">
                <h4>Example Response</h4>
                <pre>
                  {formatResponseExample(
                    activeFunction?.returnType ??
                      activeMethod?.returnType ??
                      "void",
                  )}
                </pre>
              </div>
            </div>
          </div>

          <div className="docs-section">
            <h3>Key Information</h3>
            <div className="docs-key-info">
              <div className="docs-info-row">
                <span className="docs-info-label">Grain Interface</span>
                <span className="docs-info-value">
                  {activeFunction?.interfaceName ??
                    activeGrain?.interfaceName ??
                    "N/A"}
                </span>
              </div>
              <div className="docs-info-row">
                <span className="docs-info-label">Namespace</span>
                <span className="docs-info-value">
                  {activeFunction?.namespace ?? "N/A"}
                </span>
              </div>
              <div className="docs-info-row">
                <span className="docs-info-label">Key Type</span>
                <span className="docs-info-value">
                  {activeFunction?.keyType ?? activeMethod?.keyType ?? "String"}
                </span>
              </div>
              <div className="docs-info-row">
                <span className="docs-info-label">Source</span>
                <span className="docs-info-value">
                  {activeSource?.sourceId ?? "N/A"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "context" && (
        <div className="request-workbench__context" aria-label="Context">
          <div className="context-group">
            <h3>Grain Identity</h3>
            <div className="context-grid">
              <div className="context-item">
                <span className="context-label">Grain ID</span>
                <span className="context-value code">
                  {requestState.grainKey || "(enter grain key)"}
                </span>
              </div>
              <div className="context-item">
                <span className="context-label">Key Type</span>
                <span className="context-value">{requestState.keyType}</span>
              </div>
              <div className="context-item">
                <span className="context-label">Interface</span>
                <span className="context-value code">
                  {activeFunction?.interfaceName ??
                    activeGrain?.interfaceName ??
                    "N/A"}
                </span>
              </div>
              <div className="context-item">
                <span className="context-label">Method</span>
                <span className="context-value code">
                  {activeFunction?.methodName ?? activeMethod?.name ?? "N/A"}
                </span>
              </div>
            </div>
          </div>

          <div className="context-group">
            <h3>Source Information</h3>
            <div className="context-grid">
              <div className="context-item">
                <span className="context-label">Source ID</span>
                <span className="context-value code">
                  {activeSource?.sourceId ?? "N/A"}
                </span>
              </div>
              <div className="context-item">
                <span className="context-label">Source Type</span>
                <span className="context-value">
                  {activeSource?.sourceType ?? "N/A"}
                </span>
              </div>
              <div className="context-item full-width">
                <span className="context-label">Discovery Status</span>
                <span
                  className={`context-value status status--${activeSource?.discoveryStatus?.toLowerCase() ?? "unknown"}`}
                >
                  {activeSource?.discoveryStatus ?? "Unknown"}
                </span>
              </div>
            </div>
          </div>

          <div className="context-group">
            <h3>Invocation Details</h3>
            <div className="context-details">
              <div className="context-detail-row">
                <span className="context-label">Full Signature</span>
                <code className="context-signature">
                  {activeFunction?.signature ??
                    activeMethod?.signature ??
                    "N/A"}
                </code>
              </div>
              <div className="context-detail-row">
                <span className="context-label">Return Type</span>
                <span className="context-value code">
                  {activeFunction?.returnType ??
                    activeMethod?.returnType ??
                    "Task"}
                </span>
              </div>
              <div className="context-detail-row">
                <span className="context-label">Function ID</span>
                <span className="context-value code">
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

function formatParameterList(
  parameters: GrainMethodDescriptor["parameters"],
): string {
  if (parameters.length === 0) {
    return "none";
  }

  return parameters
    .map((parameter) => `${parameter.name}: ${parameter.typeName}`)
    .join(", ");
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
  const normalizedType = typeName.toLowerCase();
  if (
    normalizedType.includes("int") ||
    normalizedType.includes("double") ||
    normalizedType.includes("float") ||
    normalizedType.includes("decimal")
  ) {
    return "0";
  }

  if (normalizedType.includes("bool")) {
    return "false";
  }

  if (
    normalizedType.endsWith("[]") ||
    normalizedType.includes("list") ||
    normalizedType.includes("array")
  ) {
    return "[]";
  }

  return '""';
}

function validateJson(value: string): string | null {
  try {
    const substituted = substituteMockTokens(value);
    JSON.parse(substituted);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON";
  }
}

function formatResponseExample(returnType: string | null | undefined): string {
  if (
    !returnType ||
    returnType === "void" ||
    returnType === "Task" ||
    returnType === "ValueTask"
  ) {
    return `{
  "isSuccess": true,
  "error": null
}`;
  }

  const normalized = returnType.toLowerCase();

  if (normalized.includes("string")) {
    return `{
  "isSuccess": true,
  "value": "example string result"
}`;
  }

  if (
    normalized.includes("int") ||
    normalized.includes("long") ||
    normalized.includes("double") ||
    normalized.includes("float") ||
    normalized.includes("decimal")
  ) {
    return `{
  "isSuccess": true,
  "value": 42
}`;
  }

  if (normalized.includes("bool")) {
    return `{
  "isSuccess": true,
  "value": true
}`;
  }

  if (
    normalized.endsWith("[]") ||
    normalized.includes("list") ||
    normalized.includes("collection") ||
    normalized.includes("array")
  ) {
    return `{
  "isSuccess": true,
  "value": [
    { /* item 1 */ },
    { /* item 2 */ }
  ]
}`;
  }

  if (normalized.includes("dictionary") || normalized.includes("map")) {
    return `{
  "isSuccess": true,
  "value": {
    "key1": "value1",
    "key2": "value2"
  }
}`;
  }

  return `{
  "isSuccess": true,
  "value": {
    /* ${returnType} result */
  }
}`;
}
