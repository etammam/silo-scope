import { useEffect, useRef, useState } from "react";
import { Check, Globe, Pencil, Plus, Save, Trash2, X } from "lucide-react";
import type { EnvironmentProfile } from "../../shared/types";

type EnvironmentPageProps = {
  environments: EnvironmentProfile[];
  activeEnvironment: string | null;
  onEnvironmentsChange: (environments: EnvironmentProfile[], activeEnvironment: string | null) => void;
};

function cloneProfiles(profiles: EnvironmentProfile[]): EnvironmentProfile[] {
  return profiles.map((p) => ({ name: p.name, variables: { ...p.variables } }));
}

function profilesEqual(a: EnvironmentProfile[], b: EnvironmentProfile[]): boolean {
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
  onEnvironmentsChange,
}: EnvironmentPageProps) {
  const [draftProfiles, setDraftProfiles] = useState<EnvironmentProfile[]>(cloneProfiles(environments));
  const [draftActive, setDraftActive] = useState<string | null>(activeEnvironment);
  const [selectedProfile, setSelectedProfile] = useState(activeEnvironment ?? (environments[0]?.name ?? ""));
  const [envVarKey, setEnvVarKey] = useState("");
  const [envVarValue, setEnvVarValue] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [editKeyDraft, setEditKeyDraft] = useState("");
  const [editValueDraft, setEditValueDraft] = useState("");

  const lastEnvironmentsRef = useRef<EnvironmentProfile[]>(environments);
  const lastActiveRef = useRef<string | null>(activeEnvironment);

  // Only reset draft when the actual content of props changes (not just reference)
  useEffect(() => {
    const envChanged = !profilesEqual(environments, lastEnvironmentsRef.current);
    const activeChanged = activeEnvironment !== lastActiveRef.current;

    if (envChanged) {
      lastEnvironmentsRef.current = environments;
      setDraftProfiles(cloneProfiles(environments));
    }
    if (activeChanged) {
      lastActiveRef.current = activeEnvironment;
      setDraftActive(activeEnvironment);
    }
    if ((envChanged || activeChanged) && environments.length > 0 && !environments.some((e) => e.name === selectedProfile)) {
      setSelectedProfile(environments[0].name);
    }
  }, [environments, activeEnvironment, selectedProfile]);

  // Auto-dismiss toast after 3 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  const currentProfile = draftProfiles.find((e) => e.name === selectedProfile) ?? draftProfiles[0];

  const pendingKey = envVarKey.trim();
  const pendingValue = envVarValue.trim();
  const hasPendingInput = Boolean(pendingKey);

  const computeHasChanges = (): boolean => {
    if (draftActive !== activeEnvironment) return true;
    if (hasPendingInput) return true;
    if (!profilesEqual(draftProfiles, environments)) return true;
    return false;
  };

  const hasChanges = computeHasChanges();

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
    const nextActive = draftActive === selectedProfile
      ? (remaining[0]?.name ?? null)
      : draftActive;
    setDraftProfiles(remaining);
    setDraftActive(nextActive);
    setSelectedProfile(remaining[0]?.name ?? "");
  };

  const renameProfile = (newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed || draftProfiles.some((e) => e.name === trimmed && e.name !== selectedProfile)) return;
    const next = draftProfiles.map((e) =>
      e.name === selectedProfile ? { ...e, name: trimmed } : e,
    );
    const nextActive = draftActive === selectedProfile ? trimmed : draftActive;
    setDraftProfiles(next);
    setDraftActive(nextActive);
    setSelectedProfile(trimmed);
  };

  const addVariable = () => {
    if (!pendingKey || !currentProfile) return;
    const next = draftProfiles.map((e) =>
      e.name === selectedProfile
        ? { ...e, variables: { ...e.variables, [pendingKey]: pendingValue } }
        : e,
    );
    setDraftProfiles(next);
    setEnvVarKey("");
    setEnvVarValue("");
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
  };

  const setActive = (name: string) => {
    setDraftActive(name);
  };

  const handleSave = async () => {
    const profilesToSave = hasPendingInput ? flushPendingVariable() : draftProfiles;
    setIsSaving(true);
    try {
      await onEnvironmentsChange(profilesToSave, draftActive);
      setEnvVarKey("");
      setEnvVarValue("");
      setToast({ message: "Environments saved successfully", type: "success" });
    } catch (error) {
      setToast({
        message: error instanceof Error ? error.message : "Failed to save environments",
        type: "error",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="environment-page" aria-label="Environments">
      <header className="environment-page__header">
        <div>
          <span>Environments</span>
          <h2 id="environments-title">Environment Profiles</h2>
          <p>{draftProfiles.length} configured</p>
        </div>
        {draftProfiles.length > 0 && (
          <button
            aria-label="Save environment changes"
            className={`environment-page__save-button ${hasChanges ? "environment-page__save-button--dirty" : ""}`}
            disabled={!hasChanges || isSaving}
            onClick={handleSave}
            type="button"
          >
            <Save aria-hidden="true" width={14} height={14} />
            {isSaving ? "Saving..." : hasChanges ? "Save Changes" : "Saved"}
          </button>
        )}
      </header>

      <div className="environment-page__body">
        {draftProfiles.length === 0 ? (
          <div className="environment-page__empty-full">
            <div className="environment-page__empty-icon">
              <Globe aria-hidden="true" width={48} height={48} />
            </div>
            <h3>No environment profiles</h3>
            <p>Environment profiles let you manage variable sets for your grain invocations across all clusters.</p>
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
              <button
                className="environment-page__create-button"
                onClick={addProfile}
                type="button"
              >
                <Plus aria-hidden="true" width={14} height={14} />
                New profile
              </button>
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
                      <span className="environment-page__list-name">{env.name}</span>
                      {draftActive === env.name && (
                        <span className="environment-page__list-badge">Active</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <div className="environment-page__form-area">
              {currentProfile ? (
                <div className="environment-form">
                  <div className="environment-form__header">
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
                          {draftActive === currentProfile.name ? "Active" : "Set Active"}
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
                  </div>

                  <div className="environment-form__section">
                    <h4>Variables</h4>
                    <div className="environment-form__var-inputs">
                      <input
                        aria-label="Variable key"
                        placeholder="Key"
                        value={envVarKey}
                        onChange={(e) => setEnvVarKey(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            addVariable();
                          }
                        }}
                      />
                      <input
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
                      <button
                        aria-label="Add variable"
                        className="environment-form__mini-command"
                        disabled={!pendingKey}
                        onClick={addVariable}
                        title="Add variable"
                        type="button"
                      >
                        <Plus aria-hidden="true" width={12} height={12} />
                      </button>
                    </div>

                    {Object.entries(currentProfile.variables).length > 0 ? (
                      <ul className="environment-form__var-list" aria-label="Environment variables">
                        {Object.entries(currentProfile.variables).map(([key, value]) => (
                          <li key={key}>
                            {editingKey === key ? (
                              <>
                                <input
                                  aria-label="Edit variable key"
                                  className="environment-form__var-edit-input"
                                  value={editKeyDraft}
                                  onChange={(e) => setEditKeyDraft(e.target.value)}
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
                                <input
                                  aria-label="Edit variable value"
                                  className="environment-form__var-edit-input environment-form__var-edit-input--value"
                                  value={editValueDraft}
                                  onChange={(e) => setEditValueDraft(e.target.value)}
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
                                <button
                                  aria-label="Save variable edit"
                                  className="environment-form__mini-command"
                                  onClick={saveEditVariable}
                                  title="Save"
                                  type="button"
                                >
                                  <Check aria-hidden="true" width={12} height={12} />
                                </button>
                                <button
                                  aria-label="Cancel variable edit"
                                  className="environment-form__mini-command"
                                  onClick={cancelEditVariable}
                                  title="Cancel"
                                  type="button"
                                >
                                  <X aria-hidden="true" width={12} height={12} />
                                </button>
                              </>
                            ) : (
                              <>
                                <span className="environment-form__var-key">{key}</span>
                                <span className="environment-form__var-value">{value}</span>
                                <button
                                  aria-label={`Edit ${key}`}
                                  className="environment-form__mini-command"
                                  onClick={() => startEditVariable(key, value)}
                                  title="Edit"
                                  type="button"
                                >
                                  <Pencil aria-hidden="true" width={12} height={12} />
                                </button>
                                <button
                                  aria-label={`Remove ${key}`}
                                  className="environment-form__mini-command"
                                  onClick={() => removeVariable(key)}
                                  title="Remove"
                                  type="button"
                                >
                                  <X aria-hidden="true" width={12} height={12} />
                                </button>
                              </>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="environment-form__empty">No variables defined</div>
                    )}
                  </div>
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
        <div
          className={`environment-toast environment-toast--${toast.type}`}
          role="status"
          aria-live="polite"
        >
          {toast.type === "success" && <Check aria-hidden="true" width={14} height={14} />}
          {toast.type === "error" && <X aria-hidden="true" width={14} height={14} />}
          <span>{toast.message}</span>
        </div>
      )}
    </section>
  );
}
