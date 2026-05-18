import { act, fireEvent, render, screen } from "@testing-library/react";
import { Electroview } from "electrobun/view";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/renderer/App";
import { useAppStore } from "@/renderer/store";

const electrobunMock = vi.hoisted(() => {
  const request = {
    loadWorkspace: vi.fn(),
    setActiveWorkspace: vi.fn(),
    saveWorkspace: vi.fn(),
    connectCluster: vi.fn(),
    disconnectCluster: vi.fn(),
    discoverGrains: vi.fn(),
    getGrains: vi.fn(),
    getSourceCatalog: vi.fn(),
    listNugetFeeds: vi.fn(),
    createNugetFeed: vi.fn(),
    searchNugetPackages: vi.fn(),
    addNugetPackageSource: vi.fn(),
    invokeGrain: vi.fn(),
    getWorkspaces: vi.fn(),
  };
  const send = {
    connectionChanged: vi.fn(),
    logEntry: vi.fn(),
  };
  const ElectroviewMock = Object.assign(
    vi.fn(function (this: { rpc: { request: typeof request; send: typeof send } }) {
      this.rpc = { request, send };
    }),
    {
      defineRPC: vi.fn((config) => config),
    },
  );

  return { ElectroviewMock, request, send };
});

vi.mock("electrobun/view", () => ({
  Electroview: electrobunMock.ElectroviewMock,
}));

vi.mock("@/renderer/components/MonacoEditor", () => ({
  MonacoEditor: ({
    value,
    theme,
  }: {
    value: string;
    theme?: "dark" | "light";
  }) => (
    <pre data-testid="mock-editor" data-theme={theme}>
      {value}
    </pre>
  ),
}));

describe("App shell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    electrobunMock.request.loadWorkspace.mockClear();
    electrobunMock.request.setActiveWorkspace.mockClear();
    electrobunMock.request.saveWorkspace.mockClear();
    electrobunMock.request.connectCluster.mockClear();
    electrobunMock.request.disconnectCluster.mockClear();
    electrobunMock.request.discoverGrains.mockClear();
    electrobunMock.request.getGrains.mockClear();
    electrobunMock.request.getSourceCatalog.mockClear();
    electrobunMock.request.listNugetFeeds.mockClear();
    electrobunMock.request.createNugetFeed.mockClear();
    electrobunMock.request.searchNugetPackages.mockClear();
    electrobunMock.request.addNugetPackageSource.mockClear();
    electrobunMock.request.invokeGrain.mockClear();
    electrobunMock.request.getWorkspaces.mockClear();
    electrobunMock.send.connectionChanged.mockClear();
    electrobunMock.send.logEntry.mockClear();
    electrobunMock.request.loadWorkspace.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Local",
        siloAddress: "127.0.0.1",
        gatewayPort: 30000,
        orleansVersion: "10.0",
        clusterId: "dev",
        serviceId: "SiloScope",
        gatewayEndpoints: ["127.0.0.1:30000"],
        sources: [],
      },
    });
    electrobunMock.request.setActiveWorkspace.mockImplementation(async ({ workspace }) => ({
      workspace,
    }));
    electrobunMock.request.saveWorkspace.mockResolvedValue({ success: true });
    electrobunMock.request.connectCluster.mockResolvedValue({
      message: "Connected to 1 gateway(s).",
    });
    electrobunMock.request.disconnectCluster.mockResolvedValue({ success: true });
    electrobunMock.request.discoverGrains.mockResolvedValue({
      grains: [],
      sourceCatalog: { sources: [] },
    });
    electrobunMock.request.discoverGrains.mockResolvedValue({
      grains: [],
      sourceCatalog: { sources: [] },
    });
    electrobunMock.request.listNugetFeeds.mockResolvedValue({
      feeds: [
        {
          name: "nuget.org",
          url: "https://api.nuget.org/v3/index.json",
          hasCredentials: false,
          isDefault: true,
        },
      ],
    });
    electrobunMock.request.searchNugetPackages.mockResolvedValue({ packages: [] });
    electrobunMock.request.createNugetFeed.mockResolvedValue({
      feed: {
        name: "private",
        url: "https://nuget.example/v3/index.json",
        hasCredentials: true,
        isDefault: false,
      },
    });
    electrobunMock.request.addNugetPackageSource.mockResolvedValue({
      workspace: {
        id: "workspace-1",
        name: "Local",
        siloAddress: "127.0.0.1",
        gatewayPort: 30000,
        orleansVersion: "10.0",
        sources: [],
      },
    });
    electrobunMock.request.getWorkspaces.mockResolvedValue({ workspaces: [] });
    electrobunMock.request.invokeGrain.mockResolvedValue({
      isSuccess: true,
      result: "{}",
      timing: {
        serializationMs: 1,
        executionMs: 2,
        totalMs: 3,
      },
    });
    useAppStore.setState({
      workspace: null,
      grains: [],
      sourceCatalog: { sources: [] },
      selectedGrain: null,
      selectedMethod: null,
      selectedFunctionId: null,
      invocationResult: null,
      logs: [],
      nugetFeeds: [],
      nugetPackages: [],
      isConnected: false,
    });
  });

  it("loads the source catalog through the desktop backend when a workspace is set", async () => {
    electrobunMock.request.discoverGrains.mockResolvedValue({
      grains: [
        {
          interfaceId: "grain-1",
          interfaceName: "IPlayerGrain",
          methods: [{ name: "GetScore", parameters: [], signature: "GetScore()", returnType: "int", keyType: "String" }],
        },
      ],
      sourceCatalog: {
        sources: [
          {
            sourceId: "source-1",
            sourceType: "DLL",
            reference: "Game.Grains.dll",
            label: "Game.Grains.dll",
            enabled: true,
            discoveryStatus: "ready",
            interfaces: [
              {
                interfaceId: "grain-1",
                interfaceName: "IPlayerGrain",
                namespace: "Game.Grains",
                methods: [
                  {
                    functionId: "function-1",
                    sourceId: "source-1",
                    interfaceId: "grain-1",
                    interfaceName: "IPlayerGrain",
                    namespace: "Game.Grains",
                    methodName: "GetScore",
                    signature: "GetScore()",
                    returnType: "int",
                    keyType: "String",
                    parameters: [],
                  },
                ],
              },
            ],
          },
        ],
      },
    });
    const rpcConfig = vi.mocked(Electroview.defineRPC).mock.calls[0][0] as any;

    act(() => {
      rpcConfig.handlers.requests.setWorkspace({
        workspace: {
          id: "workspace-1",
          name: "Local",
          siloAddress: "127.0.0.1",
          gatewayPort: 30000,
          orleansVersion: "10.0",
        },
      });
      useAppStore.setState({ isConnected: true });
    });
    render(<App />);

    expect(await screen.findAllByText("Game.Grains.dll")).not.toHaveLength(0);

    expect(electrobunMock.request.discoverGrains).toHaveBeenCalledWith({ workspaceId: "workspace-1" });
    expect(useAppStore.getState().sourceCatalog.sources[0]?.interfaces[0]?.methods[0]?.functionId).toBe("function-1");
  });

  it("loads, saves, connects, disconnects, and discovers from the workspace panel", async () => {
    electrobunMock.request.discoverGrains.mockResolvedValue({
      grains: [
        {
          interfaceId: "grain-1",
          interfaceName: "IPlayerGrain",
          methods: [],
        },
      ],
      sourceCatalog: {
        sources: [
          {
            sourceId: "source-1",
            sourceType: "DLL",
            reference: "Game.Grains.dll",
            label: "Game.Grains.dll",
            enabled: true,
            discoveryStatus: "ready",
            interfaces: [],
          },
        ],
      },
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Load" }));
    expect(await screen.findByLabelText("Active workspace")).toHaveValue("workspace-1");

    fireEvent.click(screen.getByRole("button", { name: "Save" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));
    await screen.findByText("Connected");
    fireEvent.click(screen.getByRole("button", { name: "Discover Grains" }));
    fireEvent.click(screen.getByRole("button", { name: "Disconnect" }));

    expect(electrobunMock.request.loadWorkspace).toHaveBeenCalledWith(undefined);
    expect(electrobunMock.request.setActiveWorkspace).toHaveBeenCalledWith({
      workspace: expect.objectContaining({ id: "workspace-1" }),
    });
    expect(electrobunMock.request.saveWorkspace).toHaveBeenCalledWith({
      workspace: expect.objectContaining({ id: "workspace-1" }),
      path: undefined,
    });
    expect(electrobunMock.request.connectCluster).toHaveBeenCalledWith({
      workspace: expect.objectContaining({ id: "workspace-1" }),
    });
    expect(electrobunMock.request.discoverGrains).toHaveBeenCalledWith({ workspaceId: "workspace-1" });
    expect(electrobunMock.request.disconnectCluster).toHaveBeenCalledWith();
  });

  it("loads persisted workspaces into the workspace selector on startup", async () => {
    electrobunMock.request.getWorkspaces.mockResolvedValue({
      workspaces: [
        {
          id: "workspace-2",
          name: "Persisted Workspace",
          siloAddress: "127.0.0.1",
          gatewayPort: 30000,
          orleansVersion: "10.0",
          clusterId: "dev",
          serviceId: "SiloScope",
          gatewayEndpoints: ["127.0.0.1:30000"],
          sources: [],
        },
      ],
    });

    render(<App />);

    expect(await screen.findByLabelText("Active workspace")).toHaveValue("workspace-2");
    expect(electrobunMock.request.setActiveWorkspace).toHaveBeenCalledWith({
      workspace: expect.objectContaining({ id: "workspace-2" }),
    });
  });

  it("invokes the selected function through the desktop backend", async () => {
    electrobunMock.request.invokeGrain.mockResolvedValue({
      isSuccess: true,
      result: JSON.stringify({ score: 42 }),
      timing: {
        serializationMs: 0.4,
        executionMs: 8.2,
        totalMs: 8.6,
      },
    });
    useAppStore.setState({
      workspace: {
        id: "workspace-1",
        name: "Local",
        siloAddress: "127.0.0.1",
        gatewayPort: 30000,
        orleansVersion: "10.0",
      },
      sourceCatalog: {
        sources: [
          {
            sourceId: "source-1",
            sourceType: "DLL",
            reference: "Game.Grains.dll",
            label: "Game.Grains.dll",
            enabled: true,
            discoveryStatus: "ready",
            interfaces: [
              {
                interfaceId: "grain-1",
                interfaceName: "IPlayerGrain",
                namespace: "Game.Grains",
                methods: [
                  {
                    functionId: "function-1",
                    sourceId: "source-1",
                    interfaceId: "grain-1",
                    interfaceName: "IPlayerGrain",
                    namespace: "Game.Grains",
                    methodName: "GetScore",
                    signature: "GetScore()",
                    returnType: "int",
                    keyType: "String",
                    parameters: [],
                  },
                ],
              },
            ],
          },
        ],
      },
      grains: [
        {
          interfaceId: "grain-1",
          interfaceName: "IPlayerGrain",
          methods: [{ name: "GetScore", parameters: [], signature: "GetScore()", returnType: "int", keyType: "String" }],
        },
      ],
      selectedGrain: "grain-1",
      selectedMethod: "GetScore",
      selectedFunctionId: "function-1",
    });

    render(<App />);

    fireEvent.change(screen.getByPlaceholderText("Primary key"), { target: { value: "player-1" } });
    fireEvent.click(screen.getByRole("button", { name: "Invoke Grain" }));

    await screen.findByText(/"score": 42/);

    expect(electrobunMock.request.invokeGrain).toHaveBeenCalledWith({
      grainType: "grain-1",
      method: "GetScore",
      grainKey: "player-1",
      payload: "{\n}",
      sourceId: "source-1",
      functionId: "function-1",
    });
    expect(useAppStore.getState().invocationResult?.timing?.totalMs).toBe(8.6);
  });

  it("wires NuGet feed search and package restore through the desktop backend", async () => {
    electrobunMock.request.searchNugetPackages.mockResolvedValue({
      packages: [
        {
          packageId: "SiloScope.Contracts",
          version: "1.0.0",
          description: "Contracts",
        },
      ],
    });
    useAppStore.setState({
      workspace: {
        id: "workspace-1",
        name: "Local",
        siloAddress: "127.0.0.1",
        gatewayPort: 30000,
        orleansVersion: "10.0",
      },
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "NuGet" }));
    await screen.findByLabelText("Active source");
    fireEvent.change(screen.getByLabelText("Package ID"), {
      target: { value: "SiloScope" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Search Packages" }));
    fireEvent.click(await screen.findByRole("button", { name: "SiloScope.Contracts 1.0.0" }));

    expect(electrobunMock.request.searchNugetPackages).toHaveBeenCalledWith({
      query: "SiloScope",
      sourceUrl: "https://api.nuget.org/v3/index.json",
      feedName: undefined,
      take: 20,
    });
    expect(electrobunMock.request.addNugetPackageSource).toHaveBeenCalledWith({
      packageId: "SiloScope.Contracts",
      version: "1.0.0",
      sourceUrl: "https://api.nuget.org/v3/index.json",
      feedName: undefined,
    });
  });

  it("collapses the response pane from the titlebar", () => {
    render(<App />);

    expect(screen.getByRole("complementary", { name: "Response" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize request and response panels" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse response panel" }));

    expect(screen.queryByRole("complementary", { name: "Response" })).not.toBeInTheDocument();
    expect(screen.queryByRole("separator", { name: "Resize request and response panels" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand response panel" })).toBeInTheDocument();
  });

  it("collapses the navigation panel from the titlebar", () => {
    render(<App />);

    expect(screen.getByRole("complementary", { name: "workspace navigation" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Timing" }));
    expect(screen.getByRole("tab", { name: "Timing" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "Collapse navigation panel" }));

    expect(screen.queryByRole("complementary", { name: "workspace navigation" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand navigation panel" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Timing" })).toHaveAttribute("aria-selected", "true");

    fireEvent.click(screen.getByRole("button", { name: "Expand navigation panel" }));

    expect(screen.getByRole("complementary", { name: "workspace navigation" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Timing" })).toHaveAttribute("aria-selected", "true");
  });

  it("preserves the selected response tab when the response pane is collapsed", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("tab", { name: "Timing" }));
    fireEvent.click(screen.getByRole("button", { name: "Collapse response panel" }));
    fireEvent.click(screen.getByRole("button", { name: "Expand response panel" }));

    expect(screen.getByRole("tab", { name: "Timing" })).toHaveAttribute("aria-selected", "true");
  });

  it("toggles request and response panes between horizontal and vertical layout", () => {
    const { container } = render(<App />);

    expect(container.firstElementChild).toHaveAttribute("data-pane-layout", "horizontal");
    expect(screen.getByRole("separator", { name: "Resize request and response panels" })).toHaveAttribute(
      "aria-orientation",
      "vertical",
    );

    fireEvent.click(screen.getByRole("button", { name: "Stack request and response panels" }));

    expect(container.firstElementChild).toHaveAttribute("data-pane-layout", "vertical");
    expect(screen.getByRole("button", { name: "Place request and response panels side by side" })).toBeInTheDocument();
    expect(screen.getByRole("separator", { name: "Resize request and response panels" })).toHaveAttribute(
      "aria-orientation",
      "horizontal",
    );
  });

  it("resizes request and response panes with the splitter", () => {
    const { container } = render(<App />);
    const splitter = screen.getByRole("separator", { name: "Resize request and response panels" });

    splitter.parentElement!.getBoundingClientRect = () =>
      ({
        bottom: 700,
        height: 500,
        left: 0,
        right: 1000,
        top: 200,
        width: 1000,
        x: 0,
        y: 200,
        toJSON: () => undefined,
      }) as DOMRect;

    fireEvent.mouseDown(splitter);
    fireEvent.mouseMove(document, { clientX: 640 });
    fireEvent.mouseUp(document);

    expect(container.firstElementChild).toHaveStyle({ "--response-size": "360px" });
  });

  it("switches the shell and editors to the light theme from settings", () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Workbench theme"), {
      target: { value: "light" },
    });

    expect(container.firstElementChild).toHaveAttribute("data-theme", "light");
    expect(window.localStorage.getItem("siloscope.theme")).toBe("light");
    expect(screen.getAllByTestId("mock-editor")[0]).toHaveAttribute("data-theme", "light");
  });

  it("restores the persisted workbench theme", () => {
    window.localStorage.setItem("siloscope.theme", "light");

    const { container } = render(<App />);

    expect(container.firstElementChild).toHaveAttribute("data-theme", "light");
    expect(screen.getAllByTestId("mock-editor")[0]).toHaveAttribute("data-theme", "light");
  });

  it("opens the workspace creation popup when the File menu requests a new workspace", () => {
    useAppStore.setState({
      workspace: {
        id: "workspace-1",
        name: "Local",
        siloAddress: "127.0.0.1",
        gatewayPort: 30000,
        orleansVersion: "10.0",
      },
      grains: [{ interfaceId: "grain-1", interfaceName: "IPlayerGrain", methods: [] }],
      sourceCatalog: {
        sources: [
          {
            sourceId: "source-1",
            sourceType: "DLL",
            reference: "Core.dll",
            label: "Core.dll",
            enabled: true,
            discoveryStatus: "ready",
            interfaces: [],
          },
        ],
      },
      selectedFunctionId: "function-1",
      invocationResult: { isSuccess: false, error: "pending" },
    });

    const rpcConfig = vi.mocked(Electroview.defineRPC).mock.calls[0][0] as any;
    render(<App />);

    act(() => {
      rpcConfig.handlers.messages.applicationMenuAction({ action: "newWorkspace" });
    });

    expect(screen.getByRole("dialog", { name: "New workspace" })).toBeInTheDocument();
  });

  it("opens the workspace creation popup from the navigation new workspace action", () => {
    useAppStore.setState({
      workspace: {
        id: "workspace-1",
        name: "Local",
        siloAddress: "127.0.0.1",
        gatewayPort: 30000,
        orleansVersion: "10.0",
      },
      grains: [{ interfaceId: "grain-1", interfaceName: "IPlayerGrain", methods: [] }],
      sourceCatalog: {
        sources: [
          {
            sourceId: "source-1",
            sourceType: "DLL",
            reference: "Core.dll",
            label: "Core.dll",
            enabled: true,
            discoveryStatus: "ready",
            interfaces: [],
          },
        ],
      },
      selectedFunctionId: "function-1",
      invocationResult: { isSuccess: false, error: "pending" },
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New workspace" }));

    expect(screen.getByRole("dialog", { name: "New workspace" })).toBeInTheDocument();
  });

  it("creates a workspace, configures cluster settings, references a DLL source, and connects", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New workspace" }));
    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "Tenant Workspace" },
    });
    fireEvent.change(screen.getByLabelText("Cluster ID"), {
      target: { value: "local-cluster" },
    });
    fireEvent.change(screen.getByLabelText("Service ID"), {
      target: { value: "TenantService" },
    });
    fireEvent.change(screen.getByLabelText("Gateway endpoint"), {
      target: { value: "localhost:11111" },
    });
    fireEvent.change(screen.getByLabelText("Source reference"), {
      target: { value: "/tmp/Contracts.dll" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect" }));

    await screen.findByText("Connected");

    expect(electrobunMock.request.setActiveWorkspace).toHaveBeenCalledWith({
      workspace: expect.objectContaining({
        clusterId: "local-cluster",
        serviceId: "TenantService",
        gatewayEndpoints: ["localhost:11111"],
        sources: [
          expect.objectContaining({
            sourceType: "DLL",
            reference: "/tmp/Contracts.dll",
            enabled: true,
          }),
        ],
      }),
    });
    expect(electrobunMock.request.saveWorkspace).toHaveBeenCalledWith({
      workspace: expect.objectContaining({
        name: "Tenant Workspace",
        sources: [
          expect.objectContaining({
            sourceType: "DLL",
            reference: "/tmp/Contracts.dll",
          }),
        ],
      }),
      path: undefined,
    });
    expect(electrobunMock.request.connectCluster).toHaveBeenCalledWith({
      workspace: expect.objectContaining({
        clusterId: "local-cluster",
        serviceId: "TenantService",
        gatewayEndpoints: ["localhost:11111"],
      }),
    });
  });

  it("edits a workspace and keeps multiple referenced sources", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "New workspace" }));
    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "Tenant Workspace" },
    });
    fireEvent.change(screen.getByLabelText("Source reference"), {
      target: { value: "/tmp/Contracts.dll" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Workspace" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit Workspace" }));
    expect(screen.getByRole("dialog", { name: "Edit workspace" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Workspace name"), {
      target: { value: "Tenant Workspace Edited" },
    });
    fireEvent.change(screen.getByLabelText("Source reference"), {
      target: { value: "/tmp/MoreContracts.dll" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Source" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Workspace" }));

    expect(useAppStore.getState().workspace).toEqual(
      expect.objectContaining({
        name: "Tenant Workspace Edited",
        sources: [
          expect.objectContaining({ reference: "/tmp/Contracts.dll" }),
          expect.objectContaining({ reference: "/tmp/MoreContracts.dll" }),
        ],
      }),
    );
    expect(electrobunMock.request.saveWorkspace).toHaveBeenCalledWith({
      workspace: expect.objectContaining({
        name: "Tenant Workspace Edited",
        sources: [
          expect.objectContaining({ reference: "/tmp/Contracts.dll" }),
          expect.objectContaining({ reference: "/tmp/MoreContracts.dll" }),
        ],
      }),
      path: undefined,
    });
  });

  it("toggles shell panels from the View menu actions", () => {
    const { container } = render(<App />);
    const rpcConfig = vi.mocked(Electroview.defineRPC).mock.calls[0][0] as any;

    expect(screen.getByRole("navigation", { name: "Primary views" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "workspace navigation" })).toBeInTheDocument();
    expect(screen.getByRole("complementary", { name: "Response" })).toBeInTheDocument();

    act(() => {
      rpcConfig.handlers.messages.applicationMenuAction({ action: "toggleActivityBar" });
      rpcConfig.handlers.messages.applicationMenuAction({ action: "toggleNavigationSidebar" });
      rpcConfig.handlers.messages.applicationMenuAction({ action: "toggleTelemetryPane" });
    });

    expect(container.firstElementChild).toHaveAttribute("data-activity-visible", "false");
    expect(container.firstElementChild).toHaveAttribute("data-navigation-visible", "false");
    expect(container.firstElementChild).toHaveAttribute("data-response-visible", "false");
    expect(screen.queryByRole("navigation", { name: "Primary views" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "workspace navigation" })).not.toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: "Response" })).not.toBeInTheDocument();
  });

  it("stores log entries sent from the sidecar", () => {
    render(<App />);
    const rpcConfig = vi.mocked(Electroview.defineRPC).mock.calls[0][0] as any;

    act(() => {
      rpcConfig.handlers.messages.logEntry({
        entry: {
          timestamp: "2026-05-17T20:00:00.000Z",
          level: "info",
          message: "Workspace loaded",
        },
      });
    });

    expect(useAppStore.getState().logs).toEqual([
      {
        timestamp: "2026-05-17T20:00:00.000Z",
        level: "info",
        message: "Workspace loaded",
      },
    ]);
  });

  it("shows session logs in settings and clears them on demand", () => {
    render(<App />);
    const rpcConfig = vi.mocked(Electroview.defineRPC).mock.calls[0][0] as any;

    act(() => {
      rpcConfig.handlers.messages.logEntry({
        entry: {
          timestamp: "2026-05-18T10:00:00.000Z",
          level: "warn",
          message: "No silo sources",
        },
      });
      rpcConfig.handlers.messages.logEntry({
        entry: {
          timestamp: "2026-05-18T10:00:01.000Z",
          level: "error",
          message: "Connection failed",
        },
      });
    });

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));

    expect(screen.getByText("No silo sources")).toBeInTheDocument();
    expect(screen.getByText("Connection failed")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));

    expect(useAppStore.getState().logs).toEqual([]);
    expect(screen.getByText("No logs captured")).toBeInTheDocument();
  });
});
