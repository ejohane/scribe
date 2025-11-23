/**
 * File system storage implementation
 *
 * Provides atomic read/write operations for notes using the local filesystem
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Note, NoteId, VaultPath, LexicalState } from '@scribe/shared';
import { getNotesDir, getNoteFilePath } from './vault.js';

/**
 * In-memory note storage
 */
export class FileSystemVault {
  private notes: Map<NoteId, Note> = new Map();

  constructor(private vaultPath: VaultPath) {}

  /**
   * Load all notes from disk into memory
   *
   * Scans the notes directory, parses all JSON files, validates structure,
   * and builds the in-memory notes map.
   *
   * @returns Number of notes loaded
   */
  async load(): Promise<number> {
    const notesDir = getNotesDir(this.vaultPath);

    try {
      const files = await fs.readdir(notesDir);
      const jsonFiles = files.filter((f) => f.endsWith('.json'));

      for (const file of jsonFiles) {
        try {
          const filePath = path.join(notesDir, file);
          const content = await fs.readFile(filePath, 'utf-8');
          const note = JSON.parse(content) as Note;

          // Validate note structure
          if (this.isValidNote(note)) {
            this.notes.set(note.id, note);
          } else {
            console.warn(`Invalid note structure in ${file}, skipping`);
          }
        } catch (error) {
          console.warn(`Failed to load note ${file}:`, error);
        }
      }

      return this.notes.size;
    } catch (error) {
      console.warn('Failed to read notes directory:', error);
      return 0;
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
   * @returns Note or undefined if not found
   */
  read(id: NoteId): Note | undefined {
    return this.notes.get(id);
  }

  /**
   * Create a new note
   *
   * @param content - Initial Lexical content (optional)
   * @returns Newly created note
   */
  async create(content?: LexicalState): Promise<Note> {
    const now = Date.now();
    const note: Note = {
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
      content: content || this.createEmptyContent(),
      metadata: {
        title: null,
        tags: [],
        links: [],
      },
    };

    // Save to disk and add to memory
    await this.save(note);

    return note;
  }

  /**
   * Save a note (create or update)
   *
   * Uses atomic write: temp file → fsync → rename
   *
   * @param note - Note to save
   */
  async save(note: Note): Promise<void> {
    // Update timestamp
    const updatedNote: Note = {
      ...note,
      updatedAt: Date.now(),
    };

    // Perform atomic write
    const notePath = getNoteFilePath(this.vaultPath, updatedNote.id);
    await this.atomicWrite(notePath, JSON.stringify(updatedNote, null, 2));

    // Update in-memory map
    this.notes.set(updatedNote.id, updatedNote);
  }

  /**
   * Delete a note
   *
   * @param id - Note ID to delete
   */
  async delete(id: NoteId): Promise<void> {
    const notePath = getNoteFilePath(this.vaultPath, id);

    try {
      await fs.unlink(notePath);
      this.notes.delete(id);
    } catch (error) {
      console.warn(`Failed to delete note ${id}:`, error);
      throw error;
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
      throw error;
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
