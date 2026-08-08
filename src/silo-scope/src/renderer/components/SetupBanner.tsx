import { AlertCircle, FolderOpen, Loader2 } from "lucide-react";
import { useCallback, useState } from "react";

interface SetupBannerProps {
  isStorageReady: boolean;
  onSetupComplete: (path: string) => void;
}

type SetupState = "idle" | "selecting" | "verifying" | "error";

export function SetupBanner({
  isStorageReady,
  onSetupComplete,
}: SetupBannerProps) {
  const [state, setState] = useState<SetupState>("idle");
  const [error, setError] = useState<string | null>(null);

  const handleSelectFolder = useCallback(async () => {
    if (typeof window.api?.storage?.selectFolder !== "function") {
      setError(
        "Storage API is not available. Make sure you're running in the desktop app.",
      );
      setState("error");
      return;
    }

    setState("selecting");
    setError(null);

    try {
      const selectedPath = await window.api.storage.selectFolder();
      if (!selectedPath) {
        setState("idle");
        return;
      }

      setState("verifying");

      const isValid = await window.api.storage.verify(selectedPath);
      if (!isValid) {
        setError(
          "Cannot write to this folder. Choose a different location with write permissions.",
        );
        setState("error");
        return;
      }

      onSetupComplete(selectedPath);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "An unexpected error occurred.",
      );
      setState("error");
    }
  }, [onSetupComplete]);

  if (isStorageReady) {
    return null;
  }

  const isBusy = state === "selecting" || state === "verifying";
  const Icon = isBusy ? Loader2 : FolderOpen;

  return (
    <div className="setup-overlay" role="alert" aria-live="polite">
      <div className="setup-card">
        <div className="setup-card__icon">
          <div className="setup-card__icon-ring">
            <Icon
              aria-hidden="true"
              width={28}
              height={28}
              className={isBusy ? "setup-card__spinner" : undefined}
            />
          </div>
        </div>

        <h1 className="setup-card__heading">Welcome to SiloScope</h1>

        <p className="setup-card__description">
          Choose a folder on your system where SiloScope stores your data —
          feeds, workspaces, environments. Everything stays local.
        </p>

        <button
          className="setup-card__button"
          disabled={isBusy}
          onClick={handleSelectFolder}
          type="button"
        >
          {isBusy ? (
            <>
              <Loader2
                aria-hidden="true"
                width={15}
                height={15}
                className="setup-card__spinner"
              />
              {state === "verifying" ? "Verifying folder…" : "Opening…"}
            </>
          ) : (
            <>
              <FolderOpen aria-hidden="true" width={15} height={15} />
              Select storage folder
            </>
          )}
        </button>

        {error && (
          <div className="setup-card__error" role="status">
            <AlertCircle aria-hidden="true" width={14} height={14} />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
}
