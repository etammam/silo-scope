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
        <button aria-selected="true" type="button">Payload</button>
        <button type="button">Selection</button>
        <button type="button">Context</button>
        <button type="button">Docs</button>
      </div>

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
