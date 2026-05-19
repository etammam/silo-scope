import { Folder, Package } from "lucide-react";

export type ActivityView = "workspace" | "nuget" | "settings";

type ActivityBarItem = {
  id: ActivityView;
  label: string;
  Icon: React.ComponentType<{
    width?: number;
    height?: number;
    className?: string;
  }>;
};

const activityItems: ActivityBarItem[] = [
  { id: "workspace", label: "Workspace", Icon: Folder },
  { id: "nuget", label: "NuGet", Icon: Package },
];

type ActivityBarProps = {
  activeView: ActivityView;
  onViewChange: (view: ActivityView) => void;
};

export function ActivityBar({
  activeView,
  onViewChange,
}: ActivityBarProps) {
  return (
    <nav className="activity-bar" aria-label="Primary views">
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
            <item.Icon
              aria-hidden="true"
              className="activity-icon"
              width={18}
              height={18}
            />
          </button>
        ))}
      </div>
    </nav>
  );
}
