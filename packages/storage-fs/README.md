# @scribe/storage-fs

File system-based storage for Scribe notes. Provides crash-safe atomic operations with validation, migration, and quarantine support.

## Overview

This package provides:

- **FileSystemVault**: Main storage interface with CRUD operations
- **Atomic Writes**: Crash-safe file operations (temp → fsync → rename)
- **Note Validation**: Structure validation before loading
- **Note Migration**: Legacy format upgrades
- **Quarantine System**: Corrupt file isolation and recovery

## Installation

This is an internal monorepo package. It's available to other packages via workspace dependency:

```json
{
  "dependencies": {
    "@scribe/storage-fs": "workspace:*"
  }
}
```

## Key Exports

### FileSystemVault

```typescript
import { FileSystemVault, type CreateNoteOptions } from '@scribe/storage-fs';

// Initialize vault
const vault = new FileSystemVault('/path/to/vault');

// Load notes from disk
const count = await vault.load();
console.log(`Loaded ${count} notes`);

// CRUD operations
const note = await vault.create({ title: 'New Note' });
const existing = vault.read(noteId);
await vault.save({ ...existing, title: 'Updated' });
await vault.delete(noteId);

// List all notes
const allNotes = vault.list();

// Check quarantined files
const quarantined = vault.getQuarantinedFiles();
const qm = vault.getQuarantineManager();
```

### Vault Utilities

```typescript
import { 
  initializeVault, 
  isValidVault, 
  getNotesDir, 
  getNoteFilePath 
} from '@scribe/storage-fs';

// Initialize a new vault directory
await initializeVault('/path/to/new/vault');

// Check if path is a valid vault
const valid = await isValidVault('/path/to/vault');

// Get paths
const notesDir = getNotesDir(vaultPath);      // /vault/notes
const filePath = getNoteFilePath(vaultPath, noteId);  // /vault/notes/{id}.json
```

### AtomicFileWriter

```typescript
import { 
  AtomicFileWriter, 
  atomicFileWriter,
  type AtomicWriteOptions 
} from '@scribe/storage-fs';

// Use singleton
await atomicFileWriter.writeJson('/path/to/file.json', data);

// Or create instance
const writer = new AtomicFileWriter();
await writer.writeJson(path, data, { fsync: true });
```

### NoteValidator

```typescript
import { 
  NoteValidator, 
  noteValidator,
  type ValidationResult 
} from '@scribe/storage-fs';

// Validate note structure
const isValid = noteValidator.validate(unknownObject);
```

### NoteMigrator

```typescript
import { 
  NoteMigrator, 
  noteMigrator, 
  NOTE_FORMAT_VERSION 
} from '@scribe/storage-fs';

// Check if note needs migration
if (noteMigrator.needsMigration(note)) {
  const migrated = noteMigrator.migrate(note);
}
```

### QuarantineManager

```typescript
import { 
  QuarantineManager, 
  createQuarantineManager,
  type IQuarantineManager 
} from '@scribe/storage-fs';

const qm = createQuarantineManager(vaultPath);

// List quarantined files
const files = qm.listQuarantined();

// Quarantine a corrupt file
await qm.quarantine('bad-note.json', 'Parse error');

// Restore a quarantined file
await qm.restore('1234567890-bad-note.json');
```

## Architecture

```
vault/
├── notes/              # Note JSON files
│   ├── {uuid}.json
│   └── ...
├── quarantine/         # Corrupt files moved here
│   ├── {timestamp}-{filename}
│   └── ...
└── config.json         # Vault configuration
```

### Atomic Write Pattern

All saves use the crash-safe pattern:

1. Write to temporary file (`.{id}.json.tmp`)
2. Call `fsync()` to flush to disk
3. Atomic rename to final path

This guarantees either complete old version or complete new version on crash.

### Concurrency

- **Per-note locks**: Operations on same note are serialized
- **Cross-note parallelism**: Operations on different notes run in parallel
- **Memory-first consistency**: Cache updated atomically with disk

## Error Handling

All operations throw `ScribeError` with appropriate codes:

| Error Code | Meaning |
|------------|---------|
| `FILE_READ_ERROR` | Failed to read notes directory or file |
| `FILE_WRITE_ERROR` | Failed to save note (disk full, permissions) |
| `FILE_DELETE_ERROR` | Failed to delete note file |
| `NOTE_NOT_FOUND` | Requested note ID does not exist |

## Dependencies

### Internal

- `@scribe/shared` - Core types, errors, and metadata extraction

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
