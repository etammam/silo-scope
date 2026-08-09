import { FolderOpen, RefreshCw, RotateCcw, Download } from "lucide-react";
import { useCallback, useState } from "react";
import type { ApplicationUpdateState } from "../../../settings/schema";
import "./settings-page.css";

type WorkbenchTheme = "vscode-dark" | "vscode-light" | "github-dark" | "github-light";

const LIGHT_THEMES: { id: WorkbenchTheme; label: string; swatches: string[] }[] = [
  { id: "vscode-light", label: "VS Code Light", swatches: ["#ffffff", "#f8f8f8", "#f3f3f3", "#e5e5e5", "#cecece"] },
  { id: "github-light", label: "GitHub Light", swatches: ["#ffffff", "#f6f8fa", "#f3f4f6", "#d0d7de", "#afb8c1"] },
];

const DARK_THEMES: { id: WorkbenchTheme; label: string; swatches: string[] }[] = [
  { id: "vscode-dark", label: "VS Code Dark", swatches: ["#1f1f1f", "#181818", "#313131", "#2b2b2b", "#3c3c3c"] },
  { id: "github-dark", label: "GitHub Dark", swatches: ["#0d1117", "#010409", "#161b22", "#30363d", "#21262d"] },
];

type SettingsPageProps = {
  theme: WorkbenchTheme;
  onThemeChange: (theme: WorkbenchTheme) => void;
  fontFamily: string;
  onFontFamilyChange: (fontFamily: string) => void;
  fontSize: number;
  onFontSizeChange: (fontSize: number) => void;
  updateState: ApplicationUpdateState | null;
  updateAction: "checking" | "downloading" | "applying" | null;
  onCheckForUpdate: () => void;
  onDownloadUpdate: () => void;
  onApplyUpdate: () => void;
  storagePath: string | null;
  onChangeStorage: () => Promise<string | null>;
};

export function SettingsPage({
  theme,
  onThemeChange,
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
  updateState,
  updateAction,
  onCheckForUpdate,
  onDownloadUpdate,
  onApplyUpdate,
  storagePath,
  onChangeStorage,
}: SettingsPageProps) {
  const updateInfo = updateState?.updateInfo ?? null;
  const latestStatus = updateState?.statusHistory.at(-1);
  const isDevChannel = updateState?.localInfo.channel === "dev";
  const hasReleaseUrl = Boolean(updateState?.localInfo.baseUrl);
  const canDownload = Boolean(updateInfo?.updateAvailable && !updateInfo.updateReady);
  const canApply = Boolean(updateInfo?.updateReady);
  const isBusy = updateAction !== null;
  const [isChangingStorage, setIsChangingStorage] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(null);

  const handleChangeStorage = useCallback(async () => {
    setStorageError(null);
    setIsChangingStorage(true);
    try {
      await onChangeStorage();
    } catch (err) {
      setStorageError(
        err instanceof Error ? err.message : "Failed to change storage folder.",
      );
    } finally {
      setIsChangingStorage(false);
    }
  }, [onChangeStorage]);

  return (
    <section className="settings-page" aria-label="Settings">
      <header className="settings-page__header">
        <h2>Settings</h2>
        <p>Configure your workbench. Changes take effect immediately.</p>
      </header>

      <div className="settings-page__body">
        <section className="settings-page__section" aria-labelledby="settings-theme-title">
          <div className="settings-page__section-heading">
            <h3 id="settings-theme-title">Color theme</h3>
            <p>Pick the palette for the workbench. Each theme is tuned for long reading sessions with the grain inspector.</p>
          </div>

          <div className="settings-page__theme-stack">
            <div className="settings-page__theme-group">
              <h4 className="settings-page__theme-group-label">Light</h4>
              <div
                className="settings-page__theme-grid"
                role="radiogroup"
                aria-label="Light themes"
              >
                {LIGHT_THEMES.map((t) => (
                  <ThemeCard
                    key={t.id}
                    theme={t}
                    isSelected={theme === t.id}
                    onSelect={() => onThemeChange(t.id)}
                  />
                ))}
              </div>
            </div>

            <div className="settings-page__theme-group">
              <h4 className="settings-page__theme-group-label">Dark</h4>
              <div
                className="settings-page__theme-grid"
                role="radiogroup"
                aria-label="Dark themes"
              >
                {DARK_THEMES.map((t) => (
                  <ThemeCard
                    key={t.id}
                    theme={t}
                    isSelected={theme === t.id}
                    onSelect={() => onThemeChange(t.id)}
                  />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-response-title">
          <div className="settings-page__section-heading">
            <h3 id="settings-response-title">Response panel</h3>
            <p>Control how invocation results are displayed in the telemetry pane.</p>
          </div>
          <div className="settings-page__form-grid">
            <label className="settings-page__field">
              <span>Font family</span>
              <input
                aria-label="Response panel font family"
                type="text"
                value={fontFamily}
                onChange={(event) => onFontFamilyChange(event.target.value)}
                placeholder="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas"
              />
              <small>Any system monospace font or a comma-separated stack.</small>
            </label>
            <label className="settings-page__field settings-page__field--narrow">
              <span>Font size</span>
              <input
                aria-label="Response panel font size"
                type="number"
                min={8}
                max={32}
                value={fontSize}
                onChange={(event) =>
                  onFontSizeChange(Number(event.target.value))
                }
              />
              <small>Between 8 and 32 pixels.</small>
            </label>
          </div>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-storage-title">
          <div className="settings-page__section-heading">
            <h3 id="settings-storage-title">Data storage</h3>
            <p>Where your workspaces, feeds, and environments are saved on disk.</p>
          </div>
          <div className="settings-page__storage-panel">
            <div className="settings-page__storage-path">
              <span className="settings-page__storage-icon" aria-hidden="true">
                <FolderOpen width={16} height={16} />
              </span>
              <div className="settings-page__storage-detail">
                <strong>Storage folder</strong>
                <code className="settings-page__storage-value">
                  {storagePath ?? "Not configured — select a folder to get started."}
                </code>
              </div>
            </div>
            <button
              className="settings-page__storage-action"
              disabled={isChangingStorage}
              onClick={handleChangeStorage}
              type="button"
            >
              {isChangingStorage ? "Opening…" : "Change folder"}
            </button>
          </div>
          {storageError && (
            <p className="settings-page__storage-error" role="alert">
              {storageError}
            </p>
          )}
        </section>

        <section className="settings-page__section" aria-labelledby="settings-updates-title">
          <div className="settings-page__section-heading">
            <h3 id="settings-updates-title">Software updates</h3>
            <p>Current build, release channel, and update management.</p>
          </div>
          <div className="settings-page__update-panel">
            <div className="settings-page__update-summary" data-kind={statusKind(updateInfo, latestStatus?.status)}>
              <div className="settings-page__update-copy">
                <span className="settings-page__update-channel">
                  {updateState?.localInfo.channel || "Unknown"}
                </span>
                <strong>{formatUpdateHeadline(updateState)}</strong>
                <span>{formatUpdateDetail(updateState)}</span>
              </div>
              <div className="settings-page__update-actions">
                <button
                  disabled={isBusy || isDevChannel || !hasReleaseUrl}
                  onClick={onCheckForUpdate}
                  type="button"
                >
                  <RefreshCw aria-hidden="true" width={13} height={13} />
                  {updateAction === "checking" ? "Checking" : "Check"}
                </button>
                <button
                  disabled={isBusy || !canDownload}
                  onClick={onDownloadUpdate}
                  type="button"
                >
                  <Download aria-hidden="true" width={13} height={13} />
                  {updateAction === "downloading" ? "Downloading" : "Download"}
                </button>
                <button
                  disabled={isBusy || !canApply}
                  onClick={onApplyUpdate}
                  type="button"
                >
                  <RotateCcw aria-hidden="true" width={13} height={13} />
                  {updateAction === "applying" ? "Restarting" : "Restart"}
                </button>
              </div>
              {typeof latestStatus?.progress === "number" && (
                <progress value={latestStatus.progress} max={100} />
              )}
            </div>

            <dl className="settings-page__update-facts">
              <div>
                <dt>Version</dt>
                <dd>{updateState?.localInfo.version || "Unknown"}</dd>
              </div>
              <div>
                <dt>Build</dt>
                <dd>{formatBuildHash(updateState?.localInfo.hash)}</dd>
              </div>
              <div>
                <dt>Release URL</dt>
                <dd>{formatReleaseUrl(updateState?.localInfo.baseUrl)}</dd>
              </div>
            </dl>
          </div>
        </section>
      </div>
    </section>
  );
}

function formatBuildHash(hash?: string): string {
  return hash ? hash.slice(0, 8) : "Unknown";
}

function formatReleaseUrl(baseUrl?: string): string {
  if (!baseUrl) {
    return "Not configured";
  }

  try {
    const url = new URL(baseUrl);
    return `${url.hostname}${url.pathname}`;
  } catch {
    return baseUrl;
  }
}

function formatUpdateHeadline(state: ApplicationUpdateState | null): string {
  if (!state) {
    return "Loading update state";
  }

  if (state.localInfo.channel === "dev") {
    return "Dev build";
  }

  if (!state.localInfo.baseUrl) {
    return "Release URL not configured";
  }

  if (state.updateInfo?.updateReady) {
    return "Update ready to install";
  }

  if (state.updateInfo?.updateAvailable) {
    return "Update available";
  }

  if (state.updateInfo?.error) {
    return "Update check failed";
  }

  return state.statusHistory.at(-1)?.message ?? "Ready to check";
}

function formatUpdateDetail(state: ApplicationUpdateState | null): string {
  if (!state) {
    return "Reading bundled version metadata.";
  }

  const latestStatus = state.statusHistory.at(-1);
  if (state.localInfo.channel === "dev") {
    return "Packaged stable and canary builds check GitHub Releases.";
  }

  if (state.updateInfo?.error) {
    return state.updateInfo.error;
  }

  if (state.updateInfo?.updateReady) {
    return `Version ${state.updateInfo.version || "latest"} has been downloaded.`;
  }

  if (state.updateInfo?.updateAvailable) {
    return `Version ${state.updateInfo.version || "latest"} can be downloaded.`;
  }

  return latestStatus?.message ?? state.localInfo.baseUrl;
}

function statusKind(
  updateInfo: ApplicationUpdateState["updateInfo"],
  status?: string,
): "ready" | "error" | "neutral" {
  if (updateInfo?.error || status === "error") {
    return "error";
  }

  if (updateInfo?.updateAvailable || updateInfo?.updateReady) {
    return "ready";
  }

  return "neutral";
}

function ThemeCard({
  theme,
  isSelected,
  onSelect,
}: {
  theme: { id: WorkbenchTheme; label: string; swatches: string[] };
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      aria-checked={isSelected}
      aria-label={theme.label}
      className="theme-card"
      data-selected={isSelected}
      data-theme={theme.id}
      onClick={onSelect}
      role="radio"
      type="button"
    >
      <span className="theme-card__swatches" aria-hidden="true">
        {theme.swatches.map((color, i) => (
          <span
            key={i}
            className="theme-card__swatch"
            style={{ "--swatch-color": color } as React.CSSProperties}
          />
        ))}
        <span className="theme-card__accent" />
      </span>
      <span className="theme-card__label">{theme.label}</span>
      <span className="theme-card__indicator" aria-hidden="true" />
    </button>
  );
}
