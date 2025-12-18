# @scribe/engine-search

Full-text search engine for Scribe notes. Provides fast, in-memory search with ranked results using [FlexSearch](https://github.com/nextapps-de/flexsearch).

## Overview

This package provides:

- **Full-text Search**: Search across note titles, tags, and content
- **Prefix Matching**: Type-ahead search ("meet" matches "meeting")
- **Weighted Scoring**: Title matches rank higher than content matches
- **Snippet Generation**: Context snippets around match positions
- **Incremental Indexing**: Add/remove individual notes without full rebuild

## Installation

This is an internal monorepo package. It's available to other packages via workspace dependency:

```json
{
  "dependencies": {
    "@scribe/engine-search": "workspace:*"
  }
}
```

## Key Exports

### SearchEngine

```typescript
import { SearchEngine } from '@scribe/engine-search';

const search = new SearchEngine();

// Index notes
for (const note of notes) {
  search.indexNote(note);
}

// Search with ranked results
const results = search.search('project meeting');
// Returns: SearchResult[] sorted by relevance

// Each result contains:
// {
//   id: NoteId,
//   title: string | null,
//   snippet: string,        // Context around match
//   score: number,          // Relevance score
//   matches: [{             // Where matches occurred
//     field: 'title' | 'tags' | 'content',
//     positions: number[]
//   }]
// }

// Limit results
const topFive = search.search('todo', 5);

// Remove from index
search.removeNote(noteId);

// Clear and rebuild
search.clear();

// Get index size
const count = search.size();
```

## Query Syntax

FlexSearch uses a simple query syntax:

| Query | Behavior |
|-------|----------|
| `meeting` | Matches notes containing "meeting" |
| `project update` | Matches notes with BOTH terms (AND logic) |
| `meet` | Prefix match - finds "meeting", "meetings", etc. |

**Not Supported**:
- Boolean operators (AND, OR, NOT)
- Phrase matching with quotes
- Field-specific queries (e.g., `title:meeting`)
- Wildcards or regex

## Scoring Algorithm

Results are ranked by where matches occur:

| Field | Weight | Rationale |
|-------|--------|-----------|
| Title | 10 | Term in title = note is about that topic |
| Tags | 5 | Explicit user categorization |
| Content | 1 | May be incidental mention |

Scores are additive. A note with "project" in title AND content scores 11 (10 + 1).

## Configuration

The FlexSearch index is configured for note-taking search:

```typescript
{
  tokenize: 'forward',     // Enable prefix matching
  cache: true,             // Cache repeated queries
  context: {
    resolution: 9,         // Highest precision
    depth: 2,              // Consider word proximity
    bidirectional: true    // Both directions
  }
}
```

## Performance

| Operation | Complexity | Notes |
|-----------|------------|-------|
| `indexNote()` | O(n) | n = content length (capped at 1000 chars) |
| `search()` | O(log n) | With FlexSearch context indexing |
| Memory | ~2-3x | Of indexed text due to forward tokenization |

## Dependencies

### Internal

- `@scribe/shared` - Core types (Note, NoteId, SearchResult)

### External

- `flexsearch` - Full-text search library
- `date-fns` - Date formatting for daily notes

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
