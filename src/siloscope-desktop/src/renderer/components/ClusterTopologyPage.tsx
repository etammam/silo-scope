import {
  AlertTriangle,
  Cpu,
  Database,
  HardDrive,
  Laptop,
  Network,
  RadioTower,
  RotateCcw,
  Search,
  Server,
} from "lucide-react";

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ClusterTopologySnapshot,
  GrainKeyType,
  SourceOwnedCatalog,
  Workspace,
} from "../../shared/types";

type InvocationHistoryEntry = {
  timestamp: number;
  isSuccess: boolean;
  timing: {
    totalMs: number;
    executionMs: number;
    serializationMs: number;
  } | null;
};

type TopologyStatus = "healthy" | "warning" | "critical";
type TopologyLayout = "radial" | "grid" | "focus";
type TopologyFilter = "all" | TopologyStatus;

 type GrainGroup = {
  label: string;
  count: number;
  keyType: GrainKeyType;
};

type SiloTopologyNode = {
  id: string;
  kind: "silo" | "client";
  label: string;
  address: string;
  gateway: string;
  x: number;
  y: number;
  cpu: number;
  memory: number;
  uptimeHours: number;
  clientConnections: number;
  status: TopologyStatus;
  grainCount: number;
  grainGroups: GrainGroup[];
  transitionState?: "entering" | "exiting" | "stable";
  siloClass?: string;
};

type TopologyEdge = {
  id: string;
  sourceId: string;
  targetId: string;
  latencyMs: number;
  status: TopologyStatus;
  isSpiking: boolean;
};

type TopologyRequestEvent = {
  id: string;
  sourceId: string;
  targetId: string;
  grainType: string;
  methodName: string;
  isSuccess: boolean;
  latencyMs: number;
  message: string | null;
  observedAt: string;
};

type ActiveParticle = {
  id: string;
  sourceId: string;
  targetId: string;
  startTime: number;
  duration: number;
  isSuccess: boolean;
  grainType: string;
};

type RippleEvent = {
  id: string;
  nodeId: string;
  startTime: number;
};

type ClusterTopology = {
  nodes: SiloTopologyNode[];
  edges: TopologyEdge[];
  requestEvents: TopologyRequestEvent[];
  summary: {
    totalGrains: number;
    activeSilos: number;
    clients: number;
    requests: number;
    failures: number;
    averageLatencyMs: number;
    spikeCount: number;
  };
  hasBackendSnapshot: boolean;
};

type ClusterTopologyPageProps = {
  workspace: Workspace | null;
  sourceCatalog: SourceOwnedCatalog;
  topology: ClusterTopologySnapshot | null;
  isConnected: boolean;
  invocationHistory: InvocationHistoryEntry[];
};

const graphWidth = 960;
const graphHeight = 560;
const layouts: Array<{ id: TopologyLayout; label: string }> = [
  { id: "radial", label: "Radial" },
  { id: "grid", label: "Grid" },
  { id: "focus", label: "Focus" },
];
const filters: Array<{ id: TopologyFilter; label: string }> = [
  { id: "all", label: "All" },
  { id: "healthy", label: "Healthy" },
  { id: "warning", label: "Warning" },
  { id: "critical", label: "Critical" },
];

function inferGrainKeyType(
  grainType: string,
  sourceCatalog: SourceOwnedCatalog,
): GrainKeyType {
  for (const source of sourceCatalog.sources) {
    for (const iface of source.interfaces) {
      const shortName = iface.interfaceName.replace(/^I/, "");
      if (
        grainType.includes(shortName) ||
        iface.interfaceName === grainType ||
        iface.interfaceId === grainType
      ) {
        const method = iface.methods[0];
        if (method?.keyType) return method.keyType;
      }
    }
  }
  return "String";
}

function getLatencyEdgeClass(latencyMs: number, status: TopologyStatus): string {
  if (status === "critical" || latencyMs > 100) {
    return "cluster-topology__edge--latency-critical";
  }
  if (status === "warning" || latencyMs >= 10) {
    return "cluster-topology__edge--latency-warning";
  }
  return "cluster-topology__edge--latency-healthy";
}

function getEdgeStrokeColor(latencyMs: number, status: TopologyStatus): string {
  if (status === "critical" || latencyMs > 100) return "rgb(255 95 112 / 0.56)";
  if (status === "warning" || latencyMs >= 10) return "rgb(50 150 255 / 0.56)";
  return "rgb(160 170 185 / 0.34)";
}

function getEdgeStrokeWidth(latencyMs: number, status: TopologyStatus): number {
  if (status === "critical" || latencyMs > 100) return 3.5;
  if (status === "warning" || latencyMs >= 10) return 2.5;
  return 1.5;
}

export function ClusterTopologyPage({
  workspace,
  sourceCatalog,
  topology: telemetrySnapshot,
  isConnected,
  invocationHistory: _invocationHistory,
}: ClusterTopologyPageProps) {
  const [layout, setLayout] = useState<TopologyLayout>("radial");
  const [filter, setFilter] = useState<TopologyFilter>("all");
  const [query, setQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [particles, setParticles] = useState<ActiveParticle[]>([]);
  const [ripples, setRipples] = useState<RippleEvent[]>([]);
  const prevNodeIdsRef = useRef<Set<string>>(new Set());

  const topology = useMemo(
    () =>
      isConnected && telemetrySnapshot
        ? buildClusterTopologyFromSnapshot(telemetrySnapshot, layout, sourceCatalog)
        : emptyClusterTopology(),
    [isConnected, telemetrySnapshot, layout, sourceCatalog],
  );

  // Detect node transitions (entering/exiting) for animation
  useEffect(() => {
    const currentIds = new Set(topology.nodes.map((n) => n.id));
    const prevIds = prevNodeIdsRef.current;

    const entering = new Set<string>();
    const exiting = new Set<string>();

    for (const id of currentIds) {
      if (!prevIds.has(id)) entering.add(id);
    }
    for (const id of prevIds) {
      if (!currentIds.has(id)) exiting.add(id);
    }

    // Mark entering nodes
    if (entering.size > 0) {
      setSelectedNodeId((current) => {
        // auto-select first new silo if nothing selected
        if (!current) {
          const firstNewSilo = topology.nodes.find(
            (n) => entering.has(n.id) && n.kind === "silo",
          );
          return firstNewSilo?.id ?? current;
        }
        return current;
      });
    }

    prevNodeIdsRef.current = currentIds;

    // Clear exiting nodes after animation
    if (exiting.size > 0) {
      const timer = window.setTimeout(() => {
        // Exiting nodes are already removed from topology, just ensure cleanup
      }, 600);
      return () => window.clearTimeout(timer);
    }
  }, [topology.nodes]);

  // Spawn particles from request events
  useEffect(() => {
    if (topology.requestEvents.length === 0) return;

    const now = performance.now();
    const newParticles: ActiveParticle[] = [];
    const newRipples: RippleEvent[] = [];

    for (const event of topology.requestEvents) {
      newParticles.push({
        id: `particle-${event.id}`,
        sourceId: event.sourceId,
        targetId: event.targetId,
        startTime: now,
        duration: Math.max(900, Math.min(2800, event.latencyMs * 12)),
        isSuccess: event.isSuccess,
        grainType: event.grainType,
      });
      newRipples.push({
        id: `ripple-${event.id}`,
        nodeId: event.targetId,
        startTime: now + Math.max(900, Math.min(2800, event.latencyMs * 12)),
      });
    }

    setParticles((prev) => [...prev, ...newParticles].slice(-40));
    setRipples((prev) => [...prev, ...newRipples].slice(-20));

    // Cleanup old particles/ripples
    const cleanup = window.setInterval(() => {
      const cutoff = performance.now() - 4000;
      setParticles((prev) => prev.filter((p) => p.startTime + p.duration > cutoff));
      setRipples((prev) => prev.filter((r) => r.startTime > cutoff));
    }, 500);

    return () => window.clearInterval(cleanup);
  }, [topology.requestEvents]);

  const visibleNodes = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return topology.nodes.filter((node) => {
      const matchesStatus = filter === "all" || node.status === filter;
      const matchesQuery =
        !normalizedQuery ||
        node.label.toLowerCase().includes(normalizedQuery) ||
        node.gateway.toLowerCase().includes(normalizedQuery) ||
        node.address.toLowerCase().includes(normalizedQuery);
      return matchesStatus && matchesQuery;
    });
  }, [topology.nodes, filter, query]);

  const visibleNodeIds = useMemo(
    () => new Set(visibleNodes.map((node) => node.id)),
    [visibleNodes],
  );

  const visibleEdges = topology.edges.filter(
    (edge) =>
      visibleNodeIds.has(edge.sourceId) && visibleNodeIds.has(edge.targetId),
  );

  const selectedNode =
    visibleNodes.find((node) => node.id === selectedNodeId) ??
    visibleNodes.find((node) => node.kind === "silo") ??
    visibleNodes[0] ??
    null;

  const hasTopologyData = isConnected && topology.nodes.length > 0;

  return (
    <section
      className="cluster-topology"
      aria-labelledby="cluster-topology-title"
    >
      <header className="cluster-topology__header">
        <div>
          <span className="cluster-topology__eyebrow">
            <Network aria-hidden="true" width={14} height={14} />
            Cluster topology
          </span>
          <h2 id="cluster-topology-title">
            {workspace?.name ?? "No active cluster"}
          </h2>
          <p>
            {getTopologyDescription(workspace, isConnected, telemetrySnapshot)}
          </p>
        </div>
        <dl className="cluster-topology__summary" aria-label="Topology summary">
          <Metric label="Silos" value={String(topology.summary.activeSilos)} />
          <Metric label="Clients" value={String(topology.summary.clients)} />
          <Metric label="Grains" value={String(topology.summary.totalGrains)} />
          <Metric label="Requests" value={String(topology.summary.requests)} />
          <Metric label="Failures" value={String(topology.summary.failures)} />
          <Metric
            label="Avg latency"
            value={formatMs(topology.summary.averageLatencyMs)}
          />
          <Metric label="Spikes" value={String(topology.summary.spikeCount)} />
        </dl>
      </header>

      <div className="cluster-topology__toolbar" aria-label="Topology controls">
        <div
          className="cluster-topology__segmented"
          role="group"
          aria-label="Topology layout"
        >
          {layouts.map((item) => (
            <button
              aria-pressed={layout === item.id}
              key={item.id}
              onClick={() => setLayout(item.id)}
              type="button"
            >
              {item.label}
            </button>
          ))}
        </div>
        <label className="cluster-topology__search">
          <Search aria-hidden="true" width={13} height={13} />
          <input
            aria-label="Search topology"
            placeholder="Search device or gateway"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <label className="cluster-topology__select-label">
          Status
          <select
            aria-label="Filter topology by status"
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as TopologyFilter)
            }
          >
            {filters.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="cluster-topology__icon-button"
          onClick={() => {
            setLayout("radial");
            setFilter("all");
            setQuery("");
            setSelectedNodeId(null);
          }}
          title="Reset topology view"
          type="button"
        >
          <RotateCcw aria-hidden="true" width={14} height={14} />
        </button>
        <span className="cluster-topology__source">
          {!isConnected
            ? "not connected"
            : topology.hasBackendSnapshot
              ? telemetrySnapshot?.source
              : "waiting for backend snapshot"}
        </span>
      </div>

      {!hasTopologyData ? (
        <TopologyEmptyState
          isConnected={isConnected}
          hasWorkspace={Boolean(workspace)}
        />
      ) : (
        <div
          className="cluster-topology__body"
          data-has-selection={Boolean(selectedNode)}
        >
          <div
            className="cluster-topology__graph"
            role="img"
            aria-label="Spatial cluster graph with latency colored communication paths"
          >
            {visibleNodes.length === 0 ? (
              <TopologyEmptyState
                compact
                isConnected={isConnected}
                hasWorkspace={Boolean(workspace)}
              />
            ) : (
              <>
                <svg
                  className="cluster-topology__links"
                  viewBox={`0 0 ${graphWidth} ${graphHeight}`}
                  preserveAspectRatio="xMidYMid meet"
                  aria-hidden="true"
                >
                  <defs>
                    <radialGradient
                      id="topology-core-glow"
                      cx="50%"
                      cy="50%"
                      r="50%"
                    >
                      <stop offset="0%" stopColor="rgb(78 201 176 / 0.16)" />
                      <stop offset="55%" stopColor="rgb(0 120 212 / 0.08)" />
                      <stop offset="100%" stopColor="transparent" />
                    </radialGradient>
                    <marker
                      id="topology-arrow"
                      viewBox="0 0 10 10"
                      refX="8"
                      refY="5"
                      markerWidth="5"
                      markerHeight="5"
                      orient="auto-start-reverse"
                    >
                      <path d="M 0 0 L 10 5 L 0 10 z" />
                    </marker>
                    <filter id="glow-green">
                      <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="glow-amber">
                      <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                    <filter id="glow-red">
                      <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                      <feMerge>
                        <feMergeNode in="coloredBlur" />
                        <feMergeNode in="SourceGraphic" />
                      </feMerge>
                    </filter>
                  </defs>
                  <TopologyGuideRings />
                  {visibleEdges.map((edge) => {
                    const source = visibleNodes.find(
                      (node) => node.id === edge.sourceId,
                    );
                    const target = visibleNodes.find(
                      (node) => node.id === edge.targetId,
                    );
                    if (!source || !target) return null;
                    const latencyClass = getLatencyEdgeClass(edge.latencyMs, edge.status);
                    const strokeColor = getEdgeStrokeColor(edge.latencyMs, edge.status);
                    const strokeWidth = getEdgeStrokeWidth(edge.latencyMs, edge.status);
                    return (
                      <g
                        className={`cluster-topology__edge ${latencyClass} ${edge.isSpiking ? "cluster-topology__edge--spike" : ""}`}
                        key={edge.id}
                      >
                        <path
                          d={getEdgePath(source, target)}
                          markerEnd="url(#topology-arrow)"
                          style={{
                            stroke: strokeColor,
                            strokeWidth,
                          }}
                        />
                        <text {...getEdgeLabelPoint(source, target)}>
                          {formatMs(edge.latencyMs)}
                        </text>
                      </g>
                    );
                  })}
                  {/* Request flow particles */}
                  {particles.map((particle) => {
                    const source = visibleNodes.find((n) => n.id === particle.sourceId);
                    const target = visibleNodes.find((n) => n.id === particle.targetId);
                    if (!source || !target) return null;
                    const path = getEdgePath(source, target);
                    return (
                      <g
                        className={`cluster-topology__particle ${particle.isSuccess ? "cluster-topology__particle--success" : "cluster-topology__particle--failure"}`}
                        key={particle.id}
                      >
                        <circle r="3.5">
                          <animateMotion
                            dur={`${particle.duration}ms`}
                            repeatCount="1"
                            fill="freeze"
                            path={path}
                          />
                        </circle>
                      </g>
                    );
                  })}
                  {/* Ripple effects on target nodes */}
                  {ripples.map((ripple) => {
                    const node = visibleNodes.find((n) => n.id === ripple.nodeId);
                    if (!node) return null;
                    return (
                      <g key={ripple.id} className="cluster-topology__ripple">
                        <circle
                          cx={node.x}
                          cy={node.y}
                          r="8"
                          fill="none"
                          stroke={ripple.startTime > performance.now() - 200 ? "rgb(78 201 176 / 0.5)" : "none"}
                          strokeWidth="2"
                        >
                          <animate
                            attributeName="r"
                            from="8"
                            to="40"
                            dur="600ms"
                            repeatCount="1"
                            fill="freeze"
                          />
                          <animate
                            attributeName="opacity"
                            from="0.6"
                            to="0"
                            dur="600ms"
                            repeatCount="1"
                            fill="freeze"
                          />
                        </circle>
                      </g>
                    );
                  })}
                </svg>

                <div className="cluster-topology__core" aria-hidden="true">
                  <Network width={18} height={18} />
                  <span>
                    <strong>{topology.summary.requests}</strong>
                    <small>requests</small>
                  </span>
                </div>

                {visibleNodes.map((node) => (
                  <button
                    aria-label={`${node.label}, ${node.kind}, ${node.grainCount} grains, CPU ${node.cpu} percent, memory ${node.memory} percent`}
                    aria-pressed={selectedNode?.id === node.id}
                    className={`cluster-topology__node cluster-topology__node--${node.kind} cluster-topology__node--${node.status}`}
                    key={node.id}
                    onClick={() =>
                      setSelectedNodeId((current) =>
                        current === node.id ? null : node.id,
                      )
                    }
                    style={{
                      left: `${(node.x / graphWidth) * 100}%`,
                      top: `${(node.y / graphHeight) * 100}%`,
                    }}
                    title={`${node.address}\nGateway ${node.gateway}\nUptime ${node.uptimeHours}h\n${node.clientConnections} client connections`}
                    type="button"
                  >
                    {/* Neon glow border strip */}
                    <span className="cluster-topology__node-glow" aria-hidden="true" />

                    <span className="cluster-topology__node-icon">
                      {node.kind === "client" ? (
                        <Laptop aria-hidden="true" width={18} height={18} />
                      ) : (
                        <Server aria-hidden="true" width={18} height={18} />
                      )}
                    </span>
                    <span className="cluster-topology__node-main">
                      <em>{node.kind}</em>
                      <strong>{node.label}</strong>
                      <small>{node.gateway}</small>
                    </span>
                    <span className="cluster-topology__node-load">
                      <span>{node.cpu}%</span>
                      <span>{node.memory}%</span>
                    </span>

                    {/* Health micro-gauges */}
                    {node.kind === "silo" && (
                      <span className="cluster-topology__node-gauges" aria-hidden="true">
                        <span
                          className="cluster-topology__node-gauge cluster-topology__node-gauge--cpu"
                          style={{ width: `${node.cpu}%` }}
                        />
                        <span
                          className="cluster-topology__node-gauge cluster-topology__node-gauge--memory"
                          style={{ width: `${node.memory}%` }}
                        />
                      </span>
                    )}

                    {/* Silo class tag */}
                    {node.kind === "silo" && node.siloClass && (
                      <span className="cluster-topology__node-class">
                        {node.siloClass}
                      </span>
                    )}

                    {/* Client pulse ring */}
                    {node.kind === "client" && (
                      <span className="cluster-topology__client-pulse" aria-hidden="true" />
                    )}

                    {/* Grain constellation groups */}
                    {node.kind === "silo" && node.grainGroups.length > 0 && (
                      <span className="cluster-topology__node-grains">
                        {node.grainGroups.slice(0, 4).map((group) => (
                          <span key={group.label} className="cluster-topology__grain-chip">
                            <GrainShapeIcon keyType={group.keyType} />
                            <span className="cluster-topology__grain-label">{group.label}</span>
                            <strong>{group.count}</strong>
                          </span>
                        ))}
                      </span>
                    )}
                  </button>
                ))}
              </>
            )}
          </div>

          {selectedNode && (
            <SiloInspector
              node={selectedNode}
              requestEvents={topology.requestEvents.filter(
                (event) =>
                  event.sourceId === selectedNode.id ||
                  event.targetId === selectedNode.id,
              )}
            />
          )}
        </div>
      )}
    </section>
  );
}

function GrainShapeIcon({ keyType }: { keyType: GrainKeyType }) {
  if (keyType === "Guid") {
    return <span className="cluster-topology__grain-shape cluster-topology__grain-shape--guid" aria-hidden="true" />;
  }
  if (keyType === "Integer") {
    return <span className="cluster-topology__grain-shape cluster-topology__grain-shape--integer" aria-hidden="true" />;
  }
  return <span className="cluster-topology__grain-shape cluster-topology__grain-shape--string" aria-hidden="true" />;
}

function SiloInspector({
  node,
  requestEvents,
}: {
  node: SiloTopologyNode;
  requestEvents: TopologyRequestEvent[];
}) {
  return (
    <aside
      className="cluster-topology__inspector"
      aria-label="Selected silo telemetry"
    >
      <div className="cluster-topology__inspector-heading">
        <span>
          <RadioTower aria-hidden="true" width={14} height={14} />
          {node.label}
        </span>
        <StatusPill status={node.status} />
      </div>

      <dl className="cluster-topology__host-facts">
        <Fact
          label={node.kind === "client" ? "Client address" : "Internal address"}
          value={node.address}
        />
        <Fact label="Gateway" value={node.gateway} />
        <Fact label="Uptime" value={`${node.uptimeHours}h`} />
        <Fact label="Clients" value={String(node.clientConnections)} />
      </dl>

      {node.kind === "silo" ? (
        <>
          <div className="cluster-topology__resource-stack">
            <ResourceMeter
              Icon={Cpu}
              label="CPU"
              value={node.cpu}
              status={node.status}
            />
            <ResourceMeter
              Icon={HardDrive}
              label="Memory"
              value={node.memory}
              status={node.status}
            />
          </div>

          <section className="cluster-topology__grain-groups">
            <div className="cluster-topology__section-title">
              <Database aria-hidden="true" width={14} height={14} />
              Actor placement
            </div>
            {node.grainGroups.length > 0 ? (
              node.grainGroups.map((group) => (
                <div className="cluster-topology__grain-row" key={group.label}>
                  <span className="cluster-topology__grain-row-meta">
                    <GrainShapeIcon keyType={group.keyType} />
                    <span>{group.label}</span>
                  </span>
                  <strong>{group.count}</strong>
                </div>
              ))
            ) : (
              <div className="cluster-topology__empty">
                No discovered grain interfaces on this silo.
              </div>
            )}
          </section>
        </>
      ) : (
        <div className="cluster-topology__empty">
          This Orleans client is connected through the listed gateway and is the
          source of topology sampling.
        </div>
      )}

      <section className="cluster-topology__request-log">
        <div className="cluster-topology__section-title">
          <Network aria-hidden="true" width={14} height={14} />
          Recent requests
        </div>
        {requestEvents.length > 0 ? (
          requestEvents
            .slice(-8)
            .reverse()
            .map((event) => (
              <div
                className={`cluster-topology__request-row ${event.isSuccess ? "cluster-topology__request-row--success" : "cluster-topology__request-row--failure"}`}
                key={event.id}
                title={event.message ?? undefined}
              >
                <span>{event.grainType}</span>
                <small>{event.methodName}</small>
                <strong>{event.isSuccess ? "ok" : "fail"}</strong>
                <em>{formatMs(event.latencyMs)}</em>
              </div>
            ))
        ) : (
          <div className="cluster-topology__empty">
            No observed requests for this node yet.
          </div>
        )}
      </section>
    </aside>
  );
}

function TopologyGuideRings() {
  return (
    <g className="cluster-topology__guide" aria-hidden="true">
      <rect x="0" y="0" width={graphWidth} height={graphHeight} />
      <circle
        className="cluster-topology__zone cluster-topology__zone--outer"
        cx="480"
        cy="280"
        r="238"
      />
      <circle
        className="cluster-topology__zone cluster-topology__zone--inner"
        cx="480"
        cy="280"
        r="142"
      />
      <path className="cluster-topology__axis" d="M 480 42 L 480 518" />
      <path className="cluster-topology__axis" d="M 128 280 L 832 280" />
      <path
        className="cluster-topology__mesh"
        d="M 248 280 C 326 158 634 158 712 280 C 634 402 326 402 248 280 Z"
      />
      <path
        className="cluster-topology__mesh"
        d="M 480 78 C 610 164 610 396 480 482 C 350 396 350 164 480 78 Z"
      />
    </g>
  );
}

function TopologyEmptyState({
  compact = false,
  hasWorkspace,
  isConnected,
}: {
  compact?: boolean;
  hasWorkspace: boolean;
  isConnected: boolean;
}) {
  const title = !hasWorkspace
    ? "No cluster selected"
    : isConnected
      ? "Waiting for topology data"
      : "No topology data";
  const message = !hasWorkspace
    ? "Load or create a cluster workspace to inspect Orleans silos, links, and actor placement."
    : isConnected
      ? "Discover grains or invoke a request to populate backend telemetry for this cluster."
      : "Connect the cluster or discover sources to build a topology snapshot.";

  return (
    <div
      className={`cluster-topology__empty-state ${compact ? "cluster-topology__empty-state--compact" : ""}`}
    >
      <div className="cluster-topology__empty-icon">
        {isConnected ? (
          <Network aria-hidden="true" width={24} height={24} />
        ) : (
          <AlertTriangle aria-hidden="true" width={24} height={24} />
        )}
      </div>
      <strong>{title}</strong>
      <span>{message}</span>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function StatusPill({ status }: { status: TopologyStatus }) {
  return (
    <span
      className={`cluster-topology__status cluster-topology__status--${status}`}
    >
      {status}
    </span>
  );
}

function ResourceMeter({
  Icon,
  label,
  value,
  status,
}: {
  Icon: typeof Cpu;
  label: string;
  value: number;
  status: TopologyStatus;
}) {
  return (
    <div className="cluster-topology__resource">
      <div>
        <Icon aria-hidden="true" width={14} height={14} />
        <span>{label}</span>
        <strong>{value}%</strong>
      </div>
      <span
        aria-label={`${label}: ${value}%`}
        className={`cluster-topology__meter cluster-topology__meter--${status}`}
        role="img"
      >
        <span style={{ width: `${value}%` }} />
      </span>
    </div>
  );
}

function buildClusterTopologyFromSnapshot(
  snapshot: ClusterTopologySnapshot,
  layout: TopologyLayout,
  sourceCatalog: SourceOwnedCatalog,
): ClusterTopology {
  const siloNodes: SiloTopologyNode[] = snapshot.silos.map((silo) => ({
    id: silo.siloId,
    kind: "silo",
    label: silo.name,
    address: silo.host.address,
    gateway: silo.gateway ?? "unassigned",
    x: 0,
    y: 0,
    cpu: Math.round(silo.resources.cpuPercent),
    memory: Math.round(silo.resources.memoryPercent),
    uptimeHours: Math.max(Math.round(silo.host.uptimeSeconds / 3600), 0),
    clientConnections: silo.host.clientConnections,
    status: toTopologyStatus(silo.status),
    grainCount: silo.grains.reduce((sum, grain) => sum + grain.count, 0),
    grainGroups: silo.grains.map((grain) => ({
      label: grain.grainType,
      count: grain.count,
      keyType: inferGrainKeyType(grain.grainType, sourceCatalog),
    })),
    siloClass: silo.host.clientConnections > 0 ? "Primary Gateway" : "Active Worker Node",
  }));
  const clientNodes: SiloTopologyNode[] = snapshot.clients.map((client) => ({
    id: client.clientId,
    kind: "client",
    label: client.name,
    address: client.address,
    gateway: client.gateway ?? "unassigned",
    x: 0,
    y: 0,
    cpu: 0,
    memory: 0,
    uptimeHours: 0,
    clientConnections: client.connectedSiloIds.length,
    status: toTopologyStatus(client.status),
    grainCount: 0,
    grainGroups: [],
  }));
  const edges = snapshot.connections.map((connection) => ({
    id: connection.connectionId,
    sourceId: connection.sourceSiloId,
    targetId: connection.targetSiloId,
    latencyMs: connection.latencyMs,
    status: toTopologyStatus(connection.status),
    isSpiking: connection.isSpiking,
  }));
  const nodes = applyLayout([...siloNodes, ...clientNodes], layout, edges);
  const requestEvents: TopologyRequestEvent[] = snapshot.requestEvents.map(
    (event) => ({
      id: event.eventId,
      sourceId: event.sourceId,
      targetId: event.targetSiloId,
      grainType: event.grainType,
      methodName: event.methodName,
      isSuccess: event.isSuccess,
      latencyMs: event.latencyMs,
      message: event.message ?? null,
      observedAt: event.observedAt,
    }),
  );
  const edgeLatencies = edges.map((edge) => edge.latencyMs);

  return {
    nodes,
    edges,
    requestEvents,
    hasBackendSnapshot: true,
    summary: {
      totalGrains: nodes.reduce((sum, node) => sum + node.grainCount, 0),
      activeSilos: siloNodes.length,
      clients: clientNodes.length,
      requests: requestEvents.length,
      failures: requestEvents.filter((event) => !event.isSuccess).length,
      averageLatencyMs:
        edgeLatencies.length > 0
          ? edgeLatencies.reduce((sum, value) => sum + value, 0) /
            edgeLatencies.length
          : 0,
      spikeCount: edges.filter((edge) => edge.isSpiking).length,
    },
  };
}

function emptyClusterTopology(): ClusterTopology {
  return {
    nodes: [],
    edges: [],
    requestEvents: [],
    hasBackendSnapshot: false,
    summary: {
      totalGrains: 0,
      activeSilos: 0,
      clients: 0,
      requests: 0,
      failures: 0,
      averageLatencyMs: 0,
      spikeCount: 0,
    },
  };
}

function applyLayout(
  nodes: SiloTopologyNode[],
  layout: TopologyLayout,
  edges: TopologyEdge[] = [],
): SiloTopologyNode[] {
  if (nodes.length === 0) {
    return [];
  }

  if (layout === "grid") {
    const columns = Math.ceil(Math.sqrt(nodes.length));
    const rows = Math.ceil(nodes.length / columns);
    return nodes.map((node, index) => ({
      ...node,
      x: ((index % columns) + 1) * (graphWidth / (columns + 1)),
      y: (Math.floor(index / columns) + 1) * (graphHeight / (rows + 1)),
    }));
  }

  if (layout === "focus") {
    const primarySilo = nodes.find((node) => node.kind === "silo") ?? nodes[0];
    return nodes.map((node, index) => {
      if (node.id === primarySilo.id) {
        return { ...node, x: graphWidth / 2, y: graphHeight / 2 };
      }

      const angle =
        (index / Math.max(1, nodes.length)) * Math.PI * 2 - Math.PI / 2;
      return {
        ...node,
        x: graphWidth / 2 + Math.cos(angle) * 300,
        y: graphHeight / 2 + Math.sin(angle) * 190,
      };
    });
  }

  const silos = nodes.filter((node) => node.kind === "silo");
  const clients = nodes.filter((node) => node.kind === "client");
  const siloAngles = new Map<string, number>();
  const clientOffsets = new Map<string, number>();
  const arrangedSilos = silos.map((node, index) => {
    const angle = getTopologyAngle(index, silos.length, "silo");
    siloAngles.set(node.id, angle);

    return {
      ...node,
      x: graphWidth / 2 + Math.cos(angle) * 230,
      y: graphHeight / 2 + Math.sin(angle) * 178,
    };
  });

  const arrangedClients = clients.map((node, index) => {
    const connectedSiloId = edges.find(
      (edge) => edge.sourceId === node.id,
    )?.targetId;
    const siloAngle = connectedSiloId
      ? siloAngles.get(connectedSiloId)
      : undefined;
    const baseAngle =
      siloAngle ?? getTopologyAngle(index, clients.length, "client");
    const siblingIndex =
      clientOffsets.get(connectedSiloId ?? "unassigned") ?? 0;
    clientOffsets.set(connectedSiloId ?? "unassigned", siblingIndex + 1);
    const fanOffset =
      siblingIndex === 0
        ? node.gateway.endsWith("1")
          ? 0.32
          : -0.32
        : (siblingIndex % 2 === 0 ? -1 : 1) *
          0.24 *
          Math.ceil(siblingIndex / 2);
    const angle = baseAngle + fanOffset;

    return {
      ...node,
      x: graphWidth / 2 + Math.cos(angle) * 390,
      y: graphHeight / 2 + Math.sin(angle) * 232,
    };
  });

  return [...arrangedSilos, ...arrangedClients];
}

function getTopologyAngle(
  index: number,
  count: number,
  kind: "client" | "silo" = "silo",
): number {
  if (count <= 1) {
    return kind === "client" ? -Math.PI / 2 : Math.PI / 2;
  }

  if (count === 2) {
    return index === 0 ? (5 * Math.PI) / 4 : (7 * Math.PI) / 4;
  }

  if (count === 3) {
    return [-Math.PI / 2, (5 * Math.PI) / 6, Math.PI / 6][index] ?? 0;
  }

  return (Math.PI * 2 * index) / count - Math.PI / 2;
}

function getEdgePath(
  source: SiloTopologyNode,
  target: SiloTopologyNode,
): string {
  const centerX = graphWidth / 2;
  const centerY = graphHeight / 2;
  const sourceAngle = Math.atan2(source.y - centerY, source.x - centerX);
  const targetAngle = Math.atan2(target.y - centerY, target.x - centerX);
  const sourcePort = {
    x: centerX + Math.cos(sourceAngle) * 126,
    y: centerY + Math.sin(sourceAngle) * 82,
  };
  const targetPort = {
    x: centerX + Math.cos(targetAngle) * 126,
    y: centerY + Math.sin(targetAngle) * 82,
  };

  return [
    `M ${source.x.toFixed(1)} ${source.y.toFixed(1)}`,
    `C ${sourcePort.x.toFixed(1)} ${source.y.toFixed(1)} ${sourcePort.x.toFixed(1)} ${sourcePort.y.toFixed(1)} ${sourcePort.x.toFixed(1)} ${sourcePort.y.toFixed(1)}`,
    `C ${centerX.toFixed(1)} ${centerY.toFixed(1)} ${centerX.toFixed(1)} ${centerY.toFixed(1)} ${targetPort.x.toFixed(1)} ${targetPort.y.toFixed(1)}`,
    `C ${targetPort.x.toFixed(1)} ${target.y.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)} ${target.x.toFixed(1)} ${target.y.toFixed(1)}`,
  ].join(" ");
}

function getEdgeLabelPoint(
  source: SiloTopologyNode,
  target: SiloTopologyNode,
): { x: number; y: number } {
  return {
    x: (source.x + target.x + graphWidth) / 3,
    y: (source.y + target.y + graphHeight) / 3 - 10,
  };
}

function getTopologyDescription(
  workspace: Workspace | null,
  isConnected: boolean,
  telemetrySnapshot: ClusterTopologySnapshot | null,
): string {
  if (!workspace) {
    return "Load a cluster workspace to inspect runtime topology.";
  }

  if (telemetrySnapshot?.isLive) {
    return "Using backend telemetry from observed invocations and host resource counters.";
  }

  return isConnected
    ? "Using available backend snapshots and discovered catalog metadata."
    : "Connect the cluster to start collecting live topology telemetry.";
}

function toTopologyStatus(status: string): TopologyStatus {
  if (status === "warning" || status === "critical") {
    return status;
  }

  return "healthy";
}

function formatMs(value: number): string {
  return value > 0 ? `${value.toFixed(value < 10 ? 1 : 0)} ms` : "0 ms";
}
