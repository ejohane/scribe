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
import { createNoteId, isDailyNote, isMeetingNote } from '@scribe/shared';
import { ErrorCode, ScribeError } from '@scribe/shared';
import { extractMetadata } from '@scribe/engine-core';
import { getNotesDir, getNoteFilePath, getQuarantineDir } from './vault.js';
import { noteValidator } from './note-validator.js';
import { atomicFileWriter } from './atomic-file-writer.js';
import { noteMigrator } from './note-migrator.js';

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
 * In-memory note storage
 */
export class FileSystemVault {
  private notes: Map<NoteId, Note> = new Map();
  private quarantinedFiles: string[] = [];
  /**
   * Per-note locks for serializing concurrent operations.
   * Uses promise-chaining pattern: each operation chains onto the previous
   * operation's promise, ensuring sequential execution per note.
   */
  private noteLocks: Map<NoteId, Promise<void>> = new Map();

  constructor(private vaultPath: VaultPath) {}

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
   */
  getQuarantinedFiles(): string[] {
    return [...this.quarantinedFiles];
  }

  /**
   * Quarantine a corrupt note file
   *
   * Uses a two-strategy approach:
   * 1. Primary: Move file to quarantine directory
   * 2. Fallback: Rename in place with .corrupt extension
   *
   * This ensures corrupt files are always removed from the notes directory
   * to prevent repeated parse failures on startup.
   *
   * @param fileName - Name of the file to quarantine
   * @throws ScribeError if both quarantine strategies fail
   */
  private async quarantineFile(fileName: string): Promise<void> {
    const sourcePath = path.join(getNotesDir(this.vaultPath), fileName);
    const quarantineDir = getQuarantineDir(this.vaultPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantinePath = path.join(quarantineDir, `${timestamp}_${fileName}`);

    // Strategy 1: Move to quarantine directory
    try {
      // Ensure quarantine directory exists
      await fs.mkdir(quarantineDir, { recursive: true });

      await fs.rename(sourcePath, quarantinePath);
      this.quarantinedFiles.push(fileName);
      console.warn(`Quarantined corrupt file: ${fileName} -> ${path.basename(quarantinePath)}`);
      return;
    } catch (moveError) {
      console.warn(
        `Failed to move ${fileName} to quarantine directory, trying fallback:`,
        moveError
      );
    }

    // Strategy 2: Rename in place with .corrupt extension
    const corruptPath = path.join(getNotesDir(this.vaultPath), `${fileName}.corrupt`);
    try {
      await fs.rename(sourcePath, corruptPath);
      this.quarantinedFiles.push(fileName);
      console.warn(`Renamed corrupt file in place: ${fileName} -> ${path.basename(corruptPath)}`);
      return;
    } catch (renameError) {
      console.error(`Failed to rename ${fileName} in place:`, renameError);
    }

    // Both strategies failed - this is a critical error
    // The corrupt file remains in place and will cause repeated parse failures
    throw new ScribeError(
      ErrorCode.FILE_WRITE_ERROR,
      `Failed to quarantine corrupt file ${fileName}: both move and rename strategies failed. ` +
        `File remains in notes directory and will cause repeated parse failures.`
    );
  }

  /**
   * Load all notes from disk into memory
   *
   * Scans the notes directory, parses all JSON files, validates structure,
   * and builds the in-memory notes map.
   *
   * @returns Number of notes loaded
   * @throws ScribeError if notes directory cannot be read
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
            await this.quarantineFile(file);
          }
        } catch (error) {
          // Quarantine corrupt files (e.g., invalid JSON)
          console.warn(`Failed to load note ${file}, quarantining:`, error);
          await this.quarantineFile(file);
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
    const noteContent: LexicalState = options?.content ?? this.createEmptyContent();

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
   * Save a note (create or update)
   *
   * Uses atomic write: temp file → fsync → rename
   * Metadata is automatically extracted from content before saving
   * Concurrent saves to the same note are serialized via per-note mutex.
   *
   * @param note - Note to save
   * @throws ScribeError if save fails
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
   * Validate note structure
   *
   * Delegates to NoteValidator for validation logic.
   *
   * @param note - Object to validate
   * @returns true if valid note structure
   */
  private isValidNote(note: unknown): note is Note {
    return noteValidator.validate(note);
  }

  /**
   * Create empty Lexical content
   *
   * @returns Empty Lexical state
   */
  private createEmptyContent(): LexicalState {
    return {
      root: {
        type: 'root',
        children: [],
        format: '',
        indent: 0,
        version: 1,
      },
    };
  }

  /**
   * Build a properly typed Note from raw data.
   * Handles the discriminated union based on the type field.
   *
   * @param data - Raw note data with optional type-specific fields
   * @returns Properly typed Note
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
