# High-Level System Architecture

## 1. Goals

This document describes the end-to-end architecture of the local-first knowledge graph application you’re designing, modeled loosely after Obsidian but with first-class **people entities**.

Primary goals:

- Local-first, file-based storage using Markdown.
- Rich knowledge graph: notes, tags, people, folders, headings, embeds.
- Eager indexing at startup for instant queries and graph operations.
- Simple, robust architecture that can scale to thousands of notes.
- Extensible internals so you can add features (media, queries, etc.) later.

Non-goals (for now):

- No server-side sync or collaboration.
- No dynamic query language or database-like dashboards.
- No block-level references or block graph.
- No attachment/media handling (beyond planning for it).


## 2. Core Concepts

### 2.1 Vault

A **vault** is a directory on disk:

```text
vault/
  people/
    Erik.md
    Mary.md
  notes/
    Architecture Overview.md
    Meeting Notes.md
  random-note.md
```

The app treats the vault as the single source of truth for:

- Markdown content
- Metadata (frontmatter)
- Structure (folders)
- Relationships (links/mentions)


### 2.2 Entities

The system models several first-class entity types:

- **Note** – content-bearing Markdown file (general-purpose).
- **Person** – a special kind of note stored in `people/` and referenced with `@Name`.
- **Tag** – logical label extracted from inline `#tags` or frontmatter `tags:`.
- **Folder** – hierarchical container derived from the filesystem structure.
- **Heading** – structural anchor within a note (`#`, `##`, etc.).
- **Embed** – transclusion reference (`![[Some Note]]`).

These entities are connected via a **graph layer** built on top of the raw files.


### 2.3 Subsystems

At a high level, the app is decomposed into these subsystems:

1. **Vault Manager**
   - Enumerates files and folders.
   - Monitors filesystem changes (create, modify, delete, move/rename).
   - Exposes a normalized view of the vault structure.

2. **Parsing Pipeline**
   - Reads raw Markdown files.
   - Extracts frontmatter, headings, tags, links, embeds, and person mentions.
   - Produces a structured `ParsedNote` model.

3. **Indexing System**
   - Orchestrates eager parsing of all notes at startup.
   - Maintains in-memory indexes (notes, people, tags, graph, etc.).
   - Applies incremental updates when files change.

4. **Graph Engine**
   - Maintains typed nodes and edges (note ↔ note, note ↔ tag, note ↔ person, etc.).
   - Supports graph queries and traversal.
   - Powers visual graph views and “related notes” features.

5. **Resolution Engine**
   - Resolves `[[Links]]`, `[[Note#Heading]]`, `![[Embeds]]`, and `@Person` mentions to canonical entities.
   - Handles aliases, title resolution, and conflicts.

6. **Search & Discovery Layer**
   - Full-text search over note content (can be incremental later).
   - Indexes for tags, people, and unlinked mentions.
   - Exposes APIs for “find notes mentioning X” or “unlinked mentions for this note.”

7. **UI Shell**
   - Renders folder tree, note editor, metadata panels, graph view, and entity detail views.
   - Communicates with the core via a well-defined API (e.g., IPC in Electron, or internal module boundaries).


## 3. Runtime Architecture

### 3.1 Big Picture

```text
+-------------------------+
|        UI Shell         |
|  - Editor               |
|  - Sidebar / Graph      |
|  - People / Tag views   |
+------------+------------+
             |
             v
+-------------------------+
|    Application Core     |
|                         |
|  +-------------------+  |
|  |   Search &        |  |
|  |   Discovery       |  |
|  +-------------------+  |
|  +-------------------+  |
|  |   Graph Engine    |  |
|  +-------------------+  |
|  +-------------------+  |
|  | Resolution Engine |  |
|  +-------------------+  |
|  +-------------------+  |
|  | Indexing System   |  |
|  +-------------------+  |
|  +-------------------+  |
|  | Parsing Pipeline  |  |
|  +-------------------+  |
|  +-------------------+  |
|  |  Vault Manager    |  |
|  +-------------------+  |
+-------------+-----------+
              |
              v
+-------------------------+
|       File System       |
|  (Vault: .md files)     |
+-------------------------+
```


### 3.2 Startup Flow (Eager Indexing)

1. **Vault discovery**
   - User selects a vault directory.
   - Vault Manager walks the directory tree and lists all `.md` files.

2. **Initial parse & index**
   - Indexing System schedules all files for parsing.
   - Parsing Pipeline processes each file (possibly concurrently).
   - For each parsed file, Indexing System updates:
     - note registry
     - people registry
     - tag registry
     - heading registry
     - link + embed graph
     - person mentions index
     - unlinked mentions index (can be computed after initial pass).

3. **Graph & discovery initialization**
   - Graph Engine builds adjacency structures.
   - Search & Discovery builds full-text index (optional in v1 or incremental).

4. **UI ready**
   - Once initial indexing reaches a minimum viable state (e.g., all notes parsed), UI is allowed to show:
     - folder tree
     - note list
     - graph view
     - tags & people panes.


### 3.3 Normal Operation Flow

#### Editing a Note

1. User edits a note in the UI.
2. Editor saves the note to disk (via Vault Manager).
3. Vault Manager detects a file change and notifies the Indexing System.
4. Indexing System re-parses the file through Parsing Pipeline.
5. Indexing System computes the delta and updates:
   - registries (notes, people, tags, headings)
   - graph edges
   - search index
   - unlinked mentions.
6. UI is updated (e.g., backlinks panel, graph view) based on these new indexes.


#### Creating or Renaming a Note

1. User creates/renames a note via UI.
2. Vault Manager performs filesystem operation.
3. Indexing System re-parses note and updates indexes.
4. Graph Engine updates nodes and edges referencing the entity.
5. Resolution Engine ensures links and titles resolve correctly.


#### Creating or Referencing a Person

1. User types `@Erik` in a note.
2. On save / parse, Parsing Pipeline extracts `@Erik` as a person mention.
3. Resolution Engine checks whether `people/Erik.md` exists:
   - If yes: treat as a person entity.
   - If no: create `Erik` as a *pending person* (optionally auto-create file).
4. Indexing System links note ↔ person in the graph.
5. Person view in UI shows all notes mentioning `Erik`.


## 4. Core Responsibilities and Boundaries

### 4.1 Vault Manager

- Maps between logical entity identifiers and file paths.
- Provides a normalized representation of folder hierarchy.
- Abstracts file I/O and filesystem watching from upper layers.

### 4.2 Parsing Pipeline

- Pure transformation: `FileContent + Path → ParsedNote`.
- No side-effects, no indexing logic.
- Can be tested in isolation.

### 4.3 Indexing System

- Consumes `ParsedNote` objects and builds/maintains in-memory structures.
- Central coordinator for all indexes and graph updates.
- Exposes consistent read APIs to other systems.

### 4.4 Graph Engine

- Owns node and edge representations.
- Provides traversal and query functions.
- Does not care about Markdown syntax, only logical entities and relationships.

### 4.5 Resolution Engine

- Responsible for mapping user-level syntax to canonical entities:
  - `[[Foo]]` → Note or Person or missing.
  - `[[Foo#Heading]]` → Heading anchor in a note.
  - `@Erik` → Person entity, possibly backed by `people/Erik.md`.
- Encapsulates all name/alias/title resolution rules.

### 4.6 Search & Discovery

- Full-text indexing and query execution.
- Unlinked mentions detection.
- Orphan note detection (notes with few/no connections).


## 5. Extensibility & Future Features

The architecture leaves room for future additions:

- **Media / attachments**
  - Attachments subsystem alongside Markdown files.
  - Attachment graph edges (note ↔ attachment).
- **Dynamic query language**
  - Query engine that runs against existing indexes (notes, tags, people).
- **Sync**
  - Sync layer operating at filesystem or vault abstraction level.
- **Plugins**
  - Plugin API that hooks into indexing events, graph updates, or resolution.


## 6. Non-Functional Considerations

- **Performance**
  - Eager indexing may be parallelized.
  - Use incremental parsing for single-note changes.
- **Robustness**
  - Avoid crashing on malformed frontmatter or broken links.
  - Always prefer tolerant parsing and best-effort indexing.
- **Portability**
  - Vault is just files; app-specific caches can be stored separately (and regenerated).


---

This high-level architecture sets the stage for the rest of the design:
- Next: the detailed **data model and data structures** used by each subsystem.
