import { BrowserWindow, BrowserView } from "electrobun/bun";
import Electrobun from "electrobun/bun";
import type { SiloScopeRPC } from "../shared/rpc";
import { SidecarJsonRpcClient } from "./jsonRpcClient";

const sidecar = new SidecarJsonRpcClient();
sidecar.start();

type FluentResult<T> = {
  IsSuccess: boolean;
  Errors?: Array<{ Message?: string }>;
  Value?: T;
};

type GrainCatalogResponse = {
  Grains?: Array<{
    FullName: string;
    Name: string;
    Namespace: string;
    Methods: Array<{ Name: string; Signature: string; ReturnType: string }>;
  }>;
};

const rpc = BrowserView.defineRPC<SiloScopeRPC>({
  handlers: {
    requests: {
      getGrains: async ({ workspaceId: _workspaceId }) => {
        console.log("getGrains", _workspaceId);
        const result = await sidecar.request<FluentResult<GrainCatalogResponse>>(
          "DiscoverGrainsAsync",
        );

        if (!result.IsSuccess) {
          throw new Error(result.Errors?.[0]?.Message ?? "Failed to discover grains.");
        }

        const catalog = result.Value ?? {};

        return {
          grains: (catalog.Grains ?? []).map((grain) => ({
            interfaceId: grain.FullName,
            interfaceName: grain.Name,
            methods: grain.Methods.map((method) => ({
              name: method.Name,
              parameters: [],
            })),
          })),
        };
      },
      invokeGrain: async ({ grainType, method, grainKey, payload }) => {
        console.log("invokeGrain", grainType, method, grainKey, payload);
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

new BrowserWindow({
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

console.log("SiloScope app started!");

Electrobun.events.on("before-quit", async () => {
  console.log("App shutting down...");
  await sidecar.dispose();
});
