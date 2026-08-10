import {
  AlertCircle,
  Check,
  ChevronRight,
  Download,
  Globe,
  Key,
  Loader2,
  Package,
  Pencil,
  Plus,
  Search,
  Shield,
  X,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { NugetFeed, NugetPackage } from "../../schema";
import "./package-feeds-page.css";

/** Type definitions for feed form state and package search results. */

type FeedTestState = "idle" | "testing" | "success" | "error";
type FeedHealth = "unknown" | "healthy" | "unhealthy";

interface FeedFormState {
  name: string;
  url: string;
  username: string;
  password: string;
}

interface PackageFeedsPageProps {
  feeds: NugetFeed[];
  onCreateFeed?: (request: {
    name: string;
    url: string;
    username?: string;
    password?: string;
  }) => Promise<void>;
  onTestFeed?: (request: {
    name: string;
    url: string;
    username?: string;
    password?: string;
  }) => Promise<void>;
  onUpdateFeed?: (
    name: string,
    request: {
      name: string;
      url: string;
      username?: string;
      password?: string;
    },
  ) => Promise<void>;
  onSearchPackages?: (
    query: string,
    feedName?: string,
    take?: number,
  ) => Promise<NugetPackage[]>;
  onGetVersions?: (packageId: string, feedName?: string) => Promise<string[]>;
}

const emptyForm: FeedFormState = {
  name: "",
  url: "",
  username: "",
  password: "",
};

/** Pure helper functions for feed management. */

function formatCount(n: number, singular: string, plural?: string): string {
  return `${n.toLocaleString()} ${n === 1 ? singular : (plural ?? `${singular}s`)}`;
}

function formatDownloadCount(n: number | null | undefined): string | null {
  if (n == null || n === 0) return null;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return `${n}`;
}

/**
 * Compares two NuGet-style semantic version strings.
 * Returns negative if a < b, positive if a > b, zero if equal.
 *
 * Handles numeric components correctly (so "10.0" > "9.0"),
 * pre-release tags ("1.0.0-beta" < "1.0.0"), and four-part versions.
 */
function compareSemVer(a: string, b: string): number {
  const parseVersion = (v: string) => {
    const stripped = v.replace(/^[vV]/, "");
    const dashIdx = stripped.indexOf("-");
    const plusIdx = stripped.indexOf("+");
    const preReleaseEnd =
      dashIdx >= 0 ? (plusIdx > dashIdx ? plusIdx : stripped.length) : -1;
    const core = dashIdx >= 0 ? stripped.slice(0, dashIdx) : stripped;
    const preRelease =
      dashIdx >= 0 ? stripped.slice(dashIdx + 1, preReleaseEnd) : null;
    const parts = core.split(".").map((p) => {
      const n = parseInt(p, 10);
      return Number.isNaN(n) ? 0 : n;
    });
    return { parts, preRelease };
  };

  const va = parseVersion(a);
  const vb = parseVersion(b);

  const maxLen = Math.max(va.parts.length, vb.parts.length);
  for (let i = 0; i < maxLen; i++) {
    const na = va.parts[i] ?? 0;
    const nb = vb.parts[i] ?? 0;
    if (na !== nb) return na - nb;
  }

  if (!va.preRelease && !vb.preRelease) return 0;
  if (!va.preRelease) return 1;
  if (!vb.preRelease) return -1;
  return va.preRelease.localeCompare(vb.preRelease);
}

/**
 * Finds the latest (highest) version from a list of version strings
 * using semantic version comparison.
 */
function findLatestVersion(versions: string[]): string | null {
  if (versions.length === 0) return null;
  return versions.reduce((latest, current) =>
    compareSemVer(current, latest) > 0 ? current : latest,
  );
}

/** Main PackageFeedsPage component. */

export function PackageFeedsPage({
  feeds,
  onCreateFeed,
  onTestFeed,
  onUpdateFeed,
  onSearchPackages,
  onGetVersions,
}: PackageFeedsPageProps) {
  // Feed form state
  const [editingFeedName, setEditingFeedName] = useState<string | null>(null);
  const [isAddingFeed, setIsAddingFeed] = useState(false);
  const [form, setForm] = useState<FeedFormState>(emptyForm);
  const [testState, setTestState] = useState<FeedTestState>("idle");
  const [testMessage, setTestMessage] = useState("");
  const [feedSaveState, setFeedSaveState] = useState<"idle" | "saving">("idle");

  // Per-feed health tracking
  const [feedHealth, setFeedHealth] = useState<Record<string, FeedHealth>>({});
  const [testingFeedName, setTestingFeedName] = useState<string | null>(null);

  // Search state
  const [query, setQuery] = useState("");
  const [selectedFeedName, setSelectedFeedName] = useState<string | null>(null);
  const [results, setResults] = useState<NugetPackage[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Package detail
  const [expandedPackageId, setExpandedPackageId] = useState<string | null>(
    null,
  );
  const [packageVersions, setPackageVersions] = useState<string[]>([]);
  const [isLoadingVersions, setIsLoadingVersions] = useState(false);
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);

  // Keyboard nav for results
  const [focusedResultIndex, setFocusedResultIndex] = useState(-1);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Derived
  const availableFeeds = useMemo(() => {
    const customFeeds = feeds.filter((f) => !f.isDefault);
    const defaultFeed = feeds.find((f) => f.isDefault);
    return defaultFeed ? [defaultFeed, ...customFeeds] : customFeeds;
  }, [feeds]);

  const isEditing = editingFeedName !== null;
  const showForm = isAddingFeed || isEditing;
  const canSubmitForm =
    form.name.trim().length > 0 && form.url.trim().length > 0;
  const customFeedCount = availableFeeds.filter((f) => !f.isDefault).length;

  /** Feed form event handlers (create, test, save, delete). */

  const resetForm = useCallback(() => {
    setForm(emptyForm);
    setEditingFeedName(null);
    setIsAddingFeed(false);
    setTestState("idle");
    setTestMessage("");
    setFeedSaveState("idle");
  }, []);

  const startAddFeed = useCallback(() => {
    resetForm();
    setIsAddingFeed(true);
  }, [resetForm]);

  const startEditFeed = useCallback((feed: NugetFeed) => {
    setIsAddingFeed(false);
    setEditingFeedName(feed.name);
    setForm({ name: feed.name, url: feed.url, username: "", password: "" });
    setTestState("idle");
    setTestMessage("");
    setFeedSaveState("idle");
  }, []);

  const buildRequest = useCallback((): {
    name: string;
    url: string;
    username?: string;
    password?: string;
  } => {
    const req: ReturnType<typeof buildRequest> = {
      name: form.name.trim(),
      url: form.url.trim(),
    };
    if (form.username.trim()) req.username = form.username.trim();
    if (form.password) req.password = form.password;
    return req;
  }, [form]);

  const handleTestFeed = useCallback(
    async (feed?: NugetFeed) => {
      if (feed && onTestFeed) {
        setTestingFeedName(feed.name);
        setFeedHealth((prev) => ({ ...prev, [feed.name]: "unknown" }));
        try {
          await onTestFeed({ name: feed.name, url: feed.url });
          setFeedHealth((prev) => ({ ...prev, [feed.name]: "healthy" }));
        } catch {
          setFeedHealth((prev) => ({ ...prev, [feed.name]: "unhealthy" }));
        } finally {
          setTestingFeedName(null);
        }
        return;
      }

      if (!canSubmitForm || !onTestFeed) return;
      setTestState("testing");
      setTestMessage("Testing connection…");
      try {
        await onTestFeed(buildRequest());
        setTestState("success");
        setTestMessage("Connection succeeded");
      } catch (error) {
        setTestState("error");
        setTestMessage(
          error instanceof Error ? error.message : "Connection failed",
        );
      }
    },
    [canSubmitForm, onTestFeed, buildRequest],
  );

  const handleSaveFeed = useCallback(async () => {
    if (!canSubmitForm) return;
    setFeedSaveState("saving");
    try {
      if (isEditing && editingFeedName && onUpdateFeed) {
        await onUpdateFeed(editingFeedName, buildRequest());
      } else if (onCreateFeed) {
        await onCreateFeed(buildRequest());
      }
      resetForm();
    } catch (error) {
      setTestState("error");
      setTestMessage(
        error instanceof Error ? error.message : "Failed to save feed",
      );
    } finally {
      setFeedSaveState("idle");
    }
  }, [
    canSubmitForm,
    isEditing,
    editingFeedName,
    onUpdateFeed,
    onCreateFeed,
    buildRequest,
    resetForm,
  ]);

  /** Package search logic. */

  const performSearch = useCallback(
    async (searchQuery: string) => {
      if (!onSearchPackages || searchQuery.trim().length === 0) {
        setResults([]);
        setSearchError(null);
        return;
      }

      setIsSearching(true);
      setSearchError(null);
      setFocusedResultIndex(-1);
      setExpandedPackageId(null);
      try {
        const pkgs = await onSearchPackages(
          searchQuery.trim(),
          selectedFeedName ?? undefined,
          10,
        );
        setResults(pkgs);
      } catch (error) {
        setSearchError(
          error instanceof Error ? error.message : "Search failed",
        );
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [onSearchPackages, selectedFeedName],
  );

  useEffect(() => {
    const timer = setTimeout(() => performSearch(query), 200);
    return () => clearTimeout(timer);
  }, [query, performSearch]);

  const clearSearch = useCallback(() => {
    setQuery("");
    setResults([]);
    setSearchError(null);
    setFocusedResultIndex(-1);
    setExpandedPackageId(null);
  }, []);

  /** Package version expansion / detail view. */

  const togglePackage = useCallback(
    async (packageId: string) => {
      if (expandedPackageId === packageId) {
        setExpandedPackageId(null);
        setPackageVersions([]);
        setSelectedVersion(null);
        return;
      }

      setExpandedPackageId(packageId);
      setPackageVersions([]);
      setSelectedVersion(null);
      setIsLoadingVersions(true);

      try {
        if (onGetVersions) {
          const versions = await onGetVersions(
            packageId,
            selectedFeedName ?? undefined,
          );
          setPackageVersions(versions);
          setSelectedVersion(findLatestVersion(versions));
        }
      } catch {
        setPackageVersions([]);
      } finally {
        setIsLoadingVersions(false);
      }
    },
    [expandedPackageId, onGetVersions, selectedFeedName],
  );

  /** Keyboard shortcut handlers. */

  const handleGlobalKeyDown = useCallback((event: KeyboardEvent) => {
    if (
      event.key === "/" &&
      document.activeElement !== searchInputRef.current &&
      !(document.activeElement instanceof HTMLInputElement) &&
      !(document.activeElement instanceof HTMLTextAreaElement)
    ) {
      event.preventDefault();
      searchInputRef.current?.focus();
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleGlobalKeyDown);
    return () => document.removeEventListener("keydown", handleGlobalKeyDown);
  }, [handleGlobalKeyDown]);

  const handleSearchKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLInputElement>) => {
      if (event.key === "Escape") {
        query.length > 0 ? clearSearch() : searchInputRef.current?.blur();
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setFocusedResultIndex((prev) => Math.min(prev + 1, results.length - 1));
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setFocusedResultIndex((prev) => Math.max(prev - 1, 0));
        return;
      }
      if (
        event.key === "Enter" &&
        focusedResultIndex >= 0 &&
        focusedResultIndex < results.length
      ) {
        event.preventDefault();
        togglePackage(results[focusedResultIndex].packageId);
      }
    },
    [query, clearSearch, results, focusedResultIndex, togglePackage],
  );

  /** Component render output. */

  return (
    <section className="pkg-feeds" aria-label="Package Feeds">
      <div className="pkg-feeds__body">
        {/* Page header */}
        <div className="pkg-feeds__page-header">
          <h2 className="pkg-feeds__page-title">Package Feeds</h2>
          <p className="pkg-feeds__page-subtitle">
            {customFeedCount > 0
              ? `${formatCount(availableFeeds.length, "feed")} configured — connect to NuGet registries to browse and install packages.`
              : "Connect to NuGet registries to browse and install packages directly from your feeds."}
          </p>
        </div>

        <div className="pkg-feeds__grid">
          {/* ── Configured feeds card ── */}
          <section className="pkg-feeds__card" aria-label="Configured feeds">
            <div className="pkg-feeds__card-header">
              <h3 className="pkg-feeds__card-title">Configured feeds</h3>
              <span className="pkg-feeds__card-badge">
                {availableFeeds.length}{" "}
                {availableFeeds.length === 1 ? "feed" : "feeds"}
              </span>
            </div>
            <div className="pkg-feeds__card-body">
              <p className="pkg-feeds__card-desc">
                Manage your connected NuGet registries. Test connectivity, edit
                URLs, or rotate credentials.
              </p>

              {/* Add/Edit form */}
              {showForm && (
                <div
                  className="pkg-feeds__feed-form"
                  role="form"
                  aria-label={isEditing ? "Edit feed" : "Add feed"}
                >
                  <div className="pkg-feeds__feed-form-header">
                    <h4>
                      {isEditing
                        ? `Edit "${editingFeedName}"`
                        : "Add a NuGet feed"}
                    </h4>
                    <button
                      aria-label="Close feed form"
                      className="pkg-feeds__feed-form-close"
                      onClick={resetForm}
                      type="button"
                    >
                      <X aria-hidden="true" width={16} height={16} />
                    </button>
                  </div>
                  <p className="pkg-feeds__feed-form-desc">
                    {isEditing
                      ? "Update the URL or rotate credentials for this feed."
                      : "Connect to any NuGet-compatible registry — nuget.org, GitHub Packages, Azure Artifacts, or a private feed."}
                  </p>

                  <div className="pkg-feeds__feed-form-fields">
                    <label className="pkg-feeds__form-field">
                      <span>Name</span>
                      <input
                        value={form.name}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, name: e.target.value }))
                        }
                        placeholder="github"
                        autoFocus
                      />
                    </label>
                    <label className="pkg-feeds__form-field">
                      <span>URL</span>
                      <input
                        value={form.url}
                        onChange={(e) =>
                          setForm((f) => ({ ...f, url: e.target.value }))
                        }
                        placeholder="https://nuget.pkg.github.com/org/index.json"
                      />
                    </label>
                    <div className="pkg-feeds__feed-form-row">
                      <label className="pkg-feeds__form-field">
                        <span>Username</span>
                        <input
                          value={form.username}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, username: e.target.value }))
                          }
                          placeholder="Optional"
                        />
                      </label>
                      <label className="pkg-feeds__form-field">
                        <span>Token</span>
                        <input
                          type="password"
                          value={form.password}
                          onChange={(e) =>
                            setForm((f) => ({ ...f, password: e.target.value }))
                          }
                          placeholder={
                            isEditing ? "Leave blank to keep" : "Optional"
                          }
                        />
                      </label>
                    </div>
                  </div>

                  {testMessage && testState !== "idle" && (
                    <div
                      className={`pkg-feeds__feed-form-message pkg-feeds__feed-form-message--${testState}`}
                      role="status"
                    >
                      {testState === "testing" && (
                        <Loader2 aria-hidden="true" width={14} height={14} />
                      )}
                      {testState === "success" && (
                        <Check aria-hidden="true" width={14} height={14} />
                      )}
                      {testState === "error" && (
                        <AlertCircle
                          aria-hidden="true"
                          width={14}
                          height={14}
                        />
                      )}
                      <span>{testMessage}</span>
                    </div>
                  )}

                  <div className="pkg-feeds__feed-form-actions">
                    <button
                      className="pkg-feeds__btn pkg-feeds__btn--secondary"
                      onClick={() => handleTestFeed()}
                      disabled={
                        !canSubmitForm || testState === "testing" || !onTestFeed
                      }
                      type="button"
                    >
                      {testState === "testing" ? "Testing…" : "Test connection"}
                    </button>
                    <button
                      className="pkg-feeds__btn pkg-feeds__btn--primary"
                      onClick={handleSaveFeed}
                      disabled={
                        !canSubmitForm ||
                        feedSaveState === "saving" ||
                        (!onCreateFeed && !isEditing)
                      }
                      type="button"
                    >
                      {feedSaveState === "saving"
                        ? "Saving…"
                        : isEditing
                          ? "Save changes"
                          : "Connect and save"}
                    </button>
                    <button
                      className="pkg-feeds__btn pkg-feeds__btn--ghost"
                      onClick={resetForm}
                      type="button"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Feed cards */}
              <div className="pkg-feeds__feed-grid">
                {availableFeeds.map((feed) => {
                  const health = feedHealth[feed.name] ?? "unknown";
                  const isTesting = testingFeedName === feed.name;

                  return (
                    <div key={feed.name} className="pkg-feeds__feed-card">
                      <div className="pkg-feeds__feed-card-top">
                        <span
                          className={`pkg-feeds__feed-card-icon ${feed.isDefault ? "pkg-feeds__feed-card-icon--default" : feed.hasCredentials ? "pkg-feeds__feed-card-icon--auth" : "pkg-feeds__feed-card-icon--public"}`}
                          aria-hidden="true"
                        >
                          {feed.isDefault ? (
                            <Shield width={15} height={15} />
                          ) : feed.hasCredentials ? (
                            <Key width={15} height={15} />
                          ) : (
                            <Globe width={15} height={15} />
                          )}
                        </span>
                        <div className="pkg-feeds__feed-card-info">
                          <span className="pkg-feeds__feed-card-name">
                            {feed.name}
                            {feed.isDefault && (
                              <span className="pkg-feeds__feed-card-badge">
                                Default
                              </span>
                            )}
                            {feed.hasCredentials && !feed.isDefault && (
                              <span className="pkg-feeds__feed-card-badge pkg-feeds__feed-card-badge--auth">
                                Auth
                              </span>
                            )}
                          </span>
                          <span className="pkg-feeds__feed-card-url">
                            {feed.url}
                          </span>
                        </div>
                        <div className="pkg-feeds__feed-card-health">
                          {isTesting ? (
                            <span className="pkg-feeds__health pkg-feeds__health--testing">
                              <Loader2
                                aria-hidden="true"
                                width={12}
                                height={12}
                              />
                              Testing
                            </span>
                          ) : health === "healthy" ? (
                            <span className="pkg-feeds__health pkg-feeds__health--ok">
                              <Check
                                aria-hidden="true"
                                width={12}
                                height={12}
                              />
                              Connected
                            </span>
                          ) : health === "unhealthy" ? (
                            <span className="pkg-feeds__health pkg-feeds__health--bad">
                              <AlertCircle
                                aria-hidden="true"
                                width={12}
                                height={12}
                              />
                              Failed
                            </span>
                          ) : (
                            <span className="pkg-feeds__health">
                              <span
                                className="pkg-feeds__health-dot"
                                aria-hidden="true"
                              />
                              Untested
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="pkg-feeds__feed-card-actions">
                        <button
                          className="pkg-feeds__btn pkg-feeds__btn--secondary pkg-feeds__btn--small"
                          onClick={() => handleTestFeed(feed)}
                          disabled={isTesting || !onTestFeed}
                          type="button"
                        >
                          {isTesting ? "Testing…" : "Test connection"}
                        </button>
                        {!feed.isDefault && (
                          <button
                            className="pkg-feeds__btn pkg-feeds__btn--ghost pkg-feeds__btn--small"
                            onClick={() => startEditFeed(feed)}
                            type="button"
                          >
                            <Pencil aria-hidden="true" width={12} height={12} />
                            Edit
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {availableFeeds.length === 0 && !showForm && (
                <div className="pkg-feeds__empty-state">
                  <div className="pkg-feeds__empty-icon">
                    <Globe aria-hidden="true" width={28} height={28} />
                  </div>
                  <strong>No feeds configured</strong>
                  <span>
                    Add a NuGet registry to start browsing packages. nuget.org
                    is always available as a default — add it or connect a
                    private feed.
                  </span>
                  <button
                    className="pkg-feeds__empty-action"
                    onClick={startAddFeed}
                    type="button"
                  >
                    <Plus aria-hidden="true" width={14} height={14} />
                    Add your first feed
                  </button>
                </div>
              )}

              {availableFeeds.length > 0 && !showForm && (
                <button
                  className="pkg-feeds__add-feed-btn"
                  onClick={startAddFeed}
                  type="button"
                >
                  <Plus aria-hidden="true" width={14} height={14} />
                  Add feed
                </button>
              )}
            </div>
          </section>

          {/* ── Browse packages card ── */}
          {availableFeeds.length > 0 && (
            <section className="pkg-feeds__card" aria-label="Browse packages">
              <div className="pkg-feeds__card-header">
                <h3 className="pkg-feeds__card-title">Browse packages</h3>
              </div>
              <div className="pkg-feeds__card-body">
                <p className="pkg-feeds__card-desc">
                  Search across your connected feeds to discover and inspect
                  packages.
                </p>

                <div className="pkg-feeds__search-panel">
                  <div className="pkg-feeds__search-row">
                    <label className="pkg-feeds__search">
                      <span className="sr-only">
                        Search packages across feeds
                      </span>
                      {isSearching ? (
                        <Loader2
                          aria-hidden="true"
                          className="pkg-feeds__search-icon pkg-feeds__search-icon--spinning"
                          width={16}
                          height={16}
                        />
                      ) : (
                        <Search
                          aria-hidden="true"
                          className="pkg-feeds__search-icon"
                          width={16}
                          height={16}
                        />
                      )}
                      <input
                        ref={searchInputRef}
                        aria-label="Search NuGet packages"
                        className="pkg-feeds__search-input"
                        placeholder="Search for packages…"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleSearchKeyDown}
                        role="combobox"
                        aria-expanded={results.length > 0}
                        aria-controls="pkg-results-list"
                        aria-activedescendant={
                          focusedResultIndex >= 0
                            ? `pkg-result-${results[focusedResultIndex]?.packageId}`
                            : undefined
                        }
                      />
                      {query.length > 0 && (
                        <button
                          aria-label="Clear search"
                          className="pkg-feeds__search-clear"
                          onClick={clearSearch}
                          type="button"
                        >
                          <X aria-hidden="true" width={15} height={15} />
                        </button>
                      )}
                      <kbd className="pkg-feeds__search-kbd" aria-hidden="true">
                        /
                      </kbd>
                    </label>

                    {availableFeeds.length > 1 && (
                      <div className="pkg-feeds__search-feed-filter">
                        <button
                          className={`pkg-feeds__chip${selectedFeedName === null ? " pkg-feeds__chip--active" : ""}`}
                          onClick={() => setSelectedFeedName(null)}
                          type="button"
                        >
                          All
                        </button>
                        {availableFeeds.map((f) => (
                          <button
                            key={f.name}
                            className={`pkg-feeds__chip${selectedFeedName === f.name ? " pkg-feeds__chip--active" : ""}`}
                            onClick={() => setSelectedFeedName(f.name)}
                            type="button"
                          >
                            {f.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Search error */}
                  {searchError && (
                    <div className="pkg-feeds__browser-error">
                      <AlertCircle aria-hidden="true" width={18} height={18} />
                      <div>
                        <strong>Search failed</strong>
                        <span>{searchError}</span>
                      </div>
                      <button
                        className="pkg-feeds__btn pkg-feeds__btn--secondary pkg-feeds__btn--small"
                        onClick={() => performSearch(query)}
                        type="button"
                      >
                        Retry
                      </button>
                    </div>
                  )}

                  {/* Results */}
                  {results.length > 0 && (
                    <>
                      <div className="pkg-feeds__results-summary">
                        {formatCount(results.length, "package")}
                        {selectedFeedName
                          ? ` in ${selectedFeedName}`
                          : " across all feeds"}
                        {query.trim() && (
                          <> matching &ldquo;{query.trim()}&rdquo;</>
                        )}
                      </div>
                      <div
                        id="pkg-results-list"
                        className="pkg-feeds__results"
                        role="listbox"
                        aria-label="Package search results"
                      >
                        {results.map((pkg, index) => {
                          const isExpanded =
                            expandedPackageId === pkg.packageId;
                          const isFocused = focusedResultIndex === index;
                          const dl = formatDownloadCount(pkg.downloadCount);

                          return (
                            <div
                              key={pkg.packageId}
                              id={`pkg-result-${pkg.packageId}`}
                              className={`pkg-feeds__result-card${isExpanded ? " pkg-feeds__result-card--expanded" : ""}${isFocused ? " pkg-feeds__result-card--focused" : ""}`}
                              role="option"
                              aria-selected={isExpanded}
                            >
                              <button
                                className="pkg-feeds__result-summary"
                                onClick={() => togglePackage(pkg.packageId)}
                                type="button"
                              >
                                <span className="pkg-feeds__result-icon">
                                  <Package
                                    aria-hidden="true"
                                    width={18}
                                    height={18}
                                  />
                                </span>
                                <span className="pkg-feeds__result-main">
                                  <span className="pkg-feeds__result-id">
                                    {pkg.packageId}
                                  </span>
                                  <span className="pkg-feeds__result-meta">
                                    <span className="pkg-feeds__result-version">
                                      v{pkg.version}
                                    </span>
                                    {pkg.authors && (
                                      <span className="pkg-feeds__result-author">
                                        by {pkg.authors}
                                      </span>
                                    )}
                                    {dl && (
                                      <span className="pkg-feeds__result-downloads">
                                        <Download
                                          aria-hidden="true"
                                          width={11}
                                          height={11}
                                        />
                                        {dl}
                                      </span>
                                    )}
                                  </span>
                                </span>
                                <span
                                  className="pkg-feeds__result-chevron"
                                  aria-hidden="true"
                                >
                                  <ChevronRight width={16} height={16} />
                                </span>
                              </button>
                              {pkg.description && !isExpanded && (
                                <p className="pkg-feeds__result-desc">
                                  {pkg.description}
                                </p>
                              )}
                              {isExpanded && (
                                <div className="pkg-feeds__result-detail">
                                  {pkg.description && (
                                    <p className="pkg-feeds__result-detail-desc">
                                      {pkg.description}
                                    </p>
                                  )}
                                  <dl className="pkg-feeds__result-meta-list">
                                    {pkg.authors && (
                                      <>
                                        <dt>Authors</dt>
                                        <dd>{pkg.authors}</dd>
                                      </>
                                    )}
                                    {dl && (
                                      <>
                                        <dt>Downloads</dt>
                                        <dd>{dl}</dd>
                                      </>
                                    )}
                                    <dt>Source</dt>
                                    <dd>
                                      {selectedFeedName ??
                                        feeds.find((f) => f.isDefault)?.name ??
                                        "Unknown"}
                                    </dd>
                                  </dl>
                                  <div className="pkg-feeds__versions">
                                    <span className="pkg-feeds__versions-label">
                                      Version
                                    </span>
                                    {isLoadingVersions ? (
                                      <div className="pkg-feeds__versions-loading">
                                        <Loader2
                                          aria-hidden="true"
                                          width={14}
                                          height={14}
                                        />
                                        <span>Loading versions…</span>
                                      </div>
                                    ) : packageVersions.length > 0 ? (
                                      <div
                                        className="pkg-feeds__versions-list"
                                        role="radiogroup"
                                        aria-label="Package versions"
                                      >
                                        {packageVersions.map((v) => (
                                          <button
                                            key={v}
                                            className={`pkg-feeds__version-chip${selectedVersion === v ? " pkg-feeds__version-chip--selected" : ""}`}
                                            role="radio"
                                            aria-checked={selectedVersion === v}
                                            onClick={() =>
                                              setSelectedVersion(v)
                                            }
                                            type="button"
                                          >
                                            {v}
                                          </button>
                                        ))}
                                      </div>
                                    ) : (
                                      <span className="pkg-feeds__versions-none">
                                        No version information available
                                      </span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </>
                  )}

                  {!isSearching &&
                    !searchError &&
                    query.trim() &&
                    results.length === 0 && (
                      <div className="pkg-feeds__search-empty">
                        <Search aria-hidden="true" width={20} height={20} />
                        <span>
                          No packages found for &ldquo;{query.trim()}&rdquo;
                        </span>
                      </div>
                    )}
                </div>
              </div>
            </section>
          )}
        </div>
      </div>
    </section>
  );
}
