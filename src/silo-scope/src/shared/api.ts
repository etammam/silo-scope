import type {
  CreateNugetFeedRequest,
  EnvironmentProfile,
  GrainInterfaceDescriptor,
  InvocationResult,
  NugetFeed,
  NugetPackage,
  SourceOwnedCatalog,
  Workspace,
} from "./types";

export interface EnvironmentConfig {
  profiles: EnvironmentProfile[];
  activeEnvironment: string | null;
}

export interface RendererApi {
  isDesktop: boolean;
  platform: NodeJS.Platform;
  versions: {
    electron: string;
    chrome: string;
  };
  window: {
    minimize: () => Promise<void>;
    maximize: () => Promise<void>;
    close: () => Promise<void>;
    isMaximized: () => Promise<boolean>;
    onStateChange: (
      callback: (state: { isMaximized: boolean }) => void,
    ) => () => void;
  };
  storage: {
    getPath: () => Promise<string | null>;
    selectFolder: () => Promise<string | null>;
    verify: (path: string) => Promise<boolean>;
  };
  feeds: {
    list: () => Promise<NugetFeed[]>;
    create: (request: CreateNugetFeedRequest) => Promise<NugetFeed>;
    update: (
      name: string,
      request: CreateNugetFeedRequest,
    ) => Promise<NugetFeed>;
    test: (request: CreateNugetFeedRequest) => Promise<boolean>;
    search: (
      query: string,
      feedName?: string,
      take?: number,
    ) => Promise<NugetPackage[]>;
    getVersions: (packageId: string, feedName?: string) => Promise<string[]>;
  };
  environments: {
    list: (workspaceId: string) => Promise<EnvironmentConfig>;
    save: (
      workspaceId: string,
      config: EnvironmentConfig,
    ) => Promise<boolean>;
  };
  updates: {
    check: () => Promise<void>;
    download: () => Promise<void>;
    apply: () => Promise<void>;
    onStatus: (
      callback: (entry: {
        status: string;
        message: string;
        timestamp: number;
        progress?: number;
      }) => void,
    ) => () => void;
  };
  sidecar: {
    status: () => Promise<{ running: boolean }>;
    restart: () => Promise<{ running: boolean }>;
  };
  onSidecarLog: (
    callback: (entry: {
      timestamp: string;
      level: string;
      category?: string;
      message: string;
    }) => void,
  ) => () => void;
  clusters: {
    list: () => Promise<Workspace[]>;
    save: (cluster: Workspace) => Promise<Workspace>;
    remove: (id: string) => Promise<{ success: boolean }>;
    pickSourceFile: () => Promise<string | null>;
    connect: (cluster: Workspace) => Promise<{ message: string }>;
    disconnect: () => Promise<{ success: boolean }>;
    setActive: (cluster: Workspace) => Promise<{ workspace: Workspace }>;
    discoverGrains: (workspaceId: string) => Promise<{
      grains: GrainInterfaceDescriptor[];
      sourceCatalog: SourceOwnedCatalog;
    }>;
    getGrains: () => Promise<{
      grains: GrainInterfaceDescriptor[];
      sourceCatalog: SourceOwnedCatalog;
    }>;
    getSourceCatalog: () => Promise<{
      sourceCatalog: SourceOwnedCatalog;
    }>;
    invokeGrain: (params: {
      grainType: string;
      method: string;
      grainKey: string;
      payload: string;
      sourceId?: string;
      functionId?: string;
    }) => Promise<InvocationResult>;
    requests: {
      list: (clusterId: string) => Promise<
        Array<{
          tabId: string;
          grainId: string;
          payload: string;
          targetGrainClass: string;
          targetMethod: string;
        }>
      >;
      save: (
        clusterId: string,
        requests: Record<string, unknown>[],
      ) => Promise<{ success: boolean }>;
    };
  };
}
