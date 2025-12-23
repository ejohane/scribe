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

The foundations layer provides the type system and core interfaces used across all engine modules and in communication between layers. Types are organized into domain-specific modules for discoverability and tree-shaking.

### Directory Structure

```
packages/shared/src/types/
  index.ts              # Barrel re-exports all types
  note-types.ts         # Note, NoteId, NoteType, note variants
  editor-types.ts       # EditorContent, EditorNode
  task-types.ts         # Task, TaskId, TaskFilter, TaskChangeEvent
  graph-types.ts        # GraphNode, GraphEdge
  search-types.ts       # SearchResult
```

### Key Responsibilities

- Define the canonical `Note` structure with discriminated union pattern
- Define branded types for type-safe identifiers (`NoteId`, `VaultPath`, `TaskId`)
- Define types for metadata, graph, search results, and tasks
- Provide type guards for runtime type narrowing

### Type Categories

**Note Types** (`note-types.ts`):
- `NoteId` / `VaultPath` — Branded string types for type-safe identifiers
- `NoteType` — Discriminator: `'person' | 'project' | 'meeting' | 'daily' | 'template' | 'system'`
- `BaseNote` — Common fields (id, title, createdAt, updatedAt, content, metadata)
- Note variants: `RegularNote`, `PersonNote`, `DailyNote`, `MeetingNote`, `ProjectNote`, `TemplateNote`, `SystemNote`
- Type-specific data: `DailyNoteData`, `MeetingNoteData`
- Type guards: `isRegularNote()`, `isPersonNote()`, `isDailyNote()`, `isMeetingNote()`, etc.
- System notes: `SYSTEM_NOTE_IDS`, `isSystemNoteId()`

**Editor Types** (`editor-types.ts`):
- `EditorContent` — Wrapper for Lexical JSON with `root` node
- `EditorNode` — Generic node structure for traversal

**Task Types** (`task-types.ts`):
- `TaskId` — Composite identifier: `{noteId, nodeKey, textHash}`
- `Task` — Full task with metadata (text, completed, priority, timestamps)
- `TaskFilter` — Query parameters for task listing
- `TaskChangeEvent` — Real-time update events (`added`, `updated`, `removed`, `reordered`)
- Serialization: `serializeTaskId()`, `parseTaskId()`

**Graph Types** (`graph-types.ts`):
- `GraphNode` — Node in knowledge graph (note representation)
- `GraphEdge` — Directed edge (link, mention, tag relationships)

**Search Types** (`search-types.ts`):
- `SearchResult` — Search hit with score and snippet

### Core Types

```ts
// Branded type for type-safe identifiers
type NoteId = string & { readonly __brand: 'NoteId' };

// Base structure common to all note types
interface BaseNote {
  id: NoteId;                    // Branded unique identifier
  title: string;                 // User-editable title
  createdAt: number;             // Creation timestamp (ms)
  updatedAt: number;             // Last update timestamp (ms)
  tags: string[];                // User-defined tags
  content: EditorContent;        // Rich text content (Lexical JSON)
  metadata: NoteMetadata;        // Derived metadata from content
}

// Note is a discriminated union of different note types
type Note = RegularNote | PersonNote | ProjectNote | TemplateNote 
          | SystemNote | DailyNote | MeetingNote;

// Editor content is an abstraction over Lexical JSON
interface EditorContent {
  root: {
    type: 'root';
    children: EditorNode[];
  };
}
```

### Barrel Export Pattern

The `index.ts` re-exports all types from domain modules:
- Consumers can import from `@scribe/shared` for convenience
- Or import from specific modules (e.g., `@scribe/shared/types/task-types`) for better tree-shaking
- All types are consumed by engine, storage, and desktop packages

### Note Type Variants

The `Note` type is a discriminated union. Each variant serves a specific purpose:

#### RegularNote

The default note type for general content. No special behavior or metadata.

```ts
interface RegularNote extends BaseNote {
  type?: undefined;  // Distinguishes from specialized types
}
```

#### PersonNote

Notes about people, used for `@mention` autocomplete.

```ts
interface PersonNote extends BaseNote {
  type: 'person';
}
```

- Referenced by `@name` mentions in editor
- `PersonMentionPlugin` handles autocomplete
- Appears in `metadata.mentions` when mentioned

#### DailyNote

Date-based journal notes, one per calendar day.

```ts
interface DailyNote extends BaseNote {
  type: 'daily';
  daily: {
    date: string;  // "YYYY-MM-DD" format
  };
}
```

- Created via `daily:getOrCreate` IPC
- Title derived from date (e.g., "December 23, 2024")
- MeetingNotes link to their DailyNote

#### MeetingNote

Notes for meetings with attendee tracking.

```ts
interface MeetingNote extends BaseNote {
  type: 'meeting';
  meeting: {
    date: string;        // Links to DailyNote by date
    dailyNoteId: NoteId; // Direct reference to DailyNote
    attendees: NoteId[]; // References to PersonNotes
  };
}
```

- Attendees are `PersonNote` references
- Automatically linked to the `DailyNote` for that date
- Created via `meeting:create` IPC

#### ProjectNote

Notes for project organization and grouping.

```ts
interface ProjectNote extends BaseNote {
  type: 'project';
}
```

- Organizational container for related notes
- Can be linked via wiki-links

#### TemplateNote

Reusable templates for note creation.

```ts
interface TemplateNote extends BaseNote {
  type: 'template';
}
```

- Content used as starting point for new notes
- Not used in graph relationships

#### SystemNote

Virtual notes for system UI screens (not persisted to vault).

```ts
interface SystemNote extends BaseNote {
  type: 'system';
}
```

- `system:tasks`: Tasks management screen
- Rendered by special components, not the editor
- ID format: `system:{screen-name}`

### Note Type Relationships

```
MeetingNote ──── date ────→ DailyNote
     │
     └── attendees ──→ PersonNote[]

RegularNote ──── @mention ──→ PersonNote
     │
     └── [[link]] ──→ Any Note
```

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

The `engine-core` module owns the fundamental operations over notes and tasks.

### Responsibilities:

- Creating new notes
- Updating existing notes
- Normalizing note structure
- Extracting metadata from Lexical JSON
- Providing helper methods for metadata consistency
- **Task management** — extraction, indexing, reconciliation, and persistence

### Metadata extraction includes:

- **Title** — determined from the first textual block or an explicit metadata node.
- **Tags** — parsed from content using `#tag` conventions or custom Lexical nodes.
- **Links** — extracted from link nodes, wiki-link style nodes, or dedicated reference nodes.
- **Tasks** — extracted from checklist items within Lexical JSON content.

### Browser-safe exports:

The module carefully separates browser-safe code (extractors, utilities) from Node-only code (persistence). This enables:
- Reuse in the CLI without Electron
- Potential future web deployment of extraction logic

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
- Exposing domain-specific operations (people, meetings, tasks, etc.)
- Translating renderer calls into IPC events
- Serializing responses back to the UI
- Managing auto-update lifecycle events

### Full API Surface

The preload exposes 13 API domains with 50+ methods. The contract is defined in `@scribe/shared` (`packages/shared/src/ipc-contract.ts`):

```ts
window.scribe = {
  ping: () => Promise<'pong'>,
  
  notes: {
    list, read, create, save, delete,
    findByTitle, searchTitles, findByDate
  },
  
  search: { query },
  
  graph: { forNote, backlinks, notesWithTag },
  
  shell: { openExternal },
  
  app: {
    openDevTools, getLastOpenedNote, setLastOpenedNote,
    getConfig, setConfig
  },
  
  people: { list, create, search },
  
  daily: { getOrCreate, find },
  
  meeting: { create, addAttendee, removeAttendee },
  
  dictionary: {
    addWord, removeWord, getLanguages,
    setLanguages, getAvailableLanguages
  },
  
  tasks: { list, toggle, reorder, get, onChange },
  
  update: {
    check, install,
    onChecking, onAvailable, onNotAvailable, onDownloaded, onError
  },
  
  cli: { install, isInstalled, uninstall, getStatus },
  
  export: { toMarkdown }
};
```

### API Domain Reference

| Domain | Purpose | Note Type Affinity |
|--------|---------|-------------------|
| notes | Core CRUD operations | All notes |
| search | Full-text search | All notes |
| graph | Relationship queries | All notes |
| shell | System integration | N/A |
| app | Application state | N/A |
| people | Person management | PersonNote |
| daily | Daily note creation | DailyNote |
| meeting | Meeting management | MeetingNote |
| dictionary | Spellcheck dictionary | N/A |
| tasks | Task extraction/toggle | All notes with checklists |
| update | Auto-update lifecycle | N/A |
| cli | CLI tool management | N/A |
| export | Export to external formats | All notes |

### Security Boundary

Preload enforces Scribe's strict isolation model:

- The renderer has **no direct Node.js access**
- All filesystem operations go through IPC
- The API is statically typed for compile-time safety
- Error handling prevents leaking internal details to the renderer

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
