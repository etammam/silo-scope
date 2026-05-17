import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationSidebar } from "@/renderer/components/NavigationSidebar";

const workspace = {
  id: "workspace-1",
  name: "Local Cluster",
  siloAddress: "127.0.0.1",
  gatewayPort: 30000,
  orleansVersion: "10.0",
};

const grains = [
  {
    interfaceId: "grain-1",
    interfaceName: "IPlayerGrain",
    methods: [],
  },
  {
    interfaceId: "grain-2",
    interfaceName: "IGameGrain",
    methods: [],
  },
];

describe("NavigationSidebar", () => {
  it("renders empty workspace, silo, and grain states", () => {
    render(
      <NavigationSidebar
        activeView="workspace"
        grains={[]}
        isConnected={false}
        onSelectGrain={vi.fn()}
        selectedGrain={null}
        workspace={null}
      />,
    );

    expect(screen.getByLabelText("Active workspace")).toHaveValue("none");
    expect(screen.getByText("No silo sources")).toBeInTheDocument();
    expect(screen.getByText("No grains discovered")).toBeInTheDocument();
    expect(screen.getByText("Disconnected")).toBeInTheDocument();
  });

  it("renders workspace source and selectable grain tree", () => {
    const onSelectGrain = vi.fn();
    render(
      <NavigationSidebar
        activeView="workspace"
        grains={grains}
        isConnected
        onSelectGrain={onSelectGrain}
        selectedGrain="grain-2"
        workspace={workspace}
      />,
    );

    expect(screen.getByLabelText("Active workspace")).toHaveValue("workspace-1");
    expect(screen.getByText("127.0.0.1:30000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "IGameGrain" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "IPlayerGrain" }));

    expect(onSelectGrain).toHaveBeenCalledWith("grain-1");
  });
});
