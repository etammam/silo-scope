import { describe, expect, it, vi } from "vitest";
import {
  createApplicationMenuTemplate,
  fileMenuActions,
  getApplicationMenuAction,
  helpMenuActions,
  installApplicationMenu,
  viewMenuActions,
} from "@/main/applicationMenu";

describe("application menu", () => {
  it("creates the File menu with workspace operations and native exit", () => {
    const menu = createApplicationMenuTemplate();

    expect(menu).toEqual([
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
          { type: "separator" },
          { role: "selectAll" },
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
      {
        label: "Help",
        submenu: [
          { label: "Documentation", action: helpMenuActions.openDocumentation },
          { label: "About SiloScope", action: helpMenuActions.showAbout },
        ],
      },
    ]);
  });

  it("maps native menu events to file actions", () => {
    expect(getApplicationMenuAction({ data: { action: fileMenuActions.newWorkspace } })).toBe("newWorkspace");
    expect(getApplicationMenuAction({ data: { action: fileMenuActions.openWorkspace } })).toBe("openWorkspace");
    expect(getApplicationMenuAction({ data: { action: fileMenuActions.saveWorkspace } })).toBe("saveWorkspace");
    expect(getApplicationMenuAction({ data: { action: viewMenuActions.toggleTelemetryPane } })).toBe(
      "toggleTelemetryPane",
    );
    expect(getApplicationMenuAction({ data: { action: viewMenuActions.zoomIn } })).toBe("zoomIn");
    expect(getApplicationMenuAction({ data: { action: helpMenuActions.openDocumentation } })).toBe(
      "openDocumentation",
    );
    expect(getApplicationMenuAction({ data: { action: helpMenuActions.showAbout } })).toBe("showAbout");
    expect(getApplicationMenuAction({ data: { action: "unknown" } })).toBeNull();
  });

  it("installs the native menu and forwards file actions", () => {
    const setApplicationMenu = vi.fn();
    const on = vi.fn();
    const onFileAction = vi.fn();

    installApplicationMenu({
      ApplicationMenu: { setApplicationMenu },
      events: { on },
      onMenuAction: onFileAction,
    });

    expect(setApplicationMenu).toHaveBeenCalledWith(createApplicationMenuTemplate());
    expect(on).toHaveBeenCalledWith("application-menu-clicked", expect.any(Function));

    const handler = on.mock.calls[0][1];
    handler({ data: { action: fileMenuActions.saveWorkspace } });

    expect(onFileAction).toHaveBeenCalledWith("saveWorkspace");
  });
});
