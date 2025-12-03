/**
 * File system storage implementation
 *
 * Provides atomic read/write operations for notes using the local filesystem
 */

import * as fs from 'node:fs/promises';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import type { Note, NoteId, VaultPath, LexicalState, NoteType } from '@scribe/shared';
import { ErrorCode, ScribeError } from '@scribe/shared';
import { extractMetadata } from '@scribe/engine-core';
import { getNotesDir, getNoteFilePath, getQuarantineDir } from './vault.js';

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

  constructor(private vaultPath: VaultPath) {}

  /**
   * Get list of quarantined file names
   */
  getQuarantinedFiles(): string[] {
    return [...this.quarantinedFiles];
  }

  /**
   * Quarantine a corrupt note file
   */
  private async quarantineFile(fileName: string): Promise<void> {
    const sourcePath = path.join(getNotesDir(this.vaultPath), fileName);
    const quarantineDir = getQuarantineDir(this.vaultPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantinePath = path.join(quarantineDir, `${timestamp}_${fileName}`);

    try {
      // Ensure quarantine directory exists
      await fs.mkdir(quarantineDir, { recursive: true });

      await fs.rename(sourcePath, quarantinePath);
      this.quarantinedFiles.push(fileName);
      console.warn(`Quarantined corrupt file: ${fileName} -> ${path.basename(quarantinePath)}`);
    } catch (error) {
      console.error(`Failed to quarantine file ${fileName}:`, error);
    }
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
            const migratedNote = this.migrateNote(note);
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

    // Build content with optional type
    const noteContent: LexicalState = options?.content ?? this.createEmptyContent();

    // Set type on the content if provided (for backward compat with metadata extraction)
    if (options?.type) {
      (noteContent as LexicalState & { type?: NoteType }).type = options.type;
    }

    const note: Note = {
      id: randomUUID(),
      title: options?.title ?? 'Untitled',
      createdAt: now,
      updatedAt: now,
      type: options?.type,
      tags: options?.tags ?? [],
      content: noteContent,
      metadata: extractMetadata(noteContent),
      daily: options?.daily,
      meeting: options?.meeting,
    };

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
   *
   * @param note - Note to save
   * @throws ScribeError if save fails
   */
  async save(note: Note): Promise<void> {
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

      // Preserve explicit fields from existing note if not provided
      // This handles partial updates from the editor (content-only saves)
      const updatedNote: Note = {
        ...note,
        title: note.title ?? existingNote?.title ?? 'Untitled',
        type: note.type ?? existingNote?.type,
        tags: note.tags ?? existingNote?.tags ?? [],
        content: noteContent,
        updatedAt: Date.now(),
        metadata,
        // Preserve daily/meeting fields from existing note if not in update
        daily: note.daily ?? existingNote?.daily,
        meeting: note.meeting ?? existingNote?.meeting,
      };

      // Perform atomic write
      const notePath = getNoteFilePath(this.vaultPath, updatedNote.id);
      await this.atomicWrite(notePath, JSON.stringify(updatedNote, null, 2));

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
  }

  /**
   * Delete a note
   *
   * @param id - Note ID to delete
   * @throws ScribeError if deletion fails
   */
  async delete(id: NoteId): Promise<void> {
    const notePath = getNoteFilePath(this.vaultPath, id);

    try {
      await fs.unlink(notePath);
      this.notes.delete(id);
    } catch (error) {
      const err = error as Error & { code?: string };
      const code = ScribeError.fromSystemError(err, ErrorCode.FILE_DELETE_ERROR);
      throw new ScribeError(code, `Failed to delete note ${id}: ${err.message}`, err);
    }
  }

  /**
   * Atomic file write operation
   *
   * Writes to a temporary file, syncs to disk, then renames to final path.
   * This ensures no partial writes on crash or power loss.
   *
   * @param filePath - Final file path
   * @param content - Content to write
   * @throws ScribeError if write fails
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    const dir = path.dirname(filePath);
    const tempPath = path.join(dir, `.${path.basename(filePath)}.tmp`);

    try {
      // Write to temporary file
      await fs.writeFile(tempPath, content, 'utf-8');

      // Sync to disk (ensure data is physically written)
      const fileHandle = await fs.open(tempPath, 'r+');
      try {
        await fileHandle.sync();
      } finally {
        await fileHandle.close();
      }

      // Atomic rename
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Clean up temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      const err = error as Error & { code?: string };
      const code = ScribeError.fromSystemError(err, ErrorCode.FILE_WRITE_ERROR);
      throw new ScribeError(code, `Failed to write file ${filePath}: ${err.message}`, err);
    }
  }

  /**
   * Validate note structure
   *
   * @param note - Object to validate
   * @returns true if valid note structure
   */
  private isValidNote(note: unknown): note is Note {
    if (typeof note !== 'object' || note === null) {
      return false;
    }

    const n = note as Record<string, unknown>;

    // Validate core required fields
    if (
      typeof n.id !== 'string' ||
      typeof n.createdAt !== 'number' ||
      typeof n.updatedAt !== 'number' ||
      typeof n.content !== 'object' ||
      n.content === null ||
      typeof n.metadata !== 'object' ||
      n.metadata === null
    ) {
      return false;
    }

    // Validate title: must be string if present (legacy notes may be missing it)
    if (n.title !== undefined && typeof n.title !== 'string') {
      return false;
    }

    // Validate tags: must be array of strings if present (legacy notes may be missing it)
    if (n.tags !== undefined) {
      if (!Array.isArray(n.tags)) {
        return false;
      }
      // Verify all items in tags array are strings
      if (!n.tags.every((tag) => typeof tag === 'string')) {
        return false;
      }
    }

    // Validate daily field if present
    if (n.daily !== undefined) {
      if (typeof n.daily !== 'object' || n.daily === null) {
        return false;
      }
      const daily = n.daily as Record<string, unknown>;
      if (typeof daily.date !== 'string') {
        return false;
      }
    }

    // Validate meeting field if present
    if (n.meeting !== undefined) {
      if (typeof n.meeting !== 'object' || n.meeting === null) {
        return false;
      }
      const meeting = n.meeting as Record<string, unknown>;
      if (
        typeof meeting.date !== 'string' ||
        typeof meeting.dailyNoteId !== 'string' ||
        !Array.isArray(meeting.attendees)
      ) {
        return false;
      }
    }

    return true;
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
   * Migrate a legacy note to include explicit metadata fields
   *
   * For notes created before explicit title/type/tags fields were added,
   * this derives the values from the existing metadata.
   *
   * @param note - Note to migrate (may be missing explicit fields)
   * @returns Note with all explicit fields populated
   */
  private migrateNote(note: Note): Note {
    // Type assertion for legacy notes that may be missing new fields
    const legacyNote = note as Partial<Note> & {
      id: string;
      createdAt: number;
      updatedAt: number;
      content: LexicalState;
      metadata: Note['metadata'];
    };

    return {
      id: legacyNote.id,
      // Derive title from metadata if explicit title is missing
      title: legacyNote.title ?? legacyNote.metadata?.title ?? 'Untitled',
      createdAt: legacyNote.createdAt,
      updatedAt: legacyNote.updatedAt,
      // Derive type from metadata or content if explicit type is missing
      type: legacyNote.type ?? legacyNote.metadata?.type ?? legacyNote.content?.type,
      // Initialize tags as empty if missing (inline #tags stay in metadata.tags)
      tags: legacyNote.tags ?? [],
      content: legacyNote.content,
      metadata: legacyNote.metadata,
      // Preserve daily/meeting fields if present
      daily: legacyNote.daily,
      meeting: legacyNote.meeting,
    };
  }
}
