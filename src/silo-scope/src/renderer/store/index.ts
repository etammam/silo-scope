import { create } from "zustand";
import type { Workspace, EnvironmentProfile, GrainInterfaceDescriptor, InvocationResult, LogEntry, NugetFeed, NugetPackage, SourceOwnedCatalog } from "../../shared/types";

export type ConnectionStatus = "disconnected" | "connecting" | "connected" | "error";

interface AppState {
  workspace: Workspace | null;
  grains: GrainInterfaceDescriptor[];
  sourceCatalog: SourceOwnedCatalog;
  selectedGrain: string | null;
  selectedMethod: string | null;
  selectedFunctionId: string | null;
  invocationResult: InvocationResult | null;
  isInvoking: boolean;
  logs: LogEntry[];
  nugetFeeds: NugetFeed[];
  nugetPackages: NugetPackage[];
  isConnected: boolean;
  connectionStatus: ConnectionStatus;
  connectionStep: string;
  connectionError: string | null;
  fontFamily: string;
  fontSize: number;
  environments: EnvironmentProfile[];
  activeEnvironment: string | null;
  environmentErrors: string[];
  storagePath: string | null;
  isStorageReady: boolean;

  setWorkspace: (workspace: Workspace | null) => void;
  setGrains: (grains: GrainInterfaceDescriptor[]) => void;
  setSourceCatalog: (sourceCatalog: SourceOwnedCatalog) => void;
  setSelectedGrain: (grain: string | null) => void;
  setSelectedMethod: (method: string | null) => void;
  setSelectedFunction: (functionId: string | null) => void;
  setInvocationResult: (result: InvocationResult | null) => void;
  setIsInvoking: (isInvoking: boolean) => void;
  addLog: (entry: LogEntry) => void;
  hydrateLogs: (entries: LogEntry[]) => void;
  clearLogs: () => void;
  setNugetFeeds: (feeds: NugetFeed[]) => void;
  setNugetPackages: (packages: NugetPackage[]) => void;
  setIsConnected: (connected: boolean) => void;
  setConnectionStatus: (
    status: ConnectionStatus,
    step?: string,
    error?: string | null,
  ) => void;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setEnvironments: (environments: EnvironmentProfile[]) => void;
  setActiveEnvironment: (activeEnvironment: string | null) => void;
  setEnvironmentErrors: (environmentErrors: string[]) => void;
  setStoragePath: (storagePath: string | null) => void;
  setStorageReady: (isStorageReady: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  workspace: null,
  grains: [],
  sourceCatalog: { sources: [] },
  selectedGrain: null,
  selectedMethod: null,
  selectedFunctionId: null,
  invocationResult: null,
  isInvoking: false,
  logs: [],
  nugetFeeds: [],
  nugetPackages: [],
  isConnected: false,
  connectionStatus: "disconnected" as ConnectionStatus,
  connectionStep: "",
  connectionError: null,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 13,
  environments: [],
  activeEnvironment: null,
  environmentErrors: [],
  storagePath: null,
  isStorageReady: false,

  setWorkspace: (workspace) => set({ workspace, selectedFunctionId: null, selectedGrain: null, selectedMethod: null, environmentErrors: [] }),
  setGrains: (grains) => set({ grains }),
  setSourceCatalog: (sourceCatalog) => set({ sourceCatalog }),
  setSelectedGrain: (selectedGrain) => set({ selectedGrain, selectedMethod: null, selectedFunctionId: null }),
  setSelectedMethod: (selectedMethod) => set({ selectedMethod, selectedFunctionId: null }),
  setSelectedFunction: (selectedFunctionId) => set({ selectedFunctionId }),
  setInvocationResult: (invocationResult) => set({ invocationResult }),
  setIsInvoking: (isInvoking) => set({ isInvoking }),
  addLog: (entry) => set((state) => ({ logs: [...state.logs, entry].slice(-50_000) })),
  hydrateLogs: (entries) => set((state) => {
    const incoming = new Set(state.logs.map(logIdentity));
    return {
      logs: [...entries.filter((entry) => !incoming.has(logIdentity(entry))), ...state.logs].slice(-50_000),
    };
  }),
  clearLogs: () => set({ logs: [] }),
  setNugetFeeds: (nugetFeeds) => set({ nugetFeeds }),
  setNugetPackages: (nugetPackages) => set({ nugetPackages }),
  setIsConnected: (isConnected) => set({ isConnected }),
  setConnectionStatus: (connectionStatus, connectionStep = "", connectionError = null) =>
    set({ connectionStatus, connectionStep, connectionError }),
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setFontSize: (fontSize) => set({ fontSize }),
  setEnvironments: (environments) => set({ environments }),
  setActiveEnvironment: (activeEnvironment) => set({ activeEnvironment }),
  setEnvironmentErrors: (environmentErrors) => set({ environmentErrors }),
  setStoragePath: (storagePath) => set({ storagePath }),
  setStorageReady: (isStorageReady) => set({ isStorageReady }),
}));

function logIdentity(entry: LogEntry): string {
  return `${entry.timestamp}\u0000${entry.level}\u0000${entry.category ?? ""}\u0000${entry.message}\u0000${entry.exception ?? ""}`;
}
