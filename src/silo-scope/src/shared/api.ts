import type { CreateNugetFeedRequest, EnvironmentProfile, NugetFeed, NugetPackage } from "./types";

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
}
