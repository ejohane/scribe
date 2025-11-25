# Decision 7: Editor Architecture & Lexical Integration

This document defines the **editor architecture** for Scribe, including how the Lexical editor is integrated, how state flows through the system, how notes are loaded and saved, and how the editor interacts with the command palette and engine. This decision finalizes how the writing experience is structured for the MVP.

---

# 1. Overview

Scribe uses **Lexical** as its rich-text editor. Lexical provides:

- A structured, serializable JSON document format
- A plugin-based architecture
- Strong guarantees about state consistency
- High performance even on large documents

Scribe’s MVP editor design focuses on:

- Simplicity (full-screen, distraction-free)
- Immediate responsiveness
- Reliable JSON-based persistence

The editor does **not** include formatting controls, toolbars, or UI chrome. It is a blank canvas with a blinking cursor.

---

# 2. Core Principles

The editor architecture is built around the following principles:

### **1. Lexical JSON is the single source of truth**

The editor's state is always managed as a Lexical document tree.

### **2. Minimal UI**

The editor displays content only—no sidebar, no toolbar, no secondary panes.

### **3. Engine-driven persistence**

The editor does not perform filesystem operations. Instead, it:

- Loads note content via `window.scribe.notes.read()`
- Saves note content via `window.scribe.notes.save()`

### **4. Autosave with explicit manual save**

The editor supports:

- Debounced autosave on text changes
- Manual save via `cmd+s`

### **5. Seamless command palette integration**

The editor coexists with the command palette, which overlays non-destructively.

---

# 3. Editor Component Structure

Scribe's editor consists of a small number of components:

```
Editor/
  EditorRoot.tsx
  useNoteState.ts
  plugins/
    AutosavePlugin.ts
    MetadataExtractionPlugin.ts
    CommandPaletteOverlay.tsx
```

### **EditorRoot.tsx**

- Initializes Lexical
- Loads the selected note’s content
- Re-renders when the active note changes

### **useNoteState.ts**

Custom React hook that:

- Tracks current note ID
- Loads note data via preload
- Trigger save operations
- Maps Lexical state to engine note format

### **AutosavePlugin**

- Watches Lexical updates
- Debounces and triggers `window.scribe.notes.save()`

### **MetadataExtractionPlugin**

- Provides hints to the engine about metadata extraction
- Optional in MVP; metadata is primarily extracted in engine, but Lexical plugins may help with structured nodes later

### **CommandPaletteOverlay**

- Constrains the editor visually when palette is open
- Forward keyboard events appropriately

---

# 4. Note Loading Lifecycle

The editor loads a note via the following flow:

1. Renderer triggers note open (via command palette)
2. Preload API loads note JSON via IPC
3. EditorRoot receives note content
4. Lexical initializes from the JSON
5. Cursor positioned at last known location or document start

### Loading guarantees:

- Editor never initializes with invalid or partial JSON
- Engine ensures metadata is derived before editor sees note
- Lexical always receives a clean, validated document

---

# 5. Saving Lifecycle

Saving is performed in two ways:

### **1. Autosave (debounced)**

Triggered on every Lexical update cycle.

Flow:

```
Lexical Update → AutosavePlugin → save()
→ preload API → main → engine → filesystem
```

### **2. Manual Save**

Triggered by `cmd+s`.

Flow is identical but skip debounce.

Engine responsibilities during save:

- Persist note to `{id}.json`
- Re-extract metadata
- Update indexes (search + graph)

Renderer responsibilities:

- Serialize Lexical JSON
- Request save via preload
- Do not mutate metadata or timestamps

---

# 6. Interaction With Command Palette

The command palette is the primary navigation tool. Its interaction with the editor is minimal and well-defined.

### Palette opening (`cmd+k`):

- Editor preserves cursor and selection state
- Palette overlays editor without shifting content

### Palette actions may:

- Replace current note being edited
- Trigger save of current note
- Trigger search and navigate to a result
- Open backlinks for current note

### Editor never:

- Blocks palette invocation
- Interprets palette keyboard shortcuts

---

# 7. Text Extraction for Search & Metadata

Although metadata and search indexing happen in the engine, the editor is the source of truth for the content.

### Full-text extraction:

- The engine extracts raw text from Lexical JSON (not the renderer)
- Editor plugins may annotate metadata nodes in the future

### Metadata extraction in engine includes:

- Tags from patterns like `#scribe`
- Links from structured Lexical nodes
- Title from the first text block

The editor architecture intentionally avoids duplicating extraction logic.

---

# 8. Future Extensibility

The editor architecture supports:

- Additional Lexical plugins: tables, lists, markdown shortcuts, slash commands
- Rich inline metadata nodes
- Collaborative editing (future)
- Multinode selection support
- Custom block types (thoughts, tasks, embeds)

The core design does not limit evolution.

---

# 9. Rationale

This editor architecture supports Scribe’s mission by:

- Prioritizing writing
- Starting from a minimal, quiet UI
- Maintaining correctness and durability through engine-led persistence
- Keeping metadata, search, and graph derivations centralized and reliable
- Ensuring a seamless interaction loop with the command palette

---

# 10. Final Definition

**Decision 7 defines Scribe’s editor architecture: a Lexical-based, JSON-backed, full-screen writing interface powered by autosave, IPC-driven persistence, a clean separation of concerns, and deep integration with the command palette.** It establishes how notes are loaded, serialized, saved, indexed, and visually rendered in the MVP.
