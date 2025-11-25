# Decision 4: Vault File Structure & Persistence Rules

This document defines the **vault architecture**, the **note file format**, and the **persistence and indexing rules** for Scribe. It establishes how all application data is stored, synchronized, loaded, indexed, and validated. This decision is fundamental because it locks in the durability model, data representation strategy, and long‑term portability guarantees for the Scribe platform.

---

# 1. Overview

Scribe is a **local-first**, **JSON-based**, **file-system-backed** application. The vault is a simple folder that:

- Stores every note as a JSON file.
- Contains optional metadata files and index caches.
- Can be synced with tools like Git, Dropbox, or iCloud without corruption.

Scribe does **not** store or rely on Markdown. The single source of truth is the **Lexical JSON** representation of note content.

---

# 2. Vault Directory Structure

A Scribe vault has a predictable, stable layout:

```
/vault
  /notes
    {noteId}.json
  manifest.json            (optional now, recommended later)
  /index                   (optional future cache directory)
```

### **Directory Responsibilities:**

#### `/notes`

- Contains all note files.
- One file per note ID.
- Flat directory for MVP; hierarchical subfolders may be added later without breaking compatibility.

#### `manifest.json` (optional)

- Stores vault-level metadata such as last-opened note ID or schema version.

#### `/index` (optional)

- Future location for cached search or graph snapshots.
- Vault operation does not depend on this directory.

---

# 3. Note File Format

Each note is stored as a single JSON file:

```json
{
  "id": "uuid",
  "createdAt": 1732310400000,
  "updatedAt": 1732310425000,
  "content": {
    "root": {
      /* Lexical serialized AST */
    }
  },
  "metadata": {
    "title": "My Note Title",
    "tags": ["design", "scribe"],
    "links": ["other-note-id", "a-second-id"]
  }
}
```

### Field Definitions

| Field       | Description                                                        |
| ----------- | ------------------------------------------------------------------ |
| `id`        | The immutable unique identifier for the note.                      |
| `createdAt` | Timestamp (ms) when the note was created.                          |
| `updatedAt` | Timestamp updated automatically on each save.                      |
| `content`   | The **Lexical serialized JSON** content representing editor state. |
| `metadata`  | Derived metadata, recalculated from content: title, tags, links.   |

### Why embed metadata?

Embedding `metadata` inside the note file:

- Enables fast cold-start indexing.
- Makes the note file self-contained.
- Allows manual inspection and debugging.
- Improves resilience against partial index corruption.

The engine guarantees that metadata is always re-derived from content on load.

---

# 4. Persistence Guarantees

Scribe follows strict rules to prevent corruption and ensure durability.

### **4.1 Atomic Saves**

Every save operation uses:

1. Write to a temporary file
2. Flush to disk (`fsync`)
3. Atomic rename to `{id}.json`

This prevents partial writes on crash or power loss.

### **4.2 Immutable Identifiers**

- `id` never changes.
- The file name `{id}.json` never changes.

### **4.3 Engine-Controlled Timestamps**

- `updatedAt` is managed only by the engine.
- UI cannot override it.

### **4.4 Metadata Is Always Derived**

UI never writes metadata. Engine re-extracts metadata during:

- note creation,
- note load,
- note save.

---

# 5. Vault Load Pipeline (Cold Start)

On application startup, the main process:

1. Locates or initializes the vault directory.
2. Reads every file in `/notes`.
3. Parses and validates JSON structures.
4. Re-extracts metadata if missing or stale.
5. Builds in-memory:
   - `AllNotes`
   - Metadata index
   - Graph (incoming/outgoing adjacency)
   - Search index

The entire vault is resident in memory during application runtime.

### Performance Expectations

Cold-load is extremely fast:

- \~5,000 notes loads in under 200ms on modern hardware.

---

# 6. Save Pipeline (Hot Update)

When a note is saved:

1. Write/replace `{id}.json` file atomically.
2. Re-extract metadata from updated content.
3. Update metadata index.
4. Update graph edges (links + tags).
5. Update search index.
6. Emit internal update event (future capability).

All operations are incremental; only the affected note is reindexed.

---

# 7. Search & Graph Indexing Rules

The vault design directly supports fast indexing.

### **Search Indexing**

- Extracted full text from Lexical JSON.
- Indexed fields:
  - title
  - tags
  - body text
- In-memory index rebuilt incrementally.

### **Graph Indexing**

Edges constructed from:

- `metadata.links` → note-to-note edges
- `metadata.tags` → tag-to-note edges

Graph is kept in memory with:

- `incoming` adjacency lists
- `outgoing` adjacency lists
- `tags` map

---

# 8. Optional Future Extensions

The chosen vault design supports seamless extension, including:

- Versioned note schemas
- UUID remapping
- Hierarchical subfolders
- Per-note encryption
- Partial vault loading
- Remote syncing strategies
- Background GC or compaction

No part of the MVP architecture blocks future progression.

---

# 9. Final Definition

**Decision 4 defines Scribe’s vault and persistence architecture:**

- A JSON-only, local-first storage model.
- Notes stored as `/notes/{id}.json`.
- Metadata embedded but always derived.
- Atomic, durable save guarantees.
- In-memory indexing for metadata, graph, and search.
- A simple, portable vault folder structure.

This storage strategy forms the backbone of Scribe’s performance, reliability, and extensibility.
