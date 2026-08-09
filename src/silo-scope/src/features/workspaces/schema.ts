/**
 * Workspace and cluster schemas.
 *
 * @module features/workspaces/schema
 */

import { z } from "zod";

export const grainKeyTypeSchema = z.enum(["Guid", "String", "Integer"]);
export type GrainKeyType = z.infer<typeof grainKeyTypeSchema>;

export const sourceTypeSchema = z.enum(["DLL", "NuGet"]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const parameterInfoSchema = z.object({
  name: z.string().min(1),
  typeName: z.string().min(1),
});
export type ParameterInfo = z.infer<typeof parameterInfoSchema>;

export const grainMethodDescriptorSchema = z.object({
  name: z.string(),
  parameters: z.array(parameterInfoSchema),
  signature: z.string().optional(),
  returnType: z.string().optional(),
  keyType: grainKeyTypeSchema.optional(),
});
export type GrainMethodDescriptor = z.infer<
  typeof grainMethodDescriptorSchema
>;

export const grainInterfaceDescriptorSchema = z.object({
  interfaceId: z.string(),
  interfaceName: z.string(),
  methods: z.array(grainMethodDescriptorSchema),
});
export type GrainInterfaceDescriptor = z.infer<
  typeof grainInterfaceDescriptorSchema
>;

export const workspaceSourceSchema = z.object({
  sourceId: z.string().min(1),
  sourceType: sourceTypeSchema,
  reference: z.string().min(1),
  label: z.string(),
  version: z.string().nullable().optional(),
  gateway: z.string().nullable().optional(),
  feedName: z.string().nullable().optional(),
  enabled: z.boolean(),
});
export type WorkspaceSource = z.infer<typeof workspaceSourceSchema>;

export const connectionStringOptionsSchema = z.object({
  connectionString: z.string(),
  invariant: z.string().nullable().optional(),
});

export const clusterConnectionProviderSchema = z.enum([
  "Redis",
  "AdoNet",
  "AzureStorage",
  "Cosmos",
  "Consul",
  "DynamoDB",
  "ZooKeeper",
  "Cassandra",
]);
export type ClusterConnectionProvider = z.infer<
  typeof clusterConnectionProviderSchema
>;

export const clusterConnectionOptionsSchema = z.object({
  provider: clusterConnectionProviderSchema,
  redis: connectionStringOptionsSchema.nullable().optional(),
  adoNet: connectionStringOptionsSchema.nullable().optional(),
  azureStorage: connectionStringOptionsSchema.nullable().optional(),
  cosmos: connectionStringOptionsSchema.nullable().optional(),
  consul: connectionStringOptionsSchema.nullable().optional(),
  dynamoDB: connectionStringOptionsSchema.nullable().optional(),
  zooKeeper: connectionStringOptionsSchema.nullable().optional(),
  cassandra: connectionStringOptionsSchema.nullable().optional(),
});

export const clusterTypeSchema = z.enum(["Homogenous", "Heterogeneous"]);
export type ClusterType = z.infer<typeof clusterTypeSchema>;

export const savedRequestContextSchema = z.object({
  tabId: z.string(),
  isDefaultActive: z.boolean(),
  targetGrainClass: z.string(),
  targetMethod: z.string(),
  keyType: grainKeyTypeSchema,
  grainId: z.string(),
  payload: z.string(),
  sourceId: z.string().nullable().optional(),
  functionId: z.string().nullable().optional(),
});
export type SavedRequestContext = z.infer<typeof savedRequestContextSchema>;

export const workspaceSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Workspace name is required"),
  siloAddress: z.string().min(1, "Silo address is required"),
  gatewayPort: z.number().int().positive(),
  orleansVersion: z.string().min(1, "Orleans version is required"),
  description: z.string().nullable().optional(),
  clusterId: z.string().optional(),
  serviceId: z.string().optional(),
  clusterType: clusterTypeSchema.optional(),
  clustering: clusterConnectionOptionsSchema.nullable().optional(),
  gatewayEndpoints: z.array(z.string()).optional(),
  sources: z.array(workspaceSourceSchema).optional(),
  savedContexts: z.array(savedRequestContextSchema).optional(),
});
export type Workspace = z.infer<typeof workspaceSchema>;

export const clusterConfigSchema = workspaceSchema;
export type ClusterConfig = z.infer<typeof clusterConfigSchema>;
export const clusterConfigArraySchema = z.array(clusterConfigSchema);
