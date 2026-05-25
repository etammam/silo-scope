import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ResponseTelemetryPane } from "@/renderer/components/ResponseTelemetryPane";

vi.mock("@/renderer/components/MonacoEditor", () => ({
  MonacoEditor: ({
    value,
    readOnly,
  }: {
    value: string;
    readOnly?: boolean;
  }) => (
    <pre data-readonly={String(readOnly)} data-testid="output-viewer">
      {value}
    </pre>
  ),
}));

describe("ResponseTelemetryPane", () => {
  it("renders an idle empty state before invocation", () => {
    render(
      <ResponseTelemetryPane
        activeTab="response"
        onTabChange={vi.fn()}
        result={null}
        theme="dark"
      />,
    );

    expect(screen.getByText("Idle")).toBeInTheDocument();
    expect(screen.getAllByText("No response yet").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("output-viewer")).not.toBeInTheDocument();
    expect(screen.queryByText("No run")).not.toBeInTheDocument();
  });

  it("renders result output and timing breakdowns", () => {
    render(
      <ResponseTelemetryPane
        activeTab="timing"
        onTabChange={vi.fn()}
        result={{
          isSuccess: true,
          result: '{"count":3}',
          timing: {
            serializationMs: 1.5,
            executionMs: 12,
            totalMs: 20,
          },
        }}
        theme="dark"
      />,
    );

    expect(screen.getAllByText("Success").length).toBeGreaterThan(0);
    expect(screen.queryByTestId("output-viewer")).not.toBeInTheDocument();
    expect(screen.getByText("1.5 ms")).toBeInTheDocument();
    expect(screen.getByText("12 ms")).toBeInTheDocument();
    expect(screen.getAllByText("20 ms")).toHaveLength(2);
    expect(screen.getByText("60%")).toBeInTheDocument();
    expect(screen.getByText("8%")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Execution: 12 ms" })).toBeInTheDocument();
  });

  it("notifies when the selected response tab changes", () => {
    const onTabChange = vi.fn();

    render(
      <ResponseTelemetryPane
        activeTab="response"
        onTabChange={onTabChange}
        result={null}
        theme="dark"
      />,
    );

    fireEvent.click(screen.getByRole("tab", { name: "Timing" }));

    expect(onTabChange).toHaveBeenCalledWith("timing");
  });
});
