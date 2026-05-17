export type ActivityView = "workspace" | "nuget" | "settings";

type ActivityBarItem = {
  id: ActivityView;
  label: string;
  iconClass: string;
};

const activityItems: ActivityBarItem[] = [
  { id: "workspace", label: "Workspace", iconClass: "activity-icon--workspace" },
  { id: "nuget", label: "NuGet", iconClass: "activity-icon--nuget" },
];

type ActivityBarProps = {
  activeView: ActivityView;
  onViewChange: (view: ActivityView) => void;
};

export function ActivityBar({ activeView, onViewChange }: ActivityBarProps) {
  return (
    <nav className="activity-bar" aria-label="Primary views">
      <div className="activity-bar__brand" aria-label="SiloScope">
        Si
      </div>

      <div className="activity-bar__items" role="list">
        {activityItems.map((item) => (
          <button
            aria-label={item.label}
            aria-pressed={activeView === item.id}
            className="activity-bar__button"
            key={item.id}
            onClick={() => onViewChange(item.id)}
            title={item.label}
            type="button"
          >
            <span aria-hidden="true" className={`activity-icon ${item.iconClass}`} />
          </button>
        ))}
      </div>
    </nav>
  );
}
