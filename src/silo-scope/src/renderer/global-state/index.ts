/**
 * Composed zustand store for the SiloScope renderer.
 *
 * Imports feature-specific slices from their respective feature folders
 * and composes them into a single `useAppStore` hook. Each slice manages
 * its own state and actions; cross-slice access goes through
 * `useAppStore.getState()` at runtime.
 *
 * @module renderer/global-state
 */

import { create } from "zustand";
import {
  createWorkspaceSlice,
  type WorkspaceSlice,
} from "../../features/workspaces/renderer/state";
import {
  createInvocationSlice,
  type InvocationSlice,
} from "../../features/grain-invocation/renderer/state";
import {
  createFeedsSlice,
  type FeedsSlice,
} from "../../features/feeds/renderer/state";
import {
  createEnvironmentSlice,
  type EnvironmentSlice,
} from "../../features/environments/renderer/state";
import {
  createSettingsSlice,
  type SettingsSlice,
} from "../../features/settings/renderer/state";

export type AppState = WorkspaceSlice &
  InvocationSlice &
  FeedsSlice &
  EnvironmentSlice &
  SettingsSlice;

/**
 * The single application store, composed from feature slices.
 *
 * @example
 * ```ts
 * const workspace = useAppStore((state) => state.workspace);
 * const setWorkspace = useAppStore((state) => state.setWorkspace);
 * ```
 */
export const useAppStore = create<AppState>()((...arguments_) => ({
  ...createWorkspaceSlice(...arguments_),
  ...createInvocationSlice(...arguments_),
  ...createFeedsSlice(...arguments_),
  ...createEnvironmentSlice(...arguments_),
  ...createSettingsSlice(...arguments_),
}));
