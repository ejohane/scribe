# @scribe/shared

Core type definitions and shared utilities for Scribe. This is the foundational package that all other packages depend on.

## Overview

This package provides:

- **Type Definitions**: Core types for notes, graphs, and search
- **Error System**: Structured error types with error codes
- **AST Utilities**: Lexical editor state traversal and manipulation
- **IPC Contract**: Type-safe API definitions for Electron IPC
- **Content Extraction**: Markdown export functionality

## Installation

This is an internal monorepo package. It's available to other packages via workspace dependency:

```json
{
  "dependencies": {
    "@scribe/shared": "workspace:*"
  }
}
```

## Key Exports

### Note Types

```typescript
import type {
  NoteId,
  NoteType,
  VaultPath,
  Note,
  RegularNote,
  PersonNote,
  ProjectNote,
  DailyNote,
  MeetingNote,
  TemplateNote,
  SystemNote,
  NoteMetadata,
} from '@scribe/shared';

import {
  createNoteId,
  createVaultPath,
  isRegularNote,
  isPersonNote,
  isProjectNote,
  isDailyNote,
  isMeetingNote,
  isTemplateNote,
  isSystemNote,
  SYSTEM_NOTE_IDS,
  isSystemNoteId,
} from '@scribe/shared';
```

### Editor Types

```typescript
import type {
  EditorContent,  // Abstract editor state
  EditorNode,     // Abstract node type
  LexicalState,   // Lexical-specific (deprecated alias)
  LexicalNode,    // Lexical-specific (deprecated alias)
} from '@scribe/shared';
```

### Graph & Search Types

```typescript
import type {
  GraphNode,
  GraphEdge,
  SearchResult,
  VaultConfig,
} from '@scribe/shared';
```

### Error System

```typescript
import {
  ErrorCode,
  ScribeError,
  FileSystemError,
  NoteError,
  VaultError,
  EngineError,
  ValidationError,
  isScribeError,
  isFileSystemError,
  isNoteError,
  isVaultError,
  isEngineError,
  isValidationError,
} from '@scribe/shared';
import type { EngineName } from '@scribe/shared';
```

### AST Utilities

```typescript
import {
  traverseNodes,
  traverseNodesWithAncestors,
  findNodeByKey,
  extractTextFromNodes,
  extractTextFromNode,
} from '@scribe/shared';
```

### Content Extraction

```typescript
import { extractMarkdown } from '@scribe/shared';
import type { MarkdownExportOptions } from '@scribe/shared';

// Convert Lexical content to Markdown
const markdown = extractMarkdown(note.content, {
  includeMetadata: true,
  includeTitle: true,
});
```

### IPC Contract

```typescript
import { IPC_CHANNELS } from '@scribe/shared';
import type {
  NotesAPI,
  SearchAPI,
  GraphAPI,
  ShellAPI,
  AppAPI,
  PeopleAPI,
  DailyAPI,
  MeetingAPI,
  UpdateAPI,
  ExportAPI,
  ScribeAPI,
} from '@scribe/shared';
```

### Constants

```typescript
import { DEFAULT_NOTE_TITLE } from '@scribe/shared';
```

## Note Type System

Notes use a discriminated union pattern based on the `type` field:

| Type | Description | Additional Fields |
|------|-------------|-------------------|
| `undefined` | Regular note | None |
| `'person'` | Person/contact note | None |
| `'project'` | Project note | None |
| `'daily'` | Daily journal | `daily: { date: string }` |
| `'meeting'` | Meeting note | `meeting: { date, dailyNoteId, attendees[] }` |
| `'template'` | Note template | None |
| `'system'` | System note | None |

## Error Codes

```typescript
enum ErrorCode {
  // File system errors
  FILE_READ_ERROR,
  FILE_WRITE_ERROR,
  FILE_DELETE_ERROR,
  FILE_NOT_FOUND,
  
  // Note errors
  NOTE_NOT_FOUND,
  NOTE_VALIDATION_ERROR,
  
  // Vault errors
  VAULT_NOT_INITIALIZED,
  VAULT_ALREADY_EXISTS,
  
  // Engine errors
  ENGINE_NOT_READY,
  
  // Validation errors
  INVALID_NOTE_STRUCTURE,
}
```

## Dependencies

### Development Only

- `typescript` ^5.7.2
- `vitest` ^2.1.8

This package has no runtime dependencies, making it safe to use in any environment (browser, Node.js, Electron).

## Development

```bash
# Run tests
bun run test

# Type check
bun run typecheck

# Lint
bun run lint

# Build (generates .d.ts files)
bun run build
```
