import {
  AlertTriangle,
  Braces,
  Check,
  CheckCircle2,
  ChevronRight,
  Layers,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { InlineAutocomplete } from "../../../../renderer/shared/components/InlineAutocomplete";
import type { EnvironmentProfile } from "../../schema";
import "./environment-page.css";

type EnvironmentPageProps = {
  environments: EnvironmentProfile[];
  activeEnvironment: string | null;
  hasWorkspace: boolean;
  onEnvironmentsChange: (
    environments: EnvironmentProfile[],
    activeEnvironment: string | null,
  ) => void;
};

function cloneProfiles(profiles: EnvironmentProfile[]): EnvironmentProfile[] {
  return profiles.map((p) => ({ name: p.name, variables: { ...p.variables } }));
}

function profilesEqual(
  a: EnvironmentProfile[],
  b: EnvironmentProfile[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i].name !== b[i].name) return false;
    const aKeys = Object.keys(a[i].variables);
    const bKeys = Object.keys(b[i].variables);
    if (aKeys.length !== bKeys.length) return false;
    for (const key of aKeys) {
      if (a[i].variables[key] !== b[i].variables[key]) return false;
    }
  }
  return true;
}

export function EnvironmentPage({
  environments,
  activeEnvironment,
  hasWorkspace,
  onEnvironmentsChange,
}: EnvironmentPageProps) {
  const [draftProfiles, setDraftProfiles] = useState<EnvironmentProfile[]>(
    cloneProfiles(environments),
  );
  const [draftActive, setDraftActive] = useState<string | null>(
    activeEnvironment,
  );
  const [selectedProfile, setSelectedProfile] = useState(
    activeEnvironment ?? environments[0]?.name ?? "",
  );
  const [envVarKey, setEnvVarKey] = useState("");
  const [envVarValue, setEnvVarValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [profileNameDraft, setProfileNameDraft] = useState("");
  const [profileNameError, setProfileNameError] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKeyDraft, setEditKeyDraft] = useState("");
  const [editValueDraft, setEditValueDraft] = useState("");
  const [editKeyError, setEditKeyError] = useState<string | null>(null);

  const envVarValueRef = useRef<HTMLInputElement>(null);
  const editValueRef = useRef<HTMLInputElement>(null);
  const saveBarRef = useRef<HTMLDivElement>(null);

  const lastEnvironmentsRef = useRef<EnvironmentProfile[]>(environments);
  const lastActiveRef = useRef<string | null>(activeEnvironment);

  useEffect(() => {
    const envChanged = !profilesEqual(
      environments,
      lastEnvironmentsRef.current,
    );
    const activeChanged = activeEnvironment !== lastActiveRef.current;

    if (envChanged) {
      lastEnvironmentsRef.current = environments;
      setDraftProfiles(cloneProfiles(environments));
    }
    if (activeChanged) {
      lastActiveRef.current = activeEnvironment;
      setDraftActive(activeEnvironment);
    }
    if (
      (envChanged || activeChanged) &&
      environments.length > 0 &&
      !environments.some((e) => e.name === selectedProfile)
    ) {
      setSelectedProfile(environments[0].name);
    }
  }, [environments, activeEnvironment, selectedProfile]);

  // Clear success indicator after a delay
  useEffect(() => {
    if (!saveSuccess) return;
    const timer = setTimeout(() => setSaveSuccess(false), 2000);
    return () => clearTimeout(timer);
  }, [saveSuccess]);

  // Sync profile name draft when the selected profile changes
  useEffect(() => {
    if (currentProfile) {
      setProfileNameDraft(currentProfile.name);
      setProfileNameError(null);
    }
  }, [selectedProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const currentProfile =
    draftProfiles.find((e) => e.name === selectedProfile) ?? draftProfiles[0];

  const pendingKey = envVarKey.trim();
  const pendingValue = envVarValue.trim();
  const hasPendingInput = Boolean(pendingKey);
  const isPendingKeyValid = hasPendingInput && keyError === null;

  const totalVarCount = Object.values(draftProfiles).reduce(
    (sum, p) => sum + Object.keys(p.variables).length,
    0,
  );

  const validateEnvKey = (key: string): string | null => {
    if (key.length === 0) return null;
    if (/\s/.test(key)) return "Variable names cannot contain spaces.";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key))
      return "Only letters, digits, and underscores (must start with a letter or underscore).";
    if (key.length > 64) return "Must be 64 characters or fewer.";
    return null;
  };

  const handleKeyChange = (value: string) => {
    setEnvVarKey(value);
    setKeyError(validateEnvKey(value.trim()));
  };

  const handleEditKeyChange = (value: string) => {
    setEditKeyDraft(value);
    setEditKeyError(validateEnvKey(value.trim()));
  };

  const computeHasChanges = (): boolean => {
    if (draftActive !== activeEnvironment) return true;
    if (hasPendingInput) return true;
    if (!profilesEqual(draftProfiles, environments)) return true;
    return false;
  };

  const hasChanges = computeHasChanges();

  const dismissSaveError = useCallback(() => setSaveError(null), []);

  useEffect(() => {
    if (hasChanges && saveError) {
      setSaveError(null);
    }
  }, [hasChanges, saveError]);

  const flushPendingVariable = (): EnvironmentProfile[] => {
    if (!pendingKey || !currentProfile) return draftProfiles;
    const next = draftProfiles.map((e) =>
      e.name === selectedProfile
        ? { ...e, variables: { ...e.variables, [pendingKey]: pendingValue } }
        : e,
    );
    return next;
  };

  const addProfile = () => {
    const baseName = "New Environment";
    let name = baseName;
    let counter = 1;
    while (draftProfiles.some((e) => e.name === name)) {
      name = `${baseName} ${counter}`;
      counter++;
    }
    const newProfile: EnvironmentProfile = { name, variables: {} };
    setDraftProfiles([...draftProfiles, newProfile]);
    setSelectedProfile(name);
    if (!draftActive) setDraftActive(name);
  };

  const removeProfile = () => {
    if (draftProfiles.length === 0) return;
    const remaining = draftProfiles.filter((e) => e.name !== selectedProfile);
    const nextActive =
      draftActive === selectedProfile
        ? (remaining[0]?.name ?? null)
        : draftActive;
    setDraftProfiles(remaining);
    setDraftActive(nextActive);
    setSelectedProfile(remaining[0]?.name ?? "");
  };

  const renameProfile = (newName: string) => {
    const trimmed = newName;
    if (
      !trimmed ||
      draftProfiles.some(
        (e) => e.name === trimmed && e.name !== selectedProfile,
      )
    )
      return;
    const next = draftProfiles.map((e) =>
      e.name === selectedProfile ? { ...e, name: trimmed } : e,
    );
    const nextActive = draftActive === selectedProfile ? trimmed : draftActive;
    setDraftProfiles(next);
    setDraftActive(nextActive);
    setSelectedProfile(trimmed);
  };

  const validateProfileName = (name: string): string | null => {
    const trimmed = name.trim();
    if (!trimmed) return "Profile name is required.";
    if (
      draftProfiles.some(
        (e) => e.name === trimmed && e.name !== selectedProfile,
      )
    )
      return "A profile with this name already exists.";
    return null;
  };

  const commitProfileName = (): boolean => {
    const trimmed = profileNameDraft.trim();
    const error = validateProfileName(profileNameDraft);
    setProfileNameError(error);
    if (error) {
      if (currentProfile) setProfileNameDraft(currentProfile.name);
      return false;
    }
    if (trimmed === currentProfile?.name) return true;
    renameProfile(trimmed);
    return true;
  };

  const addVariable = () => {
    if (!pendingKey || !currentProfile || !isPendingKeyValid) return;
    const next = draftProfiles.map((e) =>
      e.name === selectedProfile
        ? { ...e, variables: { ...e.variables, [pendingKey]: pendingValue } }
        : e,
    );
    setDraftProfiles(next);
    setEnvVarKey("");
    setEnvVarValue("");
    setKeyError(null);
    // Focus back on key input for rapid entry
    setTimeout(() => {
      const keyInput = document.querySelector<HTMLInputElement>(
        '[aria-label="Variable key"]',
      );
      keyInput?.focus();
    }, 0);
  };

  const removeVariable = (key: string) => {
    const next = draftProfiles.map((e) => {
      if (e.name !== selectedProfile) return e;
      const nextVars = { ...e.variables };
      delete nextVars[key];
      return { ...e, variables: nextVars };
    });
    setDraftProfiles(next);
  };

  const startEditVariable = (key: string, value: string) => {
    setEditingKey(key);
    setEditKeyDraft(key);
    setEditValueDraft(value);
  };

  const saveEditVariable = () => {
    if (!editingKey) return;
    const newKey = editKeyDraft.trim();
    const newValue = editValueDraft.trim();
    if (!newKey) return;
    if (validateEnvKey(newKey)) return;

    const next = draftProfiles.map((e) => {
      if (e.name !== selectedProfile) return e;
      const nextVars = { ...e.variables };
      if (editingKey !== newKey) {
        delete nextVars[editingKey];
      }
      nextVars[newKey] = newValue;
      return { ...e, variables: nextVars };
    });
    setDraftProfiles(next);
    setEditingKey(null);
    setEditKeyDraft("");
    setEditValueDraft("");
  };

  const cancelEditVariable = () => {
    setEditingKey(null);
    setEditKeyDraft("");
    setEditValueDraft("");
    setEditKeyError(null);
  };

  const setActive = (name: string) => {
    setDraftActive(name);
  };

  const handleSave = async () => {
    if (!commitProfileName()) return;
    const profilesToSave = hasPendingInput
      ? flushPendingVariable()
      : draftProfiles;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onEnvironmentsChange(profilesToSave, draftActive);
      setEnvVarKey("");
      setEnvVarValue("");
      setSaveSuccess(true);
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save environments",
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ── Empty state: no workspace ──
  if (!hasWorkspace) {
    return (
      <section className="environment-page" aria-label="Environments">
        <div className="environment-page__empty-full">
          <div className="environment-page__empty-icon">
            <Layers aria-hidden="true" width={28} height={28} />
          </div>
          <h3>No cluster connected</h3>
          <p>
            Environment profiles are tied to a cluster. Connect to or create a
            cluster first, then return here to manage your variable sets.
          </p>
        </div>
      </section>
    );
  }

  // ── Empty state: no profiles ──
  if (draftProfiles.length === 0) {
    return (
      <section className="environment-page" aria-label="Environments">
        <div className="environment-page__empty-full">
          <div className="environment-page__empty-icon">
            <Braces aria-hidden="true" width={28} height={28} />
          </div>
          <h3>No environment profiles yet</h3>
          <p>
            Create profiles to hold key-value variables that get substituted
            into your grain invocations. Switch between them instantly from the
            titlebar.
          </p>
          <button
            className="environment-page__empty-action"
            onClick={addProfile}
            type="button"
          >
            <Plus aria-hidden="true" width={15} height={15} />
            Create your first profile
          </button>
        </div>
      </section>
    );
  }

  const profileVarCount = currentProfile
    ? Object.keys(currentProfile.variables).length
    : 0;

  return (
    <section className="environment-page" aria-label="Environments">
      {/* ── Sidebar ── */}
      <aside className="environment-page__sidebar" aria-label="Profiles">
        <div className="environment-page__sidebar-header">
          <span>
            {draftProfiles.length}{" "}
            {draftProfiles.length === 1 ? "profile" : "profiles"}
            {totalVarCount > 0 && (
              <>
                {" "}
                · {totalVarCount} {totalVarCount === 1 ? "var" : "vars"}
              </>
            )}
          </span>
          <button
            className="environment-page__create-btn"
            onClick={addProfile}
            type="button"
            aria-label="Create new environment profile"
          >
            <Plus aria-hidden="true" width={14} height={14} />
          </button>
        </div>

        <ul className="environment-page__list" role="list">
          {draftProfiles.map((env) => {
            const varCount = Object.keys(env.variables).length;
            const isSelected = selectedProfile === env.name;
            const isCurrent = draftActive === env.name;

            return (
              <li
                key={env.name}
                className={`environment-page__list-item${isSelected ? " environment-page__list-item--selected" : ""}${isCurrent ? " environment-page__list-item--current" : ""}`}
              >
                <button
                  className="environment-page__list-button"
                  onClick={() => setSelectedProfile(env.name)}
                  type="button"
                >
                  <span className="environment-page__list-icon">
                    {isCurrent ? (
                      <CheckCircle2 aria-hidden="true" width={15} height={15} />
                    ) : (
                      <ChevronRight aria-hidden="true" width={15} height={15} />
                    )}
                  </span>
                  <span className="environment-page__list-name">
                    {env.name}
                  </span>
                  <span className="environment-page__list-meta">
                    {varCount > 0
                      ? `${varCount} ${varCount === 1 ? "var" : "vars"}`
                      : "Empty"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </aside>

      {/* ── Main form area ── */}
      <div className="environment-page__form-area">
        {/* Page header */}
        <div className="environment-page__form-header">
          <h2 className="environment-page__form-title">Environments</h2>
          <p className="environment-page__form-subtitle">
            Manage variable sets for your grain invocations. Switch between
            environments from the titlebar selector.
          </p>
        </div>

        <div className="environment-form">
          {/* Top row: Profile card + Usage card */}
          <div className="environment-form__top-row">
            {/* Profile card */}
            <section
              className="environment-form__card"
              aria-label="Profile settings"
            >
              <div className="environment-form__card-header">
                <h3 className="environment-form__card-title">Profile</h3>
                {draftActive === currentProfile?.name && (
                  <span className="environment-form__active-pill">
                    <CheckCircle2 aria-hidden="true" width={12} height={12} />
                    Active
                  </span>
                )}
              </div>

              <div className="environment-form__card-body">
                <label className="environment-form__field">
                  <span className="environment-form__label">Profile name</span>
                  <input
                    aria-label="Environment profile name"
                    aria-invalid={profileNameError !== null}
                    aria-describedby={
                      profileNameError ? "profile-name-error" : undefined
                    }
                    value={profileNameDraft}
                    onChange={(e) => {
                      setProfileNameDraft(e.target.value);
                      setProfileNameError(null);
                    }}
                    onBlur={() => commitProfileName()}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        commitProfileName();
                      }
                    }}
                    placeholder="e.g. Production, Staging, Local Dev"
                  />
                  {profileNameError && (
                    <span
                      id="profile-name-error"
                      className="environment-form__field-error"
                      role="alert"
                    >
                      {profileNameError}
                    </span>
                  )}
                </label>

                <div className="environment-form__actions">
                  <button
                    className={`environment-form__action${draftActive === currentProfile?.name ? " environment-form__action--active" : ""}`}
                    onClick={() => setActive(currentProfile!.name)}
                    aria-pressed={draftActive === currentProfile?.name}
                    type="button"
                  >
                    <CheckCircle2 aria-hidden="true" width={13} height={13} />
                    {draftActive === currentProfile?.name
                      ? "Currently active"
                      : "Set as active"}
                  </button>
                  <button
                    className="environment-form__action environment-form__action--danger"
                    onClick={removeProfile}
                    disabled={draftProfiles.length <= 1}
                    aria-label="Delete this profile"
                    title={
                      draftProfiles.length <= 1
                        ? "Cannot delete the last profile"
                        : "Delete profile"
                    }
                    type="button"
                  >
                    <Trash2 aria-hidden="true" width={13} height={13} />
                    Delete
                  </button>
                </div>
              </div>
            </section>

            {/* Usage card */}
            <section
              className="environment-form__card environment-form__card--usage"
              aria-label="Usage hints"
            >
              <div className="environment-form__card-header">
                <h3 className="environment-form__card-title">How it works</h3>
              </div>
              <div className="environment-form__card-body">
                <p className="environment-form__usage-text">
                  Reference variables in your grain invocation payloads using
                  either syntax:
                </p>
                <div className="environment-form__usage-codes">
                  <code className="environment-form__usage-code">
                    {"${env:SOME_KEY}"}
                  </code>
                  <span className="environment-form__usage-or">or</span>
                  <code className="environment-form__usage-code">
                    {"{{SOME_KEY}}"}
                  </code>
                </div>
                <p className="environment-form__usage-text">
                  The active profile&rsquo;s values are substituted at
                  invocation time. Switch profiles from the titlebar selector
                  without editing your payloads.
                </p>
              </div>
            </section>
          </div>

          {/* Variables card — full width */}
          <section
            className="environment-form__card environment-form__card--variables"
            aria-label="Environment variables"
          >
            <div className="environment-form__card-header">
              <h3 className="environment-form__card-title">Variables</h3>
              <span className="environment-form__card-badge">
                {profileVarCount}{" "}
                {profileVarCount === 1 ? "variable" : "variables"}
              </span>
            </div>

            <div className="environment-form__card-body">
              {/* Add variable row */}
              <div className="environment-form__var-inputs">
                <div className="environment-form__var-key-input">
                  <input
                    aria-label="Variable key"
                    aria-invalid={keyError !== null}
                    aria-describedby={keyError ? "var-key-error" : undefined}
                    placeholder="Variable name"
                    value={envVarKey}
                    onChange={(e) => handleKeyChange(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addVariable();
                      }
                    }}
                  />
                  {keyError && (
                    <span
                      id="var-key-error"
                      className="environment-form__var-error"
                      role="alert"
                    >
                      <AlertTriangle
                        aria-hidden="true"
                        width={10}
                        height={10}
                      />
                      {keyError}
                    </span>
                  )}
                </div>
                <InlineAutocomplete
                  envVars={Object.keys(currentProfile?.variables ?? {})}
                >
                  <input
                    ref={envVarValueRef}
                    aria-label="Variable value"
                    placeholder="Value"
                    value={envVarValue}
                    onChange={(e) => setEnvVarValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addVariable();
                      }
                    }}
                  />
                </InlineAutocomplete>
                <button
                  className="environment-form__mini-command environment-form__mini-command--add"
                  disabled={!isPendingKeyValid}
                  onClick={addVariable}
                  aria-label={keyError ?? "Add variable"}
                  title={keyError ?? "Add variable"}
                  type="button"
                >
                  <Plus aria-hidden="true" width={13} height={13} />
                </button>
              </div>

              {/* Variable list */}
              {profileVarCount > 0 ? (
                <ul
                  className="environment-form__var-list"
                  aria-label="Defined variables"
                  role="list"
                >
                  {Object.entries(currentProfile!.variables).map(
                    ([key, value]) => (
                      <li
                        key={key}
                        className={`environment-form__var-row${editingKey === key ? " environment-form__var-row--editing" : ""}`}
                      >
                        {editingKey === key ? (
                          <>
                            <div className="environment-form__var-key-input environment-form__var-key-input--edit">
                              <input
                                aria-label="Edit variable key"
                                aria-invalid={editKeyError !== null}
                                className="environment-form__var-edit-input"
                                value={editKeyDraft}
                                onChange={(e) =>
                                  handleEditKeyChange(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    saveEditVariable();
                                  }
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelEditVariable();
                                  }
                                }}
                                autoFocus
                              />
                              {editKeyError && (
                                <span
                                  className="environment-form__var-error"
                                  role="alert"
                                >
                                  <AlertTriangle
                                    aria-hidden="true"
                                    width={10}
                                    height={10}
                                  />
                                  {editKeyError}
                                </span>
                              )}
                            </div>
                            <InlineAutocomplete
                              envVars={Object.keys(currentProfile!.variables)}
                            >
                              <input
                                ref={editValueRef}
                                aria-label="Edit variable value"
                                className="environment-form__var-edit-input environment-form__var-edit-input--value"
                                value={editValueDraft}
                                onChange={(e) =>
                                  setEditValueDraft(e.target.value)
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    saveEditVariable();
                                  }
                                  if (e.key === "Escape") {
                                    e.preventDefault();
                                    cancelEditVariable();
                                  }
                                }}
                              />
                            </InlineAutocomplete>
                            <div className="environment-form__var-row-actions">
                              <button
                                className="environment-form__mini-command environment-form__mini-command--confirm"
                                onClick={saveEditVariable}
                                aria-label="Confirm edit"
                                title="Confirm"
                                type="button"
                              >
                                <Check
                                  aria-hidden="true"
                                  width={12}
                                  height={12}
                                />
                              </button>
                              <button
                                className="environment-form__mini-command"
                                onClick={cancelEditVariable}
                                aria-label="Cancel edit"
                                title="Cancel"
                                type="button"
                              >
                                <X aria-hidden="true" width={12} height={12} />
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <code className="environment-form__var-key">
                              {key}
                            </code>
                            <span className="environment-form__var-value">
                              {value || (
                                <span className="environment-form__var-value--empty">
                                  (empty)
                                </span>
                              )}
                            </span>
                            <div className="environment-form__var-row-actions">
                              <button
                                className="environment-form__mini-command"
                                onClick={() => startEditVariable(key, value)}
                                aria-label={`Edit variable ${key}`}
                                title="Edit"
                                type="button"
                              >
                                <Pencil
                                  aria-hidden="true"
                                  width={12}
                                  height={12}
                                />
                              </button>
                              <button
                                className="environment-form__mini-command environment-form__mini-command--remove"
                                onClick={() => removeVariable(key)}
                                aria-label={`Remove variable ${key}`}
                                title="Remove"
                                type="button"
                              >
                                <X aria-hidden="true" width={12} height={12} />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    ),
                  )}
                </ul>
              ) : (
                <div className="environment-form__empty">
                  <Braces aria-hidden="true" width={24} height={24} />
                  <span>No variables defined for this profile</span>
                  <span className="environment-form__empty-hint">
                    Add a key-value pair above to start building your variable
                    set
                  </span>
                </div>
              )}

              {/* Save error */}
              {saveError && (
                <div className="environment-form__error" role="alert">
                  <AlertTriangle aria-hidden="true" width={14} height={14} />
                  <div className="environment-form__error-body">
                    <strong>Save failed</strong>
                    <span>{saveError}</span>
                  </div>
                  <button
                    className="environment-form__error-dismiss"
                    onClick={dismissSaveError}
                    aria-label="Dismiss error"
                    type="button"
                  >
                    <X aria-hidden="true" width={12} height={12} />
                  </button>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>

      {/* ── Sticky save bar ── */}
      <div
        ref={saveBarRef}
        className={`environment-page__save-bar${hasChanges ? " environment-page__save-bar--dirty" : ""}${saveSuccess ? " environment-page__save-bar--success" : ""}`}
      >
        <div className="environment-page__save-bar-status">
          {saveSuccess ? (
            <>
              <CheckCircle2 aria-hidden="true" width={14} height={14} />
              <span>Saved successfully</span>
            </>
          ) : hasChanges ? (
            <>
              <span className="environment-page__save-bar-dot" />
              <span>Unsaved changes</span>
            </>
          ) : (
            <>
              <CheckCircle2 aria-hidden="true" width={14} height={14} />
              <span>All changes saved</span>
            </>
          )}
        </div>
        <div className="environment-page__save-bar-actions">
          <kbd className="environment-page__save-bar-kbd">⌘S</kbd>
          <button
            className="environment-page__save-bar-btn"
            disabled={!hasChanges || isSaving}
            onClick={handleSave}
            type="button"
          >
            <Save aria-hidden="true" width={14} height={14} />
            {isSaving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </section>
  );
}
