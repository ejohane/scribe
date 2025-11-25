# Decision 3: Internal Architecture (Layers, Responsibilities, and Engine Modules)

This document defines the **core internal architecture** of Scribe. It specifies the structural layers within the application, the responsibilities of each layer, and the detailed design of the engine modules, including metadata extraction, graph construction, and search indexing. This decision builds on Decision 1 (runtime architecture) and Decision 2 (project structure), and establishes the internal logic and data flow of the application.

---

# 1. Overview

Scribe’s internal architecture is organized into **four layers**:

1. **Foundations / Shared Types** — Shared type definitions and utility functions.
2. **Engine Layer** — Pure TypeScript modules responsible for storage, metadata, graph, and search.
3. **Bridge Layer (Preload)** — Secure API surface exposed to the renderer.
4. **UI Layer (Renderer)** — Minimal React user interface that interacts exclusively through preload.

The layers build on one another but remain cleanly separated to enforce modularity, security, and reuse.

---

# 2. Foundations / Shared Types

The foundations layer provides the type system and core interfaces used across all engine modules and in communication between layers.

### Key responsibilities:

- Define the canonical `Note` structure.
- Define types for metadata, graph, search results, and identifiers.

### Core Types:

```ts
interface Note {
  id: string;
  createdAt: number;
  updatedAt: number;
  content: LexicalState; // serialized Lexical JSON
  metadata: NoteMetadata; // derived: title, tags, links
}

interface NoteMetadata {
  title: string | null;
  tags: string[];
  links: string[]; // outbound references to other notes
}
```

### Additional foundational types include:

- `NoteId`
- `SearchResult`
- `GraphNode` / `GraphEdge`
- `VaultPath`

This layer contains **no application logic**—only shared definitions.

---

# 3. Engine Layer

The **engine** is the core of Scribe. It is a suite of pure TypeScript packages containing all domain logic, and it runs entirely in the main process. The engine is responsible for:

- CRUD operations for notes
- Persisting notes to the filesystem
- Extracting metadata
- Building and querying the graph
- Building and querying the search index
- Maintaining fast in-memory representations

The engine is organized into distinct modules for clarity and separation of concerns.

---

## 3.1 `engine-core`

The `engine-core` module owns the fundamental operations over notes.

### Responsibilities:

- Creating new notes
- Updating existing notes
- Normalizing note structure
- Extracting metadata from Lexical JSON
- Providing helper methods for metadata consistency

### Metadata extraction includes:

- **Title** — determined from the first textual block or an explicit metadata node.
- **Tags** — parsed from content using `#tag` conventions or custom Lexical nodes.
- **Links** — extracted from link nodes, wiki-link style nodes, or dedicated reference nodes.

`engine-core` is the heart of the note model.

---

## 3.2 `storage-fs`

The `storage-fs` module implements the persistence layer.

### Responsibilities:

- Reading notes from disk
- Writing notes to disk
- Ensuring atomic saves via temp-file → fsync → rename
- Serializing/deserializing notes as JSON files on disk
- Loading vault contents into memory on startup

### File Layout:

- Notes stored as `/vault/notes/{id}.json`
- JSON files contain both `content` and `metadata`

The storage layer is intentionally simple and transparent.

---

## 3.3 `engine-graph`

This module constructs and maintains a lightweight knowledge graph built entirely from metadata.

### Responsibilities:

- Building directed note → note edges from outbound links
- Building tag → note edges from metadata.tags
- Maintaining incoming (backlinks) and outgoing adjacency lists
- Providing graph queries such as:
  - `neighbors(noteId)`
  - `backlinks(noteId)`
  - `notesWithTag(tag)`

The graph is entirely in-memory, rebuilt incrementally, and updated on each note save.

---

## 3.4 `engine-search`

This module provides full-text search capabilities.

### Responsibilities:

- Tokenizing text extracted from Lexical JSON
- Indexing titles, tags, and plain text content
- Supporting fast prefix and full-text search queries
- Maintaining an in-memory search index
- Incrementally updating the index when notes change

The search engine may wrap an existing library (like flexsearch or lunr) but remains abstracted behind a consistent interface.

---

# 4. Bridge Layer (Preload)

The preload layer exposes the engine to the renderer via a stable, secure, typed API. It is the only point of contact between the renderer and main process.

### Responsibilities:

- Exposing note CRUD operations
- Exposing search and graph queries
- Translating renderer calls into IPC events
- Serializing responses back to the UI

### Example exposed API:

```ts
window.scribe = {
  notes: {
    list: () => ipc.invoke('notes:list'),
    read: (id) => ipc.invoke('notes:read', id),
    save: (note) => ipc.invoke('notes:save', note),
    create: () => ipc.invoke('notes:create'),
  },
  search: {
    query: (text) => ipc.invoke('search:query', text),
  },
  graph: {
    forNote: (id) => ipc.invoke('graph:forNote', id),
    backlinks: (id) => ipc.invoke('graph:backlinks', id),
  },
};
```

Preload enforces Scribe’s strict isolation model.

---

# 5. UI Layer (Renderer)

For the MVP, the renderer is intentionally minimal, but its architecture supports future expansion.

### The UI contains only:

- A **full-screen Lexical editor** for the current note
- A **command palette** triggered by `cmd+k` that allows:
  - creating notes
  - opening notes
  - searching notes
  - inspecting graph connections (minimal surface)

### Responsibilities:

- Holding ephemeral UI state
- Sending commands to the engine via preload
- Rendering the editor and command palette

The renderer contains **zero domain logic**.

---

# 6. Data Flow

Data flows cleanly and consistently across layers:

```
Editor (renderer)
    → preload API
        → IPC
            → main process
                → engine storage / metadata / graph / search
                    → filesystem
```

All stateful domain logic resides in the main process. The renderer receives fully formed data structures and does not maintain persistent domain state.

---

# 7. Rationale

This architecture was selected to meet Scribe’s goals of being:

- **Local-first**
- **Extremely fast**
- **Modular and reusable**
- **Secure**
- **Future-proof** for additional interfaces and capabilities

By isolating UI, engine, and storage concerns, this design ensures clarity and extensibility.

---

# 8. Final Definition

**Decision 3 establishes the full internal structure of Scribe’s application runtime.** It defines the four-layer architecture (Foundations → Engine → Bridge → UI) and specifies the responsibilities and internal structure of each engine module, including metadata extraction, graph building, and search indexing.

Engine logic is fully decoupled from UI logic, and all UI interactions occur through preload’s controlled API surface. This decision forms the backbone of all subsequent implementation choices.
