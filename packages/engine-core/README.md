# @scribe/engine-core

Core engine module for Scribe. Provides metadata extraction, task management, and note processing utilities.

## Overview

This package contains the core business logic for processing notes:

- **Metadata Extraction**: Parse note content to extract links, tags, and mentions
- **Task Extraction**: Extract and track tasks from note content
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

### Task Extraction (Browser-Safe)

```typescript
import { extractTasksFromNote, computeTextHash } from '@scribe/engine-core';
import type { ExtractedTask, NoteForExtraction } from '@scribe/engine-core';

// Extract tasks from a note
const tasks = extractTasksFromNote(note);

// Compute hash for change detection
const hash = computeTextHash(taskText);
```

### Task Types (Re-exported from @scribe/shared)

```typescript
import type { TaskId, Task, TaskFilter, TaskChangeEvent } from '@scribe/engine-core';
import { serializeTaskId, parseTaskId } from '@scribe/engine-core';
```

## Node.js-Only Imports

Some modules require Node.js APIs and are NOT exported from the barrel to keep browser bundles clean:

```typescript
// TaskIndex - for building task lookup maps
import { 
  TaskIndex, 
  buildExistingTaskMap, 
  findOldTaskId, 
  findOrphanedTaskIds 
} from '@scribe/engine-core/src/task-index.js';

// TaskPersistence - for saving/loading tasks
import { 
  TaskPersistence, 
  JsonlTaskPersistence, 
  InMemoryTaskPersistence 
} from '@scribe/engine-core/src/task-persistence.js';

// TaskReconciler - for syncing tasks with notes
import { 
  TaskReconciler, 
  DefaultTaskReconciler 
} from '@scribe/engine-core/src/task-reconciler.js';
```

## Architecture

```
src/
├── index.ts              # Browser-safe exports
├── node.ts               # Node.js-specific exports
├── metadata.ts           # Link/tag/mention extraction
├── metadata-index.ts     # In-memory metadata index
├── task-extraction.ts    # Task parsing (browser-safe)
├── task-index.ts         # Task indexing (Node.js)
├── task-persistence.ts   # Task storage (Node.js)
└── task-reconciler.ts    # Task sync logic (Node.js)
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
