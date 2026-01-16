/**
 * LinksRepository - Type-safe CRUD operations for links table.
 *
 * Provides repository pattern implementation for managing graph edges (links)
 * between notes. Supports finding outlinks (links from a note) and backlinks
 * (links to a note).
 */

import type { Database } from 'better-sqlite3';
import type { Link, CreateLinkInput } from '../types.js';
import { wrapError } from '../errors.js';

/**
 * Raw row structure from SQLite (snake_case columns)
 */
interface LinkRow {
  id: number;
  source_id: string;
  target_id: string;
  link_text: string | null;
}

/**
 * Link with the title of the target note (for display purposes)
 */
export interface LinkWithTargetTitle extends Link {
  targetTitle: string;
}

/**
 * Link with the title of the source note (for backlinks display)
 */
export interface LinkWithSourceTitle extends Link {
  sourceTitle: string;
}

/**
 * LinksRepository - Repository for links table operations.
 *
 * Encapsulates all SQL queries for the links table and provides
 * type-safe input/output interfaces for managing note-to-note links.
 *
 * @example
 * ```typescript
 * const repo = new LinksRepository(db);
 *
 * // Create a link
 * const link = repo.create({
 *   sourceId: 'note-1',
 *   targetId: 'note-2',
 *   linkText: 'See also',
 * });
 *
 * // Get all outlinks from a note
 * const outlinks = repo.findBySourceId('note-1');
 *
 * // Get all backlinks to a note
 * const backlinks = repo.findByTargetId('note-2');
 * ```
 */
export class LinksRepository {
  constructor(private db: Database) {}

  /**
   * Create a new link (idempotent - ignores duplicates).
   *
   * If a link with the same source, target, and link_text already exists,
   * returns the existing link instead of creating a duplicate.
   *
   * @param input - Link creation data
   * @returns The created or existing link, or null if note IDs are invalid
   */
  create(input: CreateLinkInput): Link | null {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO links (source_id, target_id, link_text)
        VALUES (?, ?, ?)
      `);

      const result = stmt.run(input.sourceId, input.targetId, input.linkText ?? null);

      if (result.changes === 0) {
        // Already exists - return the existing link
        return this.findBySourceAndTarget(input.sourceId, input.targetId, input.linkText ?? null);
      }

      return this.findById(result.lastInsertRowid as number);
    } catch (error) {
      // Foreign key violation = invalid note IDs
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes('FOREIGN KEY constraint failed')) {
        return null;
      }
      throw wrapError(
        error,
        'QUERY_FAILED',
        `Failed to create link from ${input.sourceId} to ${input.targetId}`
      );
    }
  }

  /**
   * Find a link by its ID.
   *
   * @param id - The link ID
   * @returns The link if found, null otherwise
   */
  findById(id: number): Link | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM links WHERE id = ?');
      const row = stmt.get(id) as LinkRow | undefined;
      return row ? this.mapRow(row) : null;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find link with id ${id}`);
    }
  }

  /**
   * Find a link by source, target, and link_text.
   *
   * @param sourceId - The source note ID
   * @param targetId - The target note ID
   * @param linkText - The link text (or null)
   * @returns The link if found, null otherwise
   */
  findBySourceAndTarget(sourceId: string, targetId: string, linkText: string | null): Link | null {
    try {
      const stmt = this.db.prepare(`
        SELECT * FROM links
        WHERE source_id = ? AND target_id = ? AND (link_text = ? OR (link_text IS NULL AND ? IS NULL))
      `);
      const row = stmt.get(sourceId, targetId, linkText, linkText) as LinkRow | undefined;
      return row ? this.mapRow(row) : null;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find link from ${sourceId} to ${targetId}`);
    }
  }

  /**
   * Get all links FROM a note (forward links / outlinks).
   *
   * Returns links with the target note's title for display purposes.
   *
   * @param sourceId - The source note ID
   * @returns Array of links with target titles
   */
  findBySourceId(sourceId: string): LinkWithTargetTitle[] {
    try {
      const stmt = this.db.prepare(`
        SELECT l.*, n.title as target_title
        FROM links l
        JOIN notes n ON n.id = l.target_id
        WHERE l.source_id = ?
      `);
      const rows = stmt.all(sourceId) as (LinkRow & { target_title: string })[];
      return rows.map((row) => ({
        ...this.mapRow(row),
        targetTitle: row.target_title,
      }));
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find links from source ${sourceId}`);
    }
  }

  /**
   * Get all links TO a note (backlinks / inlinks).
   *
   * Returns links with the source note's title for display purposes.
   *
   * @param targetId - The target note ID
   * @returns Array of links with source titles
   */
  findByTargetId(targetId: string): LinkWithSourceTitle[] {
    try {
      const stmt = this.db.prepare(`
        SELECT l.*, n.title as source_title
        FROM links l
        JOIN notes n ON n.id = l.source_id
        WHERE l.target_id = ?
      `);
      const rows = stmt.all(targetId) as (LinkRow & { source_title: string })[];
      return rows.map((row) => ({
        ...this.mapRow(row),
        sourceTitle: row.source_title,
      }));
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find links to target ${targetId}`);
    }
  }

  /**
   * Delete all links from a source (for re-indexing).
   *
   * Useful when re-parsing a note's content to rebuild its links.
   *
   * @param sourceId - The source note ID
   * @returns Number of links deleted
   */
  deleteBySourceId(sourceId: string): number {
    try {
      const stmt = this.db.prepare('DELETE FROM links WHERE source_id = ?');
      return stmt.run(sourceId).changes;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to delete links from source ${sourceId}`);
    }
  }

  /**
   * Delete a specific link by ID.
   *
   * @param id - The link ID to delete
   * @returns true if the link was deleted, false if not found
   */
  delete(id: number): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM links WHERE id = ?');
      return stmt.run(id).changes > 0;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to delete link with id ${id}`);
    }
  }

  /**
   * Batch create links (efficient for indexing).
   *
   * Uses a transaction to efficiently insert multiple links at once.
   * Invalid links (with non-existent note IDs) are silently skipped.
   *
   * @param links - Array of link inputs to create
   * @returns Number of links successfully created
   */
  createMany(links: CreateLinkInput[]): number {
    try {
      const stmt = this.db.prepare(`
        INSERT OR IGNORE INTO links (source_id, target_id, link_text)
        VALUES (?, ?, ?)
      `);

      let created = 0;
      const insertMany = this.db.transaction((linksToInsert: CreateLinkInput[]) => {
        for (const link of linksToInsert) {
          try {
            const result = stmt.run(link.sourceId, link.targetId, link.linkText ?? null);
            created += result.changes;
          } catch {
            // Skip invalid links (foreign key violations)
          }
        }
      });

      insertMany(links);
      return created;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to batch create links');
    }
  }

  /**
   * Count total links for a note (both outlinks and backlinks).
   *
   * @param noteId - The note ID
   * @returns Object with outlink and backlink counts
   */
  countByNoteId(noteId: string): { outlinks: number; backlinks: number } {
    try {
      const outlinkStmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM links WHERE source_id = ?'
      );
      const backlinkStmt = this.db.prepare(
        'SELECT COUNT(*) as count FROM links WHERE target_id = ?'
      );

      const outlinks = (outlinkStmt.get(noteId) as { count: number }).count;
      const backlinks = (backlinkStmt.get(noteId) as { count: number }).count;

      return { outlinks, backlinks };
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to count links for note ${noteId}`);
    }
  }

  /**
   * Check if a link exists between two notes.
   *
   * @param sourceId - The source note ID
   * @param targetId - The target note ID
   * @returns true if at least one link exists
   */
  exists(sourceId: string, targetId: string): boolean {
    try {
      const stmt = this.db.prepare(
        'SELECT 1 FROM links WHERE source_id = ? AND target_id = ? LIMIT 1'
      );
      return stmt.get(sourceId, targetId) !== undefined;
    } catch (error) {
      throw wrapError(
        error,
        'QUERY_FAILED',
        `Failed to check link existence from ${sourceId} to ${targetId}`
      );
    }
  }

  /**
   * Map a database row to a Link object.
   * Converts snake_case column names to camelCase properties.
   */
  private mapRow(row: LinkRow): Link {
    return {
      id: row.id,
      sourceId: row.source_id,
      targetId: row.target_id,
      linkText: row.link_text,
    };
  }
}
