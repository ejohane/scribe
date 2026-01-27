# EditorShell API Contract

This document defines the public API surface for the shared EditorShell layout so web and desktop clients can implement it consistently. EditorShell owns the layout structure and shared class names; clients provide content and platform-specific slots.

## Component contract

TypeScript interface shape:

```ts
export interface EditorShellProps {
  noteId: string | null;
  onNoteSelect: (noteId: string) => void;
  sidebarOpen?: boolean;
  defaultSidebarOpen?: boolean;
  onSidebarOpenChange?: (open: boolean) => void;
  onSettingsOpen?: () => void;
  renderMenuButton?: (args: {
    isOpen: boolean;
    toggle: () => void;
  }) => React.ReactNode;
  renderSidebarFooter?: (args: {
    isOpen: boolean;
  }) => React.ReactNode;
  renderSettingsButton?: (args: {
    onOpen: () => void;
  }) => React.ReactNode;
  renderTitlebarDragRegion?: () => React.ReactNode;
  children: React.ReactNode;
}
```

## Required props

- `noteId`: Selected note id or `null` when no note is active.
- `onNoteSelect`: Called by the sidebar note list when a note is selected.
- `children`: Editor canvas content, typically `NoteEditorPage`.

## Optional slots

- `renderMenuButton`: Slot for the menu toggle button rendered near the editor header. Receives `isOpen` and `toggle` so each client can style it but keep behavior consistent.
- `renderSidebarFooter`: Slot for sidebar footer content (settings button, status, etc.). Receives `isOpen` to allow conditional rendering.
- `renderSettingsButton`: Convenience slot for a settings button that invokes `onSettingsOpen` when provided.
- `renderTitlebarDragRegion`: Slot for platforms that need a draggable titlebar region (desktop).

## Sidebar open state defaults

- Default to `false` when no explicit state is provided.
- If `sidebarOpen` is provided, treat the component as controlled and use `onSidebarOpenChange` for updates.
- If `sidebarOpen` is not provided, initialize internal state from `defaultSidebarOpen` and update it on toggle.

## Required class names and data attributes

These are required for shared styling in web/desktop themes:

- Root container: `.editor-layout`
  - Uses `data-sidebar-open={true|false}` to power layout transitions.
- Sidebar container: `.editor-sidebar`
- Main canvas container: `.editor-canvas`
- Menu button wrapper within `NoteEditorPage`: `.note-editor-menu-button`
- Editor content targets: `[data-testid="note-editor-page"]` and `[data-testid="note-editor-content"]`

## Expected structure

```txt
editor-layout (data-sidebar-open)
├─ editor-sidebar
│  ├─ note list (NoteListPage)
│  └─ sidebar footer slot (optional)
└─ editor-canvas
   └─ editor content (NoteEditorPage)
```
