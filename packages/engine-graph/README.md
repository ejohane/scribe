# @scribe/engine-graph

Graph engine module for Scribe. Provides knowledge graph construction and query capabilities for note-to-note relationships.

## Overview

This package maintains an in-memory knowledge graph built from note metadata, enabling fast queries for:

- **Backlinks**: Find all notes that link to a given note
- **Outlinks**: Find all notes that a given note links to
- **Neighbors**: Find all connected notes (bidirectional)
- **Tag Queries**: Find all notes with a specific tag
- **Person Mentions**: Track which notes mention which people

## Installation

This is an internal monorepo package. It's available to other packages via workspace dependency:

```json
{
  "dependencies": {
    "@scribe/engine-graph": "workspace:*"
  }
}
```

## Key Exports

### GraphEngine

```typescript
import { GraphEngine } from '@scribe/engine-graph';

const graph = new GraphEngine();

// Build the graph from notes
for (const note of notes) {
  graph.addNote(note);
}

// Query backlinks (notes that link TO this note)
const backlinks = graph.backlinks(noteId);
// Returns: GraphNode[] with { id, title, tags, type }

// Query outlinks (notes this note links TO)
const outlinks = graph.outlinks(noteId);

// Query neighbors (all connected notes, both directions)
const neighbors = graph.neighbors(noteId);

// Find notes by tag
const projectNotes = graph.notesWithTag('project');

// Get all unique tags
const allTags = graph.getAllTags();

// Person mention queries
const notesMentioningPerson = graph.notesMentioning(personNoteId);
const peopleMentioned = graph.peopleMentionedIn(noteId);
const allPeople = graph.getAllPeople();

// Graph statistics
const stats = graph.getStats();
// Returns: { nodes: number, edges: number, tags: number }

// Maintenance
graph.removeNote(noteId);
graph.clear();
```

## Architecture

The graph maintains several in-memory indexes:

| Index | Purpose |
|-------|---------|
| `outgoing` | Map of noteId → Set of noteIds it links to |
| `incoming` | Map of noteId → Set of noteIds that link to it (backlinks) |
| `tags` | Map of tag → Set of noteIds with that tag |
| `nodes` | Map of noteId → GraphNode metadata |
| `mentioning` | Map of noteId → Set of personIds mentioned |
| `mentionedBy` | Map of personId → Set of noteIds mentioning them |

### Special Handling

- **Meeting Notes**: Automatically creates a link from meeting → daily note, so meetings appear in daily note backlinks
- **Tags**: Combines explicit user tags with inline #hashtags from content
- **Mentions**: Tracks @person mentions separately from wiki-links

## Performance

All data is kept in-memory for O(1) lookup performance:

- `addNote()` - O(links + tags + mentions)
- `removeNote()` - O(links + tags + mentions)
- `backlinks()` / `outlinks()` / `neighbors()` - O(n) where n = result size
- `notesWithTag()` - O(n) where n = notes with tag

## Dependencies

### Internal

- `@scribe/shared` - Core types (NoteId, Note, GraphNode, etc.)

### Development

- `typescript` ^5.7.2
- `vitest` ^2.1.8

## Development

```bash
# Run tests
bun run test

# Type check
bun run typecheck

# Lint
bun run lint
```
