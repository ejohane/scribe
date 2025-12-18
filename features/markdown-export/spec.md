# Feature: Export Note to Markdown

**Status**: Draft  
**Created**: 2025-12-16

## Overview

Allow users to export individual notes from the Scribe desktop app as standalone Markdown files. The feature provides a share menu in the note header with format options (initially only Markdown), shows a native file picker for choosing the save location, and displays a toast notification on success.

The CLI also supports exporting notes to Markdown, outputting to stdout by default or to a specified file path.

---

## Goals

1. Export a single note to a `.md` file with all content preserved
2. Include frontmatter with note metadata (title, tags, dates)
3. Preserve wiki-links as `[[title]]` and mentions as `@name` in raw form
4. Use native OS file picker for destination selection
5. Show user-friendly feedback via toast notifications
6. Support the same export from the CLI for automation and scripting

---

## Non-Goals (Out of Scope for MVP)

- Batch export of multiple notes
- Export to formats other than Markdown (PDF, HTML, etc.)
- Configurable frontmatter fields
- Asset/attachment export (images, files)
- Export with resolved wiki-links (converting to relative file paths)
- Custom templates for export format
- Clipboard copy of Markdown content

---

## User Stories

### Desktop App

**As a user**, I want to export a note to a Markdown file so that I can:
- Share it with someone who doesn't use Scribe
- Back up important notes in a portable format
- Import it into other tools (Obsidian, Notion, etc.)

**Acceptance Criteria:**
1. I see a share icon button in the note header (right side of metadata row)
2. Clicking the share icon opens a dropdown menu
3. The menu shows "Export to Markdown" as an option
4. Selecting the option opens a native file save dialog
5. The dialog defaults to `{note-title}.md` as the filename
6. After saving, I see a success toast: "Exported to {filename}"
7. If I cancel the dialog, nothing happens (no error)
8. If the file already exists, the OS prompts to confirm overwrite
9. I can press Cmd+Shift+E (macOS) or Ctrl+Shift+E (Windows/Linux) to open the share menu

### CLI

**As a developer/power user**, I want to export notes via CLI so that I can:
- Script bulk exports
- Integrate with other tools
- Quickly dump note content to terminal

**Acceptance Criteria:**
1. `scribe notes export <id>` outputs Markdown to stdout
2. `scribe notes export <id> --output path/to/file.md` saves to a file
3. Output includes frontmatter with metadata
4. Exit code 0 on success, non-zero on error

---

## Technical Design

### Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Renderer Process                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────────┐  │
│  │ ShareMenu   │───▶│ useToast    │    │ window.scribe.export    │  │
│  │ Component   │    │ Hook        │    │ .toMarkdown(noteId)     │  │
│  └─────────────┘    └─────────────┘    └───────────┬─────────────┘  │
└───────────────────────────────────────────────────┼─────────────────┘
                                                    │ IPC
┌───────────────────────────────────────────────────┼─────────────────┐
│                        Main Process               │                  │
│  ┌────────────────────────────────────────────────▼───────────────┐ │
│  │                    exportHandlers.ts                            │ │
│  │  1. Read note from vault                                        │ │
│  │  2. Convert content to Markdown (shared/content-extractor)      │ │
│  │  3. Generate frontmatter                                        │ │
│  │  4. Show dialog.showSaveDialog()                                │ │
│  │  5. Write file to disk                                          │ │
│  └─────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

### File Changes

> **Note on path verification**: All paths below have been verified against the actual project structure as of 2025-12-16.

| File | Change Type | Description | Path Verified |
|------|-------------|-------------|---------------|
| `packages/shared/src/content-extractor.ts` | **New** | Lexical → Markdown conversion with frontmatter | ✅ Directory exists |
| `packages/shared/src/index.ts` | Modify | Export `extractMarkdown` function | ✅ File exists |
| `packages/shared/src/ipc-contract.ts` | Modify | Add `ExportAPI` interface and IPC channel | ✅ File exists with `IPC_CHANNELS` |
| `apps/desktop/electron/main/src/handlers/exportHandlers.ts` | **New** | Main process export handler | ✅ Handlers directory exists |
| `apps/desktop/electron/main/src/handlers/index.ts` | Modify | Register export handlers | ✅ File exists (barrel export) |
| `apps/desktop/electron/preload/src/preload.ts` | Modify | Wire up export IPC bridge | ✅ File exists |
| `apps/desktop/renderer/src/components/ShareMenu/ShareMenu.tsx` | **New** | Share button + dropdown menu | ✅ Components directory exists |
| `apps/desktop/renderer/src/components/ShareMenu/ShareMenu.css.ts` | **New** | Styles for share menu | ✅ (new directory) |
| `apps/desktop/renderer/src/components/ShareMenu/index.ts` | **New** | Barrel export | ✅ (new directory) |
| `apps/desktop/renderer/src/components/NoteHeader/NoteHeader.tsx` | Modify | Add ShareMenu to header | ✅ File exists |
| `apps/desktop/renderer/src/components/NoteHeader/NoteHeader.css.ts` | Modify | Adjust layout for share menu | ✅ File exists |
| `apps/desktop/renderer/src/components/NoteHeader/index.ts` | - | Barrel export already exists | ✅ File exists |
| `apps/cli/src/commands/notes.ts` | Modify | Add `export` subcommand | ✅ File exists |
| `apps/cli/src/content-extractor.ts` | Modify | Re-export `extractMarkdown` from shared (existing `extractPlainText` remains) | ✅ File exists |
| `packages/shared/src/content-extractor.test.ts` | **New** | Unit tests for content extractor | ✅ Directory exists |
| `apps/desktop/renderer/src/components/ShareMenu/ShareMenu.test.tsx` | **New** | Component tests for ShareMenu | ✅ (new directory) |
| `apps/desktop/electron/main/src/handlers/exportHandlers.test.ts` | **New** | Integration tests for export handler | ✅ Handlers directory exists |
| `apps/cli/tests/unit/notes-export.test.ts` | **New** | CLI export tests | ✅ Directory exists |

**Implementation notes:**
- The existing `apps/cli/src/content-extractor.ts` contains `extractPlainText()` function - the new `extractMarkdown()` will be added to shared and re-exported alongside the existing function
- `NoteHeader/index.ts` already exists and may need updating to re-export `ShareMenu` if needed
- The `ShareMenu/` directory needs to be created under `apps/desktop/renderer/src/components/`

---

## Shared Module: Content Extractor

The content extraction logic is moved to `packages/shared/` so both the desktop app and CLI can use it.

### Location

`packages/shared/src/content-extractor.ts`

### API

```typescript
// packages/shared/src/content-extractor.ts

// Import types from within the same package (relative import)
import type { Note, NoteType } from './types.js';

export interface MarkdownExportOptions {
  /** Include YAML frontmatter with metadata (default: true) */
  includeFrontmatter?: boolean;
  /** Include title as H1 heading (default: false, since it's in frontmatter) */
  includeTitle?: boolean;
}

/**
 * Note Type Reference (from @scribe/shared/types.ts)
 * 
 * The Note type is a discriminated union with these common fields:
 * 
 * BaseNote fields (available on all notes):
 * - id: NoteId           - Unique identifier (branded string)
 * - title: string        - User-editable title
 * - createdAt: number    - Creation timestamp (milliseconds since epoch)
 * - updatedAt: number    - Last update timestamp (milliseconds since epoch)
 * - tags: string[]       - User-defined tags (without # prefix)
 * - content: EditorContent - Rich text content (Lexical JSON format)
 * - metadata: NoteMetadata - Derived metadata (links, mentions, extracted tags)
 * 
 * Note type discriminator (NoteType):
 * - undefined: Regular note (default)
 * - 'person': Person entity (can be @mentioned)
 * - 'project': Project note for organizing related work
 * - 'meeting': Meeting note with attendees
 * - 'daily': Daily journal note with date
 * - 'template': Template for creating new notes
 * - 'system': Reserved for system functionality
 * 
 * Type-specific fields:
 * - MeetingNote.meeting: { date: string, dailyNoteId: NoteId, attendees: NoteId[] }
 * - DailyNote.daily: { date: string }
 */

/**
 * Convert a note to Markdown format.
 * 
 * Handles all Lexical node types:
 * - Headings → `## Heading`
 * - Paragraphs → Plain text with blank line separation
 * - Lists → `- item` or `1. item`
 * - Checklist items → `- [ ] task` or `- [x] task`
 * - Quotes → `> quote`
 * - Code blocks → ``` code ```
 * - Wiki-links → `[[target title]]`
 * - Person mentions → `@person name`
 * - Tables → Markdown table syntax
 * - Horizontal rules → `---`
 * 
 * @param note - The note to convert
 * @param options - Export options
 * @returns Markdown string
 */
export function extractMarkdown(note: Note, options?: MarkdownExportOptions): string;
```

### Frontmatter Format

The frontmatter includes metadata from the Note type fields:

```yaml
---
title: "Meeting with Alice"      # From Note.title
tags:                            # From Note.tags (user-defined, without # prefix)
  - work
  - 1on1
created: 2025-12-15T10:30:00.000Z  # From Note.createdAt (converted to ISO-8601)
updated: 2025-12-15T11:45:00.000Z  # From Note.updatedAt (converted to ISO-8601)
type: meeting                    # From Note.type (NoteType discriminator, omitted for regular notes)
---
```

**Frontmatter field mapping:**

| Frontmatter Field | Note Field | Description |
|-------------------|------------|-------------|
| `title` | `Note.title` | User-editable note title |
| `tags` | `Note.tags` | User-defined tags (array of strings, # prefix stripped) |
| `created` | `Note.createdAt` | Creation timestamp, converted from milliseconds to ISO-8601 |
| `updated` | `Note.updatedAt` | Last update timestamp, converted from milliseconds to ISO-8601 |
| `type` | `Note.type` | Note type discriminator (only included if not a regular note) |

**Note types that appear in frontmatter:**
- `person` - A person entity that can be @mentioned
- `project` - A project note for organizing work
- `meeting` - A meeting note (includes attendees in content)
- `daily` - A daily journal note
- `template` - A template for new notes

Regular notes have `type: undefined` and the field is omitted from frontmatter.

### Content Conversion

| Lexical Node | Markdown Output |
|--------------|-----------------|
| `heading` (h1) | `# Heading` |
| `heading` (h2) | `## Heading` |
| `heading` (h3) | `### Heading` |
| `paragraph` | Plain text + blank line |
| `listitem` (unordered) | `- item` |
| `listitem` (ordered) | `1. item` |
| `listitem` (checked) | `- [x] task` |
| `listitem` (unchecked) | `- [ ] task` |
| `quote` | `> quoted text` |
| `code` | ` ```\ncode\n``` ` |
| `horizontalrule` | `---` |
| `wiki-link` | `[[Meeting Notes]]` (title preserved as-is) |
| `person-mention` | `@Person Name` |
| `table` | Pipe table with header separator (see Open Question #1) |
| `text` (bold) | `**bold**` |
| `text` (italic) | `*italic*` |
| `text` (code) | `` `code` `` |
| `text` (strikethrough) | `~~strikethrough~~` |
| `link` | `[text](url)` |
| `linebreak` | `\n` |

### Implementation Notes

- Tags in frontmatter are stripped of `#` prefix
- Dates are ISO-8601 format
- Wiki-link titles are preserved exactly as stored (no case transformation, not resolved to file paths)
- Nested lists maintain proper indentation
- Empty paragraphs are preserved as blank lines
- Text formatting (bold, italic, etc.) uses standard Markdown syntax
- Line endings use LF (`\n`) on all platforms for consistency. Markdown parsers universally support LF, the CommonMark spec uses LF, and Git's `core.autocrlf` can convert to CRLF if needed on Windows.

**File Encoding**

- Files are exported as UTF-8 without BOM (Byte Order Mark)
- Unicode characters (emoji, international text, symbols) are preserved as-is
- Line endings use LF (`\n`) consistent with Unix conventions

### Special Character Handling

Plain text content may contain characters that have special meaning in Markdown. This section defines how these characters are handled during export to ensure content fidelity.

**Characters requiring consideration:**

| Character | Markdown Meaning | Example in Plain Text |
|-----------|-----------------|----------------------|
| `*` | Emphasis/bold | "The price is $100 * 2 = $200" |
| `_` | Emphasis/italic | "Use snake_case naming" |
| `#` | Heading | "Use # to start a comment" |
| `[` `]` | Link text | "The [brackets] are important" |
| `` ` `` | Inline code | "Use `backticks` for code" (already code) |
| `>` | Blockquote | "Use > for quotes in email" |
| `-` `+` | List item | "Temperature is -5 degrees" |
| `\` | Escape character | "Path is C:\Users\name" |
| `|` | Table cell | "Use | as a separator" |
| `~` | Strikethrough | "Approx ~100 items" |

**Recommendation: Context-Aware Escaping (Option 2)**

The export function SHOULD use context-aware escaping rather than escaping all special characters or preserving raw text:

1. **Escape only when ambiguous** - Characters are escaped only when they could be misinterpreted as Markdown syntax in their current position
2. **Preserve readability** - Avoid excessive backslashes that harm readability
3. **Maintain round-trip fidelity** - Exported Markdown should render identically to the original Scribe note

**Escaping rules:**

| Context | Rule | Example |
|---------|------|---------|
| `*` or `_` at word boundary | Escape | `\*important\*` → renders as \*important\* |
| `*` or `_` mid-word | No escape | `snake_case` → renders as snake_case |
| `#` at line start | Escape | `\# comment` → renders as # comment |
| `#` mid-line | No escape | `Issue #123` → renders as Issue #123 |
| `[text]` pattern | Escape opening bracket | `\[brackets]` → renders as [brackets] |
| `[text](url)` pattern | Escape (broken link) | `\[text](url)` → renders as [text](url) |
| `>` at line start | Escape | `\> quote` → renders as > quote |
| `-`, `+`, `*` at line start + space | Escape | `\- item` → renders as - item |
| Numbered list pattern (`1.`) | Escape | `1\. First` → renders as 1. First |
| `|` in table context | Escape | `a \| b` → renders as a | b |
| `\` before special char | Escape | `\\` → renders as \ |

**Implementation approach:**

```typescript
/**
 * Escape special Markdown characters in plain text content.
 * Uses context-aware escaping to minimize visual noise while
 * preserving content fidelity.
 */
function escapeMarkdownText(text: string, context: EscapeContext): string {
  // Context includes: isLineStart, isInTable, previousChar, nextChar
  // Apply rules based on position and surrounding characters
}

interface EscapeContext {
  isLineStart: boolean;
  isInTable: boolean;
  isAtWordBoundary: boolean;
}
```

**Edge cases:**

- **Already-escaped content**: If user typed `\*` in Scribe, export as `\\*` to preserve the backslash
- **Code blocks**: No escaping inside code blocks (content is literal)
- **URLs in links**: No escaping inside URL portion of `[text](url)`
- **Frontmatter**: YAML special characters (`"`, `:`, etc.) are handled by YAML serialization, not Markdown escaping

**Testing considerations:**

Add these test cases to the unit tests for content extraction:

| Input | Expected Output | Notes |
|-------|-----------------|-------|
| `The price is $100 * 2` | `The price is $100 * 2` | Mid-word asterisk, no escape needed |
| `*important*` | `\*important\*` | Word-boundary asterisks would create emphasis |
| `Use # for comments` | `Use # for comments` | Hash not at line start |
| `# Heading` (as plain text) | `\# Heading` | Hash at line start would create heading |
| `[see docs]` | `\[see docs]` | Brackets could be interpreted as link |
| `snake_case_name` | `snake_case_name` | Mid-word underscores, no escape |
| `_emphasis_` | `\_emphasis\_` | Word-boundary underscores |
| `C:\Users\name` | `C:\\Users\\name` | Backslashes need escaping |
| `1. First item` | `1\. First item` | Would become ordered list |
| `- bullet point` | `\- bullet point` | Would become unordered list |

---

## IPC Contract

### Channel

```typescript
// packages/shared/src/ipc-contract.ts

// Add to the existing IPC_CHANNELS const object:
export const IPC_CHANNELS = {
  // ... existing channels (PING, NOTES_*, SEARCH_*, GRAPH_*, etc.) ...
  
  // Export - add this new channel
  EXPORT_TO_MARKDOWN: 'export:toMarkdown',
} as const;
```

### Types

```typescript
// Also in packages/shared/src/ipc-contract.ts
// Add these types alongside existing types (SuccessResponse, DateBasedNoteResult, etc.)

/**
 * Result of an export operation
 */
export interface ExportResult {
  /** Whether the export succeeded */
  success: boolean;
  /** Path where file was saved (if successful and not cancelled) */
  filePath?: string;
  /** Whether the user cancelled the save dialog */
  cancelled?: boolean;
  /** Error message if export failed */
  error?: string;
}

/**
 * Export API for saving notes to external formats
 */
export interface ExportAPI {
  /**
   * Export a note to Markdown format.
   * Opens a native file save dialog for the user to choose the destination.
   * 
   * @param noteId - ID of the note to export
   * @returns Export result with file path or cancellation status
   */
  toMarkdown(noteId: NoteId): Promise<ExportResult>;
}
```

### ScribeAPI Addition

```typescript
export interface ScribeAPI {
  // ... existing APIs ...
  
  /** Export notes to external formats */
  export: ExportAPI;
}
```

---

## Vault Read Behavior

The export handler needs to read notes from the vault. This section documents the exact behavior of `vault.read()` to ensure correct error handling.

### API Contract

```typescript
/**
 * Get a single note by ID.
 * 
 * @param id - Note ID
 * @returns Note object
 * @throws ScribeError with ErrorCode.NOTE_NOT_FOUND if note doesn't exist
 */
read(id: NoteId): Note;
```

### Key Behaviors

| Scenario | vault.read() Behavior |
|----------|----------------------|
| Note exists | Returns the Note object |
| Note doesn't exist (invalid ID) | **Throws** `ScribeError` with `ErrorCode.NOTE_NOT_FOUND` |
| File corruption / disk error | N/A - doesn't occur during read (see below) |

### Memory-First Architecture

The vault uses a **memory-first architecture**:

1. **Startup**: `vault.load()` reads all note files from disk into an in-memory `Map<NoteId, Note>`
2. **Corrupt files**: During load, corrupt or invalid files are quarantined (moved to `quarantine/` directory)
3. **Reading**: `vault.read(id)` reads from the in-memory Map, NOT from disk
4. **Writing**: `vault.save(note)` updates both memory and disk atomically

**Implication**: By the time the export handler runs, all readable notes are already in memory. File I/O errors (corruption, permission issues, disk errors) are handled during `vault.load()` at app startup, not during individual reads.

### Error Handling Pattern

Since `vault.read()` throws on not found (rather than returning `null`), use try/catch:

```typescript
// ✅ CORRECT: Use try/catch since vault.read() throws
let note;
try {
  note = vault.read(noteId);
} catch (error) {
  return { success: false, error: 'Note not found' };
}

// ❌ INCORRECT: vault.read() never returns null
const note = vault.read(noteId);
if (!note) {  // This condition is never true!
  return { success: false, error: 'Note not found' };
}
```

### Error Codes Reference

From `@scribe/shared`:

| ErrorCode | When Thrown | Description |
|-----------|-------------|-------------|
| `NOTE_NOT_FOUND` | `vault.read(id)` | Note ID doesn't exist in vault |
| `FILE_READ_ERROR` | `vault.load()` | Failed to read notes directory |
| `FILE_WRITE_ERROR` | `vault.save(note)` | Failed to save note to disk |
| `FILE_DELETE_ERROR` | `vault.delete(id)` | Failed to delete note file |

---

## Main Process Handler

### Location

`apps/desktop/electron/main/src/handlers/exportHandlers.ts`

### Implementation

```typescript
// apps/desktop/electron/main/src/handlers/exportHandlers.ts

import { ipcMain, dialog } from 'electron';
import * as fs from 'node:fs/promises';
import path from 'path';
import { IPC_CHANNELS, type NoteId, type ExportResult } from '@scribe/shared';
import { extractMarkdown } from '@scribe/shared';
import { HandlerDependencies, withEngines } from './types';

/**
 * Handler Dependencies & withEngines helper
 * 
 * HandlerDependencies is defined in ./types.ts and provides access to:
 * - vault: FileSystemVault | null   - Note storage
 * - graphEngine: GraphEngine | null - Link relationships
 * - searchEngine: SearchEngine | null - Full-text search
 * - taskIndex: TaskIndex | null     - Task management
 * - mainWindow: BrowserWindow | null
 * 
 * withEngines() is a helper that validates all engines are initialized
 * and provides them as a type-safe bundle. See types.ts for full documentation.
 */

/**
 * Setup IPC handlers for export operations.
 */
export function setupExportHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `export:toMarkdown`
   * 
   * Exports a note to Markdown format with a native save dialog.
   * 
   * ## vault.read() Behavior
   * 
   * `vault.read(noteId)` throws `ScribeError` with `ErrorCode.NOTE_NOT_FOUND` if the note
   * doesn't exist in the in-memory cache. It does NOT return null.
   * 
   * The vault uses a memory-first architecture:
   * - Notes are loaded into memory via `vault.load()` at app startup
   * - `vault.read()` reads from the in-memory Map, not from disk
   * - File I/O errors (corruption, disk errors) are handled during `vault.load()`,
   *   which quarantines corrupt files. By the time the handler runs, all readable
   *   notes are already in memory.
   * 
   * Therefore, the only error case for `vault.read()` is "note not found" (invalid ID).
   */
  ipcMain.handle(
    IPC_CHANNELS.EXPORT_TO_MARKDOWN,
    async (_event, noteId: NoteId): Promise<ExportResult> => {
      const { vault } = withEngines(deps);
      
      // 1. Read the note (throws ScribeError if not found)
      let note;
      try {
        note = vault.read(noteId);
      } catch (error) {
        // vault.read() throws ScribeError with NOTE_NOT_FOUND if the ID is invalid
        // It does NOT return null - the note is either found or an exception is thrown
        return { success: false, error: 'Note not found' };
      }
      
      // 2. Convert to Markdown
      const markdown = extractMarkdown(note, { includeFrontmatter: true });
      
      // 3. Sanitize filename (remove invalid characters)
      const sanitizedTitle = note.title
        .replace(/[<>:"/\\|?*]/g, '-')
        .replace(/-+/g, '-')  // Collapse consecutive dashes (e.g., "A: B / C" → "A- B - C" → "A- B - C")
        .replace(/\s+/g, ' ')
        .trim() || 'Untitled';
      
      // 4. Show save dialog
      const { canceled, filePath } = await dialog.showSaveDialog({
        defaultPath: `${sanitizedTitle}.md`,
        filters: [
          { name: 'Markdown', extensions: ['md'] },
          { name: 'All Files', extensions: ['*'] },
        ],
        properties: ['createDirectory', 'showOverwriteConfirmation'],
      });
      
      // Note: File Extension Handling
      // The app trusts the user's choice for file extensions. If the user removes `.md`,
      // changes to `.txt`, or adds `.md.md`, the file is saved exactly as specified.
      // This provides flexibility for users who may want different formats.
      // No automatic extension appending or validation is performed.
      
      if (canceled || !filePath) {
        return { success: true, cancelled: true };
      }
      
      // 5. Write to file
      try {
        await fs.writeFile(filePath, markdown, 'utf-8');
        return { success: true, filePath };
      } catch (error) {
        // Handle specific file system errors with user-friendly messages
        if (error instanceof Error && 'code' in error) {
          const nodeError = error as NodeJS.ErrnoException;
          switch (nodeError.code) {
            case 'EACCES':
              return { 
                success: false, 
                error: 'Permission denied. Try saving to a different location.' 
              };
            case 'EROFS':
              return { 
                success: false, 
                error: 'Cannot save to a read-only file system. Try saving to a different location.' 
              };
            case 'ENOSPC':
              return { 
                success: false, 
                error: 'The disk is full. Free up space and try again.' 
              };
          }
        }
        // Generic fallback for unknown errors
        const message = error instanceof Error ? error.message : 'Unknown error';
        return { success: false, error: `Failed to write file: ${message}` };
      }
    }
  );
}
```

### Handler Registration

```typescript
// apps/desktop/electron/main/src/handlers/index.ts

// Add this export alongside existing handler exports:
// export { setupNotesHandlers } from './notesHandlers';
// export { setupSearchHandlers } from './searchHandlers';
// etc.

export { setupExportHandlers } from './exportHandlers';
```

```typescript
// In main process initialization (apps/desktop/electron/main/src/main.ts or similar)
// Call setupExportHandlers alongside other handler setup calls:

import { setupExportHandlers } from './handlers';

// After creating HandlerDependencies:
setupExportHandlers(deps);
```

---

## Preload Bridge

### Addition to preload.ts

```typescript
// apps/desktop/electron/preload/src/preload.ts

// Existing imports at top of file:
// import { contextBridge, ipcRenderer } from 'electron';
// import type { Note, NoteId, TaskFilter, TaskChangeEvent } from '@scribe/shared';
// import { IPC_CHANNELS, type ScribeAPI } from '@scribe/shared';

// Add 'export' namespace to the existing scribeAPI object:
const scribeAPI: ScribeAPI = {
  // ... existing APIs (notes, search, graph, shell, app, people, daily, meeting, etc.) ...
  
  export: {
    toMarkdown: (noteId: NoteId) => 
      ipcRenderer.invoke(IPC_CHANNELS.EXPORT_TO_MARKDOWN, noteId),
  },
};

// The scribeAPI is exposed to renderer via contextBridge (existing code):
// contextBridge.exposeInMainWorld('scribe', scribeAPI);
```

---

## ShareMenu Component

### Location

`apps/desktop/renderer/src/components/ShareMenu/`

### Component Structure

```
ShareMenu/
├── ShareMenu.tsx      # Main component
├── ShareMenu.css.ts   # Styles
└── index.ts           # Barrel export
```

### Props Interface

```typescript
interface ShareMenuProps {
  /** ID of the note to share */
  noteId: NoteId;
  /** Callback when export completes successfully */
  onExportSuccess?: (filePath: string) => void;
  /** Callback when export fails */
  onExportError?: (error: string) => void;
}
```

### Component Implementation

```tsx
// apps/desktop/renderer/src/components/ShareMenu/ShareMenu.tsx

import { useState, useRef, useEffect, useCallback } from 'react';
import type { NoteId } from '@scribe/shared';
import * as styles from './ShareMenu.css';
import { FileTextIcon } from '@scribe/design-system';

/**
 * window.scribe Type Declaration
 * 
 * The `window.scribe` API is typed via TypeScript ambient declaration in:
 * apps/desktop/renderer/src/types/scribe.d.ts
 * 
 * Example declaration:
 * ```typescript
 * import type { ScribeAPI } from '@scribe/shared';
 * 
 * declare global {
 *   interface Window {
 *     scribe: ScribeAPI;
 *   }
 * }
 * ```
 * 
 * ScribeAPI is defined in packages/shared/src/ipc-contract.ts and includes
 * all available APIs (notes, search, graph, export, etc.).
 * 
 * The preload script (apps/desktop/electron/preload/src/preload.ts) implements
 * ScribeAPI and exposes it via contextBridge.exposeInMainWorld('scribe', scribeAPI).
 */

// Share icon SVG (or import from design system)
function ShareIcon({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
      <polyline points="16 6 12 2 8 6" />
      <line x1="12" y1="2" x2="12" y2="15" />
    </svg>
  );
}

export function ShareMenu({ noteId, onExportSuccess, onExportError }: ShareMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  
  // Close menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [isOpen]);
  
  // Close menu on Escape
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setIsOpen(false);
      }
    }
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      return () => document.removeEventListener('keydown', handleKeyDown);
    }
  }, [isOpen]);
  
  const handleExportMarkdown = useCallback(async () => {
    setIsExporting(true);
    setIsOpen(false);
    
    try {
      const result = await window.scribe.export.toMarkdown(noteId);
      
      if (result.success && !result.cancelled && result.filePath) {
        // Use regex to handle both Unix (/) and Windows (\) path separators
        // since the renderer process doesn't have access to Node's path.basename()
        const filename = result.filePath.split(/[/\\]/).pop() || 'file';
        onExportSuccess?.(filename);
      } else if (!result.success && result.error) {
        onExportError?.(result.error);
      }
      // If cancelled, do nothing
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Export failed';
      onExportError?.(message);
    } finally {
      setIsExporting(false);
    }
  }, [noteId, onExportSuccess, onExportError]);
  
  return (
    <div className={styles.container} ref={menuRef}>
      <button
        className={styles.shareButton}
        onClick={() => setIsOpen(!isOpen)}
        disabled={isExporting}
        aria-label="Share note"
        aria-haspopup="true"
        aria-expanded={isOpen}
        title="Share"
      >
        <ShareIcon size={16} />
      </button>
      
      {isOpen && (
        <div className={styles.dropdown} role="menu">
          <button
            className={styles.menuItem}
            onClick={handleExportMarkdown}
            role="menuitem"
          >
            <FileTextIcon size={14} className={styles.menuItemIcon} />
            Export to Markdown
          </button>
          {/* Future formats can be added here */}
        </div>
      )}
    </div>
  );
}
```

### Styles

```typescript
// apps/desktop/renderer/src/components/ShareMenu/ShareMenu.css.ts

import { style } from '@vanilla-extract/css';
import { vars } from '@scribe/design-system';  // Design tokens via CSS variables

/**
 * Design System Tokens
 * 
 * The @scribe/design-system package exports `vars` which contains CSS variable
 * references for colors, spacing, typography, etc. These are defined in:
 * packages/design-system/src/tokens/contract.css.ts
 * 
 * Actual token paths (verified against design system):
 * - vars.color.foreground      - Primary text color
 * - vars.color.foregroundMuted - Secondary/muted text
 * - vars.color.surface         - Background surfaces
 * - vars.color.backgroundAlt   - Alternative background (use for hover states)
 * - vars.color.border          - Border color
 * - vars.spacing['2'] / ['4']  - Spacing values (numbered scale)
 * - vars.radius.sm / md / lg   - Border radius values
 * - vars.typography.size.sm    - Font sizes
 * - vars.shadow.md             - Shadow for dropdown menus (no specific dropdown shadow)
 * - vars.zIndex.popover        - Z-index for dropdowns/popovers
 * 
 * Note: There is no dedicated surfaceHover token. Use vars.color.backgroundAlt
 * or implement hover states with opacity/color shifts on vars.color.surface.
 */

export const container = style({
  position: 'relative',
  display: 'inline-flex',
});

export const shareButton = style({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  width: 28,
  height: 28,
  padding: 0,
  border: 'none',
  borderRadius: vars.radius.sm,
  background: 'transparent',
  color: vars.color.foregroundMuted,
  cursor: 'pointer',
  transition: 'background 150ms ease, color 150ms ease',
  
  ':hover': {
    background: vars.color.backgroundAlt,
    color: vars.color.foreground,
  },
  
  ':disabled': {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
});

export const dropdown = style({
  position: 'absolute',
  top: '100%',
  right: 0,
  marginTop: 4,
  minWidth: 180,
  padding: '4px 0',
  background: vars.color.surface,
  border: `1px solid ${vars.color.border}`,
  borderRadius: vars.radius.md,
  boxShadow: vars.shadow.md,
  zIndex: vars.zIndex.popover,
});

export const menuItem = style({
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  padding: '8px 12px',
  border: 'none',
  background: 'transparent',
  color: vars.color.foreground,
  fontSize: vars.typography.size.sm,
  textAlign: 'left',
  cursor: 'pointer',
  transition: 'background 150ms ease',
  
  ':hover': {
    background: vars.color.backgroundAlt,
  },
});

export const menuItemIcon = style({
  flexShrink: 0,
  color: vars.color.foregroundMuted,
});
```

---

## NoteHeader Integration

### Changes to NoteHeader.tsx

```tsx
// apps/desktop/renderer/src/components/NoteHeader/NoteHeader.tsx

// Add this import alongside existing imports:
import { ShareMenu } from '../ShareMenu';

// Existing imports in NoteHeader.tsx for reference:
// import { useState, useCallback, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
// import type { Note } from '@scribe/shared';
// import * as styles from './NoteHeader.css';

// In NoteHeader component, add props
interface NoteHeaderProps {
  note: Note;
  onTitleChange: (title: string) => void;
  onTagsChange: (tags: string[]) => void;
  onDateClick?: (date: Date) => void;
  translateY?: number;
  // New props for export feedback
  onExportSuccess?: (filename: string) => void;
  onExportError?: (error: string) => void;
}

// In the metadata row, add ShareMenu after tags
<div className={styles.metadataRow}>
  {/* Creation date */}
  <div className={styles.metadataItem}>
    <button className={styles.dateButton} onClick={...}>
      {formatDate(note.createdAt)}
    </button>
  </div>
  
  {/* Tags */}
  {(note.tags.length > 0 || isAddingTag) && <div className={styles.divider} />}
  <div className={styles.tagsContainer}>
    {/* ... existing tag rendering ... */}
  </div>
  
  {/* Share menu - new addition */}
  <div className={styles.shareMenuContainer}>
    <ShareMenu
      noteId={note.id}
      onExportSuccess={onExportSuccess}
      onExportError={onExportError}
    />
  </div>
</div>
```

### Style Updates for NoteHeader

```typescript
// apps/desktop/renderer/src/components/NoteHeader/NoteHeader.css.ts

// Add this style alongside existing styles.
// The file already imports { style } from '@vanilla-extract/css';

export const shareMenuContainer = style({
  marginLeft: 'auto',  // Push to the right
  paddingLeft: 8,
});
```

---

## Toast Integration

### Existing Toast System

The Scribe desktop app has a fully implemented toast notification system. **No new implementation is required.**

#### Import Path

```typescript
// Hook for managing toast state
import { useToast } from '../hooks/useToast';
// Located at: apps/desktop/renderer/src/hooks/useToast.ts

// Toast component for rendering notifications  
import { Toast } from '../components/Toast/Toast';
// Located at: apps/desktop/renderer/src/components/Toast/Toast.tsx
```

#### API Documentation

**useToast Hook**

```typescript
interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error';
}

interface UseToastReturn {
  toasts: Toast[];
  showToast: (message: string, type?: 'success' | 'error') => void;
  dismissToast: (id: string) => void;
}

function useToast(): UseToastReturn;
```

**Features:**
- **Auto-dismiss**: Toasts automatically dismiss after 3 seconds (`AUTO_DISMISS_MS = 3000`)
- **Manual dismissal**: Click on toast or call `dismissToast(id)`
- **Multiple concurrent toasts**: Supports stacking multiple notifications
- **Timeout cleanup**: Properly cleans up pending timeouts on unmount

**Toast Types:**
| Type | Style | ARIA Role |
|------|-------|-----------|
| `'success'` (default) | Inverted colors (foreground bg, background text) | `role="status"` with `aria-live="polite"` |
| `'error'` | Danger background color | `role="alert"` with `aria-live="assertive"` |

**Toast Component Props:**

```typescript
interface ToastProps {
  toasts: ToastType[];       // Array of toast objects from useToast
  onDismiss: (id: string) => void;  // Callback to dismiss a toast
}
```

#### Positioning

Toasts are rendered at the **bottom-right** of the viewport:
- Position: `fixed`, `bottom: spacing[6]`, `right: spacing[6]`
- Z-index: `vars.zIndex.tooltip`
- Max width: 400px
- Gap between stacked toasts: `spacing[2]`

#### Animation

- **Entry**: Slides up and fades in over 0.2s (`ease-out`)
- **Exit**: Slides down and fades out over 0.15s (`ease-in`)

#### Integration Example

The toast system is already wired up in `App.tsx`:

```tsx
// apps/desktop/renderer/src/App.tsx

import { Toast } from './components/Toast/Toast';
import { useToast } from './hooks/useToast';

function App() {
  const { toasts, showToast, dismissToast } = useToast();
  
  // showToast is passed down to components that need it
  // ...
  
  return (
    <>
      {/* ... app content ... */}
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </>
  );
}
```

For the export feature, wire up the callbacks in the parent component:

```tsx
// In the parent component that renders NoteHeader

const handleExportSuccess = useCallback((filename: string) => {
  showToast(`Exported to ${filename}`, 'success');
}, [showToast]);

const handleExportError = useCallback((error: string) => {
  showToast(`Export failed: ${error}`, 'error');
}, [showToast]);

// Pass to NoteHeader
<NoteHeader
  note={currentNote}
  onExportSuccess={handleExportSuccess}
  onExportError={handleExportError}
  // ... other props
/>
```

#### Accessibility Notes

The existing toast implementation already includes:
- `role="status"` container with `aria-live="polite"` for success messages
- `role="alert"` with `aria-live="assertive"` for error messages
- Click-to-dismiss functionality

**Note**: The current implementation does NOT pause auto-dismiss on hover (as mentioned in the Accessibility section). This could be a future enhancement.

---

## CLI Implementation

### Command Addition

Add to `apps/cli/src/commands/notes.ts`:

```typescript
// apps/cli/src/commands/notes.ts

// Additional imports needed for the export command:
import * as fs from 'node:fs/promises';
import path from 'path';
import { extractMarkdown } from '@scribe/shared';  // New export from shared

// Existing imports in notes.ts that are reused:
// import { Command } from 'commander';
// import { createNoteId } from '@scribe/shared';
// import { initializeContext, type GlobalOptions } from '../context.js';
// import { output } from '../output.js';
// import { noteNotFound } from '../errors.js';

/**
 * The output() function formats data as JSON or text based on globalOpts.format.
 * For successful exports to a file, we call output() to show structured result.
 * For stdout exports, we bypass output() and write raw markdown directly.
 * See apps/cli/src/output.ts for the full implementation.
 */

notes
  .command('export')
  .description('Export note to Markdown format')
  .argument('<id>', 'Note ID')
  .option('--output <path>', 'Output file path (defaults to stdout)')
  .option('--no-frontmatter', 'Exclude YAML frontmatter')
  .action(async (id: string, options: { output?: string; frontmatter: boolean }) => {
    const globalOpts = program.opts() as GlobalOptions;
    const ctx = await initializeContext(globalOpts);
    
    // Get note from vault
    // vault.read() throws ScribeError with NOTE_NOT_FOUND if the note doesn't exist.
    // It does NOT return null - the note is either found or an exception is thrown.
    // File I/O errors (corruption, disk errors) don't occur here because vault.read()
    // reads from an in-memory cache that was populated during vault.load() at startup.
    let note;
    try {
      note = ctx.vault.read(createNoteId(id));
    } catch {
      // Re-throw as CLI-friendly error
      throw noteNotFound(id);
    }
    
    // Convert to Markdown
    const markdown = extractMarkdown(note, {
      includeFrontmatter: options.frontmatter,
    });
    
    if (options.output) {
      // Write to file
      const outputPath = path.resolve(options.output);
      await fs.writeFile(outputPath, markdown, 'utf-8');
      
      output(
        {
          success: true,
          note: { id: note.id, title: note.title },
          outputPath,
        },
        globalOpts
      );
    } else {
      // Write to stdout (raw markdown, not JSON)
      // Use process.stdout directly to bypass JSON formatting
      process.stdout.write(markdown);
    }
  });
```

### CLI Usage Examples

```bash
# Export to stdout
scribe notes export abc-123

# Export to file
scribe notes export abc-123 --output ~/Desktop/meeting-notes.md

# Export without frontmatter
scribe notes export abc-123 --no-frontmatter

# Pipe to clipboard (macOS)
scribe notes export abc-123 | pbcopy

# Pipe to another file
scribe notes export abc-123 > notes.md
```

---

## Accessibility

This section outlines accessibility requirements to ensure the export feature is usable by all users, including those using assistive technologies.

### Screen Reader Support

**Toast Notifications**
- Toast messages MUST use `role="status"` and `aria-live="polite"` for success notifications
- Error toasts SHOULD use `aria-live="assertive"` for immediate announcement
- Toast content MUST be announced to screen readers without requiring focus
- Toasts SHOULD auto-dismiss after 5 seconds but remain visible if user hovers or focuses

**Share Menu**
- Share button MUST have `aria-label="Share note"` (or similar descriptive label)
- Dropdown MUST use `role="menu"` with `aria-haspopup="true"` on trigger button
- Trigger button MUST use `aria-expanded` to indicate open/closed state
- Menu items MUST use `role="menuitem"`
- Export progress states SHOULD be announced (e.g., "Exporting..." via `aria-busy`)

### Focus Management

**Dropdown Menu**
- When menu opens, focus MUST move to the first menu item
- When menu closes via Escape, focus MUST return to the share button trigger
- When menu closes via outside click, focus SHOULD remain where user clicked
- When menu closes after selecting an item, focus MUST return to the share button

**Post-Export Behavior**
- After successful export, focus SHOULD return to share button
- Toast notifications SHOULD NOT steal focus from user's current position
- Error states SHOULD provide a clear path back to retry (focus on share button)

**Focus Trap**
- While dropdown is open, Tab/Shift+Tab SHOULD cycle within the menu
- Focus MUST not escape to elements behind an open dropdown

### Keyboard Navigation

**Share Button**
- MUST be focusable via Tab key
- Enter or Space MUST toggle the dropdown open/closed

**Dropdown Menu**
- Arrow Down: Move focus to next menu item (wrap to first)
- Arrow Up: Move focus to previous menu item (wrap to last)
- Home: Move focus to first menu item
- End: Move focus to last menu item
- Enter or Space: Activate focused menu item
- Escape: Close menu and return focus to trigger
- Tab: Close menu and move focus to next focusable element
- Type-ahead: Optional - typing characters jumps to matching menu items

**Implementation Example**
```typescript
const handleKeyDown = (event: KeyboardEvent) => {
  switch (event.key) {
    case 'ArrowDown':
      event.preventDefault();
      focusNextItem();
      break;
    case 'ArrowUp':
      event.preventDefault();
      focusPreviousItem();
      break;
    case 'Home':
      event.preventDefault();
      focusFirstItem();
      break;
    case 'End':
      event.preventDefault();
      focusLastItem();
      break;
    case 'Escape':
      closeMenu();
      triggerRef.current?.focus();
      break;
    case 'Enter':
    case ' ':
      event.preventDefault();
      activateFocusedItem();
      break;
  }
};
```

### Color Contrast

**Requirements (WCAG 2.1 Level AA)**
- Text contrast ratio MUST be at least 4.5:1 for normal text
- Text contrast ratio MUST be at least 3:1 for large text (18px+ or 14px+ bold)
- Interactive element focus indicators MUST have 3:1 contrast against adjacent colors
- Icon-only buttons MUST have sufficient contrast for the icon against background

**Specific Elements**
| Element | Foreground | Background | Min Ratio |
|---------|------------|------------|-----------|
| Menu item text | `vars.color.foreground` | `vars.color.surface` | 4.5:1 |
| Menu item hover text | `vars.color.foreground` | `vars.color.backgroundAlt` | 4.5:1 |
| Muted/secondary text | `vars.color.foregroundMuted` | `vars.color.surface` | 4.5:1 |
| Share icon (default) | `vars.color.foregroundMuted` | transparent | 3:1 |
| Share icon (hover) | `vars.color.foreground` | `vars.color.backgroundAlt` | 3:1 |
| Focus ring | Focus indicator | Adjacent colors | 3:1 |
| Toast text | Toast foreground | Toast background | 4.5:1 |

**Focus Indicators**
- All interactive elements MUST have visible focus indicators
- Focus ring SHOULD use `outline` (not just `border`) to avoid layout shift
- Recommended: `outline: 2px solid var(--focus-color); outline-offset: 2px;`

### Motion and Animation

**prefers-reduced-motion**
- Dropdown open/close animations MUST be disabled when `prefers-reduced-motion: reduce`
- Toast slide-in animations MUST be disabled or use instant appearance
- Hover transitions MAY remain but SHOULD be reduced to instant or very short duration

**Implementation**
```typescript
// In ShareMenu.css.ts
import { style } from '@vanilla-extract/css';

export const dropdown = style({
  // ... other styles ...
  
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none',
      animation: 'none',
    },
  },
});
```

```typescript
// Or using a utility class
export const reducedMotion = style({
  '@media': {
    '(prefers-reduced-motion: reduce)': {
      transition: 'none !important',
      animation: 'none !important',
    },
  },
});
```

**Motion Guidelines**
- Decorative animations SHOULD respect reduced motion preference
- Essential state change animations (e.g., "exporting" spinner) MAY continue but SHOULD be subtle
- No animations should flash more than 3 times per second (WCAG 2.3.1)

### Accessibility Testing Checklist

Before shipping, verify:

- [ ] **Screen Reader**: VoiceOver (macOS) correctly announces share button, menu items, and toast notifications
- [ ] **Keyboard Only**: Complete export flow using only keyboard (Tab, Enter, Escape, Arrows)
- [ ] **Focus Visible**: Clear focus indicators on all interactive elements
- [ ] **Color Contrast**: All text meets WCAG 2.1 AA ratios (use browser DevTools or axe)
- [ ] **Reduced Motion**: Animations are disabled with `prefers-reduced-motion: reduce`
- [ ] **Zoom**: UI remains usable at 200% zoom
- [ ] **High Contrast Mode**: Test on Windows High Contrast Mode (if applicable)

### Tools and Resources

- [axe DevTools](https://www.deque.com/axe/devtools/) - Automated accessibility testing
- [WAVE](https://wave.webaim.org/) - Web accessibility evaluation
- [Colour Contrast Analyser](https://www.tpgi.com/color-contrast-checker/) - Manual contrast checking
- [NVDA](https://www.nvaccess.org/) - Free Windows screen reader for testing
- [WAI-ARIA Authoring Practices - Menu Button](https://www.w3.org/WAI/ARIA/apg/patterns/menu-button/) - Authoritative guidance

---

## Testing Plan

### Unit Tests

**Content Extractor** (`packages/shared/src/content-extractor.test.ts`)

| Test | Input | Expected Output |
|------|-------|-----------------|
| Empty note (with frontmatter) | Note with empty content, `includeFrontmatter: true` (default) | YAML frontmatter block only (no body content) |
| Empty note (no frontmatter) | Note with empty content, `includeFrontmatter: false` | Empty string |
| Heading H1 | Lexical heading h1 | `# Heading` |
| Heading H2 | Lexical heading h2 | `## Heading` |
| Paragraph | Lexical paragraph | Plain text |
| Multiple paragraphs | Two paragraphs | Text with blank line between |
| Unordered list | Lexical list items | `- item1\n- item2` |
| Ordered list | Lexical numbered list | `1. item1\n2. item2` |
| Checklist unchecked | Lexical checklist | `- [ ] task` |
| Checklist checked | Lexical checklist | `- [x] task` |
| Blockquote | Lexical quote | `> quoted text` |
| Code block | Lexical code | ` ```\ncode\n``` ` |
| Wiki-link | Lexical wiki-link node | `[[Meeting Notes]]` |
| Person mention | Lexical mention node | `@Person Name` |
| Bold text | Text with format flag | `**bold**` |
| Italic text | Text with format flag | `*italic*` |
| Code inline | Text with format flag | `` `code` `` |
| Link | Lexical link node | `[text](url)` |
| Table | Lexical table | Markdown table |
| Frontmatter | Note with metadata | YAML frontmatter block |
| Nested list | Nested list items | Indented list items |
| Unicode content | Note with emoji, CJK, accents (e.g., "Café ☕ 日本語") | Characters preserved as UTF-8 |

**ShareMenu Component** (`apps/desktop/renderer/src/components/ShareMenu/ShareMenu.test.tsx`)

| Test | Action | Expected |
|------|--------|----------|
| Renders share button | Mount component | Button visible |
| Opens dropdown | Click button | Menu appears |
| Closes on outside click | Click outside | Menu closes |
| Closes on Escape | Press Escape | Menu closes |
| Calls export API | Click export option | API called with noteId |
| Shows loading state | During export | Button disabled |
| Calls onExportSuccess | Export succeeds | Callback fired with filename |
| Calls onExportError | Export fails | Callback fired with error |
| No callback on cancel | User cancels dialog | No callbacks fired |
| Opens via keyboard shortcut | Press Cmd/Ctrl+Shift+E | Menu opens |

### Integration Tests

**Export Handler** (`apps/desktop/electron/main/src/handlers/exportHandlers.test.ts`)

| Test | Setup | Action | Assert |
|------|-------|--------|--------|
| Exports valid note | Create note | Call handler | Markdown contains content |
| Includes frontmatter | Note with tags | Call handler | YAML block present |
| Sanitizes filename | Note with `/` in title | Call handler | Invalid chars removed |
| Handles missing note | Invalid ID | Call handler | Returns error result |
| Returns cancelled | Mock dialog cancel | Call handler | `cancelled: true` |

**CLI Export** (`apps/cli/src/commands/notes.test.ts`)

| Test | Command | Assert |
|------|---------|--------|
| Exports to stdout | `notes export abc-123` | Markdown in stdout |
| Exports to file | `notes export abc-123 --output out.md` | File created |
| No frontmatter | `notes export abc-123 --no-frontmatter` | No YAML block |
| Invalid note | `notes export invalid-id` | Error with code |

### E2E Tests

1. **Desktop flow**: Open note → Click share → Export to Markdown → Verify file content
2. **CLI flow**: `scribe notes export <id>` → Verify output matches note content

---

## Implementation Plan

### Phase 1: Shared Module (Day 1)

1. Create `packages/shared/src/content-extractor.ts`
   - Move and enhance extraction logic from CLI
   - Add frontmatter generation
   - Add text formatting (bold, italic, etc.)
   - Add comprehensive tests

2. Update `packages/shared/src/index.ts`
   - Export `extractMarkdown` function

3. Update `apps/cli/src/content-extractor.ts`
   - Re-export from shared package

### Phase 2: IPC Contract (Day 1)

4. Update `packages/shared/src/ipc-contract.ts`
   - Add `EXPORT_TO_MARKDOWN` channel
   - Add `ExportResult` type
   - Add `ExportAPI` interface
   - Update `ScribeAPI` interface

### Phase 3: Main Process Handler (Day 1-2)

5. Create `apps/desktop/electron/main/src/handlers/exportHandlers.ts`
   - Implement export handler with save dialog
   - Add file writing logic
   - Handle errors gracefully

6. Update `apps/desktop/electron/main/src/handlers/index.ts`
   - Export and register handler

### Phase 4: Preload Bridge (Day 2)

7. Update `apps/desktop/electron/preload/src/preload.ts`
   - Add `export` namespace to API
   - Wire up IPC invoke

### Phase 5: UI Components (Day 2-3)

8. Create `apps/desktop/renderer/src/components/ShareMenu/`
   - ShareMenu.tsx component
   - ShareMenu.css.ts styles
   - index.ts barrel export

9. Update `apps/desktop/renderer/src/components/NoteHeader/`
   - Add ShareMenu to metadata row
   - Adjust styles for layout

10. Wire up toast notifications in parent component

### Phase 6: CLI Support (Day 3)

11. Update `apps/cli/src/commands/notes.ts`
    - Add `export` subcommand
    - Support `--output` and `--no-frontmatter` options

### Phase 7: Testing & Polish (Day 3-4)

12. Write unit tests for content extractor
13. Write component tests for ShareMenu
14. Write integration tests for export handler
15. Write CLI tests
16. Manual E2E testing
17. Code review and cleanup

---

## Future Enhancements

After MVP, consider adding:

1. **Additional export formats**
   - PDF export (via pandoc or similar)
   - HTML export
   - Plain text export

2. **Batch export**
   - Export multiple selected notes
   - Export all notes in a folder/tag

3. **Export options**
   - Include/exclude frontmatter fields
   - Custom filename templates
   - Resolve wiki-links to relative paths

4. **Clipboard support**
   - Copy Markdown to clipboard
   - Copy formatted text to clipboard

5. **Export with assets**
   - Bundle images and attachments
   - Create archive (zip) with note + assets

---

## Open Questions

1. **Table formatting**: Should tables use simple pipe syntax or more complex GitHub-flavored Markdown with alignment?
   - **Recommendation**: Simple pipe syntax for MVP
   - **MVP table format specification**:
     - Include header separator row with dashes (`|---|---|`)
     - No column alignment markers for MVP (no `:---`, `:---:`, or `---:`)
     - Empty cells render as empty (just `|  |`)
   - **Example output**:
     ```markdown
     | Name | Status | Notes |
     |---|---|---|
     | Alice | Active |  |
     | Bob | Pending | Needs review |
     ```

2. **Wiki-link format**: Should wiki-links include the double brackets `[[title]]` or just the title?
   - **Recommendation**: Include brackets to preserve Scribe/Obsidian compatibility

3. **Date format in frontmatter**: ISO-8601 or human-readable?
   - **Recommendation**: ISO-8601 for machine readability

4. **Filename conflicts**: Should we auto-increment filenames or let OS handle?
   - **Recommendation**: Let OS handle with `showOverwriteConfirmation`

---

## References

- [Lexical Editor Documentation](https://lexical.dev/docs/intro)
- [Electron dialog API](https://www.electronjs.org/docs/latest/api/dialog)
- [YAML Frontmatter Spec](https://jekyllrb.com/docs/front-matter/)
- [CommonMark Spec](https://commonmark.org/)
- [GitHub Flavored Markdown](https://github.github.com/gfm/)
