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
      />,
    );

    expect(screen.getByRole("option", { name: "SetName(name)" })).toBeInTheDocument();

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
      />,
    );

    fireEvent.change(screen.getByLabelText("Grain"), {
      target: { value: "grain-1" },
    });

    expect(onSelectGrain).toHaveBeenCalledWith("grain-1");
    expect(onSelectMethod).toHaveBeenCalledWith(null);
  });
});
