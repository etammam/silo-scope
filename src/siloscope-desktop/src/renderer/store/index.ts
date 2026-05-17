import { create } from "zustand";
import type { Workspace, GrainInterfaceDescriptor, InvocationResult, LogEntry } from "../types";

interface AppState {
  workspace: Workspace | null;
  grains: GrainInterfaceDescriptor[];
  selectedGrain: string | null;
  selectedMethod: string | null;
  invocationResult: InvocationResult | null;
  logs: LogEntry[];
  isConnected: boolean;

  setWorkspace: (workspace: Workspace | null) => void;
  setGrains: (grains: GrainInterfaceDescriptor[]) => void;
  setSelectedGrain: (grain: string | null) => void;
  setSelectedMethod: (method: string | null) => void;
  setInvocationResult: (result: InvocationResult | null) => void;
  addLog: (entry: LogEntry) => void;
  clearLogs: () => void;
  setIsConnected: (connected: boolean) => void;
}

export const useAppStore = create<AppState>((set) => ({
  workspace: null,
  grains: [],
  selectedGrain: null,
  selectedMethod: null,
  invocationResult: null,
  logs: [],
  isConnected: false,

  setWorkspace: (workspace) => set({ workspace }),
  setGrains: (grains) => set({ grains }),
  setSelectedGrain: (selectedGrain) => set({ selectedGrain, selectedMethod: null }),
  setSelectedMethod: (selectedMethod) => set({ selectedMethod }),
  setInvocationResult: (invocationResult) => set({ invocationResult }),
  addLog: (entry) => set((state) => ({ logs: [...state.logs, entry] })),
  clearLogs: () => set({ logs: [] }),
  setIsConnected: (isConnected) => set({ isConnected }),
}));