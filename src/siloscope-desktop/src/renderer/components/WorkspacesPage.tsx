import { useCallback, useEffect, useRef, useState } from "react";
import { Briefcase, FolderOpen, Import, Trash2, FolderSearch, Search, Loader2, ChevronDown } from "lucide-react";
import type { ClusterType, NugetFeed, NugetPackage, Workspace, WorkspaceSource } from "../../shared/types";

type WorkspacesPageProps = {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  onSelectWorkspace: (workspaceId: string) => void;
  onCreateWorkspace: (workspace: Workspace) => void;
  onUpdateWorkspace: (workspace: Workspace) => void;
  onDeleteWorkspace: (workspaceId: string) => void;
  onLoadWorkspace: () => Promise<void>;
  onSaveWorkspace: () => Promise<void>;
  onPickFile: (options?: { allowedFileTypes?: string; canChooseFiles?: boolean; canChooseDirectory?: boolean; allowsMultipleSelection?: boolean }) => void;
  nugetFeeds: NugetFeed[];
  searchNugetPackages: (query: string, feedName?: string, take?: number) => Promise<NugetPackage[]>;
  getNugetPackageVersions: (packageId: string, feedName?: string) => Promise<string[]>;
};

export function WorkspacesPage({
  workspaces,
  activeWorkspace,
  onSelectWorkspace,
  onCreateWorkspace,
  onUpdateWorkspace,
  onDeleteWorkspace,
  onLoadWorkspace,
  onSaveWorkspace,
  onPickFile,
  nugetFeeds,
  searchNugetPackages,
  getNugetPackageVersions,
}: WorkspacesPageProps) {
  const [editingWorkspace, setEditingWorkspace] = useState<Workspace | null>(null);
  const isCreating = editingWorkspace === null;

  const handleCreateNew = useCallback(() => {
    setEditingWorkspace(null);
  }, []);

  const handleEdit = useCallback((workspace: Workspace) => {
    setEditingWorkspace(workspace);
  }, []);

  const handleActivate = useCallback(
    (workspaceId: string) => {
      onSelectWorkspace(workspaceId);
    },
    [onSelectWorkspace],
  );

  return (
    <section className="workspaces-page" aria-label="Clusters">
      <header className="workspaces-page__header">
        <div>
          <span>Management</span>
          <h2 id="workspaces-title">Clusters</h2>
          <p>Create, edit, and manage your Orleans clusters.</p>
        </div>
        <div className="workspaces-page__header-actions">
          <button
            className="workspaces-page__ghost-button"
            onClick={() => void onLoadWorkspace()}
            type="button"
          >
            <Import aria-hidden="true" width={14} height={14} />
            Import
          </button>
        </div>
      </header>

      <div className="workspaces-page__body">
      <nav
        className="workspaces-page__sidebar"
        aria-label="Cluster list"
      >
        <button
          className="workspaces-page__create-button"
          onClick={handleCreateNew}
          type="button"
        >
          + Create cluster
        </button>
          <ul className="workspaces-page__list" role="list">
            {workspaces.map((ws) => (
              <li
                key={ws.id}
                className={`workspaces-page__list-item ${editingWorkspace?.id === ws.id ? "workspaces-page__list-item--active" : ""} ${activeWorkspace?.id === ws.id ? "workspaces-page__list-item--current" : ""}`}
              >
                <button
                  aria-label={`Edit ${ws.name}`}
                  className="workspaces-page__list-button"
                  onClick={() => handleEdit(ws)}
                  type="button"
                >
                  <Briefcase
                    aria-hidden="true"
                    width={14}
                    height={14}
                  />
                  <span className="workspaces-page__list-name">
                    {ws.name}
                  </span>
                  {activeWorkspace?.id === ws.id && (
                    <span className="workspaces-page__list-badge">
                      Active
                    </span>
                  )}
                </button>
                <div className="workspaces-page__list-actions">
                  <button
                    aria-label={`Activate ${ws.name}`}
                    className="workspaces-page__list-action"
                    onClick={() => handleActivate(ws.id)}
                    title="Activate"
                    type="button"
                  >
                    <FolderOpen aria-hidden="true" width={13} height={13} />
                  </button>
                  <button
                    aria-label={`Delete ${ws.name}`}
                    className="workspaces-page__list-action workspaces-page__list-action--danger"
                    onClick={() => onDeleteWorkspace(ws.id)}
                    title="Delete"
                    type="button"
                  >
                    <Trash2 aria-hidden="true" width={13} height={13} />
                  </button>
                </div>
              </li>
            ))}
          </ul>
          {workspaces.length === 0 && (
            <div className="workspaces-page__empty">
              No clusters yet. Create or import one to get started.
            </div>
          )}
        </nav>

        <div className="workspaces-page__form-area">
          <WorkspaceForm
            key={isCreating ? "create" : editingWorkspace.id}
            initialWorkspace={editingWorkspace}
            isCreating={isCreating}
            onSave={isCreating ? onCreateWorkspace : onUpdateWorkspace}
            onPickFile={onPickFile}
            nugetFeeds={nugetFeeds}
            searchNugetPackages={searchNugetPackages}
            getNugetPackageVersions={getNugetPackageVersions}
          />
        </div>
      </div>
    </section>
  );
}

function WorkspaceForm({
  initialWorkspace,
  isCreating,
  onSave,
  onPickFile,
  nugetFeeds,
  searchNugetPackages,
  getNugetPackageVersions,
}: {
  initialWorkspace: Workspace | null;
  isCreating: boolean;
  onSave: (workspace: Workspace) => void;
  onPickFile: (options?: { allowedFileTypes?: string; canChooseFiles?: boolean; canChooseDirectory?: boolean; allowsMultipleSelection?: boolean }) => void;
  nugetFeeds: NugetFeed[];
  searchNugetPackages: (query: string, feedName?: string, take?: number) => Promise<NugetPackage[]>;
  getNugetPackageVersions: (packageId: string, feedName?: string) => Promise<string[]>;
}) {
  const [name, setName] = useState(initialWorkspace?.name ?? "Untitled Cluster");
  const [description, setDescription] = useState(initialWorkspace?.description ?? "");
  const [clusterType, setClusterType] = useState<ClusterType>(
    initialWorkspace?.clusterType ?? "Homogenous",
  );
  const [clusterId, setClusterId] = useState(initialWorkspace?.clusterId ?? "dev");
  const [serviceId, setServiceId] = useState(initialWorkspace?.serviceId ?? "SiloScope");
  const [gatewayEndpoint, setGatewayEndpoint] = useState(
    initialWorkspace?.gatewayEndpoints?.[0] ?? "127.0.0.1:30000",
  );
  const [sources, setSources] = useState<WorkspaceSource[]>(
    initialWorkspace?.sources ?? [],
  );
  const [sourceType, setSourceType] = useState<WorkspaceSource["sourceType"]>("DLL");
  const [sourceReference, setSourceReference] = useState("");
  const [sourceVersion, setSourceVersion] = useState("");
  const [sourceGateway, setSourceGateway] = useState("");
  const [sourceFeed, setSourceFeed] = useState("");

  useEffect(() => {
    setName(initialWorkspace?.name ?? "Untitled Cluster");
    setDescription(initialWorkspace?.description ?? "");
    setClusterType(initialWorkspace?.clusterType ?? "Homogenous");
    setClusterId(initialWorkspace?.clusterId ?? "dev");
    setServiceId(initialWorkspace?.serviceId ?? "SiloScope");
    setGatewayEndpoint(initialWorkspace?.gatewayEndpoints?.[0] ?? "127.0.0.1:30000");
    setSources(initialWorkspace?.sources ?? []);
    setSourceType("DLL");
    setSourceReference("");
    setSourceVersion("");
    setSourceGateway("");
    setSourceFeed("");
  }, [initialWorkspace]);

  useEffect(() => {
    const handler = (e: CustomEvent<{ paths: string[] }>) => {
      const first = e.detail.paths.find((p) => p.trim().length > 0);
      if (first) {
        setSourceReference(first.trim());
      }
    };
    window.addEventListener("filePicked", handler as EventListener);
    return () => window.removeEventListener("filePicked", handler as EventListener);
  }, []);

  const addSource = () => {
    const reference = sourceReference.trim();
    if (!reference) return;

    const source: WorkspaceSource = {
      sourceId: `${sourceType}:${reference}:${sourceVersion.trim()}:${sourceGateway.trim()}`,
      sourceType,
      reference,
      label: sourceType === "DLL" ? reference.split(/[\\/]/).pop() || reference : reference,
      version: sourceType === "NuGet" ? sourceVersion.trim() || null : null,
      gateway: clusterType === "Heterogeneous" ? sourceGateway.trim() || null : null,
      enabled: true,
    };

    setSources((current) => [...current, source]);
    setSourceReference("");
    setSourceVersion("");
    setSourceGateway("");
  };

  const handleSave = () => {
    const [siloAddress, portRaw] = gatewayEndpoint.split(":");
    const gatewayPort = Number(portRaw);
    const workspace: Workspace = {
      id: initialWorkspace?.id ?? `workspace-${Date.now()}`,
      name: name.trim() || "Untitled Cluster",
      description: description.trim() || null,
      siloAddress: siloAddress || "127.0.0.1",
      gatewayPort: Number.isFinite(gatewayPort) ? gatewayPort : 30000,
      orleansVersion: "10.0",
      clusterId: clusterId.trim() || "dev",
      serviceId: serviceId.trim() || "SiloScope",
      clusterType,
      gatewayEndpoints:
        clusterType === "Homogenous" && gatewayEndpoint.trim()
          ? [gatewayEndpoint.trim()]
          : [],
      environmentVariables: {},
      sources,
    };

    onSave(workspace);
  };

  return (
    <div className="workspace-form">
      <h3 className="workspace-form__title">
        {isCreating ? "New cluster" : "Edit cluster"}
      </h3>

      <div className="workspace-form__grid">
        <section className="workspace-form__panel">
          <h4>Cluster</h4>
          <label className="workspace-form__field">
            <span>Name</span>
            <input
              aria-label="Cluster name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </label>
          <label className="workspace-form__field">
            <span>Description</span>
            <input
              aria-label="Cluster description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>
        </section>

        <section className="workspace-form__panel">
          <h4>Cluster</h4>
          <label className="workspace-form__field">
            <span>Cluster type</span>
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
            <span>Cluster ID</span>
            <input
              aria-label="Cluster ID"
              value={clusterId}
              onChange={(e) => setClusterId(e.target.value)}
            />
          </label>
          <label className="workspace-form__field">
            <span>Service ID</span>
            <input
              aria-label="Service ID"
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
            />
          </label>
          {clusterType === "Homogenous" && (
            <label className="workspace-form__field">
              <span>Gateway</span>
              <input
                aria-label="Gateway endpoint"
                value={gatewayEndpoint}
                onChange={(e) => setGatewayEndpoint(e.target.value)}
              />
            </label>
          )}
        </section>

        <section className="workspace-form__panel workspace-form__panel--wide">
          <h4>Silos</h4>
          <div className="workspace-form__source-form">
            <label className="workspace-form__field">
              <span>Type</span>
              <select
                aria-label="Silo type"
                value={sourceType}
                onChange={(e) => setSourceType(e.target.value as WorkspaceSource["sourceType"])}
              >
                <option value="DLL">DLL</option>
                <option value="NuGet">NuGet</option>
              </select>
            </label>
            <label className="workspace-form__field">
              <span>{sourceType === "DLL" ? "DLL path" : "Package ID"}</span>
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
                      className="workspace-form__browse-button"
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onPickFile({ canChooseFiles: true, canChooseDirectory: false, allowsMultipleSelection: false });
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
                <span>Version</span>
                <NuGetVersionSearch
                  packageId={sourceReference.trim()}
                  feedName={sourceFeed}
                  value={sourceVersion}
                  onChange={setSourceVersion}
                  feeds={nugetFeeds}
                  getNugetPackageVersions={getNugetPackageVersions}
                />
              </label>
            )}
            {clusterType === "Heterogeneous" && (
              <label className="workspace-form__field">
                <span>Gateway</span>
                <input
                  aria-label="Silo gateway"
                  value={sourceGateway}
                  onChange={(e) => setSourceGateway(e.target.value)}
                />
              </label>
            )}
            <button
              className="workspace-form__add-button"
              disabled={!sourceReference.trim()}
              onClick={addSource}
              type="button"
            >
              Add Silo
            </button>
          </div>

          {sources.length > 0 ? (
            <ul className="workspace-form__sources" aria-label="Cluster silos">
              {sources.map((source) => (
                <li key={source.sourceId}>
                  <strong>{source.label}</strong>
                  <span>
                    {source.sourceType}
                    {source.version ? ` ${source.version}` : ""}
                    {source.gateway ? ` · ${source.gateway}` : ""}
                  </span>
                  <button
                    aria-label={`Remove ${source.label}`}
                    onClick={() =>
                      setSources((current) =>
                        current.filter((c) => c.sourceId !== source.sourceId),
                      )
                    }
                    type="button"
                  >
                    Remove
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="workspace-form__empty">No silos added yet</div>
          )}
        </section>
      </div>

      <div className="workspace-form__footer">
        <button
          className="workspace-form__save-button"
          disabled={!name.trim()}
          onClick={handleSave}
          type="button"
        >
          {isCreating ? "Create Cluster" : "Save Cluster"}
        </button>
      </div>
    </div>
  );
}

function useClickOutside(ref: React.RefObject<HTMLElement | null>, handler: () => void) {
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
  searchNugetPackages: (query: string, feedName?: string, take?: number) => Promise<NugetPackage[]>;
}) {
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<NugetPackage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [selectedFeed, setSelectedFeed] = useState<string>("");
  const wrapperRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  const feedName = selectedFeed || undefined;

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) {
      setResults([]);
      setIsOpen(false);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsLoading(true);
      try {
        const packages = await searchNugetPackages(query.trim(), feedName, 20);
        setResults(packages);
        setIsOpen(packages.length > 0);
        setSelectedIndex(-1);
      } finally {
        setIsLoading(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, feedName, searchNugetPackages]);

  useClickOutside(wrapperRef, () => setIsOpen(false));

  const selectPackage = (pkg: NugetPackage) => {
    onChange(pkg.packageId);
    setQuery(pkg.packageId);
    setIsOpen(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
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

  return (
    <div ref={wrapperRef} className="nuget-search">
      <div className="nuget-search__row">
        <div className="nuget-search__icon">
          {isLoading ? (
            <Loader2 aria-hidden="true" width={14} height={14} className="nuget-search__spinner" />
          ) : (
            <Search aria-hidden="true" width={14} height={14} />
          )}
        </div>
        <input
          aria-label="Package ID"
          aria-autocomplete="list"
          aria-controls="nuget-package-list"
          aria-expanded={isOpen}
          placeholder="Company.Contracts"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            onChange(e.target.value);
          }}
          onFocus={() => { if (results.length > 0) setIsOpen(true); }}
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
              <strong>{pkg.packageId}</strong>
              <span>{pkg.description ?? pkg.authors ?? ""}</span>
            </li>
          ))}
          {results.length === 0 && !isLoading && (
            <li className="nuget-search__item nuget-search__item--empty">No packages found</li>
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
  feeds,
  getNugetPackageVersions,
}: {
  packageId: string;
  feedName?: string;
  value: string;
  onChange: (value: string) => void;
  feeds: NugetFeed[];
  getNugetPackageVersions: (packageId: string, feedName?: string) => Promise<string[]>;
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
    getNugetPackageVersions(packageId, feedName).then((v) => {
      if (!cancelled) {
        setVersions(v);
        setIsLoading(false);
      }
    }).catch((err) => {
      if (!cancelled) {
        setIsLoading(false);
        setFetchError(true);
        // eslint-disable-next-line no-console
        console.error("[NuGetVersionSearch] failed to fetch versions:", err);
      }
    });
    return () => { cancelled = true; };
  }, [packageId, feedName, getNugetPackageVersions]);

  useClickOutside(wrapperRef, () => setIsOpen(false));

  const selectVersion = (version: string) => {
    onChange(version);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen) {
      if (e.key === "ArrowDown" && versions.length > 0) {
        e.preventDefault();
        setIsOpen(true);
        setSelectedIndex(0);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((i) => (i + 1) % versions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((i) => (i - 1 + versions.length) % versions.length);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (selectedIndex >= 0 && versions[selectedIndex]) {
        selectVersion(versions[selectedIndex]);
      }
    } else if (e.key === "Escape") {
      setIsOpen(false);
    }
  };

  const hasVersions = versions.length > 0;
  const showEmpty = !isLoading && !hasVersions && !fetchError && packageId.trim().length > 0;

  return (
    <div ref={wrapperRef} className="nuget-search">
      <div className="nuget-search__row">
        <input
          aria-label="Package version"
          aria-autocomplete="list"
          aria-controls="nuget-version-list"
          aria-expanded={isOpen}
          placeholder="1.0.0"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => { if (hasVersions) setIsOpen(true); }}
          onKeyDown={handleKeyDown}
          role="combobox"
        />
        <button
          aria-label="Show versions"
          className="nuget-search__chevron"
          onClick={() => setIsOpen((o) => !o)}
          type="button"
        >
          {isLoading ? (
            <Loader2 aria-hidden="true" width={14} height={14} className="nuget-search__spinner" />
          ) : (
            <ChevronDown aria-hidden="true" width={14} height={14} />
          )}
        </button>
      </div>
      {isOpen && (
        <ul
          id="nuget-version-list"
          className="nuget-search__dropdown"
          role="listbox"
        >
          {versions.map((version, index) => (
            <li
              key={version}
              aria-selected={index === selectedIndex}
              className={`nuget-search__item ${index === selectedIndex ? "nuget-search__item--highlighted" : ""}`}
              role="option"
              onClick={() => selectVersion(version)}
              onMouseEnter={() => setSelectedIndex(index)}
            >
              {version}
            </li>
          ))}
          {showEmpty && (
            <li className="nuget-search__item nuget-search__item--empty">
              No versions found — type one manually
            </li>
          )}
          {fetchError && (
            <li className="nuget-search__item nuget-search__item--empty">
              Could not load versions — type one manually
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
