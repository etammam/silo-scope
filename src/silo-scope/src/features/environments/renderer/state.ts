/**
 * Zustand slice for environment profile state.
 *
 * Manages environment variable profiles and the currently active profile
 * for token substitution in grain invocation payloads.
 *
 * @module features/environments/state
 */

import type { StateCreator } from "zustand";
import type { EnvironmentProfile } from "../schema";

export interface EnvironmentSlice {
  environments: EnvironmentProfile[];
  activeEnvironment: string | null;

  setEnvironments: (environments: EnvironmentProfile[]) => void;
  setActiveEnvironment: (activeEnvironment: string | null) => void;
}

/**
 * Creates the environment zustand slice.
 *
 * @param set - The zustand `set` function.
 * @returns The environment slice state and actions.
 */
export const createEnvironmentSlice: StateCreator<EnvironmentSlice> = (
  set,
) => ({
  environments: [],
  activeEnvironment: null,

  setEnvironments: (environments) => set({ environments }),
  setActiveEnvironment: (activeEnvironment) => set({ activeEnvironment }),
});
