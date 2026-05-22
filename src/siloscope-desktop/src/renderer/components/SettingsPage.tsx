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
};

export function SettingsPage({
  theme,
  onThemeChange,
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
}: SettingsPageProps) {
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
      </div>
    </section>
  );
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
