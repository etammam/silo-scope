import { ArrowRight, Command, Search, Zap } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import "./request-empty-state.css";

type RequestEmptyStateProps = {
  onOpenQuickAccess?: () => void;
  onOpenSources?: () => void;
};

const TIPS = [
  "Start typing to search across all grain methods",
  "Use Quick Access to jump to any function instantly",
  "Select a grain from Sources to explore its methods",
  "Save your request contexts for quick re-invocation",
];

export function RequestEmptyState({
  onOpenQuickAccess,
  onOpenSources,
}: RequestEmptyStateProps) {
  const [tipIndex, setTipIndex] = useState(0);
  const isMac = useMemo(() => navigator.userAgent.includes("Mac"), []);

  useEffect(() => {
    const interval = setInterval(() => {
      setTipIndex((i) => (i + 1) % TIPS.length);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="request-empty-state">
      <div className="request-empty-state__hero">
        <div className="request-empty-state__icon-ring">
          <div className="request-empty-state__icon">
            <Zap aria-hidden="true" width={32} height={32} />
          </div>
        </div>

        <h3 className="request-empty-state__title">Ready to invoke</h3>
        <p className="request-empty-state__description">
          Select a grain method to start building and invoking requests.
        </p>
      </div>

      <div className="request-empty-state__actions">
        {onOpenQuickAccess && (
          <button
            className="request-empty-state__action request-empty-state__action--primary"
            onClick={onOpenQuickAccess}
            type="button"
          >
            <Search aria-hidden="true" width={15} height={15} />
            <span>Quick Access</span>
            <kbd className="request-empty-state__kbd">
              {isMac ? "⌘K" : "Ctrl+K"}
            </kbd>
          </button>
        )}
        {onOpenSources && (
          <button
            className="request-empty-state__action request-empty-state__action--secondary"
            onClick={onOpenSources}
            type="button"
          >
            <span>Browse Sources</span>
            <ArrowRight aria-hidden="true" width={14} height={14} />
          </button>
        )}
      </div>

      <div className="request-empty-state__tip" aria-live="polite">
        <Command aria-hidden="true" width={12} height={12} />
        <span key={tipIndex}>{TIPS[tipIndex]}</span>
      </div>
    </div>
  );
}
