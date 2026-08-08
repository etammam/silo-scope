// ponytail: UI-only mock of the SiloScope RPC surface (electrobun's `electroview.rpc`).
// Replace with real IPC handlers when wiring main process. No-op stubs: minimize/maximize/close, update flow.
import type {
  AppUpdateState,
  CreateNugetFeedRequest,
  EnvironmentConfig,
  EnvironmentProfile,
  GrainInterfaceDescriptor,
  InvocationResult,
  LogEntry,
  NugetFeed,
  NugetPackage,
  SourceOwnedCatalog,
  Workspace,
} from "../shared/types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const sourceCatalog: SourceOwnedCatalog = {
  sources: [
    {
      sourceId: "src:banking",
      sourceType: "DLL",
      reference: "sample-banking-grains.dll",
      label: "Sample Banking Grains",
      version: "1.0.0",
      gateway: null,
      feedName: null,
      enabled: true,
      discoveryStatus: "ready",
      interfaces: [
        {
          interfaceId: "iface:bank-account",
          interfaceName: "IBankAccountGrain",
          namespace: "Sample.Banking.Grains",
          methods: [
            {
              functionId: "fn:bank-account.deposit",
              sourceId: "src:banking",
              interfaceId: "iface:bank-account",
              interfaceName: "IBankAccountGrain",
              namespace: "Sample.Banking.Grains",
              methodName: "Deposit",
              signature: "Task<decimal> Deposit(decimal amount)",
              returnType: "decimal",
              keyType: "Guid",
              parameters: [{ name: "amount", typeName: "decimal" }],
            },
            {
              functionId: "fn:bank-account.withdraw",
              sourceId: "src:banking",
              interfaceId: "iface:bank-account",
              interfaceName: "IBankAccountGrain",
              namespace: "Sample.Banking.Grains",
              methodName: "Withdraw",
              signature: "Task<decimal> Withdraw(decimal amount)",
              returnType: "decimal",
              keyType: "Guid",
              parameters: [{ name: "amount", typeName: "decimal" }],
            },
            {
              functionId: "fn:bank-account.get-balance",
              sourceId: "src:banking",
              interfaceId: "iface:bank-account",
              interfaceName: "IBankAccountGrain",
              namespace: "Sample.Banking.Grains",
              methodName: "GetBalance",
              signature: "Task<decimal> GetBalance()",
              returnType: "decimal",
              keyType: "Guid",
              parameters: [],
            },
          ],
        },
        {
          interfaceId: "iface:user-profile",
          interfaceName: "IUserProfileGrain",
          namespace: "Sample.Banking.Grains",
          methods: [
            {
              functionId: "fn:user-profile.get",
              sourceId: "src:banking",
              interfaceId: "iface:user-profile",
              interfaceName: "IUserProfileGrain",
              namespace: "Sample.Banking.Grains",
              methodName: "GetProfile",
              signature: "Task<UserProfile> GetProfile()",
              returnType: "UserProfile",
              keyType: "String",
              parameters: [],
            },
            {
              functionId: "fn:user-profile.update",
              sourceId: "src:banking",
              interfaceId: "iface:user-profile",
              interfaceName: "IUserProfileGrain",
              namespace: "Sample.Banking.Grains",
              methodName: "UpdateProfile",
              signature: "Task UpdateProfile(UserProfile profile)",
              returnType: "void",
              keyType: "String",
              parameters: [{ name: "profile", typeName: "UserProfile" }],
            },
          ],
        },
        {
          interfaceId: "iface:shopping-cart",
          interfaceName: "IShoppingCartGrain",
          namespace: "Sample.Banking.Grains",
          methods: [
            {
              functionId: "fn:cart.add-item",
              sourceId: "src:banking",
              interfaceId: "iface:shopping-cart",
              interfaceName: "IShoppingCartGrain",
              namespace: "Sample.Banking.Grains",
              methodName: "AddItem",
              signature: "Task AddItem(CartItem item)",
              returnType: "void",
              keyType: "Integer",
              parameters: [{ name: "item", typeName: "CartItem" }],
            },
            {
              functionId: "fn:cart.get-items",
              sourceId: "src:banking",
              interfaceId: "iface:shopping-cart",
              interfaceName: "IShoppingCartGrain",
              namespace: "Sample.Banking.Grains",
              methodName: "GetItems",
              signature: "Task<CartItem[]> GetItems()",
              returnType: "CartItem[]",
              keyType: "Integer",
              parameters: [],
            },
          ],
        },
      ],
    },
  ],
};

const grains: GrainInterfaceDescriptor[] = sourceCatalog.sources.flatMap(
  (source) =>
    source.interfaces.map((catalogInterface) => ({
      interfaceId: catalogInterface.interfaceId,
      interfaceName: catalogInterface.interfaceName,
      methods: catalogInterface.methods.map((method) => ({
        name: method.methodName,
        parameters: method.parameters,
        signature: method.signature,
        returnType: method.returnType,
        keyType: method.keyType,
      })),
    })),
);

const workspaces: Workspace[] = [
  {
    id: "ws:banking",
    name: "Banking Sample Cluster",
    siloAddress: "127.0.0.1",
    gatewayPort: 30000,
    orleansVersion: "9.1.1",
    description: "Local dev cluster running the sample banking grains.",
    clusterId: "dev-banking",
    serviceId: "siloscope-sample",
    clusterType: "Homogenous",
    clustering: {
      provider: "Redis",
      redis: { connectionString: "localhost:6379" },
    },
    sources: [sourceCatalog.sources[0]],
    savedContexts: [
      {
        tabId: "fn:bank-account.deposit",
        isDefaultActive: true,
        targetGrainClass: "IBankAccountGrain",
        targetMethod: "Deposit",
        keyType: "Guid",
        grainId: "5f2d3a8e-2d0a-4b3c-9e1a-8f6d2c1b7a34",
        payload: '{\n  "amount": 150.75\n}',
        sourceId: "src:banking",
        functionId: "fn:bank-account.deposit",
      },
    ],
  },
  {
    id: "ws:chat",
    name: "Chat Service Cluster",
    siloAddress: "10.0.1.5",
    gatewayPort: 30001,
    orleansVersion: "9.0.2",
    description: "Heterogeneous cluster with streaming.",
    clusterType: "Heterogeneous",
    clustering: {
      provider: "AdoNet",
      adoNet: { connectionString: "Server=localhost;Database=Orleans" },
    },
    sources: [],
    savedContexts: [],
  },
];

const environments: EnvironmentProfile[] = [
  {
    name: "development environment",
    variables: { ApiUrl: "https://dev.example.com", ClusterId: "dev" },
  },
  {
    name: "staging environment",
    variables: { ApiUrl: "https://staging.example.com", ClusterId: "staging" },
  },
  {
    name: "prod environment",
    variables: { ApiUrl: "https://example.com", ClusterId: "prod" },
  },
];

const nugetFeeds: NugetFeed[] = [
  {
    name: "nuget.org",
    url: "https://api.nuget.org/v3/index.json",
    hasCredentials: false,
    isDefault: true,
  },
  {
    name: "Private Feed",
    url: "https://packages.example.com/v3/index.json",
    hasCredentials: true,
    isDefault: false,
  },
];

const nugetPackages: NugetPackage[] = [
  {
    packageId: "Microsoft.Orleans.Core",
    version: "9.1.1",
    description: "Core Orleans runtime.",
    authors: "Microsoft",
    downloadCount: 21000000,
  },
  {
    packageId: "Microsoft.Orleans.Runtime",
    version: "9.1.1",
    description: "Orleans runtime.",
    authors: "Microsoft",
    downloadCount: 19000000,
  },
  {
    packageId: "Microsoft.Orleans.Streaming",
    version: "9.1.1",
    description: "Streaming support.",
    authors: "Microsoft",
    downloadCount: 8000000,
  },
  {
    packageId: "Microsoft.Orleans.Server",
    version: "9.1.1",
    description: "Orleans silo host.",
    authors: "Microsoft",
    downloadCount: 12000000,
  },
  {
    packageId: "Sample.Banking.Grains",
    version: "1.0.0",
    description: "Sample banking grain interfaces.",
    authors: "SiloScope",
    downloadCount: 1200,
  },
];

const packageVersions: Record<string, string[]> = {
  "Microsoft.Orleans.Core": ["9.0.0", "9.0.1", "9.1.0", "9.1.1"],
  "Sample.Banking.Grains": ["0.9.0", "1.0.0"],
};

const backendLogs: LogEntry[] = [
  {
    timestamp: new Date(Date.now() - 3_600_000).toISOString(),
    level: "info",
    category: "SiloScope.Core",
    message: "SiloScope.Core v0.0.1 initializing.",
  },
  {
    timestamp: new Date(Date.now() - 3_500_000).toISOString(),
    level: "info",
    category: "SiloScope.Core",
    message: "Sidecar host started on port 5188.",
  },
  {
    timestamp: new Date(Date.now() - 600_000).toISOString(),
    level: "info",
    category: "SiloScope.Core.Clustering",
    message: "Redis clustering provider registered.",
  },
  {
    timestamp: new Date(Date.now() - 300_000).toISOString(),
    level: "warn",
    category: "SiloScope.Core",
    message: "No active workspace loaded.",
    exception: null,
  },
];

const updateState: AppUpdateState = {
  localInfo: {
    version: "0.0.1",
    hash: "dev",
    baseUrl: "https://github.com/etammam/silo-scope/releases/latest/download",
    channel: "dev",
    name: "siloscope",
    identifier: "siloscope.app",
  },
  updateInfo: null,
  statusHistory: [
    {
      status: "idle",
      message: "Updates are managed by the main process.",
      timestamp: Date.now(),
    },
  ],
};

function echoInvocation(payload: string): InvocationResult {
  const serializationMs = Math.round(1 + Math.random() * 8);
  const executionMs = Math.round(20 + Math.random() * 180);
  let result: string;
  try {
    const parsed = JSON.parse(payload);
    result = JSON.stringify(
      { requestId: crypto.randomUUID(), ok: true, echo: parsed },
      null,
      2,
    );
  } catch {
    result = JSON.stringify(
      { requestId: crypto.randomUUID(), ok: true, echo: payload },
      null,
      2,
    );
  }
  return {
    isSuccess: true,
    result,
    timing: {
      serializationMs,
      executionMs,
      totalMs: serializationMs + executionMs,
    },
  };
}

// ponytail: in-memory persistence only; replaced by real storage when IPC lands.
let persistedWorkspace = workspaces[0];
let persistedFeeds = [...nugetFeeds];
let persistedEnvironments: EnvironmentConfig = {
  profiles: environments,
  activeEnvironment: "dev",
};

export const rpc = {
  request: {
    loadWorkspace: async (params?: {
      path?: string;
    }): Promise<{ workspace: Workspace }> => ({
      workspace: persistedWorkspace,
    }),
    setActiveWorkspace: async (params: {
      workspace: Workspace;
    }): Promise<{ workspace: Workspace }> => ({
      workspace: params.workspace,
    }),
    saveWorkspace: async (params: {
      workspace: Workspace;
      path?: string;
    }): Promise<{ success: boolean }> => {
      persistedWorkspace = params.workspace;
      return { success: true };
    },
    getEnvironments: async (params: {
      workspaceId: string;
    }): Promise<EnvironmentConfig> => {
      if (typeof window !== "undefined" && window.api?.environments) {
        return window.api.environments.list(params.workspaceId);
      }
      return persistedEnvironments;
    },
    saveEnvironments: async (params: {
      workspaceId: string;
      config: EnvironmentConfig;
    }): Promise<{ success: boolean }> => {
      if (typeof window !== "undefined" && window.api?.environments) {
        await window.api.environments.save(params.workspaceId, params.config);
        return { success: true };
      }
      persistedEnvironments = params.config;
      return { success: true };
    },
    connectCluster: async (params: {
      workspace: Workspace;
    }): Promise<{ message: string }> => {
      await delay(500);
      return { message: "Connected to cluster via gateway localhost:30000." };
    },
    disconnectCluster: async (): Promise<{ success: boolean }> => {
      await delay(150);
      return { success: true };
    },
    discoverGrains: async (params: {
      workspaceId: string;
    }): Promise<{
      grains: GrainInterfaceDescriptor[];
      sourceCatalog: SourceOwnedCatalog;
    }> => {
      await delay(600);
      return { grains, sourceCatalog };
    },
    getGrains: async (): Promise<{
      grains: GrainInterfaceDescriptor[];
      sourceCatalog: SourceOwnedCatalog;
    }> => ({
      grains,
      sourceCatalog,
    }),
    getSourceCatalog: async (): Promise<{
      sourceCatalog: SourceOwnedCatalog;
    }> => ({ sourceCatalog }),
    listNugetFeeds: async (): Promise<{ feeds: NugetFeed[] }> => ({
      feeds: persistedFeeds,
    }),
    createNugetFeed: async (
      params: CreateNugetFeedRequest,
    ): Promise<{ feed: NugetFeed }> => {
      const feed: NugetFeed = {
        name: params.name,
        url: params.url,
        hasCredentials: Boolean(params.username || params.password),
        isDefault: false,
      };
      persistedFeeds = [
        ...persistedFeeds.filter((candidate) => candidate.name !== feed.name),
        feed,
      ];
      return { feed };
    },
    testNugetFeed: async (
      params: CreateNugetFeedRequest,
    ): Promise<{ success: boolean }> => {
      await delay(400);
      return { success: true };
    },
    updateNugetFeed: async (params: {
      name: string;
      feed: CreateNugetFeedRequest;
    }): Promise<{ feed: NugetFeed }> => {
      const feed: NugetFeed = {
        name: params.feed.name,
        url: params.feed.url,
        hasCredentials: Boolean(params.feed.username || params.feed.password),
        isDefault: false,
      };
      persistedFeeds = [
        ...persistedFeeds.filter((candidate) => candidate.name !== params.name),
        feed,
      ];
      return { feed };
    },
    searchNugetPackages: async (params: {
      query: string;
      sourceUrl?: string;
      feedName?: string;
      take?: number;
    }): Promise<{ packages: NugetPackage[] }> => {
      await delay(300);
      const query = params.query.toLowerCase();
      return {
        packages: nugetPackages
          .filter((pkg) => pkg.packageId.toLowerCase().includes(query))
          .slice(0, params.take ?? 20),
      };
    },
    getNugetPackageVersions: async (params: {
      packageId: string;
      sourceUrl?: string;
      feedName?: string;
    }): Promise<{ versions: string[] }> => {
      await delay(200);
      return { versions: packageVersions[params.packageId] ?? ["1.0.0"] };
    },
    addNugetPackageSource: async (params: {
      packageId: string;
      version: string;
      gateway?: string;
      sourceUrl?: string;
      feedName?: string;
    }): Promise<{ workspace: Workspace }> => ({
      workspace: persistedWorkspace,
    }),
    invokeGrain: async (params: {
      grainType: string;
      method: string;
      grainKey: string;
      payload: string;
      sourceId?: string;
      functionId?: string;
    }): Promise<InvocationResult> => {
      await delay(300 + Math.random() * 500);
      if (params.grainKey.toLowerCase() === "fail") {
        return {
          isSuccess: false,
          error:
            "OrleansException: The grain operation failed (mock forced failure).",
          timing: { serializationMs: 2, executionMs: 12, totalMs: 14 },
        };
      }
      return echoInvocation(params.payload);
    },
    getWorkspaces: async (): Promise<{ workspaces: Workspace[] }> => ({
      workspaces,
    }),
    getBackendLogs: async (): Promise<{ entries: LogEntry[] }> => ({
      entries: backendLogs,
    }),
    openBackendLogDirectory: async (): Promise<{
      success: boolean;
      path: string;
    }> => ({
      success: true,
      path: "~/Library/Logs/SiloScope",
    }),
    getAppUpdateState: async (): Promise<AppUpdateState> => updateState,
    checkForAppUpdate: async (): Promise<AppUpdateState> => updateState,
    downloadAppUpdate: async (): Promise<AppUpdateState> => updateState,
    applyAppUpdate: async (): Promise<{ success: boolean }> => ({
      success: true,
    }),
    minimizeWindow: async (): Promise<{ success: boolean }> => ({
      success: true,
    }),
    maximizeWindow: async (): Promise<{
      success: boolean;
      isMaximized: boolean;
    }> => ({
      success: true,
      isMaximized: false,
    }),
    closeWindow: async (): Promise<{ success: boolean }> => ({ success: true }),
  },
  send: {
    openFileDialog: (options?: {
      allowedFileTypes?: string;
      canChooseFiles?: boolean;
      canChooseDirectories?: boolean;
      allowsMultipleSelection?: boolean;
    }): void => {
      window.dispatchEvent(
        new CustomEvent("filePicked", {
          detail: { paths: ["/tmp/mock-workspace.json"] },
        }),
      );
    },
    updateUnsavedRequestContexts: (params?: {
      requests: unknown[];
      contexts: unknown[];
    }): void => {
      // UI-only; no-op until close-guard IPC lands.
    },
  },
};
