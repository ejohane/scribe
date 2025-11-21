# Minimal Markdown Editor UI

This document defines how to build the minimal, modern, markdown-native editor UI requested for Scribe. It focuses on keeping the canvas white with a blinking cursor, rendering Markdown as you type, revealing raw Markdown only where the cursor sits, and driving all actions through a `cmd+k` command palette.


## 1. Experience Goals
- Land on a blank white canvas with a native blinking caret; zero chrome until needed.
- Markdown is the source of truth: users type Markdown, the view renders formatting instantly; entering a formatted token reveals the raw markers so edits stay predictable.
- No toolbars; a `cmd+k` palette is the control surface for navigation, formatting commands, opening notes, and toggling modes.
- Typed interactions stay fluid; parsing/rendering must not block keystrokes.


## 2. Interaction Narrative
1) Launch -> blank white page with caret anchored at start.  
2) Typing Markdown immediately renders: `**bold**` shows as bold text.  
3) When the caret enters a formatted range (inside that bold text), the Markdown markers become visible for that range only; moving the caret out collapses back to formatted view.  
4) `cmd+k` opens a floating command palette over the canvas; commands are keyboard-first and searchable.  
5) Switching notes or actions still preserves the minimal canvas; overlays (palette, dialogs) are lightweight and dismiss to return to the blank page feel.


## 3. Architectural Overview
```
Renderer (React/Vite) -> EditorPage
  |- DocumentState (raw markdown, selection, debounce timers)
  |- ParserWorker (off-main-thread parse -> token spans with offsets)
  |- SelectionTracker (maps DOM selection -> text offsets)
  |- RenderModelBuilder (merges tokens + selection to render segments)
  |- InputSurface (contentEditable for actual text input)
  |- PresentationLayer (read-only overlay showing formatted text)
  |- CommandPalette (cmd+k overlay + command registry)

CoreClient (IPC) provides: getNote, listNotes/search, updateNote/save.
```


## 4. Document State & Parsing
- **Source of truth**: single string buffer of Markdown.
- **ParserWorker**: run `@scribe/parser` (extended to emit inline tokens and offsets for emphasis, italics, code, links, headings, lists) in a Web Worker. Debounce at ~30-50 ms to avoid blocking keystrokes.
- **Tokens**: enriched with `{ type, start, end, displayText, markers }` so the renderer knows what to hide/show. Keep a coarse block map (lines/paragraphs) to limit re-rendered regions after edits.
- **Selection tracking**: translate DOM selection to buffer offsets so the renderer can flag which tokens are "active" (caret or selection intersects).


## 5. Rendering Strategy (Markdown Reveal-on-Cursor)
- **Two-layer technique**:
  - *InputSurface*: a `contentEditable` that holds the real Markdown. Base text uses transparent color with visible caret; sections marked "active" flip to visible text color.
  - *PresentationLayer*: absolutely positioned overlay (`pointer-events: none`, `white-space: pre-wrap`) that displays formatted segments.
- **Segment building**:
  1. ParserWorker emits tokens with offsets.
  2. SelectionTracker identifies active spans (caret inside or selection overlaps).
  3. RenderModelBuilder walks the buffer and emits segments: `rendered` (show formatted text, hide Markdown markers) or `source` (show raw Markdown when active).
  4. PresentationLayer renders `rendered` segments; it omits/hides active ranges so the InputSurface text becomes visible there.
- **Graceful fallback**: if parsing fails or is pending, show plain Markdown (no hiding) so editing never blocks.
- **Alignment**: keep fonts/spacing identical between layers; mirror scroll positions; throttle overlay updates to animation frames.


## 6. Command Palette Architecture (`cmd+k`)
- **Global keybinding**: listener at App root opens/closes palette; scoped so `cmd+k` inside text still opens palette.
- **Registry**: commands defined as `{ id, title, keywords, run, source }`; supports static actions (toggle preview, new note) and data-backed actions (open note, search).
- **Data providers**: palette can pull note lists/search results via `CoreClient.listNotes`/`search`; defer heavy fetches until palette opens to stay idle on the blank page.
- **UI**: centered overlay, minimal chrome, keyboard-only (arrows/enter/esc); display subtle context hint (e.g., "Type a command or search notes").


## 7. Data & IPC Flow with Core Engine
- On mount, initialize `CoreClient` via preload IPC (`window.scribeAPI.sendRPCRequest`).
- **Loading**: `getNote` fetches markdown for the current note (or empty buffer for "Quick Note"). DocumentState seeds from this.
- **Saving**: add an `updateNoteContent` RPC (as outlined in UI Integration Architecture) and wrap it in `CoreClient`. Debounce saves (~500 ms idle or on blur) and surface errors non-invasively.
- **Search/navigation**: palette uses `search`/`listNotes`; future events (noteUpdated) can be wired once the core emits them.


## 8. Styling & Identity
- Canvas: pure white background, generous margins, no visible borders. Use a single refined sans-serif (e.g., "Inter Tight" fallback to system) with moderate weight contrast.
- Cursor: rely on native caret; ensure `caret-color` is a strong neutral (#111). Keep line height 1.5-1.6 for airy feel.
- Feedback: minimal; selections use a light neutral tint; overlays (palette) use subtle shadow/blur, no heavy chrome.
- Motion: limited to fade/slide for palette and small opacity transitions when toggling rendered/source ranges.


## 9. File/Module Placement (renderer)
- `apps/desktop/renderer/src/editor/`:
  - `EditorPage.tsx` (load note, own DocumentState, wire CoreClient)
  - `InputSurface.tsx` and `PresentationLayer.tsx`
  - `useSelectionTracker.ts`, `useParserWorker.ts`, `useRenderModel.ts`
  - `command-palette/` (registry, palette component, keybinding hook)
- Keep `styles.css` minimal; add an editor-specific stylesheet scoped to the editor container.


## 10. Implementation Slices (order of work)
- Build the dual-layer editor shell that mirrors scroll/selection and falls back to plain Markdown.
- Extend parser output for inline emphasis/strong/code/link markers with offsets and push it into the worker.
- Add reveal-on-cursor logic that hides overlay on active ranges and shows raw text underneath.
- Wire CoreClient for load/save/search and connect the command palette registry.
- Polish styling (spacing, typography, palette overlay) while preserving the blank-canvas feel.
