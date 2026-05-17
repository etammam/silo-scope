import type { RPCSchema } from "electrobun/bun";
import type { Workspace, GrainInterfaceDescriptor, InvocationResult, LogEntry } from "./types";

export type SiloScopeRPC = {
  bun: RPCSchema<{
    requests: {
      getGrains: { params: { workspaceId: string }; response: { grains: GrainInterfaceDescriptor[] } };
      invokeGrain: { params: { grainType: string; method: string; grainKey: string; payload: string }; response: InvocationResult };
      getWorkspaces: { params: void; response: { workspaces: Workspace[] } };
    };
    messages: {
      connectionChanged: { isConnected: boolean };
      logEntry: { entry: LogEntry };
    };
  }>;
  webview: RPCSchema<{
    requests: {
      setWorkspace: { params: { workspace: Workspace | null }; response: boolean };
    };
    messages: {
      requestGrains: { workspaceId: string };
    };
  }>;
};