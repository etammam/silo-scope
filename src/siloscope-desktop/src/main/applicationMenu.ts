export type FileMenuAction = "newWorkspace" | "openWorkspace" | "saveWorkspace";
export type ViewMenuAction =
  | "toggleActivityBar"
  | "toggleNavigationSidebar"
  | "toggleTelemetryPane"
  | "zoomIn"
  | "zoomOut";
export type ApplicationMenuAction = FileMenuAction | ViewMenuAction;

type ApplicationMenuItem =
  | { type: "divider" | "separator" }
  | {
      label?: string;
      action?: string;
      role?: string;
      accelerator?: string;
      submenu?: ApplicationMenuItem[];
    };

type ApplicationMenuApi = {
  setApplicationMenu: (menu: ApplicationMenuItem[]) => void;
};

type ApplicationEventsApi = {
  on: (name: "application-menu-clicked", handler: (event: unknown) => void) => void;
};

export const fileMenuActions = {
  newWorkspace: "file:new-workspace",
  openWorkspace: "file:open-workspace",
  saveWorkspace: "file:save-workspace",
} as const;

export const viewMenuActions = {
  toggleActivityBar: "view:toggle-activity-bar",
  toggleNavigationSidebar: "view:toggle-navigation-sidebar",
  toggleTelemetryPane: "view:toggle-telemetry-pane",
  zoomIn: "view:zoom-in",
  zoomOut: "view:zoom-out",
} as const;

export function createApplicationMenuTemplate(): ApplicationMenuItem[] {
  return [
    {
      label: "File",
      submenu: [
        { label: "New Workspace", action: fileMenuActions.newWorkspace, accelerator: "n" },
        { label: "Open Workspace", action: fileMenuActions.openWorkspace, accelerator: "o" },
        { label: "Save Workspace", action: fileMenuActions.saveWorkspace, accelerator: "s" },
        { type: "separator" },
        { label: "Exit", role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
      ],
    },
    {
      label: "View",
      submenu: [
        { label: "Toggle Activity Bar", action: viewMenuActions.toggleActivityBar },
        { label: "Toggle Navigation Sidebar", action: viewMenuActions.toggleNavigationSidebar },
        { label: "Toggle Telemetry Pane", action: viewMenuActions.toggleTelemetryPane },
        { type: "separator" },
        { label: "Zoom In", action: viewMenuActions.zoomIn },
        { label: "Zoom Out", action: viewMenuActions.zoomOut },
      ],
    },
  ];
}

export function installApplicationMenu({
  ApplicationMenu,
  events,
  onMenuAction,
}: {
  ApplicationMenu: ApplicationMenuApi;
  events: ApplicationEventsApi;
  onMenuAction: (action: ApplicationMenuAction) => void;
}) {
  ApplicationMenu.setApplicationMenu(createApplicationMenuTemplate());
  events.on("application-menu-clicked", (event) => {
    const action = getApplicationMenuAction(event);
    if (action) {
      onMenuAction(action);
    }
  });
}

export function getApplicationMenuAction(event: unknown): ApplicationMenuAction | null {
  const action = (event as { data?: { action?: unknown } })?.data?.action;
  if (action === fileMenuActions.newWorkspace) {
    return "newWorkspace";
  }

  if (action === fileMenuActions.openWorkspace) {
    return "openWorkspace";
  }

  if (action === fileMenuActions.saveWorkspace) {
    return "saveWorkspace";
  }

  if (action === viewMenuActions.toggleActivityBar) {
    return "toggleActivityBar";
  }

  if (action === viewMenuActions.toggleNavigationSidebar) {
    return "toggleNavigationSidebar";
  }

  if (action === viewMenuActions.toggleTelemetryPane) {
    return "toggleTelemetryPane";
  }

  if (action === viewMenuActions.zoomIn) {
    return "zoomIn";
  }

  if (action === viewMenuActions.zoomOut) {
    return "zoomOut";
  }

  return null;
}
