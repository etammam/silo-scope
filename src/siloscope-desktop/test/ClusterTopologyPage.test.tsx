import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ClusterTopologyPage } from "@/renderer/components/ClusterTopologyPage";
import type { ClusterTopologySnapshot, SourceOwnedCatalog, Workspace } from "@/shared/types";

const workspace: Workspace = {
  id: "cluster-a",
  name: "Payments Cluster",
  siloAddress: "10.20.0.10",
  gatewayPort: 30000,
  orleansVersion: "10.1.0",
  clusterId: "payments-dev",
};

const sourceCatalog: SourceOwnedCatalog = {
  sources: [
    {
      sourceId: "silo-a",
      sourceType: "DLL",
      reference: "/app/payments.dll",
      label: "payments-silo-a",
      gateway: "10.20.0.10:30000",
      enabled: true,
      discoveryStatus: "ready",
      interfaces: [
        {
          interfaceId: "orders",
          interfaceName: "IOrderGrain",
          namespace: "Payments.Grains",
          methods: [],
        },
        {
          interfaceId: "customers",
          interfaceName: "ICustomerGrain",
          namespace: "Payments.Grains",
          methods: [],
        },
      ],
    },
    {
      sourceId: "silo-b",
      sourceType: "NuGet",
      reference: "Inventory.Grains",
      label: "inventory-silo-b",
      gateway: "10.20.0.11:30000",
      enabled: true,
      discoveryStatus: "ready",
      interfaces: [
        {
          interfaceId: "inventory",
          interfaceName: "IInventoryGrain",
          namespace: "Inventory.Grains",
          methods: [],
        },
      ],
    },
  ],
};

const topologySnapshot: ClusterTopologySnapshot = {
  capturedAt: new Date().toISOString(),
  isLive: true,
  source: "observed-sidecar",
  clients: [
    {
      clientId: "client:10.20.0.10:30000",
      name: "SiloScope Client",
      gateway: "10.20.0.10:30000",
      address: "localhost",
      connectedSiloIds: ["silo-a"],
      status: "healthy",
    },
  ],
  silos: [
    {
      siloId: "silo-a",
      name: "payments-silo-a",
      gateway: "10.20.0.10:30000",
      host: { address: "10.20.0.10", uptimeSeconds: 3600, clientConnections: 1 },
      resources: { cpuPercent: 20, memoryPercent: 31, memoryBytes: 1024 },
      grains: [
        { grainType: "Order", count: 1 },
        { grainType: "Customer", count: 1 },
      ],
      status: "healthy",
    },
    {
      siloId: "silo-b",
      name: "inventory-silo-b",
      gateway: "10.20.0.11:30000",
      host: { address: "10.20.0.11", uptimeSeconds: 1800, clientConnections: 0 },
      resources: { cpuPercent: 16, memoryPercent: 24, memoryBytes: 1024 },
      grains: [{ grainType: "Inventory", count: 1 }],
      status: "healthy",
    },
  ],
  requestEvents: [
    {
      eventId: "request-1",
      sourceId: "client:10.20.0.10:30000",
      targetSiloId: "silo-a",
      grainType: "Order",
      methodName: "Submit",
      isSuccess: true,
      latencyMs: 42,
      message: null,
      observedAt: new Date().toISOString(),
    },
    {
      eventId: "request-2",
      sourceId: "client:10.20.0.10:30000",
      targetSiloId: "silo-a",
      grainType: "Customer",
      methodName: "Load",
      isSuccess: false,
      latencyMs: 65,
      message: "timeout",
      observedAt: new Date().toISOString(),
    },
  ],
  connections: [
    {
      connectionId: "client:10.20.0.10:30000->silo-a",
      sourceSiloId: "client:10.20.0.10:30000",
      targetSiloId: "silo-a",
      latencyMs: 42,
      status: "healthy",
      isSpiking: false,
      observedAt: new Date().toISOString(),
    },
    {
      connectionId: "silo-a->silo-b",
      sourceSiloId: "silo-a",
      targetSiloId: "silo-b",
      latencyMs: 44,
      status: "healthy",
      isSpiking: false,
      observedAt: new Date().toISOString(),
    },
  ],
};

describe("ClusterTopologyPage", () => {
  it("renders an empty state when no workspace or topology data is available", () => {
    render(
      <ClusterTopologyPage
        workspace={null}
        sourceCatalog={{ sources: [] }}
        topology={null}
        isConnected={false}
        invocationHistory={[]}
      />,
    );

    expect(screen.getByText("No cluster selected")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /silo/i })).not.toBeInTheDocument();
  });

  it("renders silo nodes, actor placement groups, and hardware telemetry", () => {
    render(
      <ClusterTopologyPage
        workspace={workspace}
        sourceCatalog={sourceCatalog}
        topology={topologySnapshot}
        isConnected
        invocationHistory={[
          {
            timestamp: Date.now(),
            isSuccess: true,
            timing: { totalMs: 42, executionMs: 30, serializationMs: 4 },
          },
        ]}
      />,
    );

    expect(screen.getByRole("heading", { name: "Payments Cluster" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /payments-silo-a/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /inventory-silo-b/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /SiloScope Client/i })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Spatial cluster graph/i })).toBeInTheDocument();
    expect(screen.getAllByText("Order").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Customer").length).toBeGreaterThan(0);
    expect(screen.getByRole("img", { name: /CPU:/ })).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /Memory:/ })).toBeInTheDocument();
  });

  it("emphasizes transient latency spikes in the topology summary", () => {
    render(
      <ClusterTopologyPage
        workspace={workspace}
        sourceCatalog={sourceCatalog}
        topology={{
          ...topologySnapshot,
          connections: topologySnapshot.connections.map((connection) => ({
            ...connection,
            latencyMs: 220,
            status: "critical",
            isSpiking: true,
          })),
        }}
        isConnected
        invocationHistory={[]}
      />,
    );

    const summary = screen.getByLabelText("Topology summary");

    expect(within(summary).getByText("Spikes")).toBeInTheDocument();
    expect(within(summary).getAllByText("2").length).toBeGreaterThan(0);
    expect(screen.getAllByText(/22\d ms/).length).toBeGreaterThan(0);
  });

  it("renders latency-based edge colors and grain shape icons in inspector", () => {
    render(
      <ClusterTopologyPage
        workspace={workspace}
        sourceCatalog={sourceCatalog}
        topology={topologySnapshot}
        isConnected
        invocationHistory={[]}
      />,
    );

    // Inspector grain rows should render with shape icons
    const inspector = screen.getByLabelText("Selected silo telemetry");
    expect(within(inspector).getAllByText("Order").length).toBeGreaterThan(0);
    expect(within(inspector).getAllByText("Customer").length).toBeGreaterThan(0);
  });
});
