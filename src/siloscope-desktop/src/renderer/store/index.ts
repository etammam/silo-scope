import { create } from "zustand";
import type { Workspace, GrainInterfaceDescriptor, InvocationResult, LogEntry, SourceOwnedCatalog } from "../../shared/types";

interface AppState {
  workspace: Workspace | null;
  grains: GrainInterfaceDescriptor[];
  sourceCatalog: SourceOwnedCatalog;
  selectedGrain: string | null;
  selectedMethod: string | null;
  selectedFunctionId: string | null;
  invocationResult: InvocationResult | null;
  logs: LogEntry[];
  isConnected: boolean;

  setWorkspace: (workspace: Workspace | null) => void;
  setGrains: (grains: GrainInterfaceDescriptor[]) => void;
  setSourceCatalog: (sourceCatalog: SourceOwnedCatalog) => void;
  setSelectedGrain: (grain: string | null) => void;
  setSelectedMethod: (method: string | null) => void;
  setSelectedFunction: (functionId: string | null) => void;
  setInvocationResult: (result: InvocationResult | null) => void;
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  setIsConnected: (connected: boolean) => void;
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
  isConnected: false,

  setWorkspace: (workspace) => set({ workspace, selectedFunctionId: null, selectedGrain: null, selectedMethod: null }),
  setGrains: (grains) => set({ grains }),
  setSourceCatalog: (sourceCatalog) => set({ sourceCatalog }),
  setSelectedGrain: (selectedGrain) => set({ selectedGrain, selectedMethod: null, selectedFunctionId: null }),
  setSelectedMethod: (selectedMethod) => set({ selectedMethod, selectedFunctionId: null }),
  setSelectedFunction: (selectedFunctionId) => set({ selectedFunctionId }),
  setInvocationResult: (invocationResult) => set({ invocationResult }),
  addLog: (entry) => set((state) => ({ logs: [...state.logs, entry] })),
  clearLogs: () => set({ logs: [] }),
  setIsConnected: (isConnected) => set({ isConnected }),
}));
