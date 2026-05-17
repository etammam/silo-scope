import { ApplicationMenu, BrowserWindow, BrowserView } from "electrobun/bun";
import Electrobun from "electrobun/bun";
import type { SiloScopeRPC } from "../shared/rpc";
import type { SourceOwnedCatalog } from "../shared/types";
import { installApplicationMenu } from "./applicationMenu";
import { SidecarJsonRpcClient } from "./jsonRpcClient";

const sidecar = new SidecarJsonRpcClient();
sidecar.start();

type FluentResult<T> = {
  IsSuccess: boolean;
  Errors?: Array<{ Message?: string }>;
  Value?: T;
};

type BackendSourceOwnedCatalog = {
  Sources?: Array<{
    SourceId: string;
    SourceType: "DLL" | "NuGet" | string;
    Reference: string;
    Label: string;
    Version?: string | null;
    Gateway?: string | null;
    Enabled: boolean;
    DiscoveryStatus: "idle" | "discovering" | "ready" | "error" | string;
    Interfaces?: Array<{
      InterfaceId: string;
      InterfaceName: string;
      Namespace: string;
      Methods?: Array<{
        FunctionId: string;
        SourceId: string;
        InterfaceId: string;
        InterfaceName: string;
        Namespace: string;
        MethodName: string;
        Signature: string;
        ReturnType: string;
        KeyType: "Guid" | "String" | "Integer" | string;
        Parameters?: Array<{ Name: string; TypeName: string }>;
      }>;
    }>;
  }>;
};

const rpc = BrowserView.defineRPC<SiloScopeRPC>({
  handlers: {
    requests: {
      getGrains: async ({ workspaceId: _workspaceId }) => {
        console.log("getGrains", _workspaceId);
        const result = await sidecar.request<FluentResult<BackendSourceOwnedCatalog>>(
          "DiscoverSourceCatalogAsync",
        );

        if (!result.IsSuccess) {
          throw new Error(result.Errors?.[0]?.Message ?? "Failed to discover grains.");
        }

        const sourceCatalog = mapSourceCatalog(result.Value ?? {});

        return {
          grains: flattenSourceCatalog(sourceCatalog),
          sourceCatalog,
        };
      },
      getSourceCatalog: async ({ workspaceId: _workspaceId }) => {
        console.log("getSourceCatalog", _workspaceId);
        const result = await sidecar.request<FluentResult<BackendSourceOwnedCatalog>>(
          "DiscoverSourceCatalogAsync",
        );

        if (!result.IsSuccess) {
          throw new Error(result.Errors?.[0]?.Message ?? "Failed to discover source catalog.");
        }

        return { sourceCatalog: mapSourceCatalog(result.Value ?? {}) };
      },
      invokeGrain: async ({ grainType, method, grainKey, payload, sourceId, functionId }) => {
        console.log("invokeGrain", grainType, method, grainKey, payload, sourceId, functionId);
        const result = await sidecar.request<
          FluentResult<{ IsSuccess: boolean; Result?: string; ErrorMessage?: string }>
        >("InvokeGrainAsync", [grainType, method, grainKey, payload]);

        if (!result.IsSuccess) {
          return {
            isSuccess: false,
            error: result.Errors?.[0]?.Message ?? "Failed to invoke grain.",
          };
        }

        return {
          isSuccess: result.Value?.IsSuccess ?? false,
          result: result.Value?.Result,
          error: result.Value?.ErrorMessage,
        };
      },
      getWorkspaces: () => {
        return { workspaces: [] };
      },
    },
    messages: {
      connectionChanged: ({ isConnected }) => {
        console.log("connectionChanged", isConnected);
      },
      logEntry: ({ entry }) => {
        console.log("logEntry", entry);
      },
    },
  },
});

function mapSourceCatalog(catalog: BackendSourceOwnedCatalog): SourceOwnedCatalog {
  return {
    sources: (catalog.Sources ?? []).map((source) => ({
      sourceId: source.SourceId,
      sourceType: source.SourceType === "NuGet" ? "NuGet" : "DLL",
      reference: source.Reference,
      label: source.Label,
      version: source.Version ?? null,
      gateway: source.Gateway ?? null,
      enabled: source.Enabled,
      discoveryStatus: isDiscoveryStatus(source.DiscoveryStatus) ? source.DiscoveryStatus : "idle",
      interfaces: (source.Interfaces ?? []).map((catalogInterface) => ({
        interfaceId: catalogInterface.InterfaceId,
        interfaceName: catalogInterface.InterfaceName,
        namespace: catalogInterface.Namespace,
        methods: (catalogInterface.Methods ?? []).map((method) => ({
          functionId: method.FunctionId,
          sourceId: method.SourceId,
          interfaceId: method.InterfaceId,
          interfaceName: method.InterfaceName,
          namespace: method.Namespace,
          methodName: method.MethodName,
          signature: method.Signature,
          returnType: method.ReturnType,
          keyType: isGrainKeyType(method.KeyType) ? method.KeyType : "String",
          parameters: (method.Parameters ?? []).map((parameter) => ({
            name: parameter.Name,
            typeName: parameter.TypeName,
          })),
        })),
      })),
    })),
  };
}

function flattenSourceCatalog(catalog: SourceOwnedCatalog) {
  return catalog.sources.flatMap((source) =>
    source.interfaces.map((catalogInterface) => ({
      interfaceId: catalogInterface.interfaceId,
      interfaceName: catalogInterface.interfaceName,
      methods: catalogInterface.methods.map((method) => ({
        name: method.methodName,
        signature: method.signature,
        returnType: method.returnType,
        keyType: method.keyType,
        parameters: method.parameters,
      })),
    })),
  );
}

function isDiscoveryStatus(value: string): value is "idle" | "discovering" | "ready" | "error" {
  return value === "idle" || value === "discovering" || value === "ready" || value === "error";
}

function isGrainKeyType(value: string): value is "Guid" | "String" | "Integer" {
  return value === "Guid" || value === "String" || value === "Integer";
}

const mainWindow = new BrowserWindow({
  title: "SiloScope",
  url: "views://renderer/index.html",
  rpc,
  titleBarStyle: "hiddenInset",
  trafficLightOffset: {
    x: 12,
    y: 10,
  },
  frame: {
    x: 100,
    y: 100,
    width: 1200,
    height: 800,
  },
});

installApplicationMenu({
  ApplicationMenu,
  events: Electrobun.events,
  onFileAction: (action) => {
    mainWindow.webview.rpc?.send.fileMenuAction({ action });
  },
});

console.log("SiloScope app started!");

Electrobun.events.on("before-quit", async () => {
  console.log("App shutting down...");
  await sidecar.dispose();
});
