/**
 * Zustand slice for grain invocation state.
 *
 * Manages grain/method selection, invocation results, and the invocation
 * loading flag used by the workbench and response pane.
 *
 * @module features/grain-invocation/state
 */

import type { StateCreator } from "zustand";
import type { InvocationResult } from "../schema";

export interface InvocationSlice {
  selectedGrain: string | null;
  selectedMethod: string | null;
  selectedFunctionId: string | null;
  invocationResult: InvocationResult | null;
  isInvoking: boolean;

  setSelectedGrain: (grain: string | null) => void;
  setSelectedMethod: (method: string | null) => void;
  setSelectedFunction: (functionId: string | null) => void;
  setInvocationResult: (result: InvocationResult | null) => void;
  setIsInvoking: (isInvoking: boolean) => void;
}

/**
 * Creates the invocation zustand slice.
 *
 * @param set - The zustand `set` function.
 * @returns The invocation slice state and actions.
 */
export const createInvocationSlice: StateCreator<InvocationSlice> = (
  set,
) => ({
  selectedGrain: null,
  selectedMethod: null,
  selectedFunctionId: null,
  invocationResult: null,
  isInvoking: false,

  setSelectedGrain: (selectedGrain) =>
    set({ selectedGrain, selectedMethod: null, selectedFunctionId: null }),
  setSelectedMethod: (selectedMethod) =>
    set({ selectedMethod, selectedFunctionId: null }),
  setSelectedFunction: (selectedFunctionId) => set({ selectedFunctionId }),
  setInvocationResult: (invocationResult) => set({ invocationResult }),
  setIsInvoking: (isInvoking) => set({ isInvoking }),
});
