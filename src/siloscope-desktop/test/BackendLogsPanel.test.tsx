import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import {
  BackendLogsPanel,
  BackendLogStatusButton,
} from "@/renderer/components/BackendLogsPanel";

const entries = [
  {
    timestamp: "2026-05-25T10:22:33.100Z",
    level: "info" as const,
    category: "Siloscope.Core.Workspaces",
    message: "Workspace Local loaded",
    exception: null,
  },
  {
    timestamp: "2026-05-25T10:22:34.100Z",
    level: "error" as const,
    category: "Siloscope.Core.Clustering",
    message: "Connection failed",
    exception: "System.TimeoutException: Gateway unavailable",
  },
];

describe("BackendLogStatusButton", () => {
  it("summarizes live backend output and toggles the bottom panel", () => {
    const onToggle = vi.fn();
    render(<BackendLogStatusButton entries={entries} isOpen={false} onToggle={onToggle} />);

    const button = screen.getByRole("button", { name: "Toggle backend logs panel" });
    expect(button).toHaveTextContent("Backend Logs");
    expect(button).toHaveTextContent("2");
    expect(button).toHaveTextContent("1 errors");
    expect(button).toHaveTextContent("Connection failed");
    fireEvent.click(button);
    expect(onToggle).toHaveBeenCalledWith();
  });
});

describe("BackendLogsPanel", () => {
  it("filters structured log lines by text and level", () => {
    render(
      <BackendLogsPanel
        entries={entries}
        onClear={vi.fn()}
        onClose={vi.fn()}
        onOpenLogDirectory={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Search backend logs"), {
      target: { value: "gateway" },
    });
    expect(screen.getByText("Connection failed")).toBeInTheDocument();
    expect(screen.queryByText("Workspace Local loaded")).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Search backend logs"), {
      target: { value: "" },
    });
    fireEvent.change(screen.getByLabelText("Filter log level"), {
      target: { value: "info" },
    });
    expect(screen.getByText("Workspace Local loaded")).toBeInTheDocument();
    expect(screen.queryByText("Connection failed")).not.toBeInTheDocument();
  });

  it("copies visible lines, opens the log directory, and closes", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    const onClose = vi.fn();
    const onOpenLogDirectory = vi.fn().mockResolvedValue({
      success: true,
      path: "/tmp/siloscope/logs",
    });

    render(
      <BackendLogsPanel
        entries={entries}
        onClear={vi.fn()}
        onClose={onClose}
        onOpenLogDirectory={onOpenLogDirectory}
      />,
    );

    fireEvent.change(screen.getByLabelText("Filter log level"), {
      target: { value: "error" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Copy visible logs" }));
    expect(await screen.findByText("1 line copied")).toBeInTheDocument();
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("Connection failed"));
    expect(writeText).toHaveBeenCalledWith(expect.stringContaining("System.TimeoutException"));

    fireEvent.click(screen.getByRole("button", { name: "Open logs folder" }));
    expect(await screen.findByText("Opened /tmp/siloscope/logs")).toBeInTheDocument();
    expect(onOpenLogDirectory).toHaveBeenCalledWith();

    fireEvent.click(screen.getByRole("button", { name: "Close logs panel" }));
    expect(onClose).toHaveBeenCalledWith();
  });
});
