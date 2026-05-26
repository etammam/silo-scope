import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { NavigationSidebar } from "@/renderer/components/NavigationSidebar";

const workspace = {
  id: "workspace-1",
  name: "Local Cluster",
  siloAddress: "127.0.0.1",
  gatewayPort: 30000,
  orleansVersion: "10.0",
  clusterId: "dev",
  serviceId: "SiloScope",
  gatewayEndpoints: ["127.0.0.1:30000"],
};

const grains = [
  {
    interfaceId: "grain-1",
    interfaceName: "IPlayerGrain",
    methods: [{ name: "GetProfile", parameters: [] }],
  },
  {
    interfaceId: "grain-2",
    interfaceName: "IGameGrain",
    methods: [{ name: "StartMatch", parameters: [] }],
  },
];

describe("NavigationSidebar", () => {
  it("renders empty workspace and catalog states", () => {
    render(
      <NavigationSidebar
        activeView="workspace"
        grains={[]}
        isConnected={false}
        onSelectGrain={vi.fn()}
        onThemeChange={vi.fn()}
        selectedGrain={null}
        theme="dark"
        workspace={null}
      />,
    );

    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("No cluster loaded")).toBeInTheDocument();
    expect(screen.queryByText("Disconnected")).not.toBeInTheDocument();
  });

  it("renders source-owned function catalog and selectable method leaves", () => {
    const onSelectGrain = vi.fn();
    const onSelectFunction = vi.fn();
    render(
      <NavigationSidebar
        activeView="workspace"
        grains={grains}
        isConnected
        onConnectCluster={vi.fn()}
        onDisconnectCluster={vi.fn()}
        onDiscoverGrains={vi.fn()}
        onLoadWorkspace={vi.fn()}
        onSaveWorkspace={vi.fn()}
        onSelectFunction={onSelectFunction}
        onSelectGrain={onSelectGrain}
        onThemeChange={vi.fn()}
        selectedFunctionId="source:active-workspace:workspace-1:grain-2:StartMatch()"
        selectedGrain={null}
        theme="dark"
        workspace={workspace}
      />,
    );

    expect(screen.queryByLabelText("Active workspace")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Load" })).not.toBeInTheDocument();
    expect(screen.getByText("DLL")).toBeInTheDocument();
    expect(screen.getByText("127.0.0.1:30000")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "127.0.0.1:30000 2" })).toHaveAttribute(
      "aria-expanded",
      "true",
    );
    expect(screen.getByRole("button", { name: "StartMatch()" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    fireEvent.click(screen.getByRole("button", { name: "GetProfile()" }));

    expect(onSelectFunction).toHaveBeenCalledWith("source:active-workspace:workspace-1:grain-1:GetProfile()");
  });

  it("filters methods while preserving their source parent", () => {
    render(
      <NavigationSidebar
        activeView="workspace"
        grains={grains}
        isConnected
        onSelectGrain={vi.fn()}
        onThemeChange={vi.fn()}
        selectedGrain={null}
        theme="dark"
        workspace={workspace}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search catalog"), {
      target: { value: "profile" },
    });

    expect(screen.getByRole("button", { name: "127.0.0.1:30000 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GetProfile()" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "StartMatch()" })).not.toBeInTheDocument();
  });

  it("does not show source enable checkboxes in the catalog", () => {
    render(
      <NavigationSidebar
        activeView="workspace"
        grains={grains}
        isConnected
        onSelectGrain={vi.fn()}
        onThemeChange={vi.fn()}
        selectedGrain={null}
        theme="dark"
        workspace={workspace}
      />,
    );

    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "GetProfile()" })).toBeInTheDocument();
  });

  it("groups discovered functions under interfaces and supports collapsing", () => {
    const namespacedGrains = [
      {
        interfaceId: "inventory-1",
        interfaceName: "SiloScope.Inventory.IItemGrain",
        methods: [{ name: "GetItem", parameters: [] }],
      },
      {
        interfaceId: "matchmaking-1",
        interfaceName: "SiloScope.Matchmaking.IGameGrain",
        methods: [{ name: "CreateGame", parameters: [] }],
      },
    ];

    render(
      <NavigationSidebar
        activeView="workspace"
        grains={namespacedGrains}
        isConnected
        onSelectGrain={vi.fn()}
        onThemeChange={vi.fn()}
        selectedGrain={null}
        theme="dark"
        workspace={workspace}
      />,
    );

    const inventoryGroup = screen.getByRole("button", { name: "SiloScope.Inventory.IItemGrain 1" });

    expect(inventoryGroup).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("button", { name: "GetItem()" })).toBeInTheDocument();

    fireEvent.click(inventoryGroup);

    expect(inventoryGroup).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: "GetItem()" })).not.toBeInTheDocument();
  });

  it("keeps a large catalog collapsed until an interface is opened", () => {
    const largeCatalog = Array.from({ length: 60 }, (_, interfaceIndex) => ({
      interfaceId: `grain-${interfaceIndex}`,
      interfaceName: `Domain.IGrain${interfaceIndex}`,
      methods: Array.from({ length: 3 }, (_, methodIndex) => ({
        name: `Action${interfaceIndex}_${methodIndex}`,
        parameters: [],
      })),
    }));

    render(
      <NavigationSidebar
        activeView="workspace"
        grains={largeCatalog}
        isConnected
        onSelectGrain={vi.fn()}
        selectedGrain={null}
        workspace={workspace}
      />,
    );

    expect(screen.getByText("180 functions")).toBeInTheDocument();
    expect(screen.getByText("Interfaces collapsed for fast browsing")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Action0_0()" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Domain.IGrain59 3" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Domain.IGrain0 3" }));

    expect(screen.getByRole("button", { name: "Action0_0()" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show next 10 of 10 interfaces" }));

    expect(screen.getByRole("button", { name: "Domain.IGrain59 3" })).toBeInTheDocument();
  });

  it("reveals long function lists progressively", () => {
    const longInterface = [{
      interfaceId: "bulk-grain",
      interfaceName: "Domain.IBulkGrain",
      methods: Array.from({ length: 45 }, (_, index) => ({
        name: `Invoke${index}`,
        parameters: [],
      })),
    }];

    render(
      <NavigationSidebar
        activeView="workspace"
        grains={longInterface}
        isConnected
        onSelectGrain={vi.fn()}
        selectedGrain={null}
        workspace={workspace}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Domain.IBulkGrain 45" }));

    expect(screen.getByRole("button", { name: "Invoke29()" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Invoke30()" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Show 15 more functions" }));

    expect(screen.getByRole("button", { name: "Invoke44()" })).toBeInTheDocument();
  });

  it("keeps a selected interface expanded in a large catalog", () => {
    const largeCatalog = Array.from({ length: 60 }, (_, index) => ({
      interfaceId: `grain-${index}`,
      interfaceName: `Domain.IGrain${index}`,
      methods: [{ name: `Read${index}`, parameters: [] }],
    }));

    render(
      <NavigationSidebar
        activeView="workspace"
        grains={largeCatalog}
        isConnected
        onSelectGrain={vi.fn()}
        selectedGrain="grain-59"
        workspace={workspace}
      />,
    );

    expect(screen.getByRole("button", { name: "Read59()" })).toBeInTheDocument();
  });

  it("renders NuGet workspace navigation when NuGet view is active", () => {
    render(
      <NavigationSidebar
        activeView="nuget"
        grains={[]}
        isConnected={false}
        onSelectGrain={vi.fn()}
        selectedGrain={null}
        workspace={null}
      />,
    );

    expect(screen.getByText("NuGet")).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByText("No cluster loaded")).toBeInTheDocument();
  });
});
