export interface GrainInterfaceDescriptor {
  interfaceId: string;
  interfaceName: string;
  methods: GrainMethodDescriptor[];
}

export interface GrainMethodDescriptor {
  name: string;
  parameters: ParameterInfo[];
}

export interface ParameterInfo {
  name: string;
  typeName: string;
}

export interface Workspace {
  id: string;
  name: string;
  siloAddress: string;
  gatewayPort: number;
  orleansVersion: string;
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