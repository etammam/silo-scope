type WorkbenchTheme = "dark" | "light" | "vscode-dark" | "vscode-light";

const lightThemes: { id: WorkbenchTheme; label: string }[] = [
  { id: "light", label: "Codex Light" },
  { id: "vscode-light", label: "VSCode Light" },
];

const darkThemes: { id: WorkbenchTheme; label: string }[] = [
  { id: "dark", label: "Codex Dark" },
  { id: "vscode-dark", label: "VSCode Dark" },
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
          <span>Appearance</span>
          <h2 id="settings-title">Themes</h2>
          <p>Choose a color theme for the workbench and editor.</p>
        </div>
      </header>

      <nav className="settings-page__sidebar" aria-label="Settings categories">
        <ul role="list">
          <li>
            <button
              aria-current="page"
              className="settings-page__nav-item settings-page__nav-item--active"
              type="button"
            >
              Appearance
            </button>
          </li>
        </ul>
      </nav>

      <div className="settings-page__body">
        <div className="settings-page__theme-section">
          <h3 className="settings-page__theme-heading">Light Theme</h3>
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

        <div className="settings-page__theme-section">
          <h3 className="settings-page__theme-heading">Dark Theme</h3>
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

        <div className="settings-page__theme-section">
          <h3 className="settings-page__theme-heading">Response Panel</h3>
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
        </div>
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
    </button>
  );
}
