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
  /** Initial Lexical content (optional) */
  content?: LexicalState;
  /** Note type discriminator (optional) */
  type?: NoteType;
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
            this.notes.set(note.id, note);
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

    // Set type on the content if provided
    if (options?.type) {
      (noteContent as LexicalState & { type?: NoteType }).type = options.type;
    }

    const note: Note = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      content: noteContent,
      metadata: extractMetadata(noteContent),
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
      // Extract metadata from content
      const metadata = extractMetadata(note.content);

      // Update timestamp and metadata
      const updatedNote: Note = {
        ...note,
        updatedAt: Date.now(),
        metadata,
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

    return (
      typeof n.id === 'string' &&
      typeof n.createdAt === 'number' &&
      typeof n.updatedAt === 'number' &&
      typeof n.content === 'object' &&
      n.content !== null &&
      typeof n.metadata === 'object' &&
      n.metadata !== null
    );
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
}
