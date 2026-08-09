/**
 * Grain invocation and catalog schemas.
 *
 * @module features/grain-invocation/schema
 */

import { z } from "zod";
import {
  grainKeyTypeSchema,
  parameterInfoSchema,
  grainInterfaceDescriptorSchema,
  workspaceSourceSchema,
} from "../workspaces/schema";

export const invocationTimingSchema = z.object({
  serializationMs: z.number().min(0),
  executionMs: z.number().min(0),
  totalMs: z.number().min(0),
});
export type InvocationTiming = z.infer<typeof invocationTimingSchema>;

export const invocationResultSchema = z.object({
  isSuccess: z.boolean(),
  result: z.string().optional(),
  error: z.string().optional(),
  timing: invocationTimingSchema.optional(),
});
export type InvocationResult = z.infer<typeof invocationResultSchema>;

export const sourceDiscoveryStatusSchema = z.enum([
  "idle",
  "discovering",
  "ready",
  "error",
]);
export type SourceDiscoveryStatus = z.infer<
  typeof sourceDiscoveryStatusSchema
>;

export const sourceCatalogFunctionSchema = z.object({
  functionId: z.string().min(1),
  sourceId: z.string().min(1),
  interfaceId: z.string().min(1),
  interfaceName: z.string().min(1),
  namespace: z.string(),
  methodName: z.string().min(1),
  signature: z.string().min(1),
  returnType: z.string(),
  keyType: grainKeyTypeSchema,
  parameters: z.array(parameterInfoSchema),
});
export type SourceCatalogFunction = z.infer<
  typeof sourceCatalogFunctionSchema
>;

export const sourceCatalogInterfaceSchema = z.object({
  interfaceId: z.string().min(1),
  interfaceName: z.string().min(1),
  namespace: z.string(),
  methods: z.array(sourceCatalogFunctionSchema),
});
export type SourceCatalogInterface = z.infer<
  typeof sourceCatalogInterfaceSchema
>;

export const sourceCatalogSourceSchema = workspaceSourceSchema.extend({
  discoveryStatus: sourceDiscoveryStatusSchema,
  interfaces: z.array(sourceCatalogInterfaceSchema),
});
export type SourceCatalogSource = z.infer<typeof sourceCatalogSourceSchema>;

export const sourceOwnedCatalogSchema = z.object({
  sources: z.array(sourceCatalogSourceSchema),
});
export type SourceOwnedCatalog = z.infer<typeof sourceOwnedCatalogSchema>;

export const interfaceCatalogSchema = z.object({
  interfaces: z.array(grainInterfaceDescriptorSchema),
});
export type InterfaceCatalog = z.infer<typeof interfaceCatalogSchema>;

export const unsavedRequestContextSummarySchema = z.object({
  tabId: z.string().min(1),
  label: z.string().min(1),
  targetGrainClass: z.string().min(1),
  targetMethod: z.string().min(1),
});
export type UnsavedRequestContextSummary = z.infer<
  typeof unsavedRequestContextSummarySchema
>;
