import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronRight,
  FolderOpen,
  FolderSearch,
  Import,
  Loader2,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { NugetFeed, NugetPackage } from "../../../feeds/schema";
import type {
  ClusterConnectionProvider,
  ClusterType,
  Workspace,
  WorkspaceSource,
} from "../../schema";
import { workspaceSchema } from "../../schema";
import "./workspaces-page.css";

type ClusterConnectionMode = "Local" | ClusterConnectionProvider;

const CLUSTER_CONNECTION_OPTIONS: Array<{
  value: ClusterConnectionMode;
  label: string;
  placeholder: string;
}> = [
  { value: "Local", label: "Local gateways", placeholder: "127.0.0.1:30000" },
  {
    value: "Redis",
    label: "Redis",
    placeholder: "127.0.0.1:6379,defaultDatabase=0",
  },
  {
    value: "AdoNet",
    label: "ADO.NET",
    placeholder: "Server=.;Database=Orleans;Integrated Security=true",
  },
  {
    value: "AzureStorage",
    label: "Azure Storage",
    placeholder: "UseDevelopmentStorage=true",
  },
  {
    value: "Cosmos",
    label: "Cosmos DB",
    placeholder: "AccountEndpoint=https://...;AccountKey=...",
  },
  { value: "Consul", label: "Consul", placeholder: "http://127.0.0.1:8500" },
  {
    value: "DynamoDB",
    label: "DynamoDB",
    placeholder: "ServiceURL=http://localhost:8000",
  },
  { value: "ZooKeeper", label: "ZooKeeper", placeholder: "127.0.0.1:2181" },
  {
    value: "Cassandra",
    label: "Cassandra",
    placeholder: "Contact Points=127.0.0.1;Port=9042",
  },
];

const PROVIDER_OPTION_KEYS = {
  Redis: "redis",
  AdoNet: "adoNet",
  AzureStorage: "azureStorage",
  Cosmos: "cosmos",
  Consul: "consul",
  DynamoDB: "dynamoDB",
  ZooKeeper: "zooKeeper",
  Cassandra: "cassandra",
} as const satisfies Record<
  ClusterConnectionProvider,
  keyof NonNullable<Workspace["clustering"]>
>;

type WorkspacesPageProps = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (workspace: Workspace) => void;
  onUpdateWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onLoadWorkspace: () => Promise<void>;
  onSaveWorkspace: () => Promise<void>;
  onPickFile: (options?: {
    allowedFileTypes?: string;
    canChooseFiles?: boolean;
    canChooseDirectory?: boolean;
    allowsMultipleSelection?: boolean;
  }) => void;
  nugetFeeds: NugetFeed[];
  searchNugetPackages: (
    query: string,
    feedName?: string,
    take?: number,
  ) => Promise<NugetPackage[]>;
  getNugetPackageVersions: (
    packageId: string,
    feedName?: string,
  ) => Promise<string[]>;
};

export function WorkspacesPage({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onLoadWorkspace,
  onPickFile,
  nugetFeeds,
  searchNugetPackages,
  getNugetPackageVersions,
}: WorkspacesPageProps) {
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(
    null,
  );
  const [showCreateForm, setShowCreateForm] = useState(false);
  const isCreating = editingWorkspace === null;

  // Reset editor when the edited workspace is deleted
  useEffect(() => {
    if (
      editingWorkspace &&
      !workspaces.some((w) => w.id === editingWorkspace.id)
    ) {
      setEditingWorkspace(null);
      setShowCreateForm(false);
    }
  }, [workspaces, editingWorkspace]);

  // Auto-show the create form when there are no clusters and user clicks New
  useEffect(() => {
    if (workspaces.length === 0) {
      setEditingWorkspace(null);
      setShowCreateForm(false);
    }
  }, [workspaces.length]);

  const handleCreateNew = useCallback(() => {
    setEditingWorkspace(null);
    setShowCreateForm(true);
  }, []);

  const handleEdit = useCallback((workspace: Workspace) => {
    setEditingWorkspace(workspace);
    setShowCreateForm(true);
  }, []);

  const handleActivate = useCallback(
    (workspaceId: string) => {
      onSelectWorkspace(workspaceId);
    },
    [onSelectWorkspace],
  );

  const [deleteFeedback, setDeleteFeedback] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  useEffect(() => {
    if (!deleteFeedback) return;
    const timer = setTimeout(() => setDeleteFeedback(null), 2500);
    return () => clearTimeout(timer);
  }, [deleteFeedback]);

  const handleDelete = useCallback(
    (workspaceId: string) => {
      try {
        onDeleteWorkspace(workspaceId);
        setDeleteFeedback({
          type: "success",
          message: "Cluster deleted",
        });
      } catch (error) {
        setDeleteFeedback({
          type: "error",
          message:
            error instanceof Error
              ? error.message
              : "Failed to delete cluster",
        });
      }
    },
    [onDeleteWorkspace],
  );

  return (
    <section className="workspaces-page" aria-label="Clusters">
      {workspaces.length === 0 && !showCreateForm ? (
        /* ── Empty state ── */
        <div className="workspaces-page__empty-full">
          <div className="workspaces-page__empty-icon">
            <Briefcase aria-hidden="true" width={28} height={28} />
          </div>
          <h3>No clusters yet</h3>
          <p>
            Create a cluster to connect to an Orleans silo, discover grain
            interfaces, and invoke grain methods.
          </p>
          <button
            className="workspaces-page__empty-action"
            onClick={handleCreateNew}
            type="button"
          >
            <Plus aria-hidden="true" width={15} height={15} />
            Create your first cluster
          </button>
        </div>
      ) : (
        <>
          {/* ── Sidebar ── */}
          <aside className="workspaces-page__sidebar" aria-label="Clusters">
            <div className="workspaces-page__sidebar-header">
              <span>
                {workspaces.length}{" "}
                {workspaces.length === 1 ? "cluster" : "clusters"}
              </span>
              <button
                className="workspaces-page__create-btn"
                onClick={handleCreateNew}
                type="button"
                aria-label="Create new cluster"
              >
                <Plus aria-hidden="true" width={14} height={14} />
              </button>
            </div>
            <button
              className="workspaces-page__import-btn"
              onClick={() => void onLoadWorkspace()}
              type="button"
            >
              <Import aria-hidden="true" width={12} height={12} />
              Import
            </button>
            <ul className="workspaces-page__list" role="list">
              {workspaces.map((ws) => (
                <li
                  key={ws.id}
                  className={`workspaces-page__list-item${editingWorkspace?.id === ws.id ? " workspaces-page__list-item--selected" : ""}${activeWorkspace?.id === ws.id ? " workspaces-page__list-item--current" : ""}`}
                >
                  <button
                    className="workspaces-page__list-button"
                    onClick={() => handleEdit(ws)}
                    type="button"
                  >
                    <span className="workspaces-page__list-icon">
                      {activeWorkspace?.id === ws.id ? (
                        <CheckCircle2
                          aria-hidden="true"
                          width={15}
                          height={15}
                        />
                      ) : (
                        <ChevronRight
                          aria-hidden="true"
                          width={15}
                          height={15}
                        />
                      )}
                    </span>
                    <span className="workspaces-page__list-name">
                      {ws.name}
                    </span>
                    <span className="workspaces-page__list-meta">
                      {ws.clusterId || ws.siloAddress}
                    </span>
                  </button>
                  <div className="workspaces-page__list-actions">
                    <button
                      aria-label={`Activate ${ws.name}`}
                      className="workspaces-page__list-action"
                      onClick={() => handleActivate(ws.id)}
                      title="Activate"
                      type="button"
                    >
                      <FolderOpen aria-hidden="true" width={12} height={12} />
                    </button>
                    <button
                      aria-label={`Delete ${ws.name}`}
                      className="workspaces-page__list-action workspaces-page__list-action--danger"
                      onClick={() => handleDelete(ws.id)}
                      title="Delete"
                      type="button"
                    >
                      <Trash2 aria-hidden="true" width={12} height={12} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </aside>

          {/* ── Form area ── */}
          <div className="workspaces-page__form-area">
            <WorkspaceForm
              key={isCreating ? "create" : (editingWorkspace?.id ?? "create")}
              initialWorkspace={editingWorkspace}
              isCreating={isCreating}
              workspacesCount={workspaces.length}
              deleteFeedback={deleteFeedback}
              onSave={(ws) => {
                setEditingWorkspace(ws);
                setShowCreateForm(false);
                (isCreating ? onCreateWorkspace : onUpdateWorkspace)(ws);
              }}
              onPickFile={onPickFile}
              nugetFeeds={nugetFeeds}
              searchNugetPackages={searchNugetPackages}
              getNugetPackageVersions={getNugetPackageVersions}
            />
          </div>
        </>
      )}
    </section>
  );
}

function getClusterConnectionString(workspace: Workspace | null): string {
  const provider = workspace?.clustering?.provider;
  if (!provider) return "127.0.0.1:6379,defaultDatabase=0";

  const key = PROVIDER_OPTION_KEYS[provider];
  const options = workspace.clustering?.[key];
  return options?.connectionString ?? "";
}

function getAdoNetInvariant(workspace: Workspace | null): string {
  return workspace?.clustering?.adoNet?.invariant ?? "Npgsql";
}

function buildClusterConnection(
  provider: ClusterConnectionProvider,
  connectionString: string,
  adoNetInvariant: string,
): NonNullable<Workspace["clustering"]> {
  const key = PROVIDER_OPTION_KEYS[provider];
  return {
    provider,
    [key]: {
      connectionString,
      invariant: provider === "AdoNet" ? adoNetInvariant || "Npgsql" : null,
    },
  };
}

function WorkspaceForm({
  initialWorkspace,
  isCreating,
  workspacesCount,
  onSave,
  onPickFile,
  nugetFeeds,
  searchNugetPackages,
  getNugetPackageVersions,
  deleteFeedback,
}: {
  initialWorkspace: Workspace | null;
  isCreating: boolean;
  workspacesCount: number;
  deleteFeedback: {
    type: "success" | "error";
    message: string;
  } | null;
  onSave: (workspace: Workspace) => void;
  onPickFile: (options?: {
    allowedFileTypes?: string;
    canChooseFiles?: boolean;
    canChooseDirectory?: boolean;
    allowsMultipleSelection?: boolean;
  }) => void;
  nugetFeeds: NugetFeed[];
  searchNugetPackages: (
    query: string,
    feedName?: string,
    take?: number,
  ) => Promise<NugetPackage[]>;
  getNugetPackageVersions: (
    packageId: string,
    feedName?: string,
  ) => Promise<string[]>;
}) {
  const [name, setName] = useState(
    initialWorkspace?.name ?? "Untitled Cluster",
  );
  const [description, setDescription] = useState(
    initialWorkspace?.description ?? "",
  );
  const [clusterType, setClusterType] = useState<ClusterType>(
    initialWorkspace?.clusterType ?? "Homogenous",
  );
  const initialClusterConnection =
    initialWorkspace?.clustering?.provider ?? "Local";
  const [clusterConnection, setClusterConnection] =
    useState<ClusterConnectionMode>(initialClusterConnection);
  const [clusterConnectionString, setClusterConnectionString] = useState(
    getClusterConnectionString(initialWorkspace),
  );
  const [adoNetInvariant, setAdoNetInvariant] = useState(
    getAdoNetInvariant(initialWorkspace),
  );
  const [clusterId, setClusterId] = useState(
    initialWorkspace?.clusterId ?? "dev",
  );
  const [serviceId, setServiceId] = useState(
    initialWorkspace?.serviceId ?? "SiloScope",
  );
  const [gatewayEndpoint, setGatewayEndpoint] = useState(
    initialWorkspace?.gatewayEndpoints?.[0] ?? "127.0.0.1:30000",
  );
  const [sources, setSources] = useState<WorkspaceSource[]>(
    initialWorkspace?.sources ?? [],
  );
  const [sourceType, setSourceType] =
    useState<WorkspaceSource["sourceType"]>("DLL");
  const [sourceReference, setSourceReference] = useState("");
  const [sourceVersion, setSourceVersion] = useState("");
  const [sourceGateway, setSourceGateway] = useState("");
  const [sourceFeed, setSourceFeed] = useState("");
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "success" | "error"
  >("idle");
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auto-clear save success after a delay
  useEffect(() => {
    if (saveStatus !== "success") return;
    const timer = setTimeout(() => setSaveStatus("idle"), 2000);
    return () => clearTimeout(timer);
  }, [saveStatus]);

  useEffect(() => {
    setName(initialWorkspace?.name ?? "Untitled Cluster");
    setDescription(initialWorkspace?.description ?? "");
    setClusterType(initialWorkspace?.clusterType ?? "Homogenous");
    setClusterConnection(initialWorkspace?.clustering?.provider ?? "Local");
    setClusterConnectionString(getClusterConnectionString(initialWorkspace));
    setAdoNetInvariant(getAdoNetInvariant(initialWorkspace));
    setClusterId(initialWorkspace?.clusterId ?? "dev");
    setServiceId(initialWorkspace?.serviceId ?? "SiloScope");
    setGatewayEndpoint(
      initialWorkspace?.gatewayEndpoints?.[0] ?? "127.0.0.1:30000",
    );
    setSources(initialWorkspace?.sources ?? []);
    setSourceType("DLL");
    setSourceReference("");
    setSourceVersion("");
    setSourceGateway("");
    setSourceFeed("");
    setValidationErrors([]);
  }, [initialWorkspace]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ paths: string[] }>) => {
      const first = e.detail.paths.find((p) => p.trim().length > 0);
      if (first) {
        setSourceReference(first.trim());
      }
    };
    window.addEventListener("filePicked", handler as EventListener);
    return () =>
      window.removeEventListener("filePicked", handler as EventListener);
  }, []);

  const requiresSourceGateways =
    clusterConnection === "Local" && clusterType === "Heterogeneous";
  const selectedConnectionOption =
    CLUSTER_CONNECTION_OPTIONS.find(
      (option) => option.value === clusterConnection,
    ) ?? CLUSTER_CONNECTION_OPTIONS[0];
  const canAddSource =
    Boolean(sourceReference.trim()) &&
    (sourceType !== "NuGet" || Boolean(sourceVersion.trim())) &&
    (!requiresSourceGateways || Boolean(sourceGateway.trim()));
  const hasMissingSourceGateways =
    requiresSourceGateways && sources.some((source) => !source.gateway?.trim());
  const hasMissingNuGetVersions = sources.some(
    (s) => s.sourceType === "NuGet" && !s.version?.trim(),
  );
  const sourceFormClassName = [
    "workspace-form__source-form",
    sourceType === "NuGet"
      ? "workspace-form__source-form--nuget"
      : "workspace-form__source-form--dll",
    requiresSourceGateways ? "workspace-form__source-form--gateway" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const addSource = () => {
    const reference = sourceReference.trim();
    if (!reference) return;
    if (sourceType === "NuGet" && !sourceVersion.trim()) return;
    if (requiresSourceGateways && !sourceGateway.trim()) return;

    const source: WorkspaceSource = {
      sourceId: `${sourceType}:${reference}:${sourceVersion.trim()}:${sourceGateway.trim()}`,
      sourceType,
      reference,
      label:
        sourceType === "DLL"
          ? reference.split(/[\\/]/).pop() || reference
          : reference,
      version: sourceType === "NuGet" ? sourceVersion.trim() || null : null,
      feedName: sourceType === "NuGet" ? sourceFeed || null : null,
      gateway: requiresSourceGateways ? sourceGateway.trim() || null : null,
      enabled: true,
    };

    setSources((current) => [...current, source]);
    setSourceReference("");
    setSourceVersion("");
    setSourceGateway("");
  };

  const handleSave = async () => {
    const [siloAddress, portRaw] = gatewayEndpoint.split(":");
    const gatewayPort = Number(portRaw);
    const workspace: Workspace = {
      // Use crypto.randomUUID() for stable folder identity (never changes)
      id: initialWorkspace?.id ?? crypto.randomUUID(),
      name: name.trim() || "Untitled Cluster",
      description: description.trim() || null,
      siloAddress: siloAddress || "127.0.0.1",
      gatewayPort: Number.isFinite(gatewayPort) ? gatewayPort : 30000,
      orleansVersion: "10.0",
      clusterId: clusterId.trim() || "dev",
      serviceId: serviceId.trim() || "SiloScope",
      clusterType,
      clustering:
        clusterConnection !== "Local"
          ? buildClusterConnection(
              clusterConnection,
              clusterConnectionString.trim(),
              adoNetInvariant.trim(),
            )
          : null,
      gatewayEndpoints:
        clusterConnection === "Local" &&
        clusterType === "Homogenous" &&
        gatewayEndpoint.trim()
          ? [gatewayEndpoint.trim()]
          : [],
      sources: sources.map((source) => ({
        ...source,
        gateway: clusterConnection === "Local" ? source.gateway : null,
      })),
    };

    // Validate before saving
    const result = workspaceSchema.safeParse(workspace);
    if (!result.success) {
      setValidationErrors(
        result.error.issues.map(
          (issue) => `${issue.path.join(".") || "form"}: ${issue.message}`,
        ),
      );
      setSaveStatus("error");
      setSaveError("Validation failed. Check the errors above.");
      return;
    }
    setValidationErrors([]);
    setSaveStatus("saving");
    setSaveError(null);

    try {
      onSave(result.data);
      setSaveStatus("success");
    } catch (error) {
      setSaveStatus("error");
      setSaveError(
        error instanceof Error ? error.message : "Failed to save cluster",
      );
    }
  };

  return (
    <div className="workspace-form">
      {/* Page header */}
      <div className="workspace-form__page-header">
        <h2 className="workspace-form__page-title">Clusters</h2>
        <p className="workspace-form__page-subtitle">
          {isCreating
            ? "Create a new cluster to connect to an Orleans silo and discover grain interfaces."
            : `Configure connection and silo sources for ${name || initialWorkspace?.name || "this cluster"}.`}
        </p>
      </div>

      {validationErrors.length > 0 && (
        <div className="workspace-form__errors" role="alert">
          <ul>
            {validationErrors.map((err) => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="workspace-form__grid">
        {/* Identity card */}
        <section className="workspace-form__card" aria-label="Cluster identity">
          <div className="workspace-form__card-header">
            <h3 className="workspace-form__card-title">Identity</h3>
          </div>
          <div className="workspace-form__card-body">
            <label className="workspace-form__field">
              <span className="workspace-form__label">Name</span>
              <input
                aria-label="Cluster name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Production Cluster"
              />
            </label>
            <label className="workspace-form__field">
              <span className="workspace-form__label">Description</span>
              <input
                aria-label="Cluster description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
              />
            </label>
          </div>
        </section>

        {/* Connection card */}
        <section
          className="workspace-form__card"
          aria-label="Cluster connection"
        >
          <div className="workspace-form__card-header">
            <h3 className="workspace-form__card-title">Connection</h3>
          </div>
          <div className="workspace-form__card-body">
            <label className="workspace-form__field">
              <span className="workspace-form__label">Cluster type</span>
              <select
                aria-label="Cluster type"
                value={clusterType}
                onChange={(e) => setClusterType(e.target.value as ClusterType)}
              >
                <option value="Homogenous">Homogeneous</option>
                <option value="Heterogeneous">Heterogeneous</option>
              </select>
            </label>
            <label className="workspace-form__field">
              <span className="workspace-form__label">Cluster connection</span>
              <select
                aria-label="Cluster connection"
                value={clusterConnection}
                onChange={(e) =>
                  setClusterConnection(e.target.value as ClusterConnectionMode)
                }
              >
                {CLUSTER_CONNECTION_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            {clusterConnection !== "Local" && (
              <label className="workspace-form__field">
                <span className="workspace-form__label">Connection string</span>
                <input
                  aria-label={`${selectedConnectionOption.label} connection string`}
                  placeholder={selectedConnectionOption.placeholder}
                  value={clusterConnectionString}
                  onChange={(e) => setClusterConnectionString(e.target.value)}
                />
              </label>
            )}
            {clusterConnection === "AdoNet" && (
              <label className="workspace-form__field">
                <span className="workspace-form__label">ADO.NET invariant</span>
                <select
                  aria-label="ADO.NET invariant"
                  value={adoNetInvariant}
                  onChange={(e) => setAdoNetInvariant(e.target.value)}
                >
                  <option value="Npgsql">PostgreSQL</option>
                  <option value="Microsoft.Data.SqlClient">SQL Server</option>
                </select>
              </label>
            )}
            <div className="workspace-form__field-row">
              <label className="workspace-form__field">
                <span className="workspace-form__label">Cluster ID</span>
                <input
                  aria-label="Cluster ID"
                  value={clusterId}
                  onChange={(e) => setClusterId(e.target.value)}
                />
              </label>
              <label className="workspace-form__field">
                <span className="workspace-form__label">Service ID</span>
                <input
                  aria-label="Service ID"
                  value={serviceId}
                  onChange={(e) => setServiceId(e.target.value)}
                />
              </label>
            </div>
            {clusterConnection === "Local" && clusterType === "Homogenous" && (
              <label className="workspace-form__field">
                <span className="workspace-form__label">Gateway</span>
                <input
                  aria-label="Gateway endpoint"
                  value={gatewayEndpoint}
                  onChange={(e) => setGatewayEndpoint(e.target.value)}
                />
              </label>
            )}
          </div>
        </section>
      </div>

      {/* Silos card — full width */}
      <section
        className="workspace-form__card workspace-form__card--silos"
        aria-label="Silo sources"
      >
        <div className="workspace-form__card-header">
          <h3 className="workspace-form__card-title">Silos</h3>
          <span className="workspace-form__card-badge">
            {sources.length} {sources.length === 1 ? "source" : "sources"}
          </span>
        </div>
        <div className="workspace-form__card-body">
          <div className={sourceFormClassName}>
            <label className="workspace-form__field">
              <span className="workspace-form__label">Type</span>
              <select
                aria-label="Silo type"
                value={sourceType}
                onChange={(e) =>
                  setSourceType(e.target.value as WorkspaceSource["sourceType"])
                }
              >
                <option value="DLL">DLL</option>
                <option value="NuGet">NuGet</option>
              </select>
            </label>
            <label className="workspace-form__field">
              <span className="workspace-form__label">
                {sourceType === "DLL" ? "DLL path" : "Package ID"}
              </span>
              <div className="workspace-form__file-row">
                {sourceType === "DLL" ? (
                  <>
                    <input
                      aria-label="Silo reference"
                      placeholder="/path/to/contracts.dll"
                      value={sourceReference}
                      onChange={(e) => setSourceReference(e.target.value)}
                    />
                    <button
                      aria-label="Browse for DLL"
                      className="workspace-form__browse-btn"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onPickFile({
                          canChooseFiles: true,
                          canChooseDirectory: false,
                          allowsMultipleSelection: false,
                        });
                      }}
                      title="Browse"
                      type="button"
                    >
                      <FolderSearch aria-hidden="true" width={14} height={14} />
                    </button>
                  </>
                ) : (
                  <NuGetPackageSearch
                    value={sourceReference}
                    onChange={setSourceReference}
                    onFeedChange={setSourceFeed}
                    feeds={nugetFeeds}
                    searchNugetPackages={searchNugetPackages}
                  />
                )}
              </div>
            </label>
            {sourceType === "NuGet" && (
              <label className="workspace-form__field">
                <span className="workspace-form__label">Version</span>
                <NuGetVersionSearch
                  packageId={sourceReference.trim()}
                  feedName={sourceFeed}
                  value={sourceVersion}
                  onChange={setSourceVersion}
                  getNugetPackageVersions={getNugetPackageVersions}
                />
              </label>
            )}
            {requiresSourceGateways && (
              <label className="workspace-form__field">
                <span className="workspace-form__label">Gateway</span>
                <input
                  aria-label="Silo gateway"
                  value={sourceGateway}
                  onChange={(e) => setSourceGateway(e.target.value)}
                />
              </label>
            )}
            <button
              className="workspace-form__add-btn"
              disabled={!canAddSource}
              onClick={addSource}
              type="button"
            >
              <Plus aria-hidden="true" width={14} height={14} />
              Add Silo
            </button>
          </div>

          {sources.length > 0 ? (
            <ul className="workspace-form__sources" aria-label="Cluster silos">
              {sources.map((source) => (
                <li
                  key={source.sourceId}
                  className="workspace-form__source-row"
                >
                  <div className="workspace-form__source-info">
                    <span className="workspace-form__source-type">
                      {source.sourceType}
                    </span>
                    <strong>{source.label}</strong>
                    <span className="workspace-form__source-meta">
                      {source.version || source.gateway || "Default"}
                    </span>
                  </div>
                  <button
                    aria-label={`Remove ${source.label}`}
                    onClick={() =>
                      setSources((current) =>
                        current.filter((c) => c.sourceId !== source.sourceId),
                      )
                    }
                    title="Remove"
                    type="button"
                  >
                    <X aria-hidden="true" width={13} height={13} />
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="workspace-form__empty">
              No silos added yet. Add a DLL or NuGet package source above.
            </div>
          )}
        </div>
      </section>

      {/* ── Sticky save bar ── */}
      <div
        className={`workspace-form__save-bar${saveStatus === "success" || deleteFeedback?.type === "success" ? " workspace-form__save-bar--success" : ""}${saveStatus === "error" || deleteFeedback?.type === "error" ? " workspace-form__save-bar--error" : ""}`}
      >
        <div className="workspace-form__save-bar-status">
          {deleteFeedback ? (
            <>
              {deleteFeedback.type === "success" ? (
                <CheckCircle2 aria-hidden="true" width={14} height={14} />
              ) : (
                <AlertTriangle aria-hidden="true" width={14} height={14} />
              )}
              <span>{deleteFeedback.message}</span>
            </>
          ) : saveStatus === "success" ? (
            <>
              <CheckCircle2 aria-hidden="true" width={14} height={14} />
              <span>Saved successfully</span>
            </>
          ) : saveStatus === "error" ? (
            <>
              <AlertTriangle aria-hidden="true" width={14} height={14} />
              <span>{saveError ?? "Save failed"}</span>
            </>
          ) : saveStatus === "saving" ? (
            <>
              <Loader2
                aria-hidden="true"
                width={14}
                height={14}
                className="nuget-search__spinner"
              />
              <span>Saving…</span>
            </>
          ) : (
            <span>{isCreating ? "New cluster" : name}</span>
          )}
        </div>
        <div className="workspace-form__save-bar-actions">
          <button
            className="workspace-form__save-btn"
            disabled={
              !name.trim() ||
              (clusterConnection !== "Local" &&
                !clusterConnectionString.trim()) ||
              hasMissingSourceGateways ||
              hasMissingNuGetVersions ||
              saveStatus === "saving"
            }
            onClick={handleSave}
            type="button"
          >
            {saveStatus === "saving"
              ? "Saving…"
              : isCreating
                ? "Create Cluster"
                : "Save Cluster"}
          </button>
        </div>
      </div>
    </div>
  );
}

function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  handler: () => void,
) {
  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        handler();
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [ref, handler]);
}

function NuGetPackageSearch({
  value,
  onChange,
  onFeedChange,
  feeds,
  searchNugetPackages,
}: {
  value: string;
  onChange: (value: string) => void;
  onFeedChange?: (feedName: string) => void;
  feeds: NugetFeed[];
  searchNugetPackages: (
    query: string,
    feedName?: string,
    take?: number,
  ) => Promise<NugetPackage[]>;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NugetPackage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedFeed, setSelectedFeed] = useState<string>("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );

  const feedName = selectedFeed || undefined;

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      setHasSearched(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const packages = await searchNugetPackages(query.trim(), feedName, 20);
        setResults(packages);
        setIsOpen(true);
        setHasSearched(true);
        setSelectedIndex(-1);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, feedName, searchNugetPackages]);

  useClickOutside(wrapperRef, () => setIsOpen(false));

  const selectPackage = (pkg: NugetPackage) => {
    onChange(pkg.packageId);
    setQuery(pkg.packageId);
    setIsOpen(false);
    setResults([]);
    // Auto-focus the version input after package selection
    setTimeout(() => {
      const versionInput = document.querySelector<HTMLInputElement>(
        '[aria-label="Package version"]',
      );
      versionInput?.focus();
    }, 100);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !isOpen) {
      e.preventDefault();
      // Focus version input when user types a package ID manually
      setTimeout(() => {
        const versionInput = document.querySelector<HTMLInputElement>(
          '[aria-label="Package version"]',
        );
        versionInput?.focus();
      }, 50);
      return;
    }
    if (!isOpen) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % results.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + results.length) % results.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && results[selectedIndex]) {
        selectPackage(results[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const formatCount = (n?: number | null): string => {
    if (n == null) return "";
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
    return n.toLocaleString();
  };

  return (
    <div ref={wrapperRef} className="nuget-search">
      <div className="nuget-search__row">
        <div className="nuget-search__icon">
          {isLoading ? (
            <Loader2
              aria-hidden="true"
              width={14}
              height={14}
              className="nuget-search__spinner"
            />
          ) : (
            <Search aria-hidden="true" width={14} height={14} />
          )}
        </div>
        <input
          ref={inputRef}
          aria-label="Package ID"
          aria-autocomplete="list"
          aria-controls="nuget-package-list"
          aria-expanded={isOpen}
          placeholder="Search packages…"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
        />
        {feeds.length > 0 && (
          <select
            aria-label="NuGet feed"
            className="nuget-search__feed"
            value={selectedFeed}
            onChange={(e) => {
              const name = e.target.value;
              setSelectedFeed(name);
              onFeedChange?.(name);
            }}
          >
            <option value="">All feeds</option>
            {feeds.map((feed) => (
              <option key={feed.name} value={feed.name}>
                {feed.name}
              </option>
            ))}
          </select>
        )}
      </div>
      {isOpen && (
        <ul
          id="nuget-package-list"
          className="nuget-search__dropdown"
          role="listbox"
        >
          {results.map((pkg, index) => (
            <li
              key={pkg.packageId}
              aria-selected={index === selectedIndex}
              className={`nuget-search__item ${index === selectedIndex ? "nuget-search__item--highlighted" : ""}`}
              role="option"
              onClick={() => selectPackage(pkg)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <div className="nuget-search__item-main">
                <strong>{pkg.packageId}</strong>
                <span className="nuget-search__item-version">
                  v{pkg.version}
                </span>
              </div>
              <div className="nuget-search__item-meta">
                {pkg.description && (
                  <span className="nuget-search__item-desc">
                    {pkg.description}
                  </span>
                )}
                <span className="nuget-search__item-stats">
                  {pkg.authors && <span>{pkg.authors}</span>}
                  {pkg.downloadCount != null && (
                    <span>{formatCount(pkg.downloadCount)} downloads</span>
                  )}
                </span>
              </div>
            </li>
          ))}
          {results.length === 0 && !isLoading && hasSearched && (
            <li className="nuget-search__item nuget-search__item--empty">
              No packages found{feedName ? ` in "${feedName}"` : ""}. Try a
              different query.
            </li>
          )}
          {results.length === 0 && !isLoading && !hasSearched && (
            <li className="nuget-search__item nuget-search__item--empty">
              Type at least 2 characters to search
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

function NuGetVersionSearch({
  packageId,
  feedName,
  value,
  onChange,
  getNugetPackageVersions,
}: {
  packageId: string;
  feedName?: string;
  value: string;
  onChange: (value: string) => void;
  getNugetPackageVersions: (
    packageId: string,
    feedName?: string,
  ) => Promise<string[]>;
}) {
  const [versions, setVersions] = useState<string[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [fetchError, setFetchError] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!packageId.trim()) {
      setVersions([]);
      setFetchError(false);
      return;
    }
    let cancelled = false;
    setIsLoading(true);
    setFetchError(false);
    setVersions([]);
    getNugetPackageVersions(packageId, feedName)
      .then((v) => {
        if (!cancelled) {
          setVersions(v);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setIsLoading(false);
          setFetchError(true);
          console.error("[NuGetVersionSearch] failed to fetch versions:", err);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [packageId, feedName, getNugetPackageVersions]);

  useClickOutside(wrapperRef, () => setIsOpen(false));

  const selectVersion = (version: string) => {
    onChange(version);
    setIsOpen(false);
  };

  const filteredVersions = versions.filter((version) =>
    version.toLowerCase().includes(value.trim().toLowerCase()),
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const selectableVersions = value.trim() ? filteredVersions : versions;
    if (!isOpen) {
      if (e.key === "ArrowDown" && selectableVersions.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex(0);
      }
      return;
    }
    if (selectableVersions.length === 0) {
      if (e.key === "Escape") setIsOpen(false);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % selectableVersions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(
        (i) => (i - 1 + selectableVersions.length) % selectableVersions.length,
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && selectableVersions[selectedIndex]) {
        selectVersion(selectableVersions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const visibleVersions = value.trim() ? filteredVersions : versions;
  const showLoading = isLoading && visibleVersions.length === 0;
  const showEmpty =
    !isLoading &&
    visibleVersions.length === 0 &&
    !fetchError &&
    packageId.trim().length > 0;

  return (
    <div ref={wrapperRef} className="nuget-search nuget-search--version">
      <div className="nuget-search__row">
        <div className="nuget-search__icon">
          {isLoading ? (
            <Loader2
              aria-hidden="true"
              width={14}
              height={14}
              className="nuget-search__spinner"
            />
          ) : versions.length > 0 ? (
            <CheckCircle2
              aria-hidden="true"
              width={14}
              height={14}
              className="nuget-search__icon--loaded"
            />
          ) : (
            <Search aria-hidden="true" width={14} height={14} />
          )}
        </div>
        <input
          aria-label="Package version"
          aria-autocomplete="list"
          aria-controls="nuget-version-list"
          aria-expanded={isOpen}
          placeholder={isLoading ? "Loading versions…" : "1.0.0"}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            if (versions.length > 0) {
              setIsOpen(true);
              setSelectedIndex(-1);
            }
          }}
          onFocus={() => {
            if (versions.length > 0) setIsOpen(true);
          }}
          onKeyDown={handleKeyDown}
          role="combobox"
        />
      </div>
      {isOpen && (
        <ul
          id="nuget-version-list"
          className="nuget-search__dropdown"
          role="listbox"
        >
          {showLoading && (
            <li className="nuget-search__item nuget-search__item--loading">
              <Loader2
                aria-hidden="true"
                width={12}
                height={12}
                className="nuget-search__spinner"
              />
              Fetching versions…
            </li>
          )}
          {visibleVersions.map((version, index) => (
            <li
              key={version}
              aria-selected={index === selectedIndex}
              className={`nuget-search__item ${index === selectedIndex ? "nuget-search__item--highlighted" : ""}`}
              role="option"
              onClick={() => selectVersion(version)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              <span className="nuget-search__item-version">{version}</span>
              {index === 0 && versions.length > 1 && (
                <span className="nuget-search__item-latest">latest</span>
              )}
            </li>
          ))}
          {showEmpty && (
            <li className="nuget-search__item nuget-search__item--empty">
              No matching versions found. You can type one manually.
            </li>
          )}
          {fetchError && (
            <li className="nuget-search__item nuget-search__item--empty">
              Could not load versions. Type one manually.
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
