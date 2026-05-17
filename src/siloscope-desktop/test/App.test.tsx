import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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
  it("collapses the response pane from the titlebar", () => {
    render(<App />);

    expect(screen.getByRole("complementary", { name: "Response" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Collapse response panel" }));

    expect(screen.queryByRole("complementary", { name: "Response" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Expand response panel" })).toBeInTheDocument();
  });

  it("switches the shell and editors to the light theme from settings", () => {
    const { container } = render(<App />);

    fireEvent.click(screen.getByRole("button", { name: "Settings" }));
    fireEvent.change(screen.getByLabelText("Workbench theme"), {
      target: { value: "light" },
    });

    expect(container.firstElementChild).toHaveAttribute("data-theme", "light");
    expect(screen.getAllByTestId("mock-editor")[0]).toHaveAttribute("data-theme", "light");
  });
});
