import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";

type SidecarStatusProps = {
  checkStatus: () => Promise<{ running: boolean }>;
  restart: () => Promise<{ running: boolean }>;
};

export function SidecarStatus({ checkStatus, restart }: SidecarStatusProps) {
  const [running, setRunning] = useState<boolean | null>(null);
  const [restarting, setRestarting] = useState(false);

  const refresh = useCallback(() => {
    checkStatus().then((s) => setRunning(s.running)).catch(() => setRunning(false));
  }, [checkStatus]);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 10_000);
    return () => clearInterval(interval);
  }, [refresh]);

  const handleRestart = async () => {
    setRestarting(true);
    try {
      const s = await restart();
      setRunning(s.running);
    } catch {
      setRunning(false);
    } finally {
      setRestarting(false);
    }
  };

  return (
    <button
      className={`sidecar-status ${restarting ? "sidecar-status--restarting" : running ? "sidecar-status--live" : "sidecar-status--dead"}`}
      onClick={handleRestart}
      disabled={restarting}
      title={running ? "Core running — click to restart" : "Core stopped — click to restart"}
      type="button"
    >
      <span
        className={`sidecar-status__dot ${restarting ? "sidecar-status__dot--restarting" : running ? "sidecar-status__dot--live" : "sidecar-status__dot--dead"}`}
        aria-hidden="true"
      />
      <span className="sidecar-status__text">
        {restarting ? "Restarting…" : running ? "Running" : "Stopped"}
      </span>
      <RefreshCw
        aria-hidden="true"
        width={10}
        height={10}
        className={restarting ? "sidecar-status__icon--spin" : "sidecar-status__icon"}
      />
    </button>
  );
}
