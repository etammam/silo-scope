import { useEffect, useId, useMemo, useState } from "react";
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
  theme: "dark" | "light";
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
  onSelectGrain,
  onSelectFunction,
  onSelectMethod,
  onInvoke,
}: RequestWorkbenchProps) {
  const [grainKey, setGrainKey] = useState("");
  const [keyType, setKeyType] = useState<GrainKeyType>("String");
  const [methodQuery, setMethodQuery] = useState("");
  const [payload, setPayload] = useState("{\n}");
  const methodListId = useId();
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
  const grainOptions = useMemo(() => {
    if (!activeFunction || grains.some((grain) => grain.interfaceId === activeFunction.interfaceId)) {
      return grains;
    }

    return [
      ...grains,
      {
        interfaceId: activeFunction.interfaceId,
        interfaceName: activeFunction.interfaceName,
        methods: activeInterface?.methods.map(toGrainMethod) ?? [toGrainMethod(activeFunction)],
      },
    ];
  }, [activeFunction, activeInterface, grains]);
  const methods = useMemo(
    () => activeInterface?.methods.map(toGrainMethod) ?? activeGrain?.methods ?? [],
    [activeGrain, activeInterface],
  );
  const activeMethod = activeFunction
    ? toGrainMethod(activeFunction)
    : methods.find((method) => method.name === selectedMethod) ?? null;
  const filteredMethods = useMemo(
    () =>
      methods.filter((method) =>
        formatMethodLabel(method).toLowerCase().includes(methodQuery.trim().toLowerCase()),
      ),
    [methodQuery, methods],
  );
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
    const selected = activeFunction ? toGrainMethod(activeFunction) : methods.find((method) => method.name === selectedMethod) ?? null;
    setMethodQuery(selected ? formatMethodLabel(selected) : "");
  }, [activeFunction, methods, selectedMethod]);

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

  const handleGrainChange = (grainId: string) => {
    const nextGrain = grainId.length > 0 ? grainId : null;
    onSelectGrain(nextGrain);
    onSelectMethod(null);
  };

  const handleMethodQueryChange = (query: string) => {
    setMethodQuery(query);
    const nextCatalogFunction = activeInterface?.methods.find(
      (method) => method.methodName === query || method.signature === query,
    );
    if (activeInterface) {
      onSelectFunction?.(nextCatalogFunction?.functionId ?? null);
      onSelectMethod(nextCatalogFunction?.methodName ?? null);
      return;
    }

    const nextMethod = methods.find((method) => method.name === query || formatMethodLabel(method) === query);
    onSelectMethod(nextMethod?.name ?? null);
  };

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

    onInvoke({
      grainType: activeFunction?.interfaceName ?? activeGrain!.interfaceName,
      grainKey: grainKey.trim(),
      keyType,
      method: activeFunction?.methodName ?? activeMethod.name,
      payload,
      sourceId: activeFunction?.sourceId,
      functionId: activeFunction?.functionId,
    });
  };

  return (
    <section className="request-workbench" aria-labelledby="request-workbench-title">
      <div className="request-workbench__toolbar">
        <span id="request-workbench-title">Request</span>
        <span>{activeFunction ? activeFunction.signature : activeMethod ? formatMethodLabel(activeMethod) : "No method selected"}</span>
      </div>

      <div className="request-workbench__selection" aria-label="Selected function">
        <div>
          <span>Source</span>
          <strong>{activeSource?.label ?? "No source selected"}</strong>
        </div>
        <div>
          <span>Interface</span>
          <strong>{activeFunction?.interfaceName ?? activeGrain?.interfaceName ?? "No grain selected"}</strong>
        </div>
        <div>
          <span>Method</span>
          <strong>{activeFunction?.methodName ?? activeMethod?.name ?? "No method selected"}</strong>
        </div>
        <div>
          <span>Key</span>
          <strong>{activeFunction?.keyType ?? keyType}</strong>
        </div>
        <div>
          <span>Return</span>
          <strong>{activeFunction?.returnType ?? activeMethod?.returnType ?? "unknown"}</strong>
        </div>
        <div>
          <span>Parameters</span>
          <strong>{formatParameterList(activeFunction?.parameters ?? activeMethod?.parameters ?? [])}</strong>
        </div>
      </div>

      <div className="request-workbench__controls">
        <label>
          <span>Grain</span>
          <select value={selectedGrain ?? ""} onChange={(event) => handleGrainChange(event.target.value)}>
            <option value="">Select grain</option>
            {grainOptions.map((grain) => (
              <option key={grain.interfaceId} value={grain.interfaceId}>
                {grain.interfaceName}
              </option>
            ))}
          </select>
        </label>

        <label>
          <span>Method</span>
          <input
            aria-label="Method"
            list={methodListId}
            disabled={!activeGrain}
            placeholder="Search methods"
            value={methodQuery}
            onChange={(event) => handleMethodQueryChange(event.target.value)}
          />
          <datalist id={methodListId}>
            {filteredMethods.map((method) => (
              <option key={method.name} value={formatMethodLabel(method)} />
            ))}
          </datalist>
        </label>

        <label>
          <span>Key type</span>
          <select value={keyType} onChange={(event) => setKeyType(event.target.value as GrainKeyType)}>
            <option value="Guid">Guid</option>
            <option value="String">String</option>
            <option value="Integer">Integer</option>
          </select>
        </label>

        <label>
          <span>Grain ID</span>
          <input
            placeholder="Primary key"
            value={grainKey}
            onChange={(event) => setGrainKey(event.target.value)}
          />
        </label>
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
        <button disabled={!canInvoke} onClick={handleInvoke} type="button">
          Invoke Grain
        </button>
      </div>
    </section>
  );
}

function formatMethodLabel(method: GrainMethodDescriptor): string {
  if (method.signature) {
    return method.signature;
  }

  if (method.parameters.length === 0) {
    return `${method.name}()`;
  }

  return `${method.name}(${method.parameters.map((parameter) => parameter.name).join(", ")})`;
}

function toGrainMethod(catalogFunction: SourceCatalogFunction): GrainMethodDescriptor {
  return {
    name: catalogFunction.methodName,
    parameters: catalogFunction.parameters,
    signature: catalogFunction.signature,
    returnType: catalogFunction.returnType,
    keyType: catalogFunction.keyType,
  };
}

function createPayloadTemplate(catalogFunction: SourceCatalogFunction): string {
  if (catalogFunction.parameters.length === 0) {
    return "{\n}";
  }

  const lines = catalogFunction.parameters.map((parameter) => {
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
