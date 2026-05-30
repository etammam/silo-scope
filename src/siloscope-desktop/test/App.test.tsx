import { act, fireEvent, render, screen, within } from "@testing-library/react";
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
    getClusterTopology: vi.fn(),
    listNugetFeeds: vi.fn(),
    createNugetFeed: vi.fn(),
    testNugetFeed: vi.fn(),
    updateNugetFeed: vi.fn(),
    searchNugetPackages: vi.fn(),
    getNugetPackageVersions: vi.fn(),
    addNugetPackageSource: vi.fn(),
    invokeGrain: vi.fn(),
    getWorkspaces: vi.fn(),
    getBackendLogs: vi.fn(),
    openBackendLogDirectory: vi.fn(),
    getAppUpdateState: vi.fn(),
    checkForAppUpdate: vi.fn(),
    downloadAppUpdate: vi.fn(),
    applyAppUpdate: vi.fn(),
  };
  const send = {
    connectionChanged: vi.fn(),
    logEntry: vi.fn(),
    openFileDialog: vi.fn(),
    appUpdateStatusChanged: vi.fn(),
    updateUnsavedRequestContexts: vi.fn(),
  };
  const addMessageListener = vi.fn();
  const ElectroviewMock = Object.assign(
    vi.fn(function (this: { rpc: { request: typeof request; send: typeof send; addMessageListener: typeof addMessageListener } }) {
      this.rpc = { request, send, addMessageListener };
    }),
    {
      defineRPC: vi.fn((config) => config),
    },
  );

  return { ElectroviewMock, request, send, addMessageListener };
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
    theme?: "vscode-dark" | "vscode-light" | "github-dark" | "github-light";
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
    electrobunMock.request.getClusterTopology.mockClear();
    electrobunMock.request.listNugetFeeds.mockClear();
    electrobunMock.request.createNugetFeed.mockClear();
    electrobunMock.request.testNugetFeed.mockClear();
    electrobunMock.request.updateNugetFeed.mockClear();
    electrobunMock.request.searchNugetPackages.mockClear();
    electrobunMock.request.getNugetPackageVersions.mockClear();
    electrobunMock.request.addNugetPackageSource.mockClear();
    electrobunMock.request.invokeGrain.mockClear();
    electrobunMock.request.getWorkspaces.mockClear();
    electrobunMock.request.getBackendLogs.mockClear();
    electrobunMock.request.openBackendLogDirectory.mockClear();
    electrobunMock.request.getAppUpdateState.mockClear();
    electrobunMock.request.checkForAppUpdate.mockClear();
    electrobunMock.request.downloadAppUpdate.mockClear();
    electrobunMock.request.applyAppUpdate.mockClear();
    electrobunMock.send.connectionChanged.mockClear();
    electrobunMock.send.logEntry.mockClear();
    electrobunMock.send.updateUnsavedRequestContexts.mockClear();
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
    electrobunMock.request.getNugetPackageVersions.mockResolvedValue({ versions: ["1.0.0", "2.0.0"] });
    electrobunMock.request.createNugetFeed.mockResolvedValue({
      feed: {
        name: "private",
        url: "https://nuget.example/v3/index.json",
        hasCredentials: true,
        isDefault: false,
      },
    });
    electrobunMock.request.testNugetFeed.mockResolvedValue({ success: true });
    electrobunMock.request.updateNugetFeed.mockResolvedValue({
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
    electrobunMock.request.getBackendLogs.mockResolvedValue({ entries: [] });
    electrobunMock.request.getClusterTopology.mockResolvedValue({
      topology: {
        capturedAt: new Date().toISOString(),
        isLive: false,
        source: "workspace-catalog",
        clients: [],
        silos: [],
        connections: [],
      },
    });
    electrobunMock.request.openBackendLogDirectory.mockResolvedValue({
      success: true,
      path: "/tmp/siloscope/logs",
    });
    electrobunMock.request.getAppUpdateState.mockResolvedValue({
      localInfo: {
        version: "0.0.1",
        hash: "abcdef123456",
        baseUrl: "https://github.com/etammam/silo-scope/releases/latest/download",
        channel: "dev",
        name: "siloscope",
        identifier: "siloscope.app",
      },
      updateInfo: null,
      statusHistory: [],
    });
    electrobunMock.request.checkForAppUpdate.mockResolvedValue({
      localInfo: {
        version: "0.0.1",
        hash: "abcdef123456",
        baseUrl: "https://github.com/etammam/silo-scope/releases/latest/download",
        channel: "dev",
        name: "siloscope",
        identifier: "siloscope.app",
      },
      updateInfo: null,
      statusHistory: [],
    });
    electrobunMock.request.downloadAppUpdate.mockResolvedValue({
      localInfo: {
        version: "0.0.1",
        hash: "abcdef123456",
        baseUrl: "https://github.com/etammam/silo-scope/releases/latest/download",
        channel: "dev",
        name: "siloscope",
        identifier: "siloscope.app",
      },
      updateInfo: null,
      statusHistory: [],
    });
    electrobunMock.request.applyAppUpdate.mockResolvedValue({ success: true });
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

  it("connects and disconnects the active cluster from the titlebar", async () => {
    useAppStore.setState({
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

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Connect cluster" }));
    await screen.findByText("Connected");
    fireEvent.click(screen.getByRole("button", { name: "Disconnect cluster" }));

    expect(electrobunMock.request.connectCluster).toHaveBeenCalledWith({
      workspace: expect.objectContaining({ id: "workspace-1" }),
    });
    expect(electrobunMock.request.disconnectCluster).toHaveBeenCalledWith();
  });

  it("loads persisted workspaces into the workspace menu on startup", async () => {
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

    expect(await screen.findByRole("button", { name: "Persisted Workspace" })).toBeInTheDocument();
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

  it("opens a workbench tab when a source function is selected", async () => {
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
      grains: [],
      selectedGrain: null,
      selectedMethod: null,
      selectedFunctionId: null,
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "GetScore()" }));

    expect(await screen.findByRole("tab", { name: /GetScore.*IPlayerGrain/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    expect(useAppStore.getState().selectedFunctionId).toBe("function-1");
  });

  it("reports and saves all unsaved request contexts for the close guard", async () => {
    const rpcConfig = vi.mocked(Electroview.defineRPC).mock.calls[0][0] as any;
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
      grains: [],
      selectedGrain: null,
      selectedMethod: null,
      selectedFunctionId: null,
    });

    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "GetScore()" }));
    fireEvent.change(screen.getByPlaceholderText("Primary key"), { target: { value: "player-1" } });

    expect(rpcConfig.handlers.requests.getUnsavedRequestContexts()).toEqual({
      requests: [
        {
          tabId: "function-1",
          label: "IPlayerGrain.GetScore",
          targetGrainClass: "IPlayerGrain",
          targetMethod: "GetScore",
        },
      ],
    });

    await act(async () => {
      await rpcConfig.handlers.requests.saveUnsavedRequestContexts();
    });

    expect(electrobunMock.request.saveWorkspace).toHaveBeenCalledWith({
      path: undefined,
      workspace: expect.objectContaining({
        savedContexts: [
          expect.objectContaining({
            tabId: "function-1",
            grainId: "player-1",
            targetGrainClass: "IPlayerGrain",
            targetMethod: "GetScore",
          }),
        ],
      }),
    });
  });

  it("opens package feeds as a full-page manager and tests then saves a feed", async () => {
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
    await screen.findByRole("heading", { name: "Package feeds" });
    fireEvent.change(screen.getByLabelText("Feed name"), {
      target: { value: "private" },
    });
    fireEvent.change(screen.getByLabelText("Feed URL"), {
      target: { value: "https://nuget.example/v3/index.json" },
    });
    fireEvent.change(screen.getByLabelText("Feed username"), {
      target: { value: "user" },
    });
    fireEvent.change(screen.getByLabelText("Feed token"), {
      target: { value: "token" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Test connection" }));
    await screen.findByText("Connection succeeded");
    fireEvent.click(screen.getByRole("button", { name: "Connect and save" }));

    expect(electrobunMock.request.testNugetFeed).toHaveBeenCalledWith({
      name: "private",
      url: "https://nuget.example/v3/index.json",
      username: "user",
      password: "token",
      isPasswordClearText: true,
    });
    expect(electrobunMock.request.createNugetFeed).toHaveBeenCalledWith({
      name: "private",
      url: "https://nuget.example/v3/index.json",
      username: "user",
      password: "token",
      isPasswordClearText: true,
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

  it("resizes the navigation sidebar with the shell splitter", () => {
    const { container } = render(<App />);
    const splitter = screen.getByRole("separator", { name: "Resize navigation sidebar" });

    fireEvent.mouseDown(splitter);
    fireEvent.mouseMove(document, { clientX: 360 });
    fireEvent.mouseUp(document);

    expect(container.firstElementChild).toHaveStyle({ "--navigation-size": "312px" });
  });

  it("switches the shell and editors to the light theme from settings", () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.click(screen.getByRole("radio", { name: "VS Code Light" }));

    expect(container.firstElementChild).toHaveAttribute("data-theme", "vscode-light");
    expect(window.localStorage.getItem("siloscope.theme")).toBe("vscode-light");
  });

  it("restores the persisted workbench theme", () => {
    window.localStorage.setItem("siloscope.theme", "vscode-light");

    const { container } = render(<App />);

    expect(container.firstElementChild).toHaveAttribute("data-theme", "vscode-light");
  });

  it("navigates to the workspaces page when the File menu requests a new workspace", () => {
    const rpcConfig = vi.mocked(Electroview.defineRPC).mock.calls[0][0] as any;
    render(<App />);

    act(() => {
      rpcConfig.handlers.messages.applicationMenuAction({ action: "newWorkspace" });
    });

    expect(screen.getByRole("heading", { name: "Clusters" })).toBeInTheDocument();
  });

  it("navigates to the Clusters page from the ActivityBar", () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Clusters" }));

    expect(screen.getByRole("heading", { name: "Clusters" })).toBeInTheDocument();
  });

  it("creates a workspace, configures cluster settings, references a DLL source, and connects", async () => {
    render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Clusters" }));
    expect(screen.getByRole("heading", { name: "Clusters" })).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Cluster name"), {
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
    fireEvent.change(screen.getByLabelText("Silo reference"), {
      target: { value: "/tmp/Contracts.dll" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Silo" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Cluster" }));

    fireEvent.click(screen.getByRole("button", { name: "Workspace" }));
    fireEvent.click(screen.getByRole("button", { name: "Connect cluster" }));

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

    fireEvent.click(screen.getByRole("button", { name: "Clusters" }));
    fireEvent.change(screen.getByLabelText("Cluster name"), {
      target: { value: "Tenant Workspace" },
    });
    fireEvent.change(screen.getByLabelText("Silo reference"), {
      target: { value: "/tmp/Contracts.dll" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Silo" }));
    fireEvent.click(screen.getByRole("button", { name: "Create Cluster" }));

    fireEvent.click(screen.getByRole("button", { name: "Edit Tenant Workspace" }));
    expect(screen.getByRole("heading", { name: "Edit cluster" })).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Cluster name"), {
      target: { value: "Tenant Workspace Edited" },
    });
    fireEvent.change(screen.getByLabelText("Silo reference"), {
      target: { value: "/tmp/MoreContracts.dll" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add Silo" }));
    fireEvent.click(screen.getByRole("button", { name: "Save Cluster" }));

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
    expect(screen.getByRole("button", { name: "Toggle backend logs panel" })).toHaveTextContent("Workspace loaded");
  });

  it("opens retained backend logs in a resizable bottom panel from the status bar", async () => {
    electrobunMock.request.getBackendLogs.mockResolvedValue({
      entries: [
        {
          timestamp: "2026-05-17T20:00:00.000Z",
          level: "info",
          category: "Siloscope.Core",
          message: "JSON-RPC server listening",
          exception: null,
        },
      ],
    });

    const { container } = render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Toggle backend logs panel" }));

    const logPanel = await screen.findByRole("region", { name: "Backend logs panel" });
    expect(logPanel).toBeInTheDocument();
    const resizeHandle = screen.getByRole("separator", { name: "Resize backend logs panel" });
    expect(resizeHandle).toBeInTheDocument();
    expect(within(logPanel).getByText("JSON-RPC server listening")).toBeInTheDocument();
    expect(electrobunMock.request.getBackendLogs).toHaveBeenCalledWith();

    vi.spyOn(container.firstElementChild!, "getBoundingClientRect").mockReturnValue({
      bottom: 800,
      height: 800,
    } as DOMRect);
    fireEvent.mouseDown(resizeHandle);
    fireEvent.mouseMove(document, { clientY: 500 });
    fireEvent.mouseUp(document);
    expect(container.firstElementChild).toHaveStyle({ "--log-panel-size": "276px" });

    fireEvent.click(screen.getByRole("button", { name: "Close logs panel" }));
    expect(screen.queryByRole("region", { name: "Backend logs panel" })).not.toBeInTheDocument();
  });

});
