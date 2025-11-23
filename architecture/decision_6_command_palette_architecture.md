# Decision 6: Command Palette Architecture & Interaction Model

This document defines the architecture, lifecycle, and interaction model for Scribe’s **command palette**, which is the core navigation and execution interface of the MVP UI. The command palette acts as the primary mechanism for invoking engine operations, switching notes, creating content, and interfacing with search and graph features.

This decision establishes the command registry, invocation flow, IPC integration, UI behavior, and the extensibility model for future commands.

---

# 1. Overview

The **command palette** is a modal interaction surface triggered via `cmd+k`. It is the primary UI navigation mechanism and replaces traditional sidebars, menus, and toolbars in the MVP.

The palette enables users to:

- Search notes
- Open notes
- Create new notes
- Execute actions such as saving, navigating backlinks, opening devtools, etc.

All palette commands are backed by engine calls via the preload API.

---

# 2. Design Principles

1. **Centralized navigation hub** – All actions should be accessible through the palette.
2. **Keyboard-first interaction** – No mouse required; fully navigable via keyboard.
3. **Non-modal to the engine** – Palette does not change engine state except when executing commands.
4. **Renderer-only state** – The palette’s internal state lives entirely in the renderer.
5. **Composable command registry** – Commands are declarative and easy to add.
6. **Fast** – Search results should appear with sub-50ms latency.

---

# 3. Command Registry

Commands are defined as pure data objects. The renderer maintains a list registered at startup.

### Command interface

```ts
interface Command {
  id: string;
  title: string;
  description?: string;
  keywords?: string[];
  group?: string;
  run: (context: CommandContext) => Promise<void>;
}
```

### Command groups

- "Notes"
- "Search"
- "Navigation"
- "Developer"
- Future groups (e.g., "Tags", "Graph")

Commands are discoverable via fuzzy search across:

- title
- description
- keywords
- group name

---

# 4. Core Commands (MVP)

The following commands are implemented in the MVP:

### **1. New Note**

Creates a new note via `window.scribe.notes.create()` and opens it.

### **2. Open Note**

Lists notes via `window.scribe.notes.list()` and opens selected note.

### **3. Search Notes**

Calls `window.scribe.search.query(text)` and displays ranked note results.

### **4. Show Backlinks**

Retrieves backlinks via `window.scribe.graph.backlinks(id)` and presents results.

### **5. Save Note**

Triggers manual save of the current editor state (even though autosave exists).

### **6. Open Developer Tools**

Invokes Electron’s devtools for debugging.

More commands can be added without architectural changes.

---

# 5. Invocation Lifecycle

The command palette goes through a clear lifecycle:

### 1. Triggered by `cmd+k`

- Renderer sets `paletteOpen = true`.
- Palette modal appears overlayed on the editor.

### 2. User types a query

- The palette performs in-renderer fuzzy filtering of commands.
- If the query does not match a command directly, search mode is activated:
  - Query forwarded to `window.scribe.search.query(q)`
  - Results displayed below built-in command matches

### 3. User selects a command or search result

- Pressing Enter runs the selected item

### 4. Command executes

- Renderer calls the command’s `run()` function
- This function may invoke preload APIs
- The palette closes automatically

### 5. Editor updates (if necessary)

- Opening notes replaces the editor content
- Navigation updates come from main process responses

---

# 6. IPC Interaction Model

Commands invoke engine operations through preload.

Example flows:

### Note creation

```
renderer → preload.notes.create → main → engine → filesystem
```

### Search

```
renderer → preload.search.query → main → engine-search index → returns results
```

### Backlinks

```
renderer → preload.graph.backlinks → main → graphEngine.backlinks
```

Commands never bypass preload or speak directly to the engine.

---

# 7. UI Behavior

The command palette appears as a modal overlay with:

- Input field at the top
- List of matching commands
- List of search results (if query isn’t a direct command)

### UI Characteristics

- Full keyboard navigation
- Instant fuzzy filtering
- Smooth transitions
- Minimal chrome aligned with Scribe’s writing-first UX

### Layout Example

```
+-----------------------------------------+
|  > Search or run a command...           |
+-----------------------------------------+
|  New Note                               |
|  Open Note                               |
|  Save                                    |
|                                          |
|  --- Search Results ---                  |
|  Getting Started                         |
|  Meeting Notes                           |
|  Roadmap                                 |
+-----------------------------------------+
```

---

# 8. Renderer State Model

The command palette maintains:

- `paletteOpen: boolean`
- `query: string`
- `selectedIndex: number`
- `results: Command[] | SearchResult[]`
- `mode: "command" | "search" | "mixed"`

All state is renderer-local; the main process is stateless regarding UI interactions.

---

# 9. Extensibility

The architecture supports easy expansion:

### Future examples

- Tag search and tag-based navigation
- Graph exploration commands
- Export/Import
- Theme switching
- Note pinning or favoriting
- Contextual commands (per-note actions)

Because commands are simple data objects, new ones can be added without modifying core systems.

---

# 10. Rationale

The command palette is designed to:

- Provide a minimal-first, distraction-free UI
- Offer a single entry point for all interactions
- Support extensibility without UI clutter
- Leverage engine features such as search and graph seamlessly

It aligns with Scribe’s philosophy of **minimal surface + maximum capability**.

---

# 11. Final Definition

**Decision 6 establishes the architecture, lifecycle, and interaction model for Scribe’s command palette.** It defines the command registry, fuzzy matching strategy, execution pipeline, IPC integration model, UI layout, and extensibility path. The palette is the core navigation UI for the MVP and the foundation for future user-facing capabilities.
