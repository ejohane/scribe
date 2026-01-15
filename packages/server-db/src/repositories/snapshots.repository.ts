/**
 * SnapshotsRepository - Type-safe CRUD operations for snapshots table.
 *
 * Provides repository pattern implementation for content snapshots.
 * Snapshots capture point-in-time content for version history and recovery.
 *
 * Snapshot triggers:
 * - manual: User explicitly saves a snapshot
 * - auto: Periodic auto-save (e.g., every 5 min of editing)
 * - pre_edit: Before applying a significant change
 */

import type { Database } from 'better-sqlite3';
import type { Snapshot, CreateSnapshotInput, SnapshotTrigger } from '../types.js';
import { wrapError } from '../errors.js';

/**
 * Filter options for listing snapshots
 */
export interface SnapshotFilter {
  /** Filter by trigger type */
  trigger?: SnapshotTrigger;
  /** Maximum number of results to return */
  limit?: number;
  /** Number of results to skip (for pagination) */
  offset?: number;
}

/**
 * Raw row structure from SQLite (snake_case columns)
 */
interface SnapshotRow {
  id: number;
  note_id: string;
  title: string;
  content: string;
  created_at: string;
  trigger: SnapshotTrigger;
}

/**
 * SnapshotsRepository - Repository for snapshots table operations.
 *
 * Encapsulates all SQL queries for the snapshots table and provides
 * type-safe input/output interfaces for content snapshot management.
 *
 * @example
 * ```typescript
 * const repo = new SnapshotsRepository(db);
 *
 * // Create a manual snapshot
 * const snapshot = repo.create({
 *   noteId: 'note-123',
 *   title: 'My Note',
 *   content: '{"type":"doc","content":[...]}',
 *   createdAt: new Date().toISOString(),
 *   trigger: 'manual',
 * });
 *
 * // Get all snapshots for a note
 * const snapshots = repo.findByNoteId('note-123');
 *
 * // Prune old auto-snapshots, keep last 10
 * repo.pruneAutoSnapshots('note-123', 10);
 * ```
 */
export class SnapshotsRepository {
  constructor(private db: Database) {}

  /**
   * Create a new snapshot.
   *
   * @param input - Snapshot creation data
   * @returns The created snapshot
   * @throws DatabaseError if creation fails
   */
  create(input: CreateSnapshotInput): Snapshot {
    try {
      const stmt = this.db.prepare(`
        INSERT INTO snapshots (note_id, title, content, created_at, trigger)
        VALUES (?, ?, ?, ?, ?)
      `);

      const result = stmt.run(
        input.noteId,
        input.title,
        input.content,
        input.createdAt,
        input.trigger
      );

      // Return the created snapshot - we know it exists since insert succeeded
      return this.findById(result.lastInsertRowid as number)!;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to create snapshot for note ${input.noteId}`);
    }
  }

  /**
   * Find a snapshot by its ID.
   *
   * @param id - The snapshot ID
   * @returns The snapshot if found, null otherwise
   */
  findById(id: number): Snapshot | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM snapshots WHERE id = ?');
      const row = stmt.get(id) as SnapshotRow | undefined;
      return row ? this.mapRow(row) : null;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find snapshot with id ${id}`);
    }
  }

  /**
   * Get all snapshots for a note, newest first.
   *
   * @param noteId - The note ID
   * @param filter - Optional filter options
   * @returns Array of snapshots matching the filter
   */
  findByNoteId(noteId: string, filter: SnapshotFilter = {}): Snapshot[] {
    try {
      let sql = 'SELECT * FROM snapshots WHERE note_id = ?';
      const params: (string | number)[] = [noteId];

      if (filter.trigger) {
        sql += ' AND trigger = ?';
        params.push(filter.trigger);
      }

      sql += ' ORDER BY created_at DESC';

      if (filter.limit !== undefined) {
        sql += ' LIMIT ?';
        params.push(filter.limit);

        if (filter.offset !== undefined) {
          sql += ' OFFSET ?';
          params.push(filter.offset);
        }
      }

      const stmt = this.db.prepare(sql);
      const rows = stmt.all(...params) as SnapshotRow[];
      return rows.map((row) => this.mapRow(row));
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find snapshots for note ${noteId}`);
    }
  }

  /**
   * Get the most recent snapshot for a note.
   *
   * @param noteId - The note ID
   * @param trigger - Optional trigger type filter
   * @returns The most recent snapshot if found, null otherwise
   */
  findLatest(noteId: string, trigger?: SnapshotTrigger): Snapshot | null {
    const snapshots = this.findByNoteId(noteId, { trigger, limit: 1 });
    return snapshots[0] ?? null;
  }

  /**
   * Delete old auto-snapshots, keeping the most recent N.
   * Manual snapshots are never auto-deleted by this method.
   *
   * @param noteId - The note ID
   * @param keep - Number of auto-snapshots to keep (default: 10)
   * @returns Number of snapshots deleted
   */
  pruneAutoSnapshots(noteId: string, keep = 10): number {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM snapshots
        WHERE note_id = ?
          AND trigger = 'auto'
          AND id NOT IN (
            SELECT id FROM snapshots
            WHERE note_id = ? AND trigger = 'auto'
            ORDER BY created_at DESC
            LIMIT ?
          )
      `);

      const result = stmt.run(noteId, noteId, keep);
      return result.changes;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to prune auto-snapshots for note ${noteId}`);
    }
  }

  /**
   * Delete old pre_edit snapshots, keeping the most recent N.
   *
   * @param noteId - The note ID
   * @param keep - Number of pre_edit snapshots to keep (default: 5)
   * @returns Number of snapshots deleted
   */
  prunePreEditSnapshots(noteId: string, keep = 5): number {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM snapshots
        WHERE note_id = ?
          AND trigger = 'pre_edit'
          AND id NOT IN (
            SELECT id FROM snapshots
            WHERE note_id = ? AND trigger = 'pre_edit'
            ORDER BY created_at DESC
            LIMIT ?
          )
      `);

      const result = stmt.run(noteId, noteId, keep);
      return result.changes;
    } catch (error) {
      throw wrapError(
        error,
        'QUERY_FAILED',
        `Failed to prune pre_edit snapshots for note ${noteId}`
      );
    }
  }

  /**
   * Delete a specific snapshot.
   *
   * By default, manual snapshots are protected from deletion.
   * Set force=true to delete manual snapshots.
   *
   * @param id - The snapshot ID
   * @param force - If true, allows deletion of manual snapshots
   * @returns true if deleted, false if not found or protected
   */
  delete(id: number, force = false): boolean {
    try {
      const snapshot = this.findById(id);
      if (!snapshot) return false;

      // Protect manual snapshots unless forced
      if (snapshot.trigger === 'manual' && !force) {
        return false;
      }

      const stmt = this.db.prepare('DELETE FROM snapshots WHERE id = ?');
      const result = stmt.run(id);
      return result.changes > 0;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to delete snapshot with id ${id}`);
    }
  }

  /**
   * Delete all snapshots for a note.
   *
   * By default, manual snapshots are protected from deletion.
   * Set force=true to delete all including manual snapshots.
   *
   * @param noteId - The note ID
   * @param force - If true, deletes all snapshots including manual ones
   * @returns Number of snapshots deleted
   */
  deleteByNoteId(noteId: string, force = false): number {
    try {
      let sql = 'DELETE FROM snapshots WHERE note_id = ?';
      const params: string[] = [noteId];

      if (!force) {
        sql += " AND trigger != 'manual'";
      }

      const stmt = this.db.prepare(sql);
      const result = stmt.run(...params);
      return result.changes;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to delete snapshots for note ${noteId}`);
    }
  }

  /**
   * Count snapshots for a note.
   *
   * @param noteId - The note ID
   * @param trigger - Optional trigger type filter
   * @returns The count of snapshots
   */
  countByNoteId(noteId: string, trigger?: SnapshotTrigger): number {
    try {
      if (trigger) {
        const stmt = this.db.prepare(
          'SELECT COUNT(*) as count FROM snapshots WHERE note_id = ? AND trigger = ?'
        );
        const result = stmt.get(noteId, trigger) as { count: number };
        return result.count;
      } else {
        const stmt = this.db.prepare('SELECT COUNT(*) as count FROM snapshots WHERE note_id = ?');
        const result = stmt.get(noteId) as { count: number };
        return result.count;
      }
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to count snapshots for note ${noteId}`);
    }
  }

  /**
   * Count total snapshots in the database.
   *
   * @returns The total count of snapshots
   */
  count(): number {
    try {
      const stmt = this.db.prepare('SELECT COUNT(*) as count FROM snapshots');
      const result = stmt.get() as { count: number };
      return result.count;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to count snapshots');
    }
  }

  /**
   * Map a database row to a Snapshot object.
   * Converts snake_case column names to camelCase properties.
   */
  private mapRow(row: SnapshotRow): Snapshot {
    return {
      id: row.id,
      noteId: row.note_id,
      title: row.title,
      content: row.content,
      createdAt: row.created_at,
      trigger: row.trigger,
    };
  }
}
