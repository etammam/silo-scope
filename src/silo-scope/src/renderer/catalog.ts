import type {
  GrainInterfaceDescriptor,
  GrainKeyType,
  SourceCatalogFunction,
  SourceCatalogInterface,
  SourceCatalogSource,
  SourceOwnedCatalog,
  Workspace,
  WorkspaceSource,
} from "../shared/types";

const fallbackSourceId = "source:active-workspace";

export function buildSourceCatalogFromGrains(
  grains: GrainInterfaceDescriptor[],
  workspace: Workspace | null,
): SourceOwnedCatalog {
  const sources = getWorkspaceSources(workspace);

  if (grains.length === 0) {
    return {
      sources: sources.map((source) => ({
        ...source,
        discoveryStatus: "idle",
        interfaces: [],
      })),
    };
  }

  const source = sources[0] ?? getFallbackSource(workspace);

  return {
    sources: [
      {
        ...source,
        discoveryStatus: "ready",
        interfaces: grains
          .map((grain) => toCatalogInterface(source.sourceId, grain))
          .sort((left, right) => left.interfaceName.localeCompare(right.interfaceName)),
      },
      ...sources.slice(1).map((workspaceSource) => ({
        ...workspaceSource,
        discoveryStatus: "idle" as const,
        interfaces: [],
      })),
    ],
  };
}

export function findCatalogFunction(
  catalog: SourceOwnedCatalog,
  functionId: string | null,
): SourceCatalogFunction | null {
  if (!functionId) {
    return null;
  }

  for (const source of catalog.sources) {
    for (const catalogInterface of source.interfaces) {
      const match = catalogInterface.methods.find((method) => method.functionId === functionId);
      if (match) {
        return match;
      }
    }
  }

  return null;
}

export function findCatalogSource(
  catalog: SourceOwnedCatalog,
  sourceId: string | null,
): SourceCatalogSource | null {
  if (!sourceId) {
    return null;
  }

  return catalog.sources.find((source) => source.sourceId === sourceId) ?? null;
}

function getWorkspaceSources(workspace: Workspace | null): WorkspaceSource[] {
  if (workspace?.sources && workspace.sources.length > 0) {
    return workspace.sources;
  }

  if (!workspace) {
    return [];
  }

  return [getFallbackSource(workspace)];
}

function getFallbackSource(workspace: Workspace | null): WorkspaceSource {
  return {
    sourceId: workspace ? `${fallbackSourceId}:${workspace.id}` : fallbackSourceId,
    sourceType: "DLL",
    reference: workspace ? `${workspace.siloAddress}:${workspace.gatewayPort}` : "No source",
    label: workspace ? `${workspace.siloAddress}:${workspace.gatewayPort}` : "Active workspace",
    version: workspace?.orleansVersion ?? null,
    gateway: workspace ? `${workspace.siloAddress}:${workspace.gatewayPort}` : null,
    enabled: true,
  };
}

function toCatalogInterface(sourceId: string, grain: GrainInterfaceDescriptor): SourceCatalogInterface {
  const namespace = getNamespaceName(grain.interfaceName);

  return {
    interfaceId: grain.interfaceId,
    interfaceName: grain.interfaceName,
    namespace,
    methods: grain.methods.map((method) => {
      const keyType: GrainKeyType = method.keyType ?? "String";
      const signature = method.signature ?? formatMethodSignature(method.name, method.parameters);

      return {
        functionId: `${sourceId}:${grain.interfaceId}:${signature}`,
        sourceId,
        interfaceId: grain.interfaceId,
        interfaceName: grain.interfaceName,
        namespace,
        methodName: method.name,
        signature,
        returnType: method.returnType ?? "unknown",
        keyType,
        parameters: method.parameters,
      };
    }),
  };
}

function formatMethodSignature(
  methodName: string,
  parameters: Array<{ name: string; typeName: string }>,
): string {
  if (parameters.length === 0) {
    return `${methodName}()`;
  }

  return `${methodName}(${parameters.map((parameter) => `${parameter.name}: ${parameter.typeName}`).join(", ")})`;
}

function getNamespaceName(interfaceName: string): string {
  const lastDot = interfaceName.lastIndexOf(".");
  return lastDot > 0 ? interfaceName.slice(0, lastDot) : "Application";
}
