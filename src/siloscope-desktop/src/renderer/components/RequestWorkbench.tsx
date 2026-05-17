import { useEffect, useId, useMemo, useState } from "react";
import type { GrainInterfaceDescriptor, GrainMethodDescriptor } from "../../shared/types";
import { MonacoEditor } from "./MonacoEditor";

type GrainKeyType = "Guid" | "String" | "Integer";

type RequestWorkbenchProps = {
  grains: GrainInterfaceDescriptor[];
  selectedGrain: string | null;
  selectedMethod: string | null;
  theme: "dark" | "light";
  onSelectGrain: (grainId: string | null) => void;
  onSelectMethod: (methodName: string | null) => void;
  onInvoke: (request: {
    grainType: string;
    grainKey: string;
    keyType: GrainKeyType;
    method: string;
    payload: string;
  }) => void;
};

export function RequestWorkbench({
  grains,
  selectedGrain,
  selectedMethod,
  theme,
  onSelectGrain,
  onSelectMethod,
  onInvoke,
}: RequestWorkbenchProps) {
  const [grainKey, setGrainKey] = useState("");
  const [keyType, setKeyType] = useState<GrainKeyType>("String");
  const [methodQuery, setMethodQuery] = useState("");
  const [payload, setPayload] = useState("{\n}");
  const methodListId = useId();

  const activeGrain = useMemo(
    () => grains.find((grain) => grain.interfaceId === selectedGrain) ?? null,
    [grains, selectedGrain],
  );
  const methods = activeGrain?.methods ?? [];
  const activeMethod = methods.find((method) => method.name === selectedMethod) ?? null;
  const filteredMethods = useMemo(
    () =>
      methods.filter((method) =>
        formatMethodLabel(method).toLowerCase().includes(methodQuery.trim().toLowerCase()),
      ),
    [methodQuery, methods],
  );
  const payloadError = useMemo(() => validateJson(payload), [payload]);
  const canInvoke = Boolean(activeGrain && activeMethod && grainKey.trim() && !payloadError);

  useEffect(() => {
    const selected = methods.find((method) => method.name === selectedMethod) ?? null;
    setMethodQuery(selected ? formatMethodLabel(selected) : "");
  }, [methods, selectedMethod]);

  const handleGrainChange = (grainId: string) => {
    const nextGrain = grainId.length > 0 ? grainId : null;
    onSelectGrain(nextGrain);
    onSelectMethod(null);
  };

  const handleMethodQueryChange = (query: string) => {
    setMethodQuery(query);
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
    if (!activeGrain || !activeMethod || !canInvoke) {
      return;
    }

    onInvoke({
      grainType: activeGrain.interfaceName,
      grainKey: grainKey.trim(),
      keyType,
      method: activeMethod.name,
      payload,
    });
  };

  return (
    <section className="request-workbench" aria-labelledby="request-workbench-title">
      <div className="request-workbench__toolbar">
        <span id="request-workbench-title">Request</span>
        <span>{activeMethod ? formatMethodLabel(activeMethod) : "No method selected"}</span>
      </div>

      <div className="request-workbench__controls">
        <label>
          <span>Grain</span>
          <select value={selectedGrain ?? ""} onChange={(event) => handleGrainChange(event.target.value)}>
            <option value="">Select grain</option>
            {grains.map((grain) => (
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
  if (method.parameters.length === 0) {
    return `${method.name}()`;
  }

  return `${method.name}(${method.parameters.map((parameter) => parameter.name).join(", ")})`;
}

function validateJson(value: string): string | null {
  try {
    JSON.parse(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON";
  }
}
