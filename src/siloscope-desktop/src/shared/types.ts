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
export type SourceDiscoveryStatus = "idle" | "discovering" | "ready" | "error";

export interface WorkspaceSource {
  sourceId: string;
  sourceType: SourceType;
  reference: string;
  label: string;
  version?: string | null;
  gateway?: string | null;
  enabled: boolean;
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
  gatewayEndpoints?: string[];
  environmentVariables?: Record<string, string>;
  sources?: WorkspaceSource[];
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
  message: string;
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
