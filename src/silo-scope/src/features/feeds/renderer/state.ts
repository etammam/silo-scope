/**
 * Zustand slice for NuGet feed state.
 *
 * Manages the list of configured NuGet feeds and cached package search
 * results.
 *
 * @module features/feeds/state
 */

import type { StateCreator } from "zustand";
import type { NugetFeed } from "../schema";

export interface FeedsSlice {
  nugetFeeds: NugetFeed[];

  setNugetFeeds: (feeds: NugetFeed[]) => void;
}

/**
 * Creates the feeds zustand slice.
 *
 * @param set - The zustand `set` function.
 * @returns The feeds slice state and actions.
 */
export const createFeedsSlice: StateCreator<FeedsSlice> = (set) => ({
  nugetFeeds: [],

  setNugetFeeds: (nugetFeeds) => set({ nugetFeeds }),
});
