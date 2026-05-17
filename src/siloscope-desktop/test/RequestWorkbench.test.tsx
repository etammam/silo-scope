import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { RequestWorkbench } from "@/renderer/components/RequestWorkbench";

vi.mock("@/renderer/components/MonacoEditor", () => ({
  MonacoEditor: ({
    value,
    onChange,
  }: {
    value: string;
    onChange: (value: string) => void;
  }) => (
    <textarea
      aria-label="Payload editor"
      onChange={(event) => onChange(event.target.value)}
      value={value}
    />
  ),
}));

const grains = [
  {
    interfaceId: "grain-1",
    interfaceName: "IPlayerGrain",
    methods: [
      {
        name: "GetState",
        parameters: [],
      },
      {
        name: "SetName",
        parameters: [
          {
            name: "name",
            typeName: "System.String",
          },
        ],
      },
    ],
  },
];

const sourceCatalog = {
  sources: [
    {
      sourceId: "source-core",
      sourceType: "DLL" as const,
      reference: "/app/Core.dll",
      label: "Core.dll",
      enabled: true,
      discoveryStatus: "ready" as const,
      interfaces: [
        {
          interfaceId: "grain-1",
          interfaceName: "IPlayerGrain",
          namespace: "Application",
          methods: [
            {
              functionId: "function-set-name",
              sourceId: "source-core",
              interfaceId: "grain-1",
              interfaceName: "IPlayerGrain",
              namespace: "Application",
              methodName: "SetName",
              signature: "SetName(name: System.String)",
              returnType: "System.Threading.Tasks.Task",
              keyType: "String" as const,
              parameters: [
                {
                  name: "name",
                  typeName: "System.String",
                },
              ],
            },
          ],
        },
      ],
    },
  ],
};

describe("RequestWorkbench", () => {
  it("requires a selected grain, method, and grain id before invocation", () => {
    render(
      <RequestWorkbench
        grains={grains}
        onInvoke={vi.fn()}
        onSelectGrain={vi.fn()}
        onSelectMethod={vi.fn()}
        selectedGrain={null}
        selectedMethod={null}
        theme="dark"
      />,
    );

    expect(screen.getByRole("button", { name: "Invoke Grain" })).toBeDisabled();
  });

  it("renders method signatures and emits invoke requests", () => {
    const onInvoke = vi.fn();
    const onSelectGrain = vi.fn();
    const onSelectMethod = vi.fn();

    render(
      <RequestWorkbench
        grains={grains}
        onInvoke={onInvoke}
        onSelectGrain={onSelectGrain}
        onSelectMethod={onSelectMethod}
        selectedGrain="grain-1"
        selectedMethod="SetName"
        theme="dark"
      />,
    );

    expect(screen.getByLabelText("Method")).toHaveValue("SetName(name)");

    fireEvent.change(screen.getByLabelText("Key type"), {
      target: { value: "Guid" },
    });
    fireEvent.change(screen.getByLabelText("Grain ID"), {
      target: { value: "player-1" },
    });
    fireEvent.change(screen.getByLabelText("Payload editor"), {
      target: { value: '{"name":"Ada"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invoke Grain" }));

    expect(onInvoke).toHaveBeenCalledWith({
      grainType: "IPlayerGrain",
      grainKey: "player-1",
      keyType: "Guid",
      method: "SetName",
      payload: '{"name":"Ada"}',
    });
  });

  it("hydrates the request panel from a source-owned function selection", () => {
    const onInvoke = vi.fn();

    render(
      <RequestWorkbench
        grains={grains}
        onInvoke={onInvoke}
        onSelectGrain={vi.fn()}
        onSelectMethod={vi.fn()}
        selectedFunctionId="function-set-name"
        selectedGrain="grain-1"
        selectedMethod="SetName"
        sourceCatalog={sourceCatalog}
        theme="dark"
      />,
    );

    expect(screen.getByText("Core.dll")).toBeInTheDocument();
    expect(screen.getAllByText("IPlayerGrain").length).toBeGreaterThan(0);
    expect(screen.getByText("System.Threading.Tasks.Task")).toBeInTheDocument();
    expect(screen.getByLabelText("Payload editor")).toHaveValue('{\n  "name": ""\n}');

    fireEvent.change(screen.getByLabelText("Grain ID"), {
      target: { value: "player-1" },
    });
    fireEvent.change(screen.getByLabelText("Payload editor"), {
      target: { value: '{"name":"Ada"}' },
    });
    fireEvent.click(screen.getByRole("button", { name: "Invoke Grain" }));

    expect(onInvoke).toHaveBeenCalledWith({
      grainType: "IPlayerGrain",
      grainKey: "player-1",
      keyType: "String",
      method: "SetName",
      payload: '{"name":"Ada"}',
      sourceId: "source-core",
      functionId: "function-set-name",
    });
  });

  it("selects methods from a searchable method input", () => {
    const onSelectMethod = vi.fn();

    render(
      <RequestWorkbench
        grains={grains}
        onInvoke={vi.fn()}
        onSelectGrain={vi.fn()}
        onSelectMethod={onSelectMethod}
        selectedGrain="grain-1"
        selectedMethod={null}
        theme="dark"
      />,
    );

    fireEvent.change(screen.getByLabelText("Method"), {
      target: { value: "GetState()" },
    });

    expect(onSelectMethod).toHaveBeenCalledWith("GetState");
  });

  it("prevents invocation until the payload is valid JSON", () => {
    render(
      <RequestWorkbench
        grains={grains}
        onInvoke={vi.fn()}
        onSelectGrain={vi.fn()}
        onSelectMethod={vi.fn()}
        selectedGrain="grain-1"
        selectedMethod="SetName"
        theme="dark"
      />,
    );

    fireEvent.change(screen.getByLabelText("Grain ID"), {
      target: { value: "player-1" },
    });
    fireEvent.change(screen.getByLabelText("Payload editor"), {
      target: { value: "{" },
    });

    expect(screen.getByRole("button", { name: "Invoke Grain" })).toBeDisabled();
    expect(screen.getByText(/Expected property name|Unexpected end|JSON/)).toBeInTheDocument();
  });

  it("inserts environment token placeholders into the payload", () => {
    render(
      <RequestWorkbench
        grains={grains}
        onInvoke={vi.fn()}
        onSelectGrain={vi.fn()}
        onSelectMethod={vi.fn()}
        selectedGrain="grain-1"
        selectedMethod="SetName"
        theme="dark"
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "clusterId" }));

    expect(screen.getByLabelText("Payload editor")).toHaveValue(
      '{\n  "clusterId": "${env:clusterId}"\n}',
    );
  });

  it("clears the selected method when a new grain is chosen", () => {
    const onSelectGrain = vi.fn();
    const onSelectMethod = vi.fn();

    render(
      <RequestWorkbench
        grains={grains}
        onInvoke={vi.fn()}
        onSelectGrain={onSelectGrain}
        onSelectMethod={onSelectMethod}
        selectedGrain={null}
        selectedMethod={null}
        theme="dark"
      />,
    );

    fireEvent.change(screen.getByLabelText("Grain"), {
      target: { value: "grain-1" },
    });

    expect(onSelectGrain).toHaveBeenCalledWith("grain-1");
    expect(onSelectMethod).toHaveBeenCalledWith(null);
  });
});
