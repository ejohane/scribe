# EditorShell Shared Styles Plan

This plan defines the shared EditorShell layout styling surface and the per-client overrides allowed for web and desktop clients.

## Owning stylesheet

- Shared rules should live in `packages/web-core/src/styles/editor-shell.css.ts`.
- The file should define global styles for the EditorShell layout and note editor chrome.
- Web and desktop apps should import this stylesheet once at app startup.

## Shared class names and rule set

These selectors are shared across platforms and should be defined in the shared stylesheet:

- `.editor-layout`
  - Display: flex layout for full viewport.
  - Size: `height: 100vh`, `width: 100vw`.
  - Overflow: hidden.

- `.editor-layout[data-sidebar-open='true'] .editor-sidebar`
  - Sidebar width expansion.

- `.editor-sidebar`
  - Push-style sidebar: width/min-width transition, overflow hidden, flex-shrink: 0.

- `.editor-canvas`
  - Flexible main canvas, `position: relative`, `overflow: auto`, `z-index: 10`.

- `[data-testid='note-editor-page']`
  - Centered column layout with `position: relative`.

- `[data-testid='note-editor-content']`
  - Max width, padding, responsive horizontal spacing.

- `.note-editor-menu-button`
  - Chrome fade behavior via opacity + hover/typing transition.

## Allowed client overrides

These remain in platform-specific stylesheets:

- Color tokens and backgrounds (`background`, `foreground`, sidebar background).
- Menu button styling (`.sidebar-toggle-button` on desktop, `Button` variants on web).
- Sidebar footer layout (web-only settings button positioning and reserved padding).
- Titlebar drag region styling for Electron (`WebkitAppRegion: 'drag'`).
- Typography scale defaults and editor typography styles.

## Notes

- The shared stylesheet should avoid hard-coded colors. Use CSS custom properties or design tokens supplied by each client.
- Sidebar width (280px) is shared, but can be overridden if a platform needs a different breakpoint or width.
