/**
 * IPC handlers for environment profile management.
 *
 * Handles listing and saving environment variable profiles associated with
 * a workspace. Each workspace gets its own `environments.json` file.
 *
 * @module main/environments
 */

import { ipcMain } from "electron";
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

/**
 * Registers all environment-related IPC handlers on the main process.
 *
 * @param storagePathGetter - Function that returns the current storage path.
 */
export function registerEnvironmentsIpc(
  storagePathGetter: () => string | null,
): void {
  getStoragePath = storagePathGetter;

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
    (
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
        return true;
      } catch (error) {
        console.error("[environments:save]", error);
        throw error;
      }
    },
  );
}
