# SiloScope Design Notes

## Direction

SiloScope should feel like a modern developer workbench, close to the current VS Code desktop idiom: dense, quiet, monochrome, and utility-first. It is not a marketing page, dashboard hero, or card-heavy SaaS surface. The first screen should look like an application ready for repeated technical work.

## Theme

- Use one monochrome gray scale per theme.
- Avoid accent colors for core chrome, navigation, active states, and empty states.
- Dark and light themes are both baseline requirements from day zero.
- Keep contrast strong enough for labels, active navigation, and buttons, but avoid bright white blocks.
- Borders should be subtle and structural, not decorative.
- Shadows should be avoided in the main workbench. Use borders and surface changes instead.

Current dark theme intent:

```css
--ui-0: #181818; /* workbench/editor background */
--ui-1: #1e1e1e; /* titlebar/sidebar surfaces */
--ui-2: #242424; /* raised/hover surfaces */
--ui-3: #303030; /* borders/dividers */
--ui-4: #3c3c3c; /* stronger borders */
--ui-5: #858585; /* muted text/icons */
--ui-6: #c8c8c8; /* normal text */
--ui-7: #f2f2f2; /* high-emphasis text */
```

Light theme mirrors the same roles with a monochrome gray scale. It should preserve the workbench grammar rather than become a separate visual product.

## Layout

The desktop app uses a VS Code-like workbench grid:

- Native macOS titlebar remains visible through `hiddenInset`.
- App title/command field is centered in the titlebar.
- App-level settings live at the far right of the titlebar.
- Titlebar workbench actions include navigation collapse, request/response layout toggle, response collapse, and settings.
- Left Activity Bar is narrow and icon-only.
- Navigation Sidebar sits between Activity Bar and workbench content.
- Main workbench area has a slim toolbar and resizable request/response panes.

Current column structure:

```text
48px Activity Bar | 256px Navigation Sidebar | flexible Workbench
```

Current row structure:

```text
34px Titlebar
remaining Workbench
```

## Titlebar

- Keep native window controls.
- The SiloScope command/title field must remain centered relative to the full window, not shifted by right-side controls.
- Right-side controls should be actual app actions, not decorative placeholders.
- Settings currently belongs in the titlebar, not the Activity Bar.
- Response pane visibility is a titlebar-level workbench action beside Settings.
- Navigation sidebar visibility is a titlebar-level workbench action; the Activity Bar remains visible.
- Request/response panes can be side-by-side or stacked using a titlebar layout toggle.
- Titlebar controls must use `electrobun-webkit-app-region-no-drag`.

## Activity Bar

- Icon-only.
- Contains primary work views only.
- Current items: Workspace, NuGet.
- Settings does not belong here unless it becomes a primary full-height work view.
- Active state uses a slim monochrome left indicator.
- Icons should be monochrome and symbolic, not letter badges when possible.

## Navigation Sidebar

- Functions like a VS Code explorer panel.
- Section headers are uppercase, compact, and muted.
- Rows are dense and truncation-safe.
- Do not use large cards inside the sidebar.
- Empty states should be quiet and textual.

## Workbench Content

- Avoid hero-page layout.
- Avoid large floating cards.
- Use editor/workbench patterns: toolbar, start page, quick actions, panels.
- Request and response editors must use the same dark Monaco theme as the surrounding workbench.
- Empty editor surfaces should still be dark; no white loading, gutter, or read-only panes.
- Request and response panes must be resizable in both side-by-side and stacked layouts.
- Empty state should help the user start real work:
  - Open workspace
  - Connect cluster
  - Discover grains
- Quick actions should be compact rows, not oversized tiles.

## Typography

- Use system/developer-tool typography.
- Avoid display-style or marketing-scale type.
- Workbench headings should be compact.
- Section labels can be uppercase but should stay muted.
- Letter spacing should remain subtle and never negative.

## Controls

- Buttons should look like native workbench controls: small, bordered, and flat.
- Form fields should be flat dark workbench controls, not browser or macOS default glossy controls.
- Use icon buttons for persistent chrome actions.
- Use text buttons for explicit commands such as `Open Workspace`.
- Preserve accessibility labels on icon-only controls.
- Focus states should be visible but monochrome.

## Visual Rules

- No gradients.
- No colorful accent palette.
- No decorative blobs, orbs, or illustrations.
- No nested cards.
- No marketing hero sections.
- No bright white panels inside the dark workbench.
- Prefer separators, toolbars, and panels over cards.

## Current Known Refinement Areas

- Replace CSS-drawn placeholder icons with a consistent icon library when one is added.
- Make titlebar Settings open a real settings surface.
- Add functional Navigation Sidebar content for Workspace and NuGet.
- Introduce the remaining workbench panes from the plan without changing the overall workbench grammar.
- Add visual regression screenshots once browser automation is part of the normal workflow.
