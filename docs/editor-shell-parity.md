# EditorShell Parity Checklist (Web + Desktop)

Last verified: 2026-01-27

## Shell behavior
- [x] Sidebar menu button toggles `data-sidebar-open` in both clients (web Button variant, desktop `.sidebar-toggle-button`).
- [x] `.editor-layout`, `.editor-sidebar`, and `.editor-canvas` share layout sizing (push sidebar, 280px width, matching transitions).
- [x] `[data-testid='note-editor-page']` and `[data-testid='note-editor-content']` alignment and padding match (max width 750px, 100px top, 200px bottom, responsive horizontal padding).
- [x] `.note-editor-menu-button` uses shared positioning/opacity styles; desktop offsets top via inline style for titlebar clearance.

## Platform chrome
- [x] Settings button renders only in web sidebar footer and routes to settings.
- [x] Titlebar drag region renders only on desktop (40px height, behind menu button).
- [x] Menu button wrapper `.note-editor-menu-button` is shared; desktop offsets the button by 40px for titlebar clearance per chrome map.

## Gaps
- None.
