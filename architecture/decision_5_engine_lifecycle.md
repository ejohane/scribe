# Decision 5: Engine Lifecycle & Main Process Orchestration

This document defines the **runtime behavior** of Scribe’s engine and its orchestration by the Electron **main process**. It describes how the vault is loaded, how notes are indexed, how updates propagate, how IPC commands map to engine capabilities, and how in-memory structures are maintained for fast, local-first performance. This decision is foundational for predictable behavior, durability, and responsiveness.

---

# 1. Overview

The **main process** is the execution host for Scribe’s engine. It performs all privileged operations and maintains Scribe’s core datasets in memory. The renderer runs only UI logic, and the preload layer serves as the communication boundary.

This decision establishes:

- How the engine initializes
- How the vault is loaded
- How notes, metadata, graph, and search indexes are constructed
- How saves propagate through the system
- How IPC routes are defined and managed

This ensures deterministic, isolated, and high‑performance behavior.

---

# 2. Responsibilities of the Main Process

The main process operates as the central controller for the engine and owns:

1. **Vault discovery** (loading/initialization)
2. **Reading all note files** on startup
3. **Building in-memory indexes**
   - Notes
   - Metadata
   - Graph
   - Search
4. **Handling all filesystem I/O**
5. **Performing atomic saves**
6. **Hosting all engine modules** (storage, metadata, graph, search)
7. **Registering IPC handlers** for the renderer via preload

No domain logic runs in the renderer.

---

# 3. Startup Sequence

When Scribe launches, the main process executes the following steps:

### 1. Initialize the Electron application

### 2. Locate or create the vault directory

- Default location: `~/Scribe/vault` (or a configured path in future)

### 3. Instantiate engine modules

```ts
const store = new FileSystemVault(vaultPath);
const metadataIndex = new MetadataIndex();
const graphEngine = new GraphEngine();
const searchEngine = new SearchEngine();
```

### 4. Load all notes from `/vault/notes`

- Scan directory
- Read each file
- Parse JSON
- Validate structure
- Hydrate into memory

### 5. Build derived in-memory data

- Extract metadata for each note
- Build outgoing & incoming graph edges
- Add tokens to search index

### 6. Bind IPC routes

- `notes:list`
- `notes:read`
- `notes:create`
- `notes:save`
- `search:query`
- `graph:forNote`
- `graph:backlinks`

### 7. Load and display the renderer window

After this, the application is fully operational.

---

# 4. In-Memory Engine State

The engine keeps critical state in memory to ensure low-latency operations.

### **4.1 AllNotes**

Holds hydrated note objects.

```ts
Map<NoteId, Note>;
```

### **4.2 MetadataIndex**

```ts
{
  byNote: Map<NoteId, NoteMetadata>,
  byTag: Map<string, NoteId[]>,
  byLink: Map<NoteId, NoteId[]>   // backlinks
}
```

### **4.3 GraphEngine**

Directed adjacency representation:

```ts
{
  outgoing: Map<NoteId, NoteId[]>,
  incoming: Map<NoteId, NoteId[]>,
  tags: Map<string, NoteId[]>
}
```

### **4.4 SearchEngine**

In-memory full-text search index, updated incrementally.

---

# 5. Save Cycle (Hot Update Flow)

When the renderer saves a note via:

```
window.scribe.notes.save(note)
```

The main process performs a full update cycle:

### 1. Persist note to disk

- Write → fsync → atomic rename

### 2. Update AllNotes

```ts
AllNotes.set(note.id, note);
```

### 3. Re-extract metadata

- Derive title, tags, links

### 4. Update metadata index

- Remove old metadata
- Insert new metadata

### 5. Update graph engine

- Rebuild outgoing/incoming edges for the note

### 6. Update search index

- Re-tokenize note content
- Replace index entry

### 7. Emit engine-level events (future extension)

- `noteUpdated(id)`
- `graphUpdated(id)`

All updates are incremental—only the affected note is reprocessed.

---

# 6. IPC Routing Architecture

IPC routes allow the renderer to invoke engine operations through preload.

### Notes

```ts
ipcMain.handle('notes:list', () => Array.from(AllNotes.values()));
ipcMain.handle('notes:read', (_, id) => AllNotes.get(id));
ipcMain.handle('notes:create', createNoteHandler);
ipcMain.handle('notes:save', saveNoteHandler);
```

### Search

```ts
ipcMain.handle('search:query', (_, query) => searchEngine.search(query));
```

### Graph

```ts
ipcMain.handle('graph:forNote', (_, id) => graphEngine.neighbors(id));
ipcMain.handle('graph:backlinks', (_, id) => graphEngine.backlinks(id));
```

### Properties:

- Renderer cannot bypass preload
- All domain logic stays in main process
- IPC routes remain stable API boundaries

---

# 7. Live Update Behavior

The engine updates instantly on every save. The renderer may optionally receive update notifications.

Potential future mechanism:

```
ipcMain.emit("note-updated", noteId);
```

Preload could expose an event subscription API.

For MVP, polling is unnecessary—renderer reloads note state only on explicit user actions.

---

# 8. Performance Considerations

The architecture ensures:

- Fast cold starts (thousands of notes load instantly)
- Millisecond-level save operations
- Efficient incremental indexing
- No IPC or filesystem bottlenecks
- Pure in-memory, optimized graph and search structures

This supports Scribe’s goal of being fast, predictable, and durable.

---

# 9. Rationale

This lifecycle design was chosen to:

- Guarantee reliability despite crashes or power loss
- Ensure extremely fast operations with large vaults
- Preserve strict process isolation and security boundaries
- Keep the engine entirely UI-agnostic and reusable

---

# 10. Final Definition

**Decision 5 defines how Scribe's engine initializes, loads the vault, indexes notes, updates its in-memory structures, and exposes its capabilities via IPC.** The main process is the authoritative host for domain logic, while the renderer remains a pure UI layer.

This lifecycle ensures that Scribe is fast, robust, and scalable for future enhancements.
