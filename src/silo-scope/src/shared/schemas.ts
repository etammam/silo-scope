import { z } from "zod";

// ─── NuGet ───────────────────────────────────────────────────────────────────

export const nugetFeedSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  hasCredentials: z.boolean(),
  isDefault: z.boolean(),
});
export type NugetFeed = z.infer<typeof nugetFeedSchema>;

export const createNugetFeedRequestSchema = z.object({
  name: z.string().min(1, "Feed name is required"),
  url: z.string().url("Feed URL must be a valid URL"),
  username: z.string().optional(),
  password: z.string().optional(),
  isPasswordClearText: z.boolean().optional(),
});
export type CreateNugetFeedRequest = z.infer<typeof createNugetFeedRequestSchema>;

export const nugetPackageSchema = z.object({
  packageId: z.string(),
  version: z.string(),
  description: z.string().nullable().optional(),
  authors: z.string().nullable().optional(),
  downloadCount: z.number().nullable().optional(),
});
export type NugetPackage = z.infer<typeof nugetPackageSchema>;

// ─── Persisted feed (feeds-store) ────────────────────────────────────────────

export const persistedFeedSchema = z.object({
  name: z.string().min(1),
  url: z.string().url(),
  username: z.string().optional(),
  password: z.string().optional(),
  hasCredentials: z.boolean(),
  isDefault: z.boolean(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type PersistedFeed = z.infer<typeof persistedFeedSchema>;

export const persistedFeedArraySchema = z.array(persistedFeedSchema);

// ─── Storage ─────────────────────────────────────────────────────────────────

export const storageConfigSchema = z.object({
  storagePath: z.string().nullable(),
});
export type StorageConfig = z.infer<typeof storageConfigSchema>;

// ─── Workspace ───────────────────────────────────────────────────────────────

export const grainKeyTypeSchema = z.enum(["Guid", "String", "Integer"]);
export type GrainKeyType = z.infer<typeof grainKeyTypeSchema>;

export const sourceTypeSchema = z.enum(["DLL", "NuGet"]);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const parameterInfoSchema = z.object({
  name: z.string(),
  typeName: z.string(),
});
export type ParameterInfo = z.infer<typeof parameterInfoSchema>;

export const grainMethodDescriptorSchema = z.object({
  name: z.string(),
  parameters: z.array(parameterInfoSchema),
  signature: z.string().optional(),
  returnType: z.string().optional(),
  keyType: grainKeyTypeSchema.optional(),
});
export type GrainMethodDescriptor = z.infer<typeof grainMethodDescriptorSchema>;

export const grainInterfaceDescriptorSchema = z.object({
  interfaceId: z.string(),
  interfaceName: z.string(),
  methods: z.array(grainMethodDescriptorSchema),
});
export type GrainInterfaceDescriptor = z.infer<
  typeof grainInterfaceDescriptorSchema
>;

export const workspaceSourceSchema = z.object({
  sourceId: z.string(),
  sourceType: sourceTypeSchema,
  reference: z.string(),
  label: z.string(),
  version: z.string().nullable().optional(),
  gateway: z.string().nullable().optional(),
  feedName: z.string().nullable().optional(),
  enabled: z.boolean(),
});

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

export const clusterTypeSchema = z.enum(["Homogenous", "Heterogeneous"]);

export const workspaceSchema = z.object({
  id: z.string(),
  name: z.string().min(1, "Workspace name is required"),
  siloAddress: z.string(),
  gatewayPort: z.number().int().positive(),
  orleansVersion: z.string(),
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

// ─── Cluster persistence ─────────────────────────────────────────────────────

/** Persisted cluster config — same shape as the runtime Workspace schema. */
export const clusterConfigSchema = workspaceSchema;
export type ClusterConfig = z.infer<typeof clusterConfigSchema>;
export const clusterConfigArraySchema = z.array(clusterConfigSchema);

// ─── Environment ─────────────────────────────────────────────────────────────

export const environmentProfileSchema = z.object({
  name: z.string(),
  variables: z.record(z.string(), z.string()),
});
export type EnvironmentProfile = z.infer<typeof environmentProfileSchema>;

export const environmentConfigSchema = z.object({
  profiles: z.array(environmentProfileSchema),
  activeEnvironment: z.string().nullable(),
});

// ─── Invocation ──────────────────────────────────────────────────────────────

export const invocationTimingSchema = z.object({
  serializationMs: z.number(),
  executionMs: z.number(),
  totalMs: z.number(),
});

export const invocationResultSchema = z.object({
  isSuccess: z.boolean(),
  result: z.string().optional(),
  error: z.string().optional(),
  timing: invocationTimingSchema.optional(),
});
export type InvocationResult = z.infer<typeof invocationResultSchema>;

// ─── Logs ────────────────────────────────────────────────────────────────────

export const logLevelSchema = z.enum(["debug", "info", "warn", "error"]);

export const logEntrySchema = z.object({
  timestamp: z.string(),
  level: logLevelSchema,
  category: z.string().optional(),
  message: z.string(),
  exception: z.string().nullable().optional(),
});
export type LogEntry = z.infer<typeof logEntrySchema>;
