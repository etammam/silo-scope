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
    expect(screen.getByText("No workspace loaded")).toBeInTheDocument();
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

  it("toggles source enabled state without losing the catalog", () => {
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

    const sourceToggle = screen.getByRole("checkbox", { name: "127.0.0.1:30000 enabled" });

    expect(sourceToggle).toBeChecked();
    fireEvent.click(sourceToggle);

    expect(sourceToggle).not.toBeChecked();
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

  it("renders NuGet registry manager when NuGet view is active", () => {
    render(
      <NavigationSidebar
        activeView="nuget"
        grains={[]}
        isConnected={false}
        onSelectGrain={vi.fn()}
        onThemeChange={vi.fn()}
        selectedGrain={null}
        theme="dark"
        workspace={null}
      />,
    );

    expect(screen.getByText("NuGet")).toBeInTheDocument();
    expect(screen.getByLabelText("Active source")).toHaveValue("nuget.org");
    expect(screen.getByLabelText("Package ID")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Search Packages" })).toBeInTheDocument();
  });

  it("searches NuGet packages and adds a package source", async () => {
    const onSearchPackages = vi.fn().mockResolvedValue(undefined);
    const onAddPackageSource = vi.fn().mockResolvedValue(undefined);

    render(
      <NavigationSidebar
        activeView="nuget"
        grains={[]}
        isConnected={false}
        nugetFeeds={[
          {
            name: "nuget.org",
            url: "https://api.nuget.org/v3/index.json",
            hasCredentials: false,
            isDefault: true,
          },
        ]}
        nugetPackages={[
          {
            packageId: "SiloScope.Contracts",
            version: "1.0.0",
            description: "Contracts",
          },
        ]}
        onAddNugetPackageSource={onAddPackageSource}
        onSearchNugetPackages={onSearchPackages}
        onSelectGrain={vi.fn()}
        onThemeChange={vi.fn()}
        selectedGrain={null}
        theme="dark"
        workspace={workspace}
      />,
    );

    fireEvent.change(screen.getByLabelText("Package ID"), {
      target: { value: "SiloScope" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search Packages" }));
    fireEvent.click(screen.getByRole("button", { name: "SiloScope.Contracts 1.0.0" }));

    expect(onSearchPackages).toHaveBeenCalledWith({
      query: "SiloScope",
      sourceUrl: "https://api.nuget.org/v3/index.json",
      feedName: undefined,
    });
    expect(onAddPackageSource).toHaveBeenCalledWith({
      packageId: "SiloScope.Contracts",
      version: "1.0.0",
      sourceUrl: "https://api.nuget.org/v3/index.json",
      feedName: undefined,
    });
  });

  it("renders system settings when settings view is active", () => {
    const onThemeChange = vi.fn();
    const onClearLogs = vi.fn();

    render(
      <NavigationSidebar
        activeView="settings"
        grains={[]}
        isConnected={false}
        logs={[
          {
            timestamp: "2026-05-18T10:00:00.000Z",
            level: "info",
            message: "Workspace loaded",
          },
          {
            timestamp: "2026-05-18T10:00:01.000Z",
            level: "warn",
            message: "No silo sources",
          },
          {
            timestamp: "2026-05-18T10:00:02.000Z",
            level: "error",
            message: "Connection failed",
          },
        ]}
        onClearLogs={onClearLogs}
        onSelectGrain={vi.fn()}
        onThemeChange={onThemeChange}
        selectedGrain={null}
        theme="dark"
        workspace={null}
      />,
    );

    expect(screen.getByText("Application")).toBeInTheDocument();
    expect(screen.getByLabelText("Use native titlebar")).toBeChecked();
    expect(screen.getByLabelText("Disable text selection")).toBeChecked();
    expect(screen.getByLabelText("Workbench theme")).toHaveValue("dark");
    expect(screen.getByLabelText("Core logs")).toBeInTheDocument();
    expect(screen.getByText("Workspace loaded")).toBeInTheDocument();
    expect(screen.getByText("No silo sources")).toBeInTheDocument();
    expect(screen.getByText("Connection failed")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Workbench theme"), {
      target: { value: "light" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(onThemeChange).toHaveBeenCalledWith("light");
    expect(onClearLogs).toHaveBeenCalledOnce();
  });
});
