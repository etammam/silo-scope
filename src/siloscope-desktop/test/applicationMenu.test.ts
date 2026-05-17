import { describe, expect, it, vi } from "vitest";
import {
  createApplicationMenuTemplate,
  fileMenuActions,
  getFileMenuAction,
  installApplicationMenu,
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
    ]);
  });

  it("maps native menu events to file actions", () => {
    expect(getFileMenuAction({ data: { action: fileMenuActions.newWorkspace } })).toBe("newWorkspace");
    expect(getFileMenuAction({ data: { action: fileMenuActions.openWorkspace } })).toBe("openWorkspace");
    expect(getFileMenuAction({ data: { action: fileMenuActions.saveWorkspace } })).toBe("saveWorkspace");
    expect(getFileMenuAction({ data: { action: "unknown" } })).toBeNull();
  });

  it("installs the native menu and forwards file actions", () => {
    const setApplicationMenu = vi.fn();
    const on = vi.fn();
    const onFileAction = vi.fn();

    installApplicationMenu({
      ApplicationMenu: { setApplicationMenu },
      events: { on },
      onFileAction,
    });

    expect(setApplicationMenu).toHaveBeenCalledWith(createApplicationMenuTemplate());
    expect(on).toHaveBeenCalledWith("application-menu-clicked", expect.any(Function));

    const handler = on.mock.calls[0][1];
    handler({ data: { action: fileMenuActions.saveWorkspace } });

    expect(onFileAction).toHaveBeenCalledWith("saveWorkspace");
  });
});
