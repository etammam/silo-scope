import { Download, RefreshCw, RotateCcw } from "lucide-react";
import type { AppUpdateState } from "../../shared/types";

type WorkbenchTheme = "dark" | "light" | "vscode-dark" | "vscode-light";

const lightThemes: { id: WorkbenchTheme; label: string }[] = [
  { id: "light", label: "Codex Light" },
  { id: "vscode-light", label: "VS Code Light" },
];

const darkThemes: { id: WorkbenchTheme; label: string }[] = [
  { id: "dark", label: "Codex Dark" },
  { id: "vscode-dark", label: "VS Code Dark" },
];

type SettingsPageProps = {
  theme: WorkbenchTheme;
  onThemeChange: (theme: WorkbenchTheme) => void;
  fontFamily: string;
  onFontFamilyChange: (fontFamily: string) => void;
  fontSize: number;
  onFontSizeChange: (fontSize: number) => void;
  updateState: AppUpdateState | null;
  updateAction: "checking" | "downloading" | "applying" | null;
  onCheckForUpdate: () => void;
  onDownloadUpdate: () => void;
  onApplyUpdate: () => void;
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
}: SettingsPageProps) {
  const updateInfo = updateState?.updateInfo ?? null;
  const latestStatus = updateState?.statusHistory.at(-1);
  const isDevChannel = updateState?.localInfo.channel === "dev";
  const hasReleaseUrl = Boolean(updateState?.localInfo.baseUrl);
  const canDownload = Boolean(updateInfo?.updateAvailable && !updateInfo.updateReady);
  const canApply = Boolean(updateInfo?.updateReady);
  const isBusy = updateAction !== null;

  return (
    <section className="settings-page" aria-label="Settings">
      <header className="settings-page__header">
        <div>
          <span>Settings</span>
          <h2 id="settings-title">Appearance</h2>
          <p>Theme and response panel preferences.</p>
        </div>
      </header>

      <div className="settings-page__body">
        <section className="settings-page__section" aria-labelledby="settings-theme-title">
          <div className="settings-page__section-heading">
            <h3 id="settings-theme-title">Color Theme</h3>
            <p>Choose the workbench palette.</p>
          </div>

          <div className="settings-page__theme-stack">
            <div className="settings-page__theme-group">
              <h4>Light</h4>
              <div
                className="settings-page__theme-grid"
                role="radiogroup"
                aria-label="Light themes"
              >
                {lightThemes.map((t) => (
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
              <h4>Dark</h4>
              <div
                className="settings-page__theme-grid"
                role="radiogroup"
                aria-label="Dark themes"
              >
                {darkThemes.map((t) => (
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
            <h3 id="settings-response-title">Response Panel</h3>
            <p>Control response text rendering.</p>
          </div>
          <div className="settings-page__form-row">
            <label className="settings-page__input-label">
              <span>Font family</span>
              <input
                aria-label="Response panel font family"
                type="text"
                value={fontFamily}
                onChange={(event) => onFontFamilyChange(event.target.value)}
                placeholder="ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas"
              />
            </label>
            <label className="settings-page__input-label settings-page__input-label--narrow">
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
            </label>
          </div>
        </section>

        <section className="settings-page__section" aria-labelledby="settings-updates-title">
          <div className="settings-page__section-heading">
            <h3 id="settings-updates-title">Software Updates</h3>
            <p>Current build and release channel.</p>
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

function formatUpdateHeadline(state: AppUpdateState | null): string {
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

function formatUpdateDetail(state: AppUpdateState | null): string {
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
  updateInfo: AppUpdateState["updateInfo"],
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
  theme: { id: WorkbenchTheme; label: string };
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
      <span className="theme-card__editor" aria-hidden="true">
        <span className="theme-card__line" />
        <span className="theme-card__line" />
        <span className="theme-card__line" />
        <span className="theme-card__line" />
        <span className="theme-card__line" />
      </span>
      <span className="theme-card__label">{theme.label}</span>
      <span className="theme-card__check" aria-hidden="true" />
    </button>
  );
}
