import type { RPCSchema } from "electrobun/bun";
import type {
  Workspace,
  GrainInterfaceDescriptor,
  InvocationResult,
  LogEntry,
  CreateNugetFeedRequest,
  NugetFeed,
  NugetPackage,
  SavedRequestContext,
  SourceOwnedCatalog,
  UnsavedRequestContextSummary,
} from "./types";

export type ApplicationMenuAction =
  | "newWorkspace"
  | "openWorkspace"
  | "saveWorkspace"
  | "quitApplication"
  | "toggleActivityBar"
  | "toggleNavigationSidebar"
  | "toggleTelemetryPane";

export type SiloScopeRPC = {
  bun: RPCSchema<{
    requests: {
      loadWorkspace: { params: { path?: string } | void; response: { workspace: Workspace } };
      setActiveWorkspace: { params: { workspace: Workspace }; response: { workspace: Workspace } };
      saveWorkspace: { params: { workspace: Workspace; path?: string }; response: { success: boolean } };
      connectCluster: { params: { workspace: Workspace }; response: { message: string } };
      disconnectCluster: { params: void; response: { success: boolean } };
      discoverGrains: { params: { workspaceId: string }; response: { grains: GrainInterfaceDescriptor[]; sourceCatalog?: SourceOwnedCatalog } };
      getGrains: { params: { workspaceId: string }; response: { grains: GrainInterfaceDescriptor[]; sourceCatalog?: SourceOwnedCatalog } };
      getSourceCatalog: { params: { workspaceId: string }; response: { sourceCatalog: SourceOwnedCatalog } };
      listNugetFeeds: { params: void; response: { feeds: NugetFeed[] } };
      createNugetFeed: { params: CreateNugetFeedRequest; response: { feed: NugetFeed } };
      testNugetFeed: { params: CreateNugetFeedRequest; response: { success: boolean } };
      updateNugetFeed: { params: { name: string; feed: CreateNugetFeedRequest }; response: { feed: NugetFeed } };
      searchNugetPackages: {
        params: { query: string; sourceUrl?: string; feedName?: string; take?: number };
        response: { packages: NugetPackage[] };
      };
      getNugetPackageVersions: {
        params: { packageId: string; sourceUrl?: string; feedName?: string };
        response: { versions: string[] };
      };
      addNugetPackageSource: {
        params: { packageId: string; version: string; gateway?: string; sourceUrl?: string; feedName?: string };
        response: { workspace: Workspace };
      };
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
      minimizeWindow: { params: void; response: { success: boolean } };
      maximizeWindow: { params: void; response: { success: boolean; isMaximized: boolean } };
      closeWindow: { params: void; response: { success: boolean } };
    };
    messages: {
      connectionChanged: { isConnected: boolean };
      logEntry: { entry: LogEntry };
      openFileDialog: {
        allowedFileTypes?: string;
        canChooseFiles?: boolean;
        canChooseDirectories?: boolean;
        allowsMultipleSelection?: boolean;
      };
      updateUnsavedRequestContexts: {
        requests: UnsavedRequestContextSummary[];
        contexts: SavedRequestContext[];
      };
    };
  }>;
  webview: RPCSchema<{
    requests: {
      setWorkspace: { params: { workspace: Workspace | null }; response: boolean };
      getUnsavedRequestContexts: {
        params: void;
        response: { requests: UnsavedRequestContextSummary[] };
      };
      saveUnsavedRequestContexts: {
        params: void;
        response: { success: boolean };
      };
    };
    messages: {
      requestGrains: { workspaceId: string };
      applicationMenuAction: { action: ApplicationMenuAction };
      logEntry: { entry: LogEntry };
      filePicked: { paths: string[] };
    };
  }>;
};
