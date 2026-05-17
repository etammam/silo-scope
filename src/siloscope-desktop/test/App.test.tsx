import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "@/renderer/App";

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
});
