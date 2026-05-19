import { useEffect, useMemo, useState } from "react";
import { Play } from "lucide-react";
import type {
  GrainInterfaceDescriptor,
  GrainKeyType,
  GrainMethodDescriptor,
  SourceCatalogFunction,
  SourceOwnedCatalog,
} from "../../shared/types";
import { findCatalogFunction, findCatalogSource } from "../catalog";
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

export function RequestWorkbench({
  grains,
  sourceCatalog,
  selectedFunctionId,
  selectedGrain,
  selectedMethod,
  theme,
  onInvoke,
}: RequestWorkbenchProps) {
  const [grainKey, setGrainKey] = useState("");
  const [keyType, setKeyType] = useState<GrainKeyType>("String");
  const [payload, setPayload] = useState("{\n}");
  const [activeTab, setActiveTab] = useState<RequestTab>("payload");
  const activeFunction = useMemo(
    () => findCatalogFunction(sourceCatalog ?? { sources: [] }, selectedFunctionId ?? null),
    [selectedFunctionId, sourceCatalog],
  );
  const activeSource = useMemo(
    () => findCatalogSource(sourceCatalog ?? { sources: [] }, activeFunction?.sourceId ?? null),
    [activeFunction, sourceCatalog],
  );
  const activeInterface = useMemo(
    () =>
      activeSource?.interfaces.find((catalogInterface) => catalogInterface.interfaceId === activeFunction?.interfaceId) ??
      null,
    [activeFunction, activeSource],
  );

  const activeGrain = useMemo(
    () => grains.find((grain) => grain.interfaceId === selectedGrain) ?? null,
    [grains, selectedGrain],
  );
  const methods = useMemo(
    () => activeInterface?.methods.map(toGrainMethod) ?? activeGrain?.methods ?? [],
    [activeGrain, activeInterface],
  );
  const activeMethod = activeFunction
    ? toGrainMethod(activeFunction)
    : methods.find((method) => method.name === selectedMethod) ?? null;
  const payloadError = useMemo(() => validateJson(payload), [payload]);
  const expectsSourceOwnedSelection = Boolean(sourceCatalog?.sources.some((source) => source.interfaces.length > 0));
  const canInvoke = Boolean(
    (activeFunction || activeGrain) &&
      activeMethod &&
      (!expectsSourceOwnedSelection || activeFunction) &&
      grainKey.trim() &&
      !payloadError,
  );

  useEffect(() => {
    if (!activeFunction) {
      if (selectedFunctionId) {
        setPayload("{\n}");
        setKeyType("String");
      }
      return;
    }

    setKeyType(activeFunction.keyType);
    setPayload(createPayloadTemplate(activeFunction));
  }, [activeFunction, selectedFunctionId]);

  const insertEnvToken = (token: string) => {
    setPayload((currentPayload) => {
      const insertAt = Math.max(currentPayload.lastIndexOf("}"), 0);
      const prefix = currentPayload.slice(0, insertAt).trimEnd();
      const suffix = currentPayload.slice(insertAt);
      const separator = prefix.endsWith("{") ? "\n  " : ",\n  ";

      return `${prefix}${separator}"${token}": "\${env:${token}}"\n${suffix}`;
    });
  };

  const handleInvoke = () => {
    if ((!activeGrain && !activeFunction) || !activeMethod || !canInvoke) {
      return;
    }

    const request = {
      grainType: activeFunction?.interfaceId ?? activeGrain!.interfaceName,
      grainKey: grainKey.trim(),
      keyType,
      method: activeFunction?.methodName ?? activeMethod.name,
      payload,
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
    <section className="request-workbench" aria-labelledby="request-workbench-title">
      <h2 className="request-workbench__sr-title" id="request-workbench-title">Request</h2>

      <div className="request-workbench__request-line">
        <label>
          <span>Grain ID</span>
          <input
            placeholder="Primary key"
            value={grainKey}
            onChange={(event) => setGrainKey(event.target.value)}
          />
        </label>

        <div className="request-workbench__grain-summary" aria-label="Grain selection summary">
          <div>
            <span>Grain</span>
            <small>{activeFunction?.keyType ?? activeMethod?.keyType ?? keyType} key</small>
          </div>
          <strong>{activeFunction?.methodName ?? activeMethod?.name ?? "No method selected"}</strong>
          <small>{activeFunction?.interfaceName ?? activeGrain?.interfaceName ?? "No grain selected"}</small>
        </div>

        <button className="request-workbench__invoke-button" disabled={!canInvoke} onClick={handleInvoke} type="button">
          <Play aria-hidden="true" width={12} height={12} />
          Invoke Grain
        </button>
      </div>

      <div className="request-workbench__tabs" aria-label="Request sections">
        <button aria-selected={activeTab === "payload"} onClick={() => setActiveTab("payload")} type="button">
          Payload
        </button>
        <button aria-selected={activeTab === "context"} onClick={() => setActiveTab("context")} type="button">
          Context
        </button>
        <button aria-selected={activeTab === "docs"} onClick={() => setActiveTab("docs")} type="button">
          Docs
        </button>
      </div>

      {activeTab === "payload" && (
        <>
          <div className="request-workbench__selection" aria-label="Selected function">
            <div>
              <span>Interface</span>
              <strong>{activeFunction?.interfaceName ?? activeGrain?.interfaceName ?? "No grain selected"}</strong>
            </div>
            <div>
              <span>Method</span>
              <strong>{activeFunction?.methodName ?? activeMethod?.name ?? "No method selected"}</strong>
            </div>
            <div>
              <span>Return</span>
              <strong>{activeFunction?.returnType ?? activeMethod?.returnType ?? "unknown"}</strong>
            </div>
            <div>
              <span>Parameters</span>
              <strong>{formatParameterList(visibleParameters(activeFunction?.parameters ?? activeMethod?.parameters ?? []))}</strong>
            </div>
          </div>

          <div className="request-workbench__editor">
            <div className="request-workbench__editor-header">
              <span>Payload</span>
              <div className="request-workbench__tokens" aria-label="Environment token autocomplete">
                <button onClick={() => insertEnvToken("clusterId")} type="button">
                  clusterId
                </button>
                <button onClick={() => insertEnvToken("workspaceId")} type="button">
                  workspaceId
                </button>
              </div>
            </div>
            <MonacoEditor value={payload} onChange={setPayload} theme={theme} />
          </div>

          <div className="request-workbench__trigger-bar">
            <span className={payloadError ? "request-workbench__status request-workbench__status--error" : "request-workbench__status"}>
              {payloadError ?? "JSON valid"}
            </span>
          </div>
        </>
      )}

      {activeTab === "docs" && (
        <div className="request-workbench__docs" aria-label="Documentation">
          <div className="docs-section">
            <h3>Method Signature</h3>
            <p>
              Full C# method signature for invoking this grain method.
            </p>
            <div className="docs-signature">
              <code>
                {activeFunction?.signature ?? activeMethod?.signature ?? "Task InvokeAsync(string grainId, object payload)"}
              </code>
            </div>
          </div>

          <div className="docs-section">
            <h3>Request Payload</h3>
            <p>
              The request payload is a JSON object containing the method parameters. Map each parameter name to its
              corresponding value using the appropriate C# type.
            </p>
            <div className="docs-parameters">
              <h4>Parameters ({visibleParameters(activeFunction?.parameters ?? activeMethod?.parameters ?? []).length})</h4>
              {visibleParameters(activeFunction?.parameters ?? activeMethod?.parameters ?? []).length > 0 ? (
                <table className="docs-params-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>C# Type</th>
                      <th>JSON Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleParameters(activeFunction?.parameters ?? activeMethod?.parameters ?? []).map((param) => (
                      <tr key={param.name}>
                        <td><code>{param.name}</code></td>
                        <td><span className="docs-cs-type">{param.typeName}</span></td>
                        <td><span className="docs-json-example">{defaultJsonValue(param.typeName)}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <p className="docs-empty">No parameters required - send an empty JSON object <code>{"{}"}</code></p>
              )}
            </div>
          </div>

          <div className="docs-section">
            <h3>Response Payload</h3>
            <p>
              The response payload contains the return value from the grain method. The JSON structure depends on the
              return type of the method.
            </p>
            <div className="docs-response">
              <h4>Return Type</h4>
              <code className="docs-cs-type">
                {activeFunction?.returnType ?? activeMethod?.returnType ?? "Task (async void)"}
              </code>
              <div className="docs-response-example">
                <h4>Example Response</h4>
                <pre>
{formatResponseExample(activeFunction?.returnType ?? activeMethod?.returnType ?? "void")}
                </pre>
              </div>
            </div>
          </div>

          <div className="docs-section">
            <h3>Key Information</h3>
            <div className="docs-key-info">
              <div className="docs-info-row">
                <span className="docs-info-label">Grain Interface</span>
                <span className="docs-info-value">{activeFunction?.interfaceName ?? activeGrain?.interfaceName ?? "N/A"}</span>
              </div>
              <div className="docs-info-row">
                <span className="docs-info-label">Namespace</span>
                <span className="docs-info-value">{activeFunction?.namespace ?? "N/A"}</span>
              </div>
              <div className="docs-info-row">
                <span className="docs-info-label">Key Type</span>
                <span className="docs-info-value">{activeFunction?.keyType ?? activeMethod?.keyType ?? "String"}</span>
              </div>
              <div className="docs-info-row">
                <span className="docs-info-label">Source</span>
                <span className="docs-info-value">{activeSource?.sourceId ?? "N/A"}</span>
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
                <span className="context-value code">{grainKey || "(enter grain key)"}</span>
              </div>
              <div className="context-item">
                <span className="context-label">Key Type</span>
                <span className="context-value">{keyType}</span>
              </div>
              <div className="context-item">
                <span className="context-label">Interface</span>
                <span className="context-value code">{activeFunction?.interfaceName ?? activeGrain?.interfaceName ?? "N/A"}</span>
              </div>
              <div className="context-item">
                <span className="context-label">Method</span>
                <span className="context-value code">{activeFunction?.methodName ?? activeMethod?.name ?? "N/A"}</span>
              </div>
            </div>
          </div>

          <div className="context-group">
            <h3>Source Information</h3>
            <div className="context-grid">
              <div className="context-item">
                <span className="context-label">Source ID</span>
                <span className="context-value code">{activeSource?.sourceId ?? "N/A"}</span>
              </div>
              <div className="context-item">
                <span className="context-label">Source Type</span>
                <span className="context-value">{activeSource?.sourceType ?? "N/A"}</span>
              </div>
              <div className="context-item full-width">
                <span className="context-label">Discovery Status</span>
                <span className={`context-value status status--${activeSource?.discoveryStatus?.toLowerCase() ?? "unknown"}`}>
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
                <code className="context-signature">{activeFunction?.signature ?? activeMethod?.signature ?? "N/A"}</code>
              </div>
              <div className="context-detail-row">
                <span className="context-label">Return Type</span>
                <span className="context-value code">{activeFunction?.returnType ?? activeMethod?.returnType ?? "Task"}</span>
              </div>
              <div className="context-detail-row">
                <span className="context-label">Function ID</span>
                <span className="context-value code">{activeFunction?.functionId ?? "N/A"}</span>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function toGrainMethod(catalogFunction: SourceCatalogFunction): GrainMethodDescriptor {
  return {
    name: catalogFunction.methodName,
    parameters: visibleParameters(catalogFunction.parameters),
    signature: catalogFunction.signature,
    returnType: catalogFunction.returnType,
    keyType: catalogFunction.keyType,
  };
}

function createPayloadTemplate(catalogFunction: SourceCatalogFunction): string {
  const parameters = visibleParameters(catalogFunction.parameters);
  if (parameters.length === 0) {
    return "{\n}";
  }

  const lines = parameters.map((parameter) => {
    return `  "${parameter.name}": ${defaultJsonValue(parameter.typeName)}`;
  });

  return `{\n${lines.join(",\n")}\n}`;
}

function formatParameterList(parameters: GrainMethodDescriptor["parameters"]): string {
  if (parameters.length === 0) {
    return "none";
  }

  return parameters.map((parameter) => `${parameter.name}: ${parameter.typeName}`).join(", ");
}

function visibleParameters<T extends { name: string; typeName: string }>(parameters: T[]): T[] {
  return parameters.filter((parameter) => !isCancellationTokenParameter(parameter));
}

function isCancellationTokenParameter(parameter: { name: string; typeName: string }): boolean {
  return (
    parameter.typeName === "CancellationToken" ||
    parameter.typeName === "System.Threading.CancellationToken" ||
    parameter.name.toLowerCase() === "cancellationtoken"
  );
}

function defaultJsonValue(typeName: string): string {
  const normalizedType = typeName.toLowerCase();
  if (normalizedType.includes("int") || normalizedType.includes("double") || normalizedType.includes("float") || normalizedType.includes("decimal")) {
    return "0";
  }

  if (normalizedType.includes("bool")) {
    return "false";
  }

  if (normalizedType.endsWith("[]") || normalizedType.includes("list") || normalizedType.includes("array")) {
    return "[]";
  }

  return "\"\"";
}

function validateJson(value: string): string | null {
  try {
    JSON.parse(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON";
  }
}

function formatResponseExample(returnType: string | null | undefined): string {
  if (!returnType || returnType === "void" || returnType === "Task" || returnType === "ValueTask") {
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

  if (normalized.includes("int") || normalized.includes("long") || normalized.includes("double") || normalized.includes("float") || normalized.includes("decimal")) {
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

  if (normalized.endsWith("[]") || normalized.includes("list") || normalized.includes("collection") || normalized.includes("array")) {
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
