import {
  AlertTriangle,
  Braces,
  Check,
  Globe,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { EnvironmentProfile } from "../../schema";
import { InlineAutocomplete } from "../../../../renderer/shared/components/InlineAutocomplete";
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
  const [toast, setToast] = useState<string | null>(null);
  const [keyError, setKeyError] = useState<string | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKeyDraft, setEditKeyDraft] = useState("");
  const [editValueDraft, setEditValueDraft] = useState("");
  const [editKeyError, setEditKeyError] = useState<string | null>(null);

  const envVarValueRef = useRef<HTMLInputElement>(null);
  const editValueRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2800);
    return () => clearTimeout(timer);
  }, [toast]);

  const currentProfile =
    draftProfiles.find((e) => e.name === selectedProfile) ?? draftProfiles[0];

  const pendingKey = envVarKey.trim();
  const pendingValue = envVarValue.trim();
  const hasPendingInput = Boolean(pendingKey);
  const isPendingKeyValid = hasPendingInput && keyError === null;

  const validateEnvKey = (key: string): string | null => {
    if (key.length === 0) return null;
    if (/\s/.test(key)) return "Variable names cannot contain spaces.";
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key))
      return "Only English letters, digits, and underscores.";
    if (key.length > 64)
      return "Variable names must be 64 characters or fewer.";
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

  // Clear save error when the user starts making changes again
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
    const profilesToSave = hasPendingInput
      ? flushPendingVariable()
      : draftProfiles;
    setIsSaving(true);
    setSaveError(null);
    try {
      await onEnvironmentsChange(profilesToSave, draftActive);
      setEnvVarKey("");
      setEnvVarValue("");
      setToast("Environments saved");
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save environments",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="environment-page" aria-label="Environments">
      <header className="environment-page__header">
        <h2>Environments</h2>
        <p>
          Manage variable sets for your grain invocations. Switch between
          environments from the titlebar selector.
        </p>
      </header>

      <div className="environment-page__body">
        {!hasWorkspace ? (
          <div className="environment-page__empty-full">
            <div className="environment-page__empty-icon">
              <Globe aria-hidden="true" width={32} height={32} />
            </div>
            <h3>No cluster selected</h3>
            <p>
              Environment profiles are scoped to a cluster. Select or create a
              cluster to manage its environments.
            </p>
          </div>
        ) : draftProfiles.length === 0 ? (
          <div className="environment-page__empty-full">
            <div className="environment-page__empty-icon">
              <Globe aria-hidden="true" width={32} height={32} />
            </div>
            <h3>No environment profiles</h3>
            <p>
              Define sets of variables to switch between when invoking grains.
              Each profile holds key-value pairs scoped to this cluster.
            </p>
            <button
              className="environment-page__empty-action"
              onClick={addProfile}
              type="button"
            >
              <Plus aria-hidden="true" width={14} height={14} />
              Create your first profile
            </button>
          </div>
        ) : (
          <>
            <div className="environment-page__sidebar">
              <div className="environment-page__sidebar-header">
                <span>
                  {draftProfiles.length}{" "}
                  {draftProfiles.length === 1 ? "profile" : "profiles"}
                </span>
                <button
                  className="environment-page__create-btn"
                  disabled={!hasWorkspace}
                  onClick={addProfile}
                  type="button"
                >
                  <Plus aria-hidden="true" width={14} height={14} />
                </button>
              </div>
              <ul className="environment-page__list" role="list">
                {draftProfiles.map((env) => (
                  <li
                    key={env.name}
                    className={`environment-page__list-item ${selectedProfile === env.name ? "environment-page__list-item--active" : ""} ${draftActive === env.name ? "environment-page__list-item--current" : ""}`}
                  >
                    <button
                      className="environment-page__list-button"
                      onClick={() => setSelectedProfile(env.name)}
                      type="button"
                    >
                      <span className="environment-page__list-name">
                        {env.name}
                      </span>
                      {draftActive === env.name && (
                        <span className="environment-page__list-badge">
                          Active
                        </span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="environment-page__form-area">
              {currentProfile ? (
                <div className="environment-form">
                  <div className="environment-form__toolbar">
                    <label className="environment-form__field">
                      <span>Profile name</span>
                      <input
                        aria-label="Environment profile name"
                        value={currentProfile.name}
                        onChange={(e) => renameProfile(e.target.value)}
                      />
                    </label>
                    <div className="environment-form__actions">
                      <button
                        aria-label="Set as active environment"
                        aria-pressed={draftActive === currentProfile.name}
                        className={`environment-form__action ${draftActive === currentProfile.name ? "environment-form__action--active" : ""}`}
                        onClick={() => setActive(currentProfile.name)}
                        type="button"
                      >
                        {draftActive === currentProfile.name
                          ? "Active"
                          : "Set active"}
                      </button>
                      <button
                        aria-label="Delete environment profile"
                        className="environment-form__action environment-form__action--danger"
                        disabled={draftProfiles.length === 0}
                        onClick={removeProfile}
                        title="Delete profile"
                        type="button"
                      >
                        <Trash2 aria-hidden="true" width={12} height={12} />
                      </button>
                    </div>
                  </div>

                  {saveError && (
                    <div className="environment-form__error" role="alert">
                      <div className="environment-form__error-header">
                        <AlertTriangle
                          aria-hidden="true"
                          width={14}
                          height={14}
                        />
                        <span>Save failed</span>
                        <button
                          aria-label="Dismiss error"
                          className="environment-form__error-dismiss"
                          onClick={dismissSaveError}
                          type="button"
                        >
                          <X aria-hidden="true" width={12} height={12} />
                        </button>
                      </div>
                      <p className="environment-form__error-message">
                        {saveError}
                      </p>
                    </div>
                  )}

                  <div className="environment-form__section">
                    <h4>Variables</h4>
                    <div className="environment-form__var-inputs">
                      <div className="environment-form__var-key-input">
                        <input
                          aria-label="Variable key"
                          aria-invalid={keyError !== null}
                          placeholder="Key"
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
                        envVars={Object.keys(currentProfile.variables)}
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
                        aria-label="Add variable"
                        className="environment-form__mini-command"
                        disabled={!isPendingKeyValid}
                        onClick={addVariable}
                        title={keyError ?? "Add variable"}
                        type="button"
                      >
                        <Plus aria-hidden="true" width={12} height={12} />
                      </button>
                    </div>

                    {Object.entries(currentProfile.variables).length > 0 ? (
                      <ul
                        className="environment-form__var-list"
                        aria-label="Environment variables"
                      >
                        {Object.entries(currentProfile.variables).map(
                          ([key, value]) => (
                            <li key={key}>
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
                                    envVars={Object.keys(
                                      currentProfile.variables,
                                    )}
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
                                  <button
                                    aria-label="Save variable edit"
                                    className="environment-form__mini-command"
                                    onClick={saveEditVariable}
                                    title="Save"
                                    type="button"
                                  >
                                    <Check
                                      aria-hidden="true"
                                      width={12}
                                      height={12}
                                    />
                                  </button>
                                  <button
                                    aria-label="Cancel variable edit"
                                    className="environment-form__mini-command"
                                    onClick={cancelEditVariable}
                                    title="Cancel"
                                    type="button"
                                  >
                                    <X
                                      aria-hidden="true"
                                      width={12}
                                      height={12}
                                    />
                                  </button>
                                </>
                              ) : (
                                <>
                                  <span className="environment-form__var-key">
                                    {key}
                                  </span>
                                  <span className="environment-form__var-value">
                                    {value}
                                  </span>
                                  <button
                                    aria-label={`Edit ${key}`}
                                    className="environment-form__mini-command"
                                    onClick={() =>
                                      startEditVariable(key, value)
                                    }
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
                                    aria-label={`Remove ${key}`}
                                    className="environment-form__mini-command"
                                    onClick={() => removeVariable(key)}
                                    title="Remove"
                                    type="button"
                                  >
                                    <X
                                      aria-hidden="true"
                                      width={12}
                                      height={12}
                                    />
                                  </button>
                                </>
                              )}
                            </li>
                          ),
                        )}
                      </ul>
                    ) : (
                      <div className="environment-form__empty">
                        <Braces aria-hidden="true" width={20} height={20} />
                        <span>No variables defined</span>
                      </div>
                    )}
                  </div>
                  {draftProfiles.length > 0 && (
                    <div className="environment-form__footer">
                      <button
                        aria-label="Save environment changes"
                        className={`environment-page__save-btn ${hasChanges ? "environment-page__save-btn--dirty" : ""}`}
                        disabled={!hasChanges || isSaving}
                        onClick={handleSave}
                        type="button"
                      >
                        <Save aria-hidden="true" width={14} height={14} />
                        {isSaving
                          ? "Saving…"
                          : hasChanges
                            ? "Save changes"
                            : "Saved"}
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="environment-page__empty-state">
                  Select or create an environment profile to edit.
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {toast && (
        <div className="environment-toast" role="status" aria-live="polite">
          <Check aria-hidden="true" width={14} height={14} />
          <span>{toast}</span>
        </div>
      )}
    </section>
  );
}
