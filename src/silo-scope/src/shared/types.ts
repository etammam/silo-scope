export interface GrainInterfaceDescriptor {
  interfaceId: string;
  interfaceName: string;
  methods: GrainMethodDescriptor[];
}

export interface GrainMethodDescriptor {
  name: string;
  parameters: ParameterInfo[];
  signature?: string;
  returnType?: string;
  keyType?: GrainKeyType;
}

export interface ParameterInfo {
  name: string;
  typeName: string;
}

export type GrainKeyType = "Guid" | "String" | "Integer";
export type SourceType = "DLL" | "NuGet";
export type ClusterType = "Homogenous" | "Heterogeneous";
export type ClusterConnectionProvider =
  | "Redis"
  | "AdoNet"
  | "AzureStorage"
  | "Cosmos"
  | "Consul"
  | "DynamoDB"
  | "ZooKeeper"
  | "Cassandra";
export type SourceDiscoveryStatus = "idle" | "discovering" | "ready" | "error";

export interface RedisClusteringOptions {
  connectionString: string;
  invariant?: string | null;
}

export interface ClusterConnectionOptions {
  provider: ClusterConnectionProvider;
  redis?: RedisClusteringOptions | null;
  adoNet?: RedisClusteringOptions | null;
  azureStorage?: RedisClusteringOptions | null;
  cosmos?: RedisClusteringOptions | null;
  consul?: RedisClusteringOptions | null;
  dynamoDB?: RedisClusteringOptions | null;
  zooKeeper?: RedisClusteringOptions | null;
  cassandra?: RedisClusteringOptions | null;
}

export interface WorkspaceSource {
  sourceId: string;
  sourceType: SourceType;
  reference: string;
  label: string;
  version?: string | null;
  gateway?: string | null;
  feedName?: string | null;
  enabled: boolean;
}

export interface EnvironmentProfile {
  name: string;
  variables: Record<string, string>;
}

export interface Workspace {
  id: string;
  name: string;
  siloAddress: string;
  gatewayPort: number;
  orleansVersion: string;
  description?: string | null;
  clusterId?: string;
  serviceId?: string;
  clusterType?: ClusterType;
  clustering?: ClusterConnectionOptions | null;
  gatewayEndpoints?: string[];
  sources?: WorkspaceSource[];
  savedContexts?: SavedRequestContext[];
}

export interface EnvironmentConfig {
  profiles: EnvironmentProfile[];
  activeEnvironment: string | null;
}

export interface SavedRequestContext {
  tabId: string;
  isDefaultActive: boolean;
  targetGrainClass: string;
  targetMethod: string;
  keyType: GrainKeyType;
  grainId: string;
  payload: string;
  sourceId?: string | null;
  functionId?: string | null;
}

export interface UnsavedRequestContextSummary {
  tabId: string;
  label: string;
  targetGrainClass: string;
  targetMethod: string;
}

export interface NugetFeed {
  name: string;
  url: string;
  hasCredentials: boolean;
  isDefault: boolean;
}

export interface CreateNugetFeedRequest {
  name: string;
  url: string;
  username?: string;
  password?: string;
  isPasswordClearText?: boolean;
}

export interface NugetPackage {
  packageId: string;
  version: string;
  description?: string | null;
  authors?: string | null;
  downloadCount?: number | null;
}

export interface InvocationResult {
  isSuccess: boolean;
  result?: string;
  error?: string;
  timing?: InvocationTiming;
}

export interface InvocationTiming {
  serializationMs: number;
  executionMs: number;
  totalMs: number;
}

export interface LogEntry {
  timestamp: string;
  level: "debug" | "info" | "warn" | "error";
  category?: string;
  message: string;
  exception?: string | null;
}

export interface AppUpdateLocalInfo {
  version: string;
  hash: string;
  baseUrl: string;
  channel: string;
  name: string;
  identifier: string;
}

export interface AppUpdateInfo {
  version: string;
  hash: string;
  updateAvailable: boolean;
  updateReady: boolean;
  error: string;
}

export type AppUpdateStatusType =
  | "idle"
  | "checking"
  | "check-complete"
  | "no-update"
  | "update-available"
  | "download-starting"
  | "downloading"
  | "checking-local-tar"
  | "local-tar-found"
  | "local-tar-missing"
  | "fetching-patch"
  | "patch-found"
  | "patch-not-found"
  | "downloading-patch"
  | "applying-patch"
  | "patch-applied"
  | "patch-failed"
  | "extracting-version"
  | "patch-chain-complete"
  | "downloading-full-bundle"
  | "download-progress"
  | "decompressing"
  | "download-complete"
  | "applying"
  | "extracting"
  | "replacing-app"
  | "launching-new-version"
  | "complete"
  | "error";

export interface AppUpdateStatusEntry {
  status: AppUpdateStatusType;
  message: string;
  timestamp: number;
  progress?: number;
}

export interface AppUpdateState {
  localInfo: AppUpdateLocalInfo;
  updateInfo: AppUpdateInfo | null;
  statusHistory: AppUpdateStatusEntry[];
}

export interface InterfaceCatalog {
  interfaces: GrainInterfaceDescriptor[];
}

export interface SourceOwnedCatalog {
  sources: SourceCatalogSource[];
}

export interface SourceCatalogSource extends WorkspaceSource {
  discoveryStatus: SourceDiscoveryStatus;
  interfaces: SourceCatalogInterface[];
}

export interface SourceCatalogInterface {
  interfaceId: string;
  interfaceName: string;
  namespace: string;
  methods: SourceCatalogFunction[];
}

export interface SourceCatalogFunction {
  functionId: string;
  sourceId: string;
  interfaceId: string;
  interfaceName: string;
  namespace: string;
  methodName: string;
  signature: string;
  returnType: string;
  keyType: GrainKeyType;
  parameters: ParameterInfo[];
}
