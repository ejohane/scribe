# @scribe/engine-core

Core engine module for Scribe. Provides metadata extraction and note processing utilities.

## Overview

This package contains the core business logic for processing notes:

- **Metadata Extraction**: Parse note content to extract links, tags, and mentions
- **Metadata Indexing**: Maintain indexes for efficient lookups

## Installation

This is an internal monorepo package. It's available to other packages via workspace dependency:

```json
{
  "dependencies": {
    "@scribe/engine-core": "workspace:*"
  }
}
```

## Key Exports

### Metadata Extraction

```typescript
import { extractMetadata, extractTags, extractLinks } from '@scribe/engine-core';

// Extract all metadata from Lexical content
const metadata = extractMetadata(lexicalContent);
// Returns: { links: NoteId[], tags: string[], mentions: NoteId[] }

// Extract just tags or links
const tags = extractTags(lexicalContent);    // ['project', 'meeting']
const links = extractLinks(lexicalContent);  // ['note-id-1', 'note-id-2']
```

### Metadata Index

```typescript
import { MetadataIndex } from '@scribe/engine-core';

const index = new MetadataIndex();
index.addNote(note);
index.removeNote(noteId);

// Query the index
const notesWithTag = index.getNotesWithTag('project');
const backlinks = index.getBacklinks(noteId);
```

## Architecture

```
src/
├── index.ts              # Browser-safe exports
├── metadata.ts           # Link/tag/mention extraction
└── metadata-index.ts     # In-memory metadata index
```

## Dependencies

### Internal

- `@scribe/shared` - Core types and utilities

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
