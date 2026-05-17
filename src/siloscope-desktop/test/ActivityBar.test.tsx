import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ActivityBar } from "@/renderer/components/ActivityBar";

describe("ActivityBar", () => {
  it("renders the primary view buttons", () => {
    render(<ActivityBar activeView="workspace" onViewChange={vi.fn()} />);

    expect(screen.getByRole("navigation", { name: "Primary views" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Workspace" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: "NuGet" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
    expect(screen.queryByRole("button", { name: "Settings" })).not.toBeInTheDocument();
  });

  it("notifies when a different view is selected", () => {
    const onViewChange = vi.fn();
    render(<ActivityBar activeView="workspace" onViewChange={onViewChange} />);

    fireEvent.click(screen.getByRole("button", { name: "NuGet" }));

    expect(onViewChange).toHaveBeenNthCalledWith(1, "nuget");
  });
});
