/**
 * Environment profile schemas.
 *
 * @module features/environments/schema
 */

import { z } from "zod";

export const environmentProfileSchema = z.object({
  name: z.string().min(1, "Profile name is required"),
  variables: z.record(z.string(), z.string()),
});
export type EnvironmentProfile = z.infer<typeof environmentProfileSchema>;

export const environmentConfigSchema = z.object({
  profiles: z.array(environmentProfileSchema),
  activeEnvironment: z.string().nullable(),
});
export type EnvironmentConfig = z.infer<typeof environmentConfigSchema>;
