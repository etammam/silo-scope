import { useMemo, useState } from "react";
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
  const [payload, setPayload] = useState("{\n}");

  const activeGrain = useMemo(
    () => grains.find((grain) => grain.interfaceId === selectedGrain) ?? null,
    [grains, selectedGrain],
  );
  const methods = activeGrain?.methods ?? [];
  const activeMethod = methods.find((method) => method.name === selectedMethod) ?? null;
  const canInvoke = Boolean(activeGrain && activeMethod && grainKey.trim());

  const handleGrainChange = (grainId: string) => {
    const nextGrain = grainId.length > 0 ? grainId : null;
    onSelectGrain(nextGrain);
    onSelectMethod(null);
  };

  const handleMethodChange = (methodName: string) => {
    onSelectMethod(methodName.length > 0 ? methodName : null);
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
        <button disabled={!canInvoke} onClick={handleInvoke} type="button">
          Invoke Grain
        </button>
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
          <select
            disabled={!activeGrain}
            value={selectedMethod ?? ""}
            onChange={(event) => handleMethodChange(event.target.value)}
          >
            <option value="">Select method</option>
            {methods.map((method) => (
              <option key={method.name} value={method.name}>
                {formatMethodLabel(method)}
              </option>
            ))}
          </select>
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
          <span>JSON</span>
        </div>
        <MonacoEditor value={payload} onChange={setPayload} theme={theme} />
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
