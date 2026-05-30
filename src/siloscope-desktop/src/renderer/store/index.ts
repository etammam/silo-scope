import { create } from "zustand";
import type { Workspace, EnvironmentProfile, GrainInterfaceDescriptor, InvocationResult, LogEntry, NugetFeed, NugetPackage, SourceOwnedCatalog } from "../../shared/types";

interface AppState {
  workspace: Workspace | null;
  grains: GrainInterfaceDescriptor[];
  sourceCatalog: SourceOwnedCatalog;
  selectedGrain: string | null;
  selectedMethod: string | null;
  selectedFunctionId: string | null;
  invocationResult: InvocationResult | null;
  logs: LogEntry[];
  nugetFeeds: NugetFeed[];
  nugetPackages: NugetPackage[];
  isConnected: boolean;
  fontFamily: string;
  fontSize: number;
  environments: EnvironmentProfile[];
  activeEnvironment: string | null;
  environmentErrors: string[];

  setWorkspace: (workspace: Workspace | null) => void;
  setGrains: (grains: GrainInterfaceDescriptor[]) => void;
  setSourceCatalog: (sourceCatalog: SourceOwnedCatalog) => void;
  setSelectedGrain: (grain: string | null) => void;
  setSelectedMethod: (method: string | null) => void;
  setSelectedFunction: (functionId: string | null) => void;
  setInvocationResult: (result: InvocationResult | null) => void;
  addLog: (entry: LogEntry) => void;
  hydrateLogs: (entries: LogEntry[]) => void;
  clearLogs: () => void;
  setNugetFeeds: (feeds: NugetFeed[]) => void;
  setNugetPackages: (packages: NugetPackage[]) => void;
  setIsConnected: (connected: boolean) => void;
  setFontFamily: (fontFamily: string) => void;
  setFontSize: (fontSize: number) => void;
  setEnvironments: (environments: EnvironmentProfile[]) => void;
  setActiveEnvironment: (activeEnvironment: string | null) => void;
  setEnvironmentErrors: (environmentErrors: string[]) => void;
}

export const useAppStore = create<AppState>((set) => ({
  workspace: null,
  grains: [],
  sourceCatalog: { sources: [] },
  selectedGrain: null,
  selectedMethod: null,
  selectedFunctionId: null,
  invocationResult: null,
  logs: [],
  nugetFeeds: [],
  nugetPackages: [],
  isConnected: false,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: 13,
  environments: [],
  activeEnvironment: null,
  environmentErrors: [],

  setWorkspace: (workspace) => set({ workspace, selectedFunctionId: null, selectedGrain: null, selectedMethod: null, environmentErrors: [] }),
  setGrains: (grains) => set({ grains }),
  setSourceCatalog: (sourceCatalog) => set({ sourceCatalog }),
  setSelectedGrain: (selectedGrain) => set({ selectedGrain, selectedMethod: null, selectedFunctionId: null }),
  setSelectedMethod: (selectedMethod) => set({ selectedMethod, selectedFunctionId: null }),
  setSelectedFunction: (selectedFunctionId) => set({ selectedFunctionId }),
  setInvocationResult: (invocationResult) => set({ invocationResult }),
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
  setFontFamily: (fontFamily) => set({ fontFamily }),
  setFontSize: (fontSize) => set({ fontSize }),
  setEnvironments: (environments) => set({ environments }),
  setActiveEnvironment: (activeEnvironment) => set({ activeEnvironment }),
  setEnvironmentErrors: (environmentErrors) => set({ environmentErrors }),
}));

function logIdentity(entry: LogEntry): string {
  return `${entry.timestamp}\u0000${entry.level}\u0000${entry.category ?? ""}\u0000${entry.message}\u0000${entry.exception ?? ""}`;
}
