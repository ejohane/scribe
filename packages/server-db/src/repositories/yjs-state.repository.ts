/**
 * YjsStateRepository - Type-safe CRUD operations for yjs_state table.
 *
 * Provides repository pattern implementation for Yjs CRDT state persistence.
 * The state is stored as a binary blob (Buffer) in SQLite.
 *
 * Note: This repository works with raw buffers. The encoding/decoding of Y.Doc
 * objects should be handled by higher-level services (e.g., CollaborationService).
 */

import type { Database } from 'better-sqlite3';
import type { YjsState, CreateYjsStateInput } from '../types.js';
import { wrapError } from '../errors.js';

/**
 * Raw row structure from SQLite (snake_case columns)
 */
interface YjsStateRow {
  note_id: string;
  state: Buffer;
  updated_at: string;
}

/**
 * YjsStateRepository - Repository for yjs_state table operations.
 *
 * Encapsulates all SQL queries for the yjs_state table and provides
 * type-safe input/output interfaces for Yjs document state persistence.
 *
 * @example
 * ```typescript
 * import * as Y from 'yjs';
 *
 * const repo = new YjsStateRepository(db);
 *
 * // Save Yjs document state
 * const doc = new Y.Doc();
 * doc.getText('content').insert(0, 'Hello');
 * const state = Y.encodeStateAsUpdate(doc);
 * repo.save({
 *   noteId: 'note-123',
 *   state: Buffer.from(state),
 *   updatedAt: new Date().toISOString(),
 * });
 *
 * // Load and apply state
 * const savedState = repo.load('note-123');
 * if (savedState) {
 *   const newDoc = new Y.Doc();
 *   Y.applyUpdate(newDoc, savedState.state);
 * }
 * ```
 */
export class YjsStateRepository {
  constructor(private db: Database) {}

  /**
   * Save Yjs document state (upsert semantics).
   *
   * If state already exists for the note, it will be replaced.
   *
   * @param input - Yjs state creation data
   * @returns The saved Yjs state
   * @throws DatabaseError if save fails
   */
  save(input: CreateYjsStateInput): YjsState {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO yjs_state (note_id, state, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(note_id) DO UPDATE SET
          state = excluded.state,
          updated_at = excluded.updated_at
      `);

      stmt.run(input.noteId, input.state, input.updatedAt);

      // Return the saved state - we know it exists since upsert succeeded
      return this.load(input.noteId)!;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to save Yjs state for note ${input.noteId}`);
    }
  }

  /**
   * Load Yjs document state by note ID.
   *
   * @param noteId - The note ID
   * @returns The Yjs state if found, null otherwise
   */
  load(noteId: string): YjsState | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM yjs_state WHERE note_id = ?');
      const row = stmt.get(noteId) as YjsStateRow | undefined;
      return row ? this.mapRow(row) : null;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to load Yjs state for note ${noteId}`);
    }
  }

  /**
   * Load Yjs document state as Uint8Array (for direct use with Y.applyUpdate).
   *
   * @param noteId - The note ID
   * @returns Uint8Array state if found, null otherwise
   */
  loadAsUint8Array(noteId: string): Uint8Array | null {
    const state = this.load(noteId);
    if (!state) return null;

    // Convert Buffer to Uint8Array
    return new Uint8Array(state.state);
  }

  /**
   * Delete Yjs state for a note.
   *
   * @param noteId - The note ID
   * @returns true if state was deleted, false if not found
   */
  delete(noteId: string): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM yjs_state WHERE note_id = ?');
      const result = stmt.run(noteId);
      return result.changes > 0;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to delete Yjs state for note ${noteId}`);
    }
  }

  /**
   * Check if Yjs state exists for a note.
   *
   * @param noteId - The note ID
   * @returns true if state exists
   */
  exists(noteId: string): boolean {
    try {
      const stmt = this.db.prepare('SELECT 1 FROM yjs_state WHERE note_id = ? LIMIT 1');
      const result = stmt.get(noteId);
      return result !== undefined;
    } catch (error) {
      throw wrapError(
        error,
        'QUERY_FAILED',
        `Failed to check existence of Yjs state for note ${noteId}`
      );
    }
  }

  /**
   * Get last update time for a note's Yjs state.
   *
   * @param noteId - The note ID
   * @returns ISO timestamp if found, null otherwise
   */
  getLastUpdated(noteId: string): string | null {
    try {
      const stmt = this.db.prepare('SELECT updated_at FROM yjs_state WHERE note_id = ?');
      const row = stmt.get(noteId) as { updated_at: string } | undefined;
      return row?.updated_at ?? null;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to get last updated time for note ${noteId}`);
    }
  }

  /**
   * Get all note IDs that have Yjs state stored.
   *
   * @returns Array of note IDs
   */
  getAllNoteIds(): string[] {
    try {
      const stmt = this.db.prepare('SELECT note_id FROM yjs_state');
      const rows = stmt.all() as { note_id: string }[];
      return rows.map((row) => row.note_id);
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to get all note IDs with Yjs state');
    }
  }

  /**
   * Count total Yjs state records.
   *
   * @returns The count of stored states
   */
  count(): number {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM yjs_state');
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to count Yjs states');
    }
  }

  /**
   * Map a database row to a YjsState object.
   * Converts snake_case column names to camelCase properties.
   */
  private mapRow(row: YjsStateRow): YjsState {
    return {
      noteId: row.note_id,
      state: row.state,
      updatedAt: row.updated_at,
    };
  }
}
