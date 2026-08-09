/**
 * NuGet feed schemas.
 *
 * @module features/feeds/schema
 */

import { z } from "zod";


export const nugetFeedSchema = z.object({
  name: z.string().min(1, "Feed name is required"),
  url: z.string().url({ message: "Feed URL must be a valid URL" }),
  hasCredentials: z.boolean(),
  isDefault: z.boolean(),
});
export type NugetFeed = z.infer<typeof nugetFeedSchema>;

export const createNugetFeedRequestSchema = z.object({
  name: z.string().min(1, "Feed name is required"),
  url: z.string().url({ message: "Feed URL must be a valid URL" }),
  username: z.string().optional(),
  password: z.string().optional(),
  isPasswordClearText: z.boolean().optional(),
});
export type CreateNugetFeedRequest = z.infer<
  typeof createNugetFeedRequestSchema
>;

export const nugetPackageSchema = z.object({
  packageId: z.string(),
  version: z.string(),
  description: z.string().nullable().optional(),
  authors: z.string().nullable().optional(),
  downloadCount: z.number().nullable().optional(),
});
export type NugetPackage = z.infer<typeof nugetPackageSchema>;

export const persistedFeedSchema = z.object({
  name: z.string().min(1, "Feed name is required"),
  url: z.string().url({ message: "Feed URL must be a valid URL" }),
  username: z.string().optional(),
  password: z.string().optional(),
  hasCredentials: z.boolean(),
  isDefault: z.boolean(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
});
export type PersistedFeed = z.infer<typeof persistedFeedSchema>;

export const persistedFeedArraySchema = z.array(persistedFeedSchema);
