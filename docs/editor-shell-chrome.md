# EditorShell Platform Chrome Map

This map captures platform-specific UI elements that must be slotted into the shared EditorShell while keeping the shell layout platform agnostic.

## Slot map

| Slot | Platform | Purpose | Location | Styling constraints |
| --- | --- | --- | --- | --- |
| `renderMenuButton` | Web + Desktop | Toggle the sidebar open/closed. | Rendered inside `NoteEditorPage` as `.note-editor-menu-button` at the top-left (positioned absolutely). | Must work within the `.note-editor-menu-button` wrapper and keep a 16px-32px icon footprint. Web uses `Button` variants; desktop uses `.sidebar-toggle-button` styling. |
| `renderSidebarFooter` | Web (primary) | Optional footer content under the note list (settings button or status). | Bottom-left of `.editor-sidebar`, below `NoteListPage`. | Footer should fit within the sidebar width and reserve vertical space in the note list (web uses padding to avoid overlap). |
| `renderSettingsButton` | Web | Open settings surface. | Typically placed inside the sidebar footer slot (absolute bottom-left in web). | Keep icon-only button with hover affordances and `aria-label`.
| `renderTitlebarDragRegion` | Desktop | Provide a draggable titlebar region for Electron. | Absolute positioned strip across the top of `NoteEditorPage` content. | Must set `WebkitAppRegion: 'drag'`, 40px height, and `z-index` below the menu button. |

## Notes

- The `renderTitlebarDragRegion` is only needed for Electron. Web should omit it.
- The sidebar footer slot can be empty on desktop (currently no footer UI).
- The menu button wrapper is required for consistent positioning and should keep the `.note-editor-menu-button` class.
