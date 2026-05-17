import { act, fireEvent, render, screen } from "@testing-library/react";
import { Electroview } from "electrobun/view";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/renderer/App";
import { useAppStore } from "@/renderer/store";

vi.mock("electrobun/view", () => ({
  Electroview: {
    defineRPC: vi.fn(),
  },
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
    useAppStore.setState({
      workspace: null,
      grains: [],
      sourceCatalog: { sources: [] },
      selectedGrain: null,
      selectedMethod: null,
      selectedFunctionId: null,
      invocationResult: null,
      logs: [],
      isConnected: false,
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

  it("clears workspace state when the File menu requests a new workspace", () => {
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

    rpcConfig.handlers.messages.applicationMenuAction({ action: "newWorkspace" });

    expect(useAppStore.getState().workspace).toBeNull();
    expect(useAppStore.getState().grains).toEqual([]);
    expect(useAppStore.getState().sourceCatalog).toEqual({ sources: [] });
    expect(useAppStore.getState().selectedFunctionId).toBeNull();
    expect(useAppStore.getState().invocationResult).toBeNull();
  });

  it("clears workspace state from the navigation new workspace action", () => {
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

    expect(useAppStore.getState().workspace).toBeNull();
    expect(useAppStore.getState().grains).toEqual([]);
    expect(useAppStore.getState().sourceCatalog).toEqual({ sources: [] });
    expect(useAppStore.getState().selectedFunctionId).toBeNull();
    expect(useAppStore.getState().invocationResult).toBeNull();
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
});
