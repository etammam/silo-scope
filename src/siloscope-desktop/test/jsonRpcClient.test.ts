import { afterEach, describe, expect, it, vi } from "vitest";
import { SidecarJsonRpcClient } from "@/main/jsonRpcClient";

type FakeProcess = {
  stdin: {
    write: ReturnType<typeof vi.fn>;
    flush: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  };
  stdout: ReadableStream<Uint8Array>;
  stderr: ReadableStream<Uint8Array>;
  exitCode: number | null;
  exited: Promise<number>;
  kill: ReturnType<typeof vi.fn>;
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();

describe("SidecarJsonRpcClient", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends header-delimited requests and resolves matching responses", async () => {
    let stdoutController: ReadableStreamDefaultController<Uint8Array>;
    let resolveExit: (exitCode: number) => void = () => {};
    const writes: Uint8Array[] = [];

    const fakeProcess: FakeProcess = {
      stdin: {
        write: vi.fn((chunk: Uint8Array) => {
          writes.push(chunk);
        }),
        flush: vi.fn(),
        end: vi.fn(),
      },
      stdout: new ReadableStream<Uint8Array>({
        start(controller) {
          stdoutController = controller;
        },
      }),
      stderr: new ReadableStream<Uint8Array>({
        start(controller) {
          controller.close();
        },
      }),
      exitCode: null,
      exited: new Promise<number>((resolve) => {
        resolveExit = resolve;
      }),
      kill: vi.fn(() => {
        fakeProcess.exitCode = 0;
        stdoutController.close();
        resolveExit(0);
      }),
    };

    const spawn = vi.fn(() => fakeProcess);
    vi.stubGlobal("Bun", { spawn });

    const client = new SidecarJsonRpcClient({
      corePath: "/tmp/Siloscope.Core",
      requestTimeoutMs: 1_000,
      maxRestartAttempts: 0,
    });

    const responsePromise = client.request("LoadWorkspaceAsync", ["/tmp/workspace.json"]);

    expect(spawn).toHaveBeenCalledWith(
      ["/tmp/Siloscope.Core"],
      expect.objectContaining({
        stdin: "pipe",
        stdout: "pipe",
        stderr: "pipe",
      }),
    );

    const requestText = decoder.decode(writes[0]);
    const [, bodyText] = requestText.split("\r\n\r\n");
    expect(requestText).toMatch(/^Content-Length: \d+\r\n\r\n/);
    expect(JSON.parse(bodyText)).toEqual({
      jsonrpc: "2.0",
      id: 1,
      method: "LoadWorkspaceAsync",
      params: ["/tmp/workspace.json"],
    });

    const responseBody = JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      result: { IsSuccess: true, Value: { Id: "workspace-1" } },
    });
    stdoutController!.enqueue(
      encoder.encode(`Content-Length: ${encoder.encode(responseBody).byteLength}\r\n\r\n${responseBody}`),
    );

    await expect(responsePromise).resolves.toEqual({
      IsSuccess: true,
      Value: { Id: "workspace-1" },
    });

    await client.dispose();
  });
});
