# Editor Shell Audit (Web vs Desktop)

Source files reviewed:
- `apps/web/src/App.tsx`
- `apps/desktop/renderer/src/App.tsx`
- `apps/web/src/styles/global.css`
- `apps/desktop/renderer/src/global.css.ts`

## Shared layout structure and class names
- Root editor layout is a push-style sidebar with `.editor-layout` and `data-sidebar-open`.
- Sidebar container uses `.editor-sidebar` and the main content area uses `.editor-canvas`.
- `NoteEditorPage` relies on `renderMenuButton` and uses `.note-editor-menu-button`.
- Note editor page layout uses `[data-testid="note-editor-page"]` and `[data-testid="note-editor-content"]`.

## Web-specific behavior and styling
- Router: `BrowserRouter` with routes for `/notes`, `/note/:id`, and `/settings`.
- Sidebar settings button: `Settings` icon button positioned in the sidebar bottom-left.
- Sidebar content: `NoteListPage` includes `className="pb-14"` to reserve space for settings.
- Menu toggle button: `Button` component with tailwind utility class names and `Menu` icon.
- App shell wraps `PluginProvider`, `CommandPaletteWithPlugins`, and `CommandPalette` at top-level.
- CSS source: Tailwind + custom CSS in `apps/web/src/styles/global.css`.

## Desktop-specific behavior and styling
- Router: `HashRouter` with routes for `/notes` and `/note/:id` only.
- Menu toggle button: plain `<button>` with `.sidebar-toggle-button` class.
- No settings button rendered in the sidebar.
- App shell includes Electron daemon port resolution and `PlatformProvider` with window/dialog/shell/update capabilities.
- CSS source: vanilla-extract `globalStyle` rules in `apps/desktop/renderer/src/global.css.ts`.

## Menu button styling differences
- Web uses `Button` with `variant="ghost"`, `size="icon"`, and a custom class string.
- Desktop uses `.sidebar-toggle-button` styles in `global.css.ts` (border, blur, hover states).

## Titlebar drag regions
- No explicit titlebar drag region styles or markup found in either `App.tsx` or the global styles listed above.

## CSS and token usage differences
- Web defines design tokens in `:root` CSS custom properties and tailwind `@theme`.
- Desktop pulls from design system `vars` tokens (color/typography/radius).
- Both define push-style sidebar layout rules with matching class names and data attribute.

## Required slots and class names to preserve
- Slot: `renderMenuButton` for `NoteEditorPage` (menu button placement).
- Slot: sidebar content area for `NoteListPage` (with optional settings footer).
- `editor-layout`, `editor-sidebar`, `editor-canvas`, `note-editor-menu-button`.
- `[data-testid="note-editor-page"]` and `[data-testid="note-editor-content"]` for layout styles.
