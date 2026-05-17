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
    vi.restoreAllMocks();
  });

  it("sends header-delimited requests and resolves matching responses", async () => {
    const fake = createFakeProcess();
    const spawn = vi.fn(() => fake.process);
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

    const requestText = decoder.decode(fake.writes[0]);
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
    fake.writeStdoutFrame(responseBody);

    await expect(responsePromise).resolves.toEqual({
      IsSuccess: true,
      Value: { Id: "workspace-1" },
    });

    await client.dispose();
  });

  it("rejects pending requests when an invalid response is received", async () => {
    const fake = createFakeProcess();
    vi.stubGlobal("Bun", { spawn: vi.fn(() => fake.process) });

    const client = new SidecarJsonRpcClient({
      corePath: "/tmp/Siloscope.Core",
      requestTimeoutMs: 1_000,
      maxRestartAttempts: 0,
    });

    const responsePromise = client.request("LoadWorkspaceAsync");
    fake.writeStdoutFrame("{not valid json");

    await expect(responsePromise).rejects.toThrow();
    await client.dispose();
  });

  it("processes sidecar stderr logs", async () => {
    const fake = createFakeProcess();
    const infoSpy = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.stubGlobal("Bun", { spawn: vi.fn(() => fake.process) });

    const client = new SidecarJsonRpcClient({
      corePath: "/tmp/Siloscope.Core",
      requestTimeoutMs: 1_000,
      maxRestartAttempts: 0,
    });

    client.start();
    fake.stderrController.enqueue(encoder.encode("[INF] JSON-RPC server listening...\n"));

    await vi.waitFor(() => {
      expect(infoSpy).toHaveBeenCalledWith(
        "[siloscope-core] [INF] JSON-RPC server listening...",
      );
    });

    await client.dispose();
  });
});

function createFakeProcess(): {
  process: FakeProcess;
  writes: Uint8Array[];
  stderrController: ReadableStreamDefaultController<Uint8Array>;
  writeStdoutFrame: (body: string) => void;
} {
  let stdoutController: ReadableStreamDefaultController<Uint8Array>;
  let stderrController: ReadableStreamDefaultController<Uint8Array>;
  let resolveExit: (exitCode: number) => void = () => {};
  const writes: Uint8Array[] = [];

  const process: FakeProcess = {
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
        stderrController = controller;
      },
    }),
    exitCode: null,
    exited: new Promise<number>((resolve) => {
      resolveExit = resolve;
    }),
    kill: vi.fn(() => {
      process.exitCode = 0;
      stdoutController.close();
      stderrController.close();
      resolveExit(0);
    }),
  };

  return {
    process,
    writes,
    stderrController: stderrController!,
    writeStdoutFrame: (body: string) => {
      stdoutController.enqueue(
        encoder.encode(`Content-Length: ${encoder.encode(body).byteLength}\r\n\r\n${body}`),
      );
    },
  };
}
