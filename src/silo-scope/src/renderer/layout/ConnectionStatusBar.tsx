import { Loader2 } from "lucide-react";
import type { ConnectionStatus } from "../../features/workspaces/renderer/state";

type ConnectionStatusBarProps = {
  status: ConnectionStatus;
  step: string;
  error: string | null;
  clusterName?: string;
  onDismissError: () => void;
};

export function ConnectionStatusBar({
  status,
  step,
  error,
  clusterName,
  onDismissError,
}: ConnectionStatusBarProps) {
  const name = clusterName ?? "cluster";

  if (status === "disconnected") {
    return (
      <>
        <span
          className="conn-status__dot conn-status__dot--idle"
          aria-hidden="true"
        />
        <span className="conn-status__text">Disconnected</span>
      </>
    );
  }

  if (status === "connecting") {
    return (
      <>
        <Loader2
          aria-hidden="true"
          className="conn-status__spinner"
          width={11}
          height={11}
        />
        <span className="conn-status__text">{step}</span>
      </>
    );
  }

  if (status === "connected") {
    return (
      <>
        <span
          className="conn-status__dot conn-status__dot--live"
          aria-hidden="true"
        />
        <span className="conn-status__text">{name}</span>
      </>
    );
  }

  // error
  return (
    <>
      <span
        className="conn-status__dot conn-status__dot--fault"
        aria-hidden="true"
      />
      <span className="conn-status__text">{error ?? "Connection failed"}</span>
      <button
        className="conn-status__dismiss"
        onClick={onDismissError}
        type="button"
        aria-label="Dismiss error"
      >
        ×
      </button>
    </>
  );
}
