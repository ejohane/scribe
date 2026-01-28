# EditorShell Style Source of Truth

## Recommendation

Adopt a shared vanilla-extract stylesheet in `packages/web-core` as the single source of truth, imported by both web and desktop clients.

## Rationale

- Desktop already uses vanilla-extract, so this keeps the desktop pipeline intact.
- Web can import the generated CSS bundle from web-core without losing the current Tailwind setup.
- Shared selectors remain centralized while allowing per-client tokens via CSS variables (web) or design tokens (desktop).
- Avoids duplicating layout rules across separate CSS and vanilla-extract systems.

## Migration steps

1. Create `packages/web-core/src/styles/editor-shell.css.ts` with the shared selectors (`.editor-layout`, `.editor-sidebar`, `.editor-canvas`, `[data-testid='note-editor-page']`, `[data-testid='note-editor-content']`, `.note-editor-menu-button`).
2. Export the stylesheet entry from `packages/web-core/src/styles/index.ts` (new) and re-export in `packages/web-core/src/index.ts`.
3. Import the stylesheet in `apps/web/src/main.tsx` (or app entry) and `apps/desktop/renderer/src/main.tsx`.
4. Remove duplicated layout rules from `apps/web/src/styles/global.css` and `apps/desktop/renderer/src/global.css.ts` once the shared styles apply.
5. Keep per-client overrides (menu button, sidebar footer, tokens) in app-level styles.

## Notes

- The shared stylesheet should not hardcode colors; rely on CSS variables or tokens from each client.
- If web build constraints prevent vanilla-extract import, fall back to shipping a compiled CSS file from web-core as a temporary bridge.
