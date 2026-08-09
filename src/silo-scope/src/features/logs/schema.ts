/**
 * Log entry schemas — no single feature owner.
 *
 * @module features/logs/schema
 */

import { z } from "zod";

export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const logEntrySchema = z.object({
  timestamp: z.string().min(1, "Log timestamp is required"),
  level: logLevelSchema,
  category: z.string().optional(),
  message: z.string().min(1, "Log message is required"),
  exception: z.string().nullable().optional(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;
