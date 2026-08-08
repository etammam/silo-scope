import { Loader2 } from "lucide-react";
import type { ConnectionStatus } from "../store";

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
      <span className="conn-status" title="Disconnected">
        <span className="conn-status__pulse conn-status__pulse--idle" aria-hidden="true" />
        <span className="conn-status__text">Disconnected</span>
      </span>
    );
  }

  if (status === "connecting") {
    return (
      <span className="conn-status conn-status--acquiring" title={step}>
        <Loader2 aria-hidden="true" className="conn-status__spinner" width={11} height={11} />
        <span className="conn-status__text">{step}</span>
      </span>
    );
  }

  if (status === "connected") {
    return (
      <span className="conn-status conn-status--locked" title={step || `Connected to ${name}`}>
        <span className="conn-status__pulse conn-status__pulse--live" aria-hidden="true" />
        <span className="conn-status__text">{name}</span>
      </span>
    );
  }

  // error
  return (
    <span className="conn-status conn-status--fault" title={error ?? ""}>
      <span className="conn-status__pulse conn-status__pulse--fault" aria-hidden="true" />
      <span className="conn-status__text">{error ?? "Connection failed"}</span>
      <button
        className="conn-status__dismiss"
        onClick={onDismissError}
        type="button"
        aria-label="Dismiss"
      >
        ×
      </button>
    </span>
  );
}
