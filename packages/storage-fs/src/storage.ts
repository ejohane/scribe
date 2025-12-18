/**
 * File system storage implementation
 *
 * Provides atomic read/write operations for notes using the local filesystem
 */

import * as fs from 'node:fs/promises';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import type {
  Note,
  NoteId,
  VaultPath,
  LexicalState,
  NoteType,
  DailyNoteData,
  MeetingNoteData,
} from '@scribe/shared';
import { createNoteId, isDailyNote, isMeetingNote, createEmptyContent } from '@scribe/shared';
import { ErrorCode, ScribeError } from '@scribe/shared';
import { extractMetadata } from '@scribe/engine-core';
import { getNotesDir, getNoteFilePath } from './vault.js';
import { noteValidator } from './note-validator.js';
import { atomicFileWriter } from './atomic-file-writer.js';
import { noteMigrator } from './note-migrator.js';
import {
  QuarantineManager,
  createQuarantineManager,
  type IQuarantineManager,
} from './quarantine-manager.js';

/**
 * Options for creating a new note
 */
export interface CreateNoteOptions {
  /** Initial title (optional, defaults to 'Untitled') */
  title?: string;
  /** Initial Lexical content (optional) */
  content?: LexicalState;
  /** Note type discriminator (optional) */
  type?: NoteType;
  /** Initial user-defined tags (optional) */
  tags?: string[];
  /** Custom creation timestamp in milliseconds (optional, defaults to now) */
  createdAt?: number;
  /** Daily note specific data (for daily notes) */
  daily?: {
    /** ISO date string "YYYY-MM-DD" */
    date: string;
  };
  /** Meeting specific data (for meeting notes) */
  meeting?: {
    /** ISO date string "YYYY-MM-DD" */
    date: string;
    /** Associated daily note for this meeting */
    dailyNoteId: NoteId;
    /** Person note IDs of meeting attendees */
    attendees: NoteId[];
  };
}

/**
 * File system-backed vault for note storage with atomic operations.
 *
 * `FileSystemVault` provides a reliable, crash-safe storage layer for notes using the local
 * filesystem. It maintains an in-memory cache of all notes synchronized with on-disk JSON files,
 * ensuring fast reads while guaranteeing data durability through atomic write operations.
 *
 * ## Thread Safety and Concurrent Access
 *
 * This class is designed for safe concurrent access within a single Node.js process:
 *
 * - **Per-note mutex locks**: Operations on the same note (save, delete) are serialized using
 *   promise-chaining. This prevents race conditions like simultaneous saves overwriting each other.
 * - **Cross-note parallelism**: Operations on different notes can execute concurrently, maximizing
 *   throughput during bulk operations like initial vault loading.
 * - **Memory-first consistency**: Reads always return from the in-memory cache, which is updated
 *   atomically with disk operations to prevent stale reads.
 *
 * **Important**: This class does NOT provide cross-process safety. If multiple Electron instances
 * or Node processes access the same vault directory, external coordination (file locks, IPC) is
 * required to prevent data corruption.
 *
 * ## Architecture
 *
 * The vault delegates specialized operations to focused modules:
 * - {@link AtomicFileWriter} - Crash-safe file writes (temp → fsync → rename pattern)
 * - {@link QuarantineManager} - Corrupt file isolation and recovery
 * - {@link NoteMigrator} - Legacy note format upgrades
 * - {@link NoteValidator} - Note structure validation
 *
 * ## Error Handling
 *
 * All I/O operations throw {@link ScribeError} with appropriate error codes:
 * - `FILE_READ_ERROR` - Failed to read notes directory or file
 * - `FILE_WRITE_ERROR` - Failed to save note (disk full, permissions, etc.)
 * - `FILE_DELETE_ERROR` - Failed to delete note file
 * - `NOTE_NOT_FOUND` - Requested note ID does not exist
 *
 * @example
 * ```typescript
 * // Initialize vault with path to vault directory
 * const vault = new FileSystemVault('/Users/me/.scribe/vaults/personal');
 *
 * // Load existing notes from disk
 * const count = await vault.load();
 * console.log(`Loaded ${count} notes`);
 *
 * // Create a new note
 * const note = await vault.create({ title: 'Meeting Notes' });
 *
 * // Read and update
 * const existing = vault.read(note.id);
 * await vault.save({ ...existing, title: 'Updated Title' });
 *
 * // List all notes
 * const allNotes = vault.list();
 * ```
 *
 * @see {@link AtomicFileWriter} for details on crash-safe write operations
 * @see {@link QuarantineManager} for corrupt file handling
 */
export class FileSystemVault {
  private notes: Map<NoteId, Note> = new Map();
  private quarantineManager: QuarantineManager;
  /**
   * Per-note locks for serializing concurrent operations.
   *
   * Uses a promise-chaining pattern: each operation chains onto the previous
   * operation's promise, ensuring sequential execution per note while allowing
   * parallel operations on different notes.
   *
   * @internal
   */
  private noteLocks: Map<NoteId, Promise<void>> = new Map();

  /**
   * Creates a new FileSystemVault instance.
   *
   * @param vaultPath - Absolute path to the vault directory. This directory should contain
   *   (or will contain) a `notes/` subdirectory where note JSON files are stored. The path
   *   must be accessible with read/write permissions. Relative paths are not supported and
   *   will cause undefined behavior.
   *
   * @example
   * ```typescript
   * // Typical vault paths
   * const vault = new FileSystemVault('/Users/me/.scribe/vaults/work');
   * const vault = new FileSystemVault(path.join(app.getPath('userData'), 'vault'));
   * ```
   */
  constructor(private vaultPath: VaultPath) {
    this.quarantineManager = createQuarantineManager(vaultPath);
  }

  /**
   * Execute a function with exclusive access to a note's lock.
   *
   * Uses promise-chaining pattern: each operation chains onto the previous
   * operation's promise for the same note, ensuring sequential execution.
   * Operations on different notes can run concurrently.
   *
   * @param id - Note ID to lock
   * @param fn - Async function to execute while holding the lock
   * @returns Result of the function
   */
  private async withNoteLock<T>(id: NoteId, fn: () => Promise<T>): Promise<T> {
    // Get the current lock promise, or a resolved promise if none exists
    const previousLock = this.noteLocks.get(id) ?? Promise.resolve();

    // Create a new promise that chains onto the previous one
    let resolve: () => void;
    const newLock = new Promise<void>((r) => {
      resolve = r;
    });

    // Set the new lock immediately to queue any subsequent operations
    this.noteLocks.set(id, newLock);

    try {
      // Wait for the previous operation to complete
      await previousLock;
      // Execute our operation
      return await fn();
    } finally {
      // Clean up the lock entry if no other operations are queued
      // (this prevents memory leaks from accumulating lock entries)
      if (this.noteLocks.get(id) === newLock) {
        this.noteLocks.delete(id);
      }
      // Release the lock so the next queued operation can proceed
      resolve!();
    }
  }

  /**
   * Get list of quarantined file names
   * @deprecated Use getQuarantineManager().listQuarantined() for full functionality
   */
  getQuarantinedFiles(): string[] {
    return this.quarantineManager.listQuarantined();
  }

  /**
   * Get the QuarantineManager for advanced quarantine operations
   * (restore, delete, detailed info)
   */
  getQuarantineManager(): IQuarantineManager {
    return this.quarantineManager;
  }

  /**
   * Load all notes from disk into memory.
   *
   * Scans the vault's `notes/` directory, parses all JSON files, validates their structure,
   * applies any necessary migrations, and builds the in-memory notes map.
   *
   * ## Loading Process
   *
   * For each `.json` file in the notes directory:
   * 1. **Parse**: Read and parse as JSON
   * 2. **Validate**: Check structure via {@link NoteValidator} (required fields, types)
   * 3. **Migrate**: Apply legacy format upgrades via {@link NoteMigrator} if needed
   * 4. **Index**: Add to in-memory map for fast access
   *
   * ## Error Handling
   *
   * - **Parse errors** (invalid JSON): File is quarantined, loading continues
   * - **Validation errors** (missing required fields): File is quarantined, loading continues
   * - **Directory read errors** (permissions, missing): Throws `ScribeError`
   *
   * Quarantined files are moved to the `quarantine/` directory with a timestamp prefix.
   * Use {@link getQuarantineManager} to inspect, restore, or permanently delete them.
   *
   * ## Performance
   *
   * Files are loaded in parallel using `Promise.all()` for maximum throughput on SSDs.
   * On network filesystems or HDDs with high latency, this parallelism significantly
   * reduces total load time compared to sequential reads.
   *
   * @returns Number of notes successfully loaded (excludes quarantined files)
   * @throws ScribeError with `FILE_READ_ERROR` if notes directory cannot be read
   *
   * @example
   * ```typescript
   * const vault = new FileSystemVault('/path/to/vault');
   * try {
   *   const count = await vault.load();
   *   console.log(`Loaded ${count} notes`);
   *
   *   // Check for any files that couldn't be loaded
   *   const quarantined = vault.getQuarantineManager().listQuarantined();
   *   if (quarantined.length > 0) {
   *     console.warn(`${quarantined.length} corrupt files quarantined`);
   *   }
   * } catch (err) {
   *   console.error('Failed to load vault:', err);
   * }
   * ```
   */
  async load(): Promise<number> {
    const notesDir = getNotesDir(this.vaultPath);

    try {
      const files = await fs.readdir(notesDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      // Batch file reads for better performance
      const loadPromises = jsonFiles.map(async (file) => {
        try {
          const filePath = path.join(notesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const note = JSON.parse(content) as Note;

          // Validate note structure
          if (this.isValidNote(note)) {
            // Use stored metadata (already extracted during save)
            // Only re-extract if metadata is missing (legacy notes)
            if (!note.metadata || Object.keys(note.metadata).length === 0) {
              note.metadata = extractMetadata(note.content);
            }

            // Migrate legacy notes: derive explicit fields from metadata if missing
            const migratedNote = noteMigrator.needsMigration(note)
              ? noteMigrator.migrate(note)
              : note;
            this.notes.set(migratedNote.id, migratedNote);
          } else {
            // Quarantine invalid notes
            console.warn(`Invalid note structure in ${file}, quarantining`);
            await this.quarantineManager.quarantine(file, 'Invalid note structure');
          }
        } catch (error) {
          // Quarantine corrupt files (e.g., invalid JSON)
          console.warn(`Failed to load note ${file}, quarantining:`, error);
          await this.quarantineManager.quarantine(file, 'Parse error or corrupt file');
        }
      });

      // Load all files in parallel
      await Promise.all(loadPromises);

      return this.notes.size;
    } catch (error) {
      const err = error as Error & { code?: string };
      const code = ScribeError.fromSystemError(err, ErrorCode.FILE_READ_ERROR);
      throw new ScribeError(code, `Failed to read notes directory: ${err.message}`, err);
    }
  }

  /**
   * Get all notes
   *
   * @returns Array of all notes
   */
  list(): Note[] {
    return Array.from(this.notes.values());
  }

  /**
   * Get a single note by ID
   *
   * @param id - Note ID
   * @returns Note
   * @throws ScribeError if note not found
   */
  read(id: NoteId): Note {
    const note = this.notes.get(id);
    if (!note) {
      throw new ScribeError(ErrorCode.NOTE_NOT_FOUND, `Note not found: ${id}`);
    }
    return note;
  }

  /**
   * Create a new note
   *
   * @param options - Options for creating the note (content and type)
   * @returns Newly created note
   */
  async create(options?: CreateNoteOptions): Promise<Note> {
    const now = Date.now();
    const createdAt = options?.createdAt ?? now;

    // Build content with optional type
    const noteContent: LexicalState = options?.content ?? createEmptyContent();

    // Set type on the content if provided (for backward compat with metadata extraction)
    if (options?.type) {
      (noteContent as LexicalState & { type?: NoteType }).type = options.type;
    }

    // Build the note using the discriminated union pattern
    const note = this.buildNote({
      id: createNoteId(randomUUID()),
      title: options?.title ?? 'Untitled',
      createdAt,
      updatedAt: now,
      type: options?.type,
      tags: options?.tags ?? [],
      content: noteContent,
      metadata: extractMetadata(noteContent),
      daily: options?.daily,
      meeting: options?.meeting,
    });

    // Save to disk and add to memory
    await this.save(note);

    // Return the saved note from memory (which has updated metadata)
    return this.notes.get(note.id)!;
  }

  /**
   * Save a note to disk (create or update).
   *
   * Persists a note using crash-safe atomic writes and updates the in-memory cache.
   * This method handles both new note creation and updates to existing notes.
   *
   * ## Atomic Write Pattern
   *
   * Uses the temp file → fsync → rename pattern via {@link AtomicFileWriter}:
   * 1. Write JSON to temporary file (`.{id}.json.tmp`)
   * 2. Call `fsync()` to ensure data is physically written to disk
   * 3. Atomic rename from temp to final path
   *
   * This guarantees that on crash or power loss, you either have the complete
   * previous version or the complete new version—never a partial write.
   *
   * ## Performance Characteristics
   *
   * - **SSD**: ~1-5ms per save (fsync is fast on modern NVMe)
   * - **HDD**: ~10-50ms per save (fsync waits for physical write)
   * - **Network filesystems (NFS, SMB)**: Variable, potentially 100ms+ per save.
   *   The fsync behavior depends on mount options; some configurations may not
   *   provide true durability guarantees.
   *
   * ## Disk Space Requirements
   *
   * Temporarily requires ~2x the note size during save (original + temp file).
   * On low disk space, the operation may fail with `FILE_WRITE_ERROR`.
   *
   * ## Concurrent Access
   *
   * Multiple saves to the same note are serialized via per-note mutex locks.
   * Concurrent saves to different notes execute in parallel.
   *
   * ## Field Preservation
   *
   * When updating a note, fields not present in the incoming note are preserved
   * from the existing version:
   * - `type` - Preserved if not specified (editor may not send this)
   * - `tags` - Preserved if not specified
   * - `daily`/`meeting` - Type-specific data preserved if not specified
   *
   * @param note - Note to save. Must have at least `id`, `createdAt`, `content`.
   * @throws ScribeError with `FILE_WRITE_ERROR` if save fails (disk full, permissions, etc.)
   *
   * @example
   * ```typescript
   * // Update just the title, preserving other fields
   * const note = vault.read(noteId);
   * await vault.save({ ...note, title: 'New Title' });
   *
   * // Note: metadata is auto-extracted from content
   * await vault.save({ ...note, content: newLexicalState });
   * ```
   */
  async save(note: Note): Promise<void> {
    return this.withNoteLock(note.id, async () => {
      try {
        // Get existing note for preserving fields not sent from renderer
        const existingNote = this.notes.get(note.id);

        // Preserve the note type from existing note if not present in incoming note
        // This is necessary because the Lexical editor doesn't always send the type field
        const noteContent = { ...note.content };
        if (!noteContent.type && existingNote?.type) {
          noteContent.type = existingNote.type;
        }

        // Extract metadata from content (now with preserved type)
        const metadata = extractMetadata(noteContent);

        // Extract type-specific data from incoming and existing notes
        const incomingDaily = isDailyNote(note) ? note.daily : undefined;
        const existingDaily =
          existingNote && isDailyNote(existingNote) ? existingNote.daily : undefined;
        const incomingMeeting = isMeetingNote(note) ? note.meeting : undefined;
        const existingMeeting =
          existingNote && isMeetingNote(existingNote) ? existingNote.meeting : undefined;

        // Build the updated note using discriminated union pattern
        const updatedNote = this.buildNote({
          id: note.id,
          title: note.title ?? existingNote?.title ?? 'Untitled',
          createdAt: note.createdAt,
          updatedAt: Date.now(),
          type: note.type ?? existingNote?.type,
          tags: note.tags ?? existingNote?.tags ?? [],
          content: noteContent,
          metadata,
          // Preserve daily/meeting fields from existing note if not in update
          daily: incomingDaily ?? existingDaily,
          meeting: incomingMeeting ?? existingMeeting,
        });

        // Perform atomic write using the extracted AtomicFileWriter
        const notePath = getNoteFilePath(this.vaultPath, updatedNote.id);
        await atomicFileWriter.writeJson(notePath, updatedNote);

        // Update in-memory map
        this.notes.set(updatedNote.id, updatedNote);
      } catch (error) {
        if (error instanceof ScribeError) {
          throw error;
        }
        const err = error as Error & { code?: string };
        const code = ScribeError.fromSystemError(err, ErrorCode.FILE_WRITE_ERROR);
        throw new ScribeError(code, `Failed to save note ${note.id}: ${err.message}`, err);
      }
    });
  }

  /**
   * Delete a note
   *
   * Uses memory-first deletion: removes from in-memory map before disk
   * to prevent stale reads during async disk operation.
   * Serialized with save operations via per-note mutex.
   *
   * @param id - Note ID to delete
   * @throws ScribeError if deletion fails
   */
  async delete(id: NoteId): Promise<void> {
    return this.withNoteLock(id, async () => {
      const notePath = getNoteFilePath(this.vaultPath, id);

      // Memory-first deletion: remove from map before disk to prevent stale reads
      const existingNote = this.notes.get(id);
      this.notes.delete(id);

      try {
        await fs.unlink(notePath);
      } catch (error) {
        // Rollback: restore the note to memory if disk deletion failed
        if (existingNote) {
          this.notes.set(id, existingNote);
        }
        const err = error as Error & { code?: string };
        const code = ScribeError.fromSystemError(err, ErrorCode.FILE_DELETE_ERROR);
        throw new ScribeError(code, `Failed to delete note ${id}: ${err.message}`, err);
      }
    });
  }

  /**
   * Validate that an object conforms to the Note structure.
   *
   * Delegates to {@link NoteValidator} for the actual validation logic. This method
   * is used during {@link load} to filter out corrupt or malformed note files.
   *
   * ## Validation Rules
   *
   * **Required fields** (must be present and correctly typed):
   * - `id` - String (UUID-based note identifier)
   * - `createdAt` - Number (Unix timestamp in milliseconds)
   * - `updatedAt` - Number (Unix timestamp in milliseconds)
   * - `content` - Object (Lexical editor state)
   * - `metadata` - Object (extracted note metadata: links, tags, mentions, etc.)
   *
   * **Optional fields** (validated if present, but not required):
   * - `title` - String. Optional because legacy notes derived title from the first
   *   heading in content. Modern notes store it explicitly.
   * - `type` - String enum ('daily', 'meeting', 'person', 'project', 'template', 'system').
   *   Optional because regular notes have no special type.
   * - `tags` - Array of strings. Optional because not all notes have user-defined tags
   *   (distinct from inline #hashtags which are in metadata).
   * - `daily` - Object with `date` string. Required only when `type === 'daily'`.
   * - `meeting` - Object with `date`, `dailyNoteId`, `attendees[]`. Required only when
   *   `type === 'meeting'`.
   *
   * ## Why Fields Are Optional
   *
   * The flexible validation allows for:
   * 1. **Backward compatibility**: Legacy notes from v1 format may lack explicit title/tags
   * 2. **Forward compatibility**: New fields can be added without breaking existing notes
   * 3. **Discriminated union support**: Type-specific fields only required for their type
   *
   * Invalid notes are quarantined rather than causing load failures, allowing users
   * to manually inspect and recover data if needed.
   *
   * @param note - Object to validate (typically parsed from JSON file)
   * @returns `true` if the object is a valid Note structure, `false` otherwise
   *
   * @internal Used by {@link load} for validation during vault initialization
   * @see {@link NoteValidator} for detailed validation implementation
   */
  private isValidNote(note: unknown): note is Note {
    return noteValidator.validate(note);
  }

  /**
   * Build a properly typed Note from raw data using TypeScript discriminated unions.
   *
   * This method is the central point for constructing Note objects, handling the
   * complexity of TypeScript's discriminated union pattern where the `type` field
   * determines which additional fields are present.
   *
   * ## Migration Scenarios
   *
   * This method is used in several contexts where field precedence matters:
   *
   * 1. **New note creation** ({@link create}): All fields come from options, defaults applied
   * 2. **Save/update** ({@link save}): Incoming fields take precedence, missing fields
   *    preserved from existing note
   * 3. **Post-migration** ({@link NoteMigrator}): Migrator derives missing fields from
   *    metadata, then buildNote creates the final typed object
   *
   * ## Field Precedence (during save)
   *
   * When updating an existing note, this precedence is applied before calling buildNote:
   * - `title`: incoming ?? existing ?? 'Untitled'
   * - `type`: incoming ?? existing ?? undefined
   * - `tags`: incoming ?? existing ?? []
   * - `daily`: incoming ?? existing (for daily notes)
   * - `meeting`: incoming ?? existing (for meeting notes)
   *
   * This allows partial updates where only changed fields are sent.
   *
   * ## Discriminated Union Handling
   *
   * The return type is narrowed based on the `type` field:
   * - `type: 'daily'` + `daily` data → DailyNote
   * - `type: 'meeting'` + `meeting` data → MeetingNote
   * - `type: 'person'` → PersonNote
   * - `type: 'project'` → ProjectNote
   * - `type: 'template'` → TemplateNote
   * - `type: 'system'` → SystemNote
   * - `type: undefined` → RegularNote
   *
   * @param data - Raw note data with optional type-specific fields. The `type` field
   *   determines which type-specific fields (`daily`, `meeting`) are included in output.
   * @returns Properly typed Note conforming to the discriminated union
   *
   * @internal Used by {@link create}, {@link save}, and {@link NoteMigrator}
   */
  private buildNote(data: {
    id: NoteId;
    title: string;
    createdAt: number;
    updatedAt: number;
    type?: NoteType;
    tags: string[];
    content: LexicalState;
    metadata: Note['metadata'];
    daily?: DailyNoteData;
    meeting?: MeetingNoteData;
  }): Note {
    const baseNote = {
      id: data.id,
      title: data.title,
      createdAt: data.createdAt,
      updatedAt: data.updatedAt,
      tags: data.tags,
      content: data.content,
      metadata: data.metadata,
    };

    // Handle discriminated union based on type
    if (data.type === 'daily' && data.daily) {
      return { ...baseNote, type: 'daily', daily: data.daily };
    }
    if (data.type === 'meeting' && data.meeting) {
      return { ...baseNote, type: 'meeting', meeting: data.meeting };
    }
    if (data.type === 'person') {
      return { ...baseNote, type: 'person' };
    }
    if (data.type === 'project') {
      return { ...baseNote, type: 'project' };
    }
    if (data.type === 'template') {
      return { ...baseNote, type: 'template' };
    }
    if (data.type === 'system') {
      return { ...baseNote, type: 'system' };
    }
    // Regular note (no special type)
    return { ...baseNote, type: undefined };
  }
}
