/**
 * IPC handlers for environment profile management.
 *
 * Handles listing and saving environment variable profiles associated with
 * a workspace. Each workspace gets its own `environments.json` file, and
 * changes are synced to the .NET sidecar for token substitution during
 * grain invocation.
 *
 * @module main/environments
 */

import { ipcMain } from "electron";
import type { ISidecarAdapter } from "../../main/sidecar/adapter";
import { IPC_CHANNELS } from "../../shared/events";
import {
  readEnvironments,
  writeEnvironments,
} from "../environments/persistence";

/**
 * Returns the storage path from the module-level state, throwing if not
 * yet configured.
 *
 * @returns The user-selected storage directory path.
 * @throws {Error} When the storage folder has not been configured.
 */
function requireStoragePath(): string {
  const storagePath = getStoragePath();
  if (!storagePath) {
    throw new Error("Storage folder not configured.");
  }
  return storagePath;
}

/**
 * Module-level reference to the storage path getter, set by the main
 * entry point during registration.
 */
let getStoragePath: () => string | null = () => null;

/** Module-level reference to the sidecar adapter for environment sync. */
let sidecarAdapter: ISidecarAdapter | null = null;

/**
 * Registers all environment-related IPC handlers on the main process.
 *
 * @param storagePathGetter - Function that returns the current storage path.
 * @param adapter - The sidecar adapter for syncing environments to the C# process.
 */
export function registerEnvironmentsIpc(
  storagePathGetter: () => string | null,
  adapter?: ISidecarAdapter,
): void {
  getStoragePath = storagePathGetter;
  sidecarAdapter = adapter ?? null;

  ipcMain.handle(
    IPC_CHANNELS.environmentsList,
    (_event, workspaceId: string) => {
      try {
        const storagePath = requireStoragePath();
        return readEnvironments(storagePath, workspaceId);
      } catch (error) {
        console.error("[environments:list]", error);
        return { profiles: [], activeEnvironment: null };
      }
    },
  );

  ipcMain.handle(
    IPC_CHANNELS.environmentsSave,
    async (
      _event,
      parameters: {
        workspaceId: string;
        config: { profiles: unknown[]; activeEnvironment: string | null };
      },
    ) => {
      try {
        const storagePath = requireStoragePath();
        const config = {
          profiles: parameters.config.profiles as Array<{
            name: string;
            variables: Record<string, string>;
          }>,
          activeEnvironment: parameters.config.activeEnvironment,
        };
        writeEnvironments(storagePath, parameters.workspaceId, config);

        // Sync to the sidecar so token substitution works during grain invocation.
        if (sidecarAdapter) {
          await sidecarAdapter.saveEnvironments(config);
        }

        return true;
      } catch (error) {
        console.error("[environments:save]", error);
        throw error;
      }
    },
  );
}
