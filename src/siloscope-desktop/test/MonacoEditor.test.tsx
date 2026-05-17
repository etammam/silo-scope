import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MonacoEditor } from "@/renderer/components/MonacoEditor";

vi.mock("@monaco-editor/react", () => ({
  default: ({
    height,
    language,
    value,
    onChange,
    onMount,
    options,
  }: {
    height: string;
    language: string;
    value: string;
    onChange: (value: string) => void;
    onMount: (editor: unknown) => void;
    options: Record<string, unknown>;
  }) => (
    <div data-testid="mock-editor">
      <div>height: {height}</div>
      <div>language: {language}</div>
      <div>value: {value}</div>
    </div>
  ),
}));

describe("MonacoEditor", () => {
  it("renders with given value", () => {
    const handleChange = vi.fn();
    render(
      <MonacoEditor value='{"key": "value"}' onChange={handleChange} />
    );

    expect(screen.getByTestId("mock-editor")).toBeInTheDocument();
    expect(screen.getByText(/{"key": "value"}/)).toBeInTheDocument();
  });

  it("uses json as default language", () => {
    const handleChange = vi.fn();
    render(<MonacoEditor value="{}" onChange={handleChange} />);

    expect(screen.getByText("language: json")).toBeInTheDocument();
  });

  it("accepts custom language", () => {
    const handleChange = vi.fn();
    render(
      <MonacoEditor value="test" onChange={handleChange} language="typescript" />
    );

    expect(screen.getByText("language: typescript")).toBeInTheDocument();
  });
});