import type { RPCSchema } from "electrobun/bun";
import type {
  Workspace,
  GrainInterfaceDescriptor,
  InvocationResult,
  LogEntry,
  SourceOwnedCatalog,
} from "./types";

export type FileMenuAction = "newWorkspace" | "openWorkspace" | "saveWorkspace";

export type SiloScopeRPC = {
  bun: RPCSchema<{
    requests: {
      getGrains: { params: { workspaceId: string }; response: { grains: GrainInterfaceDescriptor[]; sourceCatalog?: SourceOwnedCatalog } };
      getSourceCatalog: { params: { workspaceId: string }; response: { sourceCatalog: SourceOwnedCatalog } };
      invokeGrain: {
        params: {
          grainType: string;
          method: string;
          grainKey: string;
          payload: string;
          sourceId?: string;
          functionId?: string;
        };
        response: InvocationResult;
      };
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
      fileMenuAction: { action: FileMenuAction };
    };
  }>;
};
