# Data Model and Data Structures

This document defines the core data model and in-memory structures that power the application.

The goal is to:

- Represent all entities (notes, people, tags, folders, headings, embeds) in a unified way.
- Provide efficient lookup and traversal for indexing, graph operations, and UI queries.
- Keep the model simple, extensible, and grounded in the filesystem reality.


## 1. Core Identifiers and Types

We’ll use pseudo-TypeScript types to describe structures.

### 1.1 Primitive Types

```ts
type NoteId = string;    // stable ID, usually derived from normalized file path
type PersonId = string;  // e.g. "Erik", but you can also use "people/Erik"
type TagId = string;     // e.g. "planning", normalized
type FolderId = string;  // e.g. "notes", "people", "notes/2025"
type HeadingId = string; // unique within a note, e.g. `${NoteId}#normalized-heading`
type EmbedId = string;   // refers to a note or future attachment ID
type FilePath = string;  // OS path relative to vault root
```

### 1.2 EntityType

```ts
type EntityType = "note" | "person" | "tag" | "folder" | "heading" | "embed";
```

### 1.3 Graph Node ID

Graph nodes can be any entity type; we can represent node IDs as:

```ts
type NodeId = string; // usually prefixed by type, e.g. "note:notes/Plan.md"
```


## 2. Note Model

Notes are Markdown files that may live anywhere in the vault except reserved locations (like `people/` for person entities).

### 2.1 Raw File Representation

```ts
interface RawFile {
  path: FilePath;
  content: string;
  lastModified: number; // epoch millis
}
```

### 2.2 ParsedNote

Result of parsing pipeline for a single file:

```ts
interface ParsedNote {
  id: NoteId;
  path: FilePath;

  // Titles
  fileName: string;         // "Plan.md"
  frontmatterTitle?: string;
  h1Title?: string;
  resolvedTitle: string;    // final chosen title

  // Frontmatter (raw + normalized)
  frontmatterRaw?: string;
  frontmatter: Record<string, unknown>;

  // Tags
  inlineTags: TagId[];      // from #tag in body
  fmTags: TagId[];          // from frontmatter "tags"
  allTags: TagId[];         // union of both

  // Aliases
  aliases: string[];        // from frontmatter "aliases"

  // Headings
  headings: HeadingRef[];

  // Links and embeds
  links: LinkRef[];         // [[Note]], [[Note#Heading]]
  embeds: EmbedRef[];       // ![[Note]]

  // People mentions
  peopleMentions: PersonMentionRef[]; // @Erik

  // Plain-text content (for full-text search)
  plainText: string;
}

interface HeadingRef {
  id: HeadingId;
  level: number;         // 1..6
  rawText: string;
  normalized: string;    // for anchor / link resolution
  line: number;          // line number in file
}
```

### 2.3 Link and Embed Models

```ts
type LinkTargetKind = "note" | "heading"; // resolved later

interface LinkRef {
  raw: string;             // "[[Some Note#Heading]]"
  targetText: string;      // "Some Note" or "Some Note#Heading"
  noteName: string;        // "Some Note"
  headingText?: string;    // "Heading"
  position: {
    line: number;
    column: number;
  };
}

interface EmbedRef {
  raw: string;             // "![[Some Note]]"
  noteName: string;        // "Some Note"
  position: {
    line: number;
    column: number;
  };
}
```

### 2.4 Person Mentions

```ts
interface PersonMentionRef {
  raw: string;            // "@Erik"
  personName: string;     // "Erik"
  position: {
    line: number;
    column: number;
  };
}
```


## 3. Person Model

Persons are represented both as notes (files in `people/`) and as a typed entity.

### 3.1 PersonNote

A person file is still just a ParsedNote, but with additional semantics:

```ts
interface Person {
  id: PersonId;           // canonical name, e.g. "Erik"
  noteId: NoteId;         // associated note/entity (people/Erik.md)
  path: FilePath;         // "people/Erik.md"
  name: string;           // display name (from title or frontmatter)
  metadata: Record<string, unknown>; // derived from frontmatter
}
```

### 3.2 Person Indices

```ts
interface PeopleIndex {
  byId: Map<PersonId, Person>;
  byName: Map<string, PersonId>; // normalized person name -> PersonId
  mentionsByPerson: Map<PersonId, Set<NoteId>>;
  peopleByNote: Map<NoteId, Set<PersonId>>;
}
```


## 4. Tag Model

Tags are lightweight entities derived from notes and people.

```ts
interface Tag {
  id: TagId;
  name: string;             // original tag text
  usageCount: number;
}
```

Indices:

```ts
interface TagIndex {
  tags: Map<TagId, Tag>;
  notesByTag: Map<TagId, Set<NoteId>>;
  tagsByNote: Map<NoteId, Set<TagId>>;
}
```


## 5. Folder Model

Folders are derived entirely from file paths.

```ts
interface Folder {
  id: FolderId;            // e.g. "notes/2025"
  name: string;            // last segment: "2025"
  parentId?: FolderId;     // undefined for root
  path: string;            // normalized folder path
}
```

Indices:

```ts
interface FolderIndex {
  folders: Map<FolderId, Folder>;
  childrenByFolder: Map<FolderId, Set<FolderId>>;
  notesByFolder: Map<FolderId, Set<NoteId>>;
}
```


## 6. Heading Model

Headings are not standalone files, but structural anchors within notes.

```ts
interface Heading {
  id: HeadingId;           // e.g. "note:notes/Plan.md#goals-and-scope"
  noteId: NoteId;
  level: number;
  text: string;
  normalized: string;      // for matching [[Note#Heading]]
  line: number;
}
```

Indices:

```ts
interface HeadingIndex {
  byId: Map<HeadingId, Heading>;
  headingsByNote: Map<NoteId, HeadingId[]>;
}
```


## 7. Embeds

Embeds point to other notes (or future attachment entities).

```ts
interface Embed {
  id: EmbedId;            // e.g. "embed:notes/Plan.md"
  sourceNoteId: NoteId;   // note that includes the embed
  targetNoteId?: NoteId;  // resolved note, if any
}
```

Indices:

```ts
interface EmbedIndex {
  embedsBySourceNote: Map<NoteId, EmbedId[]>;
  embedsByTargetNote: Map<NoteId, EmbedId[]>;
}
```


## 8. Note Registry

The central registry of all note-like entities (including person notes).

```ts
interface NoteRegistry {
  byId: Map<NoteId, ParsedNote>;
  byPath: Map<FilePath, NoteId>;
  byTitle: Map<string, Set<NoteId>>;     // for unlinked mentions + resolution
  byAlias: Map<string, Set<NoteId>>;     // aliases -> candidate notes
}
```

- `byTitle` and `byAlias` support:
  - link resolution
  - unlinked mention detection
  - search suggestions.


## 9. Graph Model

The graph engine uses a generic node/edge model built on top of the indices above.

### 9.1 Nodes

```ts
interface GraphNode {
  id: NodeId;
  entityType: EntityType;
  refId: string; // underlying NoteId, TagId, PersonId, etc.
}
```

### 9.2 Edges

Edge types:

```ts
type EdgeType =
  | "note-links-note"
  | "note-embeds-note"
  | "note-has-tag"
  | "note-mentions-person"
  | "person-links-note"
  | "folder-contains-note"
  | "folder-contains-folder";
```

Edge representation:

```ts
interface GraphEdge {
  from: NodeId;
  to: NodeId;
  type: EdgeType;
}
```

### 9.3 Graph Indices

Adjacency-based representation for fast traversal:

```ts
interface GraphIndex {
  nodes: Map<NodeId, GraphNode>;
  outgoing: Map<NodeId, GraphEdge[]>;
  incoming: Map<NodeId, GraphEdge[]>;
}
```


## 10. Unlinked Mentions Model

Unlinked mentions track potential links where a note’s title or alias appears in another note’s plain text but is not already linked.

```ts
interface UnlinkedMention {
  noteId: NoteId;         // the note that contains the text
  candidateTargetId: NoteId; // note that could be linked to
  occurrences: {
    line: number;
    startColumn: number;
    endColumn: number;
  }[];
}

interface UnlinkedMentionIndex {
  byNote: Map<NoteId, UnlinkedMention[]>;     // for a given note, possible outgoing links
  byTarget: Map<NoteId, UnlinkedMention[]>;   // for a given note, who mentions it
}
```


## 11. Application State Aggregation

The Indexing System stitches all these indices together into a single state object:

```ts
interface AppState {
  noteRegistry: NoteRegistry;
  peopleIndex: PeopleIndex;
  tagIndex: TagIndex;
  folderIndex: FolderIndex;
  headingIndex: HeadingIndex;
  embedIndex: EmbedIndex;
  graphIndex: GraphIndex;
  unlinkedMentionIndex: UnlinkedMentionIndex;

  // Optional: full-text search index
  // searchIndex: SearchIndex;
}
```

This `AppState` (or a subset of it) is exposed as read-only to the UI and other subsystems, with mutations funneled through the Indexing System.

---

This data model gives you:

- A clear, normalized representation of all entities.
- Efficient, index-based lookups for graph queries and discovery.
- A strong foundation for the parsing, indexing, graph, and resolution systems described in the following documents.
