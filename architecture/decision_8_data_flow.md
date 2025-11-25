# Decision 8: Application Data Flow & State Synchronization Model

This document defines the **end‑to‑end data flow** throughout Scribe, from the editor to the engine to the filesystem and back. It establishes how state changes propagate, how data is synchronized between layers, how consistency is maintained, and how derived indexes (graph, search, metadata) remain up to date.

This decision unifies the behaviors defined in Decisions 1–7 into a coherent runtime model.

---

# 1. Overview

Scribe’s data flow is intentionally simple, predictable, and strictly layered. The system follows a **unidirectional flow**:

```
Renderer (UI)
    ↓ via preload API
Main Process (IPC host)
    ↓
Engine (metadata, graph, search, storage)
    ↓
File System (vault)
```

Information always flows through the preload boundary for any privileged action.

Derived data—metadata, search index, graph—flows **one way**: from engine → renderer only upon request.

There is no shared mutable state between processes.

---

# 2. Core Data Flow Principles

1. **Single source of truth: Lexical JSON** stored in each note file.
2. **Main process owns domain state** (notes, indexes, metadata, graph).
3. **Renderer is stateless regarding data persistence**.
4. **All writes go through a controlled save pipeline**.
5. **All reads return fully hydrated note objects**.
6. **Indexes updated incrementally on every save**.

This creates a robust foundation that avoids duplication or race conditions.

---

# 3. Data Flow When Loading a Note

Loading a note follows a clear sequence:

```
User selects note → Renderer → preload.notes.read(id)
    → IPC → main → AllNotes.get(id)
        → return Note object with metadata
            → preload → renderer → Lexical initialization
```

### Guarantees:

- Renderer never sees partial or unvalidated JSON.
- Metadata is always fresh because engine re-extracts it when loading.
- Graph and search state remain in main and never leak to renderer except through explicit queries.

---

# 4. Data Flow During Editing

As the user types, Lexical updates local editor state. Renderer keeps this transient; no persistence happens until explicitly triggered.

### Update flow:

```
Lexical state update → AutosavePlugin (debounced)
    → serialize Lexical JSON
        → preload.notes.save(note)
            → IPC → main → save cycle
```

Renderer does not manipulate metadata or timestamps at any point.

---

# 5. Save Pipeline Data Flow

Save pipeline details were formalized in Decision 5. Here we describe the **data movement** specifically:

### 1. Renderer serializes Lexical JSON

- Produces stable document structure

### 2. Preload invokes IPC handler

- Marshals the serialized note JSON and metadata fields

### 3. Main process reconstructs a full `Note` object

- Adds timestamps
- Ensures `id` is stable

### 4. Engine performs durable save

```
write temp → fsync → rename
```

### 5. Engine updates in-memory structures

- Replace note in `AllNotes`
- Extract metadata
- Update metadata index
- Update graph edges
- Update search tokens

### 6. Save pipeline completes

- Renderer may optionally refresh UI state—but this is not required

---

# 6. Search Data Flow

Search is performed entirely in the main process.

```
Renderer query → preload.search.query(q)
    → IPC → main.searchEngine.search(q)
        → ranked results returned to renderer
```

Search results are always computed from in-memory indexes, not raw filesystem reads.

---

# 7. Graph Data Flow

Graph queries follow the same pattern:

```
Renderer → preload.graph.forNote(id)
    → IPC → main.graphEngine.neighbors(id)
        → return adjacency list
```

Backlink resolution:

```
renderer → preload.graph.backlinks(id)
    → IPC → main.graphEngine.backlinks(id)
```

All graph edges are derived from metadata during save or load.

---

# 8. Metadata Data Flow

Metadata is **always engine-derived** and flows only **engine → renderer**, never the other direction.

### Metadata extraction triggers:

- On note load
- On note save

The renderer receives metadata when reading a note but does not modify it.

### Metadata is used for:

- Graph construction
- Search indexing
- Displaying note title in command palette results

---

# 9. Renderer State Synchronization

The renderer holds **only ephemeral UI state**:

- Current note ID
- Lexical editor state
- Command palette state

It does not:

- Cache notes
- Store metadata
- Persist anything to disk

Renderer state resets safely on reload.

---

# 10. Multi-Note Navigation Flow

Navigating between notes uses the following sequence:

```
User selects note in palette
    → preload.notes.read(id)
        → IPC → main → return note
            → Lexical loads new JSON
```

Autosave ensures the current note is already persisted before switching.

---

# 11. Failure & Recovery Behavior

### If save fails:

- Preload returns an error to renderer
- Renderer may display a non-blocking notification
- Editor does not advance to another note until resolved

### If note load fails:

- Main returns error
- Renderer shows placeholder or error page

### If a file becomes corrupt:

- Engine attempts recovery; if impossible, the file is skipped and flagged

### If metadata extraction fails:

- Note still loads, but metadata regeneration attempted on next save

---

# 12. Rationale

This data flow model ensures:

- High performance
- Deterministic state transitions
- Full isolation of domains
- Minimal UI complexity
- No risk of renderer–engine state divergence
- Immediate index updates on every save

The unidirectional model is simple, robust, and scalable.

---

# 13. Final Definition

**Decision 8 establishes Scribe’s complete data flow model:** a unidirectional, preload‑mediated system in which the main process owns all domain data; the renderer requests data and sends edits; and the engine maintains metadata, graph, and search indexes in memory. This model ensures correctness, performance, and long-term maintainability across all layers of the application.
