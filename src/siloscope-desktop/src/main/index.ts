import { BrowserWindow, BrowserView } from "electrobun/bun";
import Electrobun from "electrobun/bun";
import type { SiloScopeRPC } from "../shared/rpc";

const rpc = BrowserView.defineRPC<SiloScopeRPC>({
  handlers: {
    requests: {
      getGrains: ({ workspaceId }) => {
        console.log("getGrains", workspaceId);
        return { grains: [] };
      },
      invokeGrain: ({ grainType, method, grainKey, payload }) => {
        console.log("invokeGrain", grainType, method, grainKey, payload);
        return { isSuccess: true, result: "{}" };
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
});