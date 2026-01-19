/**
 * NotesRepository - Type-safe CRUD operations for notes table.
 *
 * Provides repository pattern implementation for notes data access.
 * All methods return typed results and accept typed inputs.
 */

import type { Database } from 'better-sqlite3';
import type { Note, NoteType, CreateNoteInput, UpdateNoteInput, RecentNote } from '../types.js';
import { wrapError } from '../errors.js';

/**
 * Filter options for listing notes
 */
export interface NoteFilter {
  /** Filter by note type */
  type?: NoteType;
  /** Filter by date >= dateFrom (ISO date string) */
  dateFrom?: string;
  /** Filter by date <= dateTo (ISO date string) */
  dateTo?: string;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip (for pagination) */
  offset?: number;
  /** Column to sort by */
  orderBy?: 'created_at' | 'updated_at' | 'title' | 'date';
  /** Sort direction */
  orderDir?: 'asc' | 'desc';
}

/**
 * Raw row structure from SQLite (snake_case columns)
 */
interface NoteRow {
  id: string;
  title: string;
  type: NoteType;
  date: string | null;
  created_at: string;
  updated_at: string;
  word_count: number;
  file_path: string;
  content_hash: string | null;
  last_accessed_at: string | null;
}

/**
 * Raw row structure for recent note queries
 */
interface RecentNoteRow {
  id: string;
  title: string;
  type: NoteType;
  last_accessed_at: string;
}

/**
 * NotesRepository - Repository for notes table operations.
 *
 * Encapsulates all SQL queries for the notes table and provides
 * type-safe input/output interfaces.
 *
 * @example
 * ```typescript
 * const repo = new NotesRepository(db);
 *
 * // Create a note
 * const note = repo.create({
 *   id: 'abc123',
 *   title: 'My Note',
 *   type: 'note',
 *   filePath: 'notes/my-note.json',
 *   createdAt: new Date().toISOString(),
 *   updatedAt: new Date().toISOString(),
 * });
 *
 * // Find by ID
 * const found = repo.findById('abc123');
 *
 * // List with filters
 * const dailyNotes = repo.findAll({ type: 'daily', limit: 10 });
 * ```
 */
export class NotesRepository {
  constructor(private db: Database) {}

  /**
   * Create a new note.
   *
   * @param input - Note creation data
   * @returns The created note
   * @throws DatabaseError if creation fails
   */
  create(input: CreateNoteInput): Note {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO notes (id, title, type, date, created_at, updated_at, word_count, file_path, content_hash)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);

      stmt.run(
        input.id,
        input.title,
        input.type,
        input.date ?? null,
        input.createdAt,
        input.updatedAt,
        input.wordCount ?? 0,
        input.filePath,
        input.contentHash ?? null
      );

      // Return the created note - we know it exists since insert succeeded
      return this.findById(input.id)!;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to create note with id ${input.id}`);
    }
  }

  /**
   * Find a note by its ID.
   *
   * @param id - The note ID
   * @returns The note if found, null otherwise
   */
  findById(id: string): Note | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM notes WHERE id = ?');
      const row = stmt.get(id) as NoteRow | undefined;
      return row ? this.mapRow(row) : null;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find note with id ${id}`);
    }
  }

  /**
   * Find a note by its file path.
   *
   * @param filePath - The file path (relative to vault root)
   * @returns The note if found, null otherwise
   */
  findByFilePath(filePath: string): Note | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM notes WHERE file_path = ?');
      const row = stmt.get(filePath) as NoteRow | undefined;
      return row ? this.mapRow(row) : null;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find note with file_path ${filePath}`);
    }
  }

  /**
   * Find all notes matching the given filter criteria.
   *
   * @param filter - Filter options for the query
   * @returns Array of notes matching the filter
   */
  findAll(filter: NoteFilter = {}): Note[] {
    try {
      let sql = 'SELECT * FROM notes WHERE 1=1';
      const params: (string | number)[] = [];

      if (filter.type) {
        sql += ' AND type = ?';
        params.push(filter.type);
      }

      if (filter.dateFrom) {
        sql += ' AND date >= ?';
        params.push(filter.dateFrom);
      }

      if (filter.dateTo) {
        sql += ' AND date <= ?';
        params.push(filter.dateTo);
      }

      // Order by clause - use validated column names to prevent SQL injection
      const orderBy = filter.orderBy ?? 'updated_at';
      const orderDir = filter.orderDir ?? 'desc';
      sql += ` ORDER BY ${orderBy} ${orderDir}`;

      if (filter.limit !== undefined) {
        sql += ' LIMIT ?';
        params.push(filter.limit);

        if (filter.offset !== undefined) {
          sql += ' OFFSET ?';
          params.push(filter.offset);
        }
      }

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as NoteRow[];
      return rows.map((row) => this.mapRow(row));
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to find notes');
    }
  }

  /**
   * Update an existing note.
   *
   * @param id - The ID of the note to update
   * @param input - Fields to update (updatedAt is required)
   * @returns The updated note if found, null if not found
   */
  update(id: string, input: UpdateNoteInput): Note | null {
    try {
      const sets: string[] = ['updated_at = ?'];
      const params: (string | number | null)[] = [input.updatedAt];

      if (input.title !== undefined) {
        sets.push('title = ?');
        params.push(input.title);
      }

      if (input.type !== undefined) {
        sets.push('type = ?');
        params.push(input.type);
      }

      if (input.date !== undefined) {
        sets.push('date = ?');
        params.push(input.date);
      }

      if (input.wordCount !== undefined) {
        sets.push('word_count = ?');
        params.push(input.wordCount);
      }

      if (input.contentHash !== undefined) {
        sets.push('content_hash = ?');
        params.push(input.contentHash);
      }

      params.push(id);

      const stmt = this.db.prepare(`UPDATE notes SET ${sets.join(', ')} WHERE id = ?`);

      const result = stmt.run(...params);
      return result.changes > 0 ? this.findById(id) : null;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to update note with id ${id}`);
    }
  }

  /**
   * Delete a note by its ID.
   *
   * Due to foreign key constraints with ON DELETE CASCADE, this will also
   * delete related records in links, note_tags, yjs_state, and snapshots tables.
   *
   * @param id - The ID of the note to delete
   * @returns true if the note was deleted, false if not found
   */
  delete(id: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM notes WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to delete note with id ${id}`);
    }
  }

  /**
   * Count total notes, optionally filtered by type.
   *
   * @param type - Optional type filter
   * @returns The count of notes
   */
  count(type?: NoteType): number {
    try {
      if (type) {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM notes WHERE type = ?');
        const result = stmt.get(type) as { count: number };
        return result.count;
      } else {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM notes');
        const result = stmt.get() as { count: number };
        return result.count;
      }
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to count notes');
    }
  }

  /**
   * Check if a note exists by ID.
   *
   * @param id - The note ID
   * @returns true if the note exists
   */
  exists(id: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM notes WHERE id = ? LIMIT 1');
      const result = stmt.get(id);
      return result !== undefined;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to check existence of note with id ${id}`);
    }
  }

  /**
   * Check if a file path is already used by a note.
   *
   * @param filePath - The file path to check
   * @returns true if a note with this file path exists
   */
  filePathExists(filePath: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM notes WHERE file_path = ? LIMIT 1');
      const result = stmt.get(filePath);
      return result !== undefined;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to check existence of file path ${filePath}`);
    }
  }

  /**
   * Update the last accessed timestamp for a note.
   *
   * This is called when a note is opened/viewed to track recent access.
   * Uses a fire-and-forget pattern - does not throw if note doesn't exist.
   *
   * @param noteId - The ID of the note to update
   */
  updateLastAccessedAt(noteId: string): void {
    try {
      const stmt = this.db.prepare(`
        UPDATE notes SET last_accessed_at = datetime('now') WHERE id = ?
      `);
      stmt.run(noteId);
    } catch (error) {
      throw wrapError(
        error,
        'QUERY_FAILED',
        `Failed to update last_accessed_at for note ${noteId}`
      );
    }
  }

  /**
   * Find recently accessed notes, sorted by most recent first.
   *
   * Returns notes that have been accessed (last_accessed_at IS NOT NULL),
   * ordered by access time descending.
   *
   * @param limit - Maximum number of notes to return (default: 5)
   * @returns Array of recently accessed notes
   */
  findRecentlyAccessed(limit: number = 5): RecentNote[] {
    try {
      const stmt = this.db.prepare(`
        SELECT id, title, type, last_accessed_at
        FROM notes
        WHERE last_accessed_at IS NOT NULL
        ORDER BY last_accessed_at DESC
        LIMIT ?
      `);
      const rows = stmt.all(limit) as RecentNoteRow[];
      return rows.map((row) => ({
        id: row.id,
        title: row.title,
        type: row.type,
        lastAccessedAt: row.last_accessed_at,
      }));
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to find recently accessed notes');
    }
  }

  /**
   * Map a database row to a Note object.
   * Converts snake_case column names to camelCase properties.
   */
  private mapRow(row: NoteRow): Note {
    return {
      id: row.id,
      title: row.title,
      type: row.type,
      date: row.date,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      wordCount: row.word_count,
      filePath: row.file_path,
      contentHash: row.content_hash,
    };
  }
}
