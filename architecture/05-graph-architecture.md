# Graph Architecture

This document specifies the graph model and operations that power the knowledge graph features of the application.

The graph represents relationships between:

- Notes
- People
- Tags
- Folders
- Headings
- Embeds


## 1. Goals

- Represent all relevant relationships as typed edges.
- Provide fast lookup for neighbors, degrees, and basic traversals.
- Support filters by entity type and edge type.
- Serve as a backend for visual graph views and “related content” features.
- Stay decoupled from Markdown details and parsing logic.


## 2. Graph Model

### 2.1 Node Types

Each entity type gets a corresponding graph node:

- `note` – general Markdown file (including person notes).
- `person` – person entity (backed by a note in `people/`).
- `tag` – logical tag label.
- `folder` – filesystem folder.
- `heading` – anchor within a note (if you want them to appear in graph).
- `embed` – optional explicit embed node (or implicit relationship).

### 2.2 Node Representation

```ts
type EntityType = "note" | "person" | "tag" | "folder" | "heading";

interface GraphNode {
  id: NodeId;             // e.g. "note:notes/Plan"
  entityType: EntityType;
  refId: string;          // underlying ID: NoteId, TagId, etc.
}
```

`NodeId` is usually prefixed by type, e.g.:

- `note:notes/Plan`
- `person:Erik`
- `tag:planning`
- `folder:notes/2025`


### 2.3 Edge Types

Graph edges encode different relationships:

```ts
type EdgeType =
  | "note-links-note"       // [[Note]]
  | "note-links-heading"    // [[Note#Heading]]
  | "note-embeds-note"      // ![[Note]]
  | "note-has-tag"          // #tag
  | "note-mentions-person"  // @Person
  | "person-links-note"     // links from person note content
  | "folder-contains-note"  // folder membership
  | "folder-contains-folder"; // parent-child folders
```

Edge representation:

```ts
interface GraphEdge {
  from: NodeId;
  to: NodeId;
  type: EdgeType;
}
```


## 3. Graph Construction

The Graph Engine consumes `ParsedNote` objects and indices (notes, tags, people, folders) and generates edges.

### 3.1 Nodes

Nodes are registered when:

- A note is parsed → `note` node.
- A person entity is registered → `person` node.
- Tags are discovered → `tag` nodes.
- Folders are discovered → `folder` nodes.
- Optional: headings are registered → `heading` nodes.

Example:

```ts
function ensureNoteNode(noteId: NoteId): NodeId {
  const nodeId = `note:${noteId}`;
  if (!graphIndex.nodes.has(nodeId)) {
    graphIndex.nodes.set(nodeId, {
      id: nodeId,
      entityType: "note",
      refId: noteId,
    });
  }
  return nodeId;
}
```


### 3.2 Edges from a ParsedNote

For each `ParsedNote` `parsed`:

1. **Note node**

```ts
const fromNodeId = ensureNoteNode(parsed.id);
```

2. **Note ↔ Folder**

Using `FolderIndex`:

```ts
const folderId = folderIndex.getFolderForNote(parsed.id);
if (folderId) {
  const folderNodeId = ensureFolderNode(folderId);
  addEdge(folderNodeId, fromNodeId, "folder-contains-note");
}
```

3. **Note ↔ Tag**

For each `TagId` in `parsed.allTags`:

```ts
const tagNodeId = ensureTagNode(tagId);
addEdge(fromNodeId, tagNodeId, "note-has-tag");
```

4. **Note ↔ Person (mentions)**

For each `PersonMentionRef` resolved to `PersonId`:

```ts
const personNodeId = ensurePersonNode(personId);
addEdge(fromNodeId, personNodeId, "note-mentions-person");
```

5. **Note ↔ Note (links)**

For each `LinkRef` resolved to a target note:

```ts
const targetNoteNodeId = ensureNoteNode(targetNoteId);
addEdge(fromNodeId, targetNoteNodeId, "note-links-note");
```

6. **Note ↔ Heading (links to headings)**

If `LinkRef` includes a heading that resolves to a `HeadingId`:

```ts
const headingNodeId = ensureHeadingNode(headingId);
addEdge(fromNodeId, headingNodeId, "note-links-heading");
```

7. **Note ↔ Note (embeds)**

For each `EmbedRef` resolved to a target note:

```ts
const targetNoteNodeId = ensureNoteNode(targetNoteId);
addEdge(fromNodeId, targetNoteNodeId, "note-embeds-note");
```


## 4. Adjacency Representation

To support efficient graph operations, we maintain adjacency lists.

```ts
interface GraphIndex {
  nodes: Map<NodeId, GraphNode>;
  outgoing: Map<NodeId, GraphEdge[]>;
  incoming: Map<NodeId, GraphEdge[]>;
}
```

### 4.1 Adding an Edge

```ts
function addEdge(from: NodeId, to: NodeId, type: EdgeType): void {
  const edge: GraphEdge = { from, to, type };

  if (!graphIndex.outgoing.has(from)) {
    graphIndex.outgoing.set(from, []);
  }
  graphIndex.outgoing.get(from)!.push(edge);

  if (!graphIndex.incoming.has(to)) {
    graphIndex.incoming.set(to, []);
  }
  graphIndex.incoming.get(to)!.push(edge);
}
```


### 4.2 Removing Edges for a Note

When a note is deleted or updated, we remove its edges:

```ts
function removeNodeEdges(nodeId: NodeId): void {
  // Remove outgoing
  const outgoing = graphIndex.outgoing.get(nodeId) || [];
  for (const edge of outgoing) {
    const incoming = graphIndex.incoming.get(edge.to);
    if (incoming) {
      graphIndex.incoming.set(edge.to, incoming.filter(e => e.from !== nodeId || e.type !== edge.type));
    }
  }
  graphIndex.outgoing.delete(nodeId);

  // Remove incoming
  const incoming = graphIndex.incoming.get(nodeId) || [];
  for (const edge of incoming) {
    const outgoingEdges = graphIndex.outgoing.get(edge.from);
    if (outgoingEdges) {
      graphIndex.outgoing.set(edge.from, outgoingEdges.filter(e => e.to !== nodeId || e.type !== edge.type));
    }
  }
  graphIndex.incoming.delete(nodeId);
}
```


## 5. Graph Query Patterns

The Graph Engine exposes a set of operations for the UI and other subsystems.

### 5.1 Neighbors

```ts
function getNeighbors(nodeId: NodeId, filter?: { edgeTypes?: EdgeType[], direction?: "in" | "out" | "both" }): GraphEdge[];
```

Use cases:

- “What notes link to this note?” → incoming edges of type `note-links-note`.
- “What tags does this note have?” → outgoing edges of type `note-has-tag`.
- “What people are mentioned in this note?” → outgoing edges of type `note-mentions-person`.


### 5.2 Backlinks

Backlinks for a note are just incoming edges of type:

- `note-links-note`
- `note-embeds-note` (if you want embeds to count)

```ts
function getBacklinks(noteId: NoteId): GraphEdge[] {
  const nodeId = `note:${noteId}`;
  const incoming = graphIndex.incoming.get(nodeId) || [];
  return incoming.filter(e => e.type === "note-links-note" || e.type === "note-embeds-note");
}
```


### 5.3 Tag-Based Graph

To render a tag-centric view:

- Start from `tag:<TagId>` node.
- Get incoming edges of type `note-has-tag`.
- The `from` nodes are notes with that tag.


### 5.4 Person-Centric Graph

For a `person:Erik` node:

- Incoming `note-mentions-person` edges → notes mentioning Erik.
- Outgoing edges (if Erik’s person note links to other notes) → explicit relationships from the person page.


### 5.5 Folder-Based Graph

Folders are hierarchical:

- `folder-contains-folder` edges describe parent-child relationships.
- `folder-contains-note` edges describe note membership.

They’re especially useful for filtering or layered graph views.


## 6. Visual Graph View

The UI can consume the Graph Engine as follows:

1. Construct a **graph subview**:
   - Set of node types (e.g., notes + people + tags).
   - Set of edge types (e.g., `note-links-note`, `note-mentions-person`).
   - Optional filters (by tag, folder, text search).

2. Fetch nodes and edges using Graph Engine APIs.

3. Layout using a force-directed graph or other visualization algorithm.

4. Provide interactions:
   - Click node → open entity detail.
   - Hover node → show metadata.
   - Filter by tag / person / folder.


## 7. Relationship to Other Systems

- **Indexing System** constructs and maintains the graph as notes change.
- **Resolution Engine** provides the mapping from link text / mention text to canonical node IDs.
- **Search & Discovery** may use graph structure to rank search results or find “related notes” (e.g., based on number and types of connections).


## 8. Future Extensions

You can extend the graph architecture to support:

- Weighted edges (edge strength based on frequency of mentions/links).
- Edge attributes (e.g., link context, line number).
- Different edge visibility levels (toggle certain edge types for clarity).
- Community detection algorithms for clustering notes.

---

This graph architecture abstracts away the low-level parsing and indexing and exposes a powerful, flexible relationship model for your UI and features.

Next, we’ll document the **Link & Entity Resolution Engine**, which determines how user-facing syntax like `[[Note]]` and `@Person` maps onto this graph.
