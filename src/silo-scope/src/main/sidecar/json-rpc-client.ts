import { spawn, type ChildProcess } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join, normalize } from "node:path";

type JsonRpcId = number;
type JsonRpcParams = readonly unknown[] | Record<string, unknown> | undefined;

type JsonRpcRequest = {
  jsonrpc: "2.0";
  id: JsonRpcId;
  method: string;
  params?: JsonRpcParams;
};

type JsonRpcResponse = {
  jsonrpc: "2.0";
  id?: JsonRpcId;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

type JsonRpcNotification = {
  jsonrpc: "2.0";
  method: string;
  params?: unknown;
};

export type JsonRpcNotificationHandler = (notification: {
  method: string;
  params?: unknown;
}) => void;

type PendingRequest<T> = {
  resolve: (value: T) => void;
  reject: (reason: Error) => void;
  timeout: NodeJS.Timeout;
};

export type SidecarProcessOptions = {
  coreCommand?: string[];
  corePath?: string;
  cwd?: string;
  env?: Record<string, string>;
  requestTimeoutMs?: number;
  maxRestartAttempts?: number;
  restartDelayMs?: number;
};

export class JsonRpcError extends Error {
  constructor(
    message: string,
    readonly code: number,
    readonly data?: unknown,
  ) {
    super(message);
    this.name = "JsonRpcError";
  }
}

export class SidecarJsonRpcClient {
  private readonly requestTimeoutMs: number;
  private readonly maxRestartAttempts: number;
  private readonly restartDelayMs: number;
  private readonly pendingRequests = new Map<JsonRpcId, PendingRequest<unknown>>();
  private readonly notificationHandlers = new Set<JsonRpcNotificationHandler>();
  private readonly textEncoder = new TextEncoder();
  private readonly textDecoder = new TextDecoder();
  private process: ChildProcess | null = null;
  private nextId = 1;
  private restartAttempts = 0;
  private restartTimer: NodeJS.Timeout | null = null;
  private receiveBuffer: Buffer = Buffer.alloc(0);
  private isDisposed = false;

  constructor(private options: SidecarProcessOptions = {}) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 120_000;
    this.maxRestartAttempts = options.maxRestartAttempts ?? 3;
    this.restartDelayMs = options.restartDelayMs ?? 1_000;
  }

  get isRunning(): boolean {
    return this.process !== null && this.process.exitCode === null;
  }

  /** Update env vars and restart the sidecar so they take effect. */
  async updateEnv(env: Record<string, string>): Promise<void> {
    this.options.env = { ...this.options.env, ...env };
    const currentProcess = this.process;
    this.process = null;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (currentProcess && currentProcess.exitCode === null) {
      currentProcess.kill();
      // Wait for the process to fully exit before allowing restart
      await new Promise<void>((resolve) => {
        currentProcess.on("exit", () => resolve());
      });
    }
    // restart will happen on next request() or start() call
  }

  onNotification(handler: JsonRpcNotificationHandler): () => void {
    this.notificationHandlers.add(handler);
    return () => {
      this.notificationHandlers.delete(handler);
    };
  }

  start(): void {
    if (this.process && this.process.exitCode === null) {
      return;
    }

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    const sidecar = this.resolveSidecar();
    const [cmd, ...args] = sidecar.command;
    this.process = spawn(cmd, args, {
      stdio: ["pipe", "pipe", "pipe"],
      cwd: this.options.cwd ?? sidecar.cwd,
      env: {
        ...process.env,
        ...this.options.env,
      },
    });

    this.readStdout(this.process.stdout!);
    this.readStderr(this.process.stderr!);

    this.process.on("exit", (exitCode) => {
      this.rejectAllPending(
        new Error(`SiloScope Core exited with code ${exitCode}.`),
      );
      this.scheduleRestart(exitCode ?? 1);
    });

    this.process.on("error", (err) => {
      this.rejectAllPending(
        new Error(`SiloScope Core failed to start: ${err.message}`),
      );
    });
  }

  async request<T>(
    method: string,
    params?: JsonRpcParams,
  ): Promise<T> {
    if (this.isDisposed) {
      throw new Error("Cannot send JSON-RPC request after client disposal.");
    }

    this.start();

    if (!this.process || this.process.exitCode !== null) {
      throw new Error("SiloScope Core is not running.");
    }

    const id = this.nextId++;
    const request: JsonRpcRequest = {
      jsonrpc: "2.0",
      id,
      method,
      ...(params === undefined ? {} : { params }),
    };

    const body = this.textEncoder.encode(JSON.stringify(request));
    const header = this.textEncoder.encode(
      `Content-Length: ${body.byteLength}\r\n\r\n`,
    );
    const message = Buffer.concat([Buffer.from(header), Buffer.from(body)]);

    const responsePromise = new Promise<T>((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(id);
        reject(new Error(`JSON-RPC request timed out: ${method}`));
      }, this.requestTimeoutMs);

      this.pendingRequests.set(id, {
        resolve: resolve as (value: unknown) => void,
        reject,
        timeout,
      });
    });

    this.process.stdin!.write(message);

    return responsePromise;
  }

  async dispose(): Promise<void> {
    this.isDisposed = true;
    const currentProcess = this.process;
    this.process = null;

    if (this.restartTimer) {
      clearTimeout(this.restartTimer);
      this.restartTimer = null;
    }

    if (!currentProcess) {
      return;
    }

    currentProcess.stdin?.end();

    if (currentProcess.exitCode === null) {
      currentProcess.kill();
    }

    // Wait for process to exit
    await new Promise<void>((resolve) => {
      if (currentProcess.exitCode !== null) {
        resolve();
        return;
      }
      currentProcess.on("exit", () => resolve());
    });
  }

  /** Stdout stream handling and JSON-RPC message framing. */

  private readStdout(stdout: NodeJS.ReadableStream): void {
    stdout.on("data", (chunk: Buffer) => {
      this.receiveBuffer = Buffer.concat([this.receiveBuffer, chunk]);
      this.drainMessages();
    });

    stdout.on("error", (error) => {
      this.rejectAllPending(
        error instanceof Error ? error : new Error(String(error)),
      );
    });
  }

  private readStderr(stderr: NodeJS.ReadableStream): void {
    stderr.on("data", (chunk: Buffer) => {
      const message = this.textDecoder.decode(chunk).trim();
      if (message.length > 0) {
        console.info(`[siloscope-core] ${message}`);
      }
    });

    stderr.on("error", (error) => {
      console.warn("[siloscope-core] failed to read stderr", error);
    });
  }

  private drainMessages(): void {
    while (true) {
      const headerEnd = findHeaderEnd(this.receiveBuffer);
      if (headerEnd === -1) {
        return;
      }

      const headerText = this.textDecoder.decode(
        this.receiveBuffer.subarray(0, headerEnd),
      );
      const contentLength = parseContentLength(headerText);
      const bodyStart = headerEnd + 4;
      const bodyEnd = bodyStart + contentLength;

      if (this.receiveBuffer.byteLength < bodyEnd) {
        return;
      }

      const body = this.receiveBuffer.subarray(bodyStart, bodyEnd);
      this.receiveBuffer = this.receiveBuffer.subarray(bodyEnd);
      this.handleResponse(body);
    }
  }

  private handleResponse(body: Buffer): void {
    let parsed: JsonRpcResponse | JsonRpcNotification;
    try {
      parsed = JSON.parse(this.textDecoder.decode(body)) as
        | JsonRpcResponse
        | JsonRpcNotification;
    } catch {
      return;
    }

    // Notification (no id)
    if ("method" in parsed && !("id" in parsed)) {
      this.emitNotification(parsed);
      return;
    }

    if (!("id" in parsed) || typeof parsed.id !== "number") {
      return;
    }

    const response = parsed as JsonRpcResponse & { id: JsonRpcId };
    const pending = this.pendingRequests.get(response.id);
    if (!pending) {
      return;
    }

    this.pendingRequests.delete(response.id);
    clearTimeout(pending.timeout);

    if (response.error) {
      pending.reject(
        new JsonRpcError(
          response.error.message,
          response.error.code,
          response.error.data,
        ),
      );
      return;
    }

    pending.resolve(response.result);
  }

  private emitNotification(notification: JsonRpcNotification): void {
    for (const handler of this.notificationHandlers) {
      try {
        handler({
          method: notification.method,
          params: notification.params,
        });
      } catch (error) {
        console.warn(
          "[siloscope-core] notification handler failed",
          error,
        );
      }
    }
  }

  private rejectAllPending(error: Error): void {
    for (const pending of this.pendingRequests.values()) {
      clearTimeout(pending.timeout);
      pending.reject(error);
    }
    this.pendingRequests.clear();
  }

  private scheduleRestart(exitCode: number): void {
    if (this.isDisposed || exitCode === 0 || this.restartTimer) {
      return;
    }

    if (this.restartAttempts >= this.maxRestartAttempts) {
      console.error(
        `[siloscope-core] restart limit reached after ${this.maxRestartAttempts} failed attempts.`,
      );
      return;
    }

    this.restartAttempts += 1;
    console.warn(
      `[siloscope-core] exited with code ${exitCode}; restarting (${this.restartAttempts}/${this.maxRestartAttempts}).`,
    );

    this.restartTimer = setTimeout(() => {
      this.restartTimer = null;
      this.process = null;
      this.start();
    }, this.restartDelayMs);
  }

  /** Locates the SiloScope Core binary on disk. */

  private resolveSidecar(): SidecarCommand {
    if (this.options.coreCommand) {
      return {
        command: this.options.coreCommand,
        cwd: this.options.cwd ?? process.cwd(),
      };
    }

    if (this.options.corePath) {
      return {
        command: [this.options.corePath],
        cwd: this.options.cwd ?? dirname(this.options.corePath),
      };
    }

    return resolveDefaultCoreCommand();
  }
}

/**
 * Sidecar binary resolution — locates the SiloScope Core executable
 * from environment variables, packaged resources, or the repository build output.
 */

export type SidecarCommand = {
  command: string[];
  cwd: string;
};

export function resolveDefaultCoreCommand(): SidecarCommand {
  const overridePath = process.env["SILOSCOPE_CORE_PATH"];
  if (overridePath) {
    return {
      command: [overridePath],
      cwd: dirname(overridePath),
    };
  }

  const packagedCommand = resolvePackagedCoreCommand();
  if (packagedCommand) {
    return packagedCommand;
  }

  const repoRoot = findRepoRoot();
  if (!repoRoot) {
    throw new Error(
      "Could not locate Siloscope.slnx. Set SILOSCOPE_CORE_PATH to the SiloScope Core executable.",
    );
  }

  const executableName =
    process.platform === "win32" ? "Siloscope.Core.exe" : "Siloscope.Core";
  const outputDirectory = join(
    repoRoot,
    "src",
    "Siloscope.Core",
    "bin",
    "Debug",
    "net10.0",
  );
  const executablePath = join(outputDirectory, executableName);
  if (existsSync(executablePath)) {
    return {
      command: [executablePath],
      cwd: outputDirectory,
    };
  }

  const dllPath = join(outputDirectory, "Siloscope.Core.dll");
  if (existsSync(dllPath)) {
    return {
      command: ["dotnet", dllPath],
      cwd: outputDirectory,
    };
  }

  const projectPath = join(
    repoRoot,
    "src",
    "Siloscope.Core",
    "Siloscope.Core.csproj",
  );
  if (existsSync(projectPath)) {
    return {
      command: ["dotnet", "run", "--project", projectPath, "--no-launch-profile"],
      cwd: repoRoot,
    };
  }

  throw new Error(
    `Could not locate SiloScope Core project under ${repoRoot}.`,
  );
}

function resolvePackagedCoreCommand(): SidecarCommand | null {
  const executableName =
    process.platform === "win32" ? "Siloscope.Core.exe" : "Siloscope.Core";
  // In production, the core is bundled in resources/core/
  const packagedPath = join(process.resourcesPath ?? "", "core", executableName);
  if (existsSync(packagedPath)) {
    return {
      command: [packagedPath],
      cwd: dirname(packagedPath),
    };
  }
  return null;
}

function findRepoRoot(): string | null {
  const searchStarts = [
    process.cwd(),
    __dirname,
    process.env["INIT_CWD"],
  ].filter((path): path is string => Boolean(path));

  for (const searchStart of searchStarts) {
    const repoRoot = findAncestorContaining(searchStart, "Siloscope.slnx");
    if (repoRoot) {
      return repoRoot;
    }
  }

  return null;
}

function findAncestorContaining(
  startDirectory: string,
  fileName: string,
): string | null {
  let currentDirectory = normalize(startDirectory);

  while (true) {
    if (existsSync(join(currentDirectory, fileName))) {
      return currentDirectory;
    }

    const parentDirectory = dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return null;
    }

    currentDirectory = parentDirectory;
  }
}

/**
 * Low-level buffer parsing for the `Content-Length`-delimited
 * JSON-RPC 2.0 wire format used by StreamJsonRpc.
 */

function findHeaderEnd(buffer: Buffer): number {
  // Search for \r\n\r\n
  for (let index = 0; index <= buffer.byteLength - 4; index += 1) {
    if (
      buffer[index] === 13 &&
      buffer[index + 1] === 10 &&
      buffer[index + 2] === 13 &&
      buffer[index + 3] === 10
    ) {
      return index;
    }
  }
  return -1;
}

function parseContentLength(headerText: string): number {
  const contentLengthHeader = headerText
    .split("\r\n")
    .find((line) => line.toLowerCase().startsWith("content-length:"));

  if (!contentLengthHeader) {
    throw new Error("JSON-RPC response missing Content-Length header.");
  }

  const value = Number.parseInt(
    contentLengthHeader.slice("content-length:".length).trim(),
    10,
  );

  if (!Number.isFinite(value) || value < 0) {
    throw new Error(
      `Invalid JSON-RPC Content-Length header: ${contentLengthHeader}`,
    );
  }

  return value;
}
