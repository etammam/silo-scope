/**
 * Settings and auto-update schemas.
 *
 * @module features/settings/schema
 */

import { z } from "zod";

export const storageConfigSchema = z.object({
  storagePath: z.string().nullable(),
});
export type StorageConfig = z.infer<typeof storageConfigSchema>;

export const applicationUpdateStatusTypeSchema = z.enum([
  "idle", "checking", "check-complete", "no-update", "update-available",
  "download-starting", "downloading", "checking-local-tar", "local-tar-found",
  "local-tar-missing", "fetching-patch", "patch-found", "patch-not-found",
  "downloading-patch", "applying-patch", "patch-applied", "patch-failed",
  "extracting-version", "patch-chain-complete", "downloading-full-bundle",
  "download-progress", "decompressing", "download-complete", "applying",
  "extracting", "replacing-app", "launching-new-version", "complete", "error",
]);
export type ApplicationUpdateStatusType = z.infer<
  typeof applicationUpdateStatusTypeSchema
>;

export const applicationUpdateLocalInfoSchema = z.object({
  version: z.string().min(1),
  hash: z.string(),
  baseUrl: z.string().url(),
  channel: z.string().min(1),
  name: z.string().min(1),
  identifier: z.string().min(1),
});
export type ApplicationUpdateLocalInfo = z.infer<
  typeof applicationUpdateLocalInfoSchema
>;

export const applicationUpdateInfoSchema = z.object({
  version: z.string().min(1),
  hash: z.string(),
  updateAvailable: z.boolean(),
  updateReady: z.boolean(),
  error: z.string(),
});
export type ApplicationUpdateInfo = z.infer<
  typeof applicationUpdateInfoSchema
>;

export const applicationUpdateStatusEntrySchema = z.object({
  status: applicationUpdateStatusTypeSchema,
  message: z.string(),
  timestamp: z.number().positive(),
  progress: z.number().min(0).max(100).optional(),
  version: z.string().optional(),
  localInfo: applicationUpdateLocalInfoSchema.optional(),
});
export type ApplicationUpdateStatusEntry = z.infer<
  typeof applicationUpdateStatusEntrySchema
>;

export const applicationUpdateStateSchema = z.object({
  localInfo: applicationUpdateLocalInfoSchema,
  updateInfo: applicationUpdateInfoSchema.nullable(),
  statusHistory: z.array(applicationUpdateStatusEntrySchema),
});
export type ApplicationUpdateState = z.infer<
  typeof applicationUpdateStateSchema
>;
