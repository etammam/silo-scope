import { Search, Send } from "lucide-react";

type RequestEmptyStateProps = {
  onOpenQuickAccess?: () => void;
  onOpenSources?: () => void;
};

export function RequestEmptyState({
  onOpenQuickAccess,
  onOpenSources,
}: RequestEmptyStateProps) {
  return (
    <div className="request-empty-state">
      <div className="request-empty-state__icon">
        <Send aria-hidden="true" width={48} height={48} />
      </div>
      <h3 className="request-empty-state__title">Select a function to get started</h3>
      <p className="request-empty-state__description">
        Choose a grain method to start building and invoking requests. You can browse the
        Sources panel or use Quick Access to search across all available functions.
      </p>
      <div className="request-empty-state__actions">
        {onOpenQuickAccess && (
          <button
            className="request-empty-state__action request-empty-state__action--primary"
            onClick={onOpenQuickAccess}
            type="button"
          >
            <Search aria-hidden="true" width={14} height={14} />
            Open Quick Access
          </button>
        )}
        {onOpenSources && (
          <button
            className="request-empty-state__action request-empty-state__action--secondary"
            onClick={onOpenSources}
            type="button"
          >
            Browse Sources
          </button>
        )}
      </div>
    </div>
  );
}
