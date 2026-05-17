export type FileMenuAction = "newWorkspace" | "openWorkspace" | "saveWorkspace";

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
  ];
}

export function installApplicationMenu({
  ApplicationMenu,
  events,
  onFileAction,
}: {
  ApplicationMenu: ApplicationMenuApi;
  events: ApplicationEventsApi;
  onFileAction: (action: FileMenuAction) => void;
}) {
  ApplicationMenu.setApplicationMenu(createApplicationMenuTemplate());
  events.on("application-menu-clicked", (event) => {
    const action = getFileMenuAction(event);
    if (action) {
      onFileAction(action);
    }
  });
}

export function getFileMenuAction(event: unknown): FileMenuAction | null {
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

  return null;
}
