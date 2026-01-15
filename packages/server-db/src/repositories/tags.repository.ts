/**
 * TagsRepository - Type-safe CRUD operations for tags and note_tags tables.
 *
 * Provides repository pattern implementation for managing tags and their
 * associations with notes. Tags are normalized (lowercase) and stored
 * in a many-to-many relationship with notes.
 */

import type { Database } from 'better-sqlite3';
import type { Tag, Note, NoteType } from '../types.js';
import { wrapError } from '../errors.js';

/**
 * Raw row structure from SQLite for tags table
 */
interface TagRow {
  id: number;
  name: string;
}

/**
 * Raw row structure for notes table (used when querying notes by tag)
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
}

/**
 * Tag with usage count for listing purposes
 */
export interface TagWithCount extends Tag {
  count: number;
}

/**
 * TagsRepository - Repository for tags and note_tags table operations.
 *
 * Encapsulates all SQL queries for managing tags and their note associations.
 * Tags are normalized to lowercase for consistent storage and querying.
 *
 * @example
 * ```typescript
 * const repo = new TagsRepository(db);
 *
 * // Find or create a tag
 * const tag = repo.findOrCreate('JavaScript');  // Stored as 'javascript'
 *
 * // Set tags for a note (replaces existing)
 * repo.setNoteTags('note-1', ['javascript', 'typescript']);
 *
 * // Get all tags for a note
 * const tags = repo.findByNoteId('note-1');
 *
 * // Get all notes with a tag
 * const notes = repo.findNotesByTagName('javascript');
 * ```
 */
export class TagsRepository {
  constructor(private db: Database) {}

  /**
   * Find or create a tag by name (normalized to lowercase).
   *
   * This is idempotent - calling it multiple times with the same name
   * will always return the same tag.
   *
   * @param name - The tag name (will be normalized)
   * @returns The existing or newly created tag
   */
  findOrCreate(name: string): Tag {
    const normalized = name.toLowerCase().trim();

    try {
      const existing = this.db.prepare('SELECT * FROM tags WHERE name = ?').get(normalized) as
        | TagRow
        | undefined;

      if (existing) {
        return this.mapTagRow(existing);
      }

      const result = this.db.prepare('INSERT INTO tags (name) VALUES (?)').run(normalized);

      return { id: result.lastInsertRowid as number, name: normalized };
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find or create tag "${name}"`);
    }
  }

  /**
   * Find a tag by its ID.
   *
   * @param id - The tag ID
   * @returns The tag if found, null otherwise
   */
  findById(id: number): Tag | null {
    try {
      const stmt = this.db.prepare('SELECT * FROM tags WHERE id = ?');
      const row = stmt.get(id) as TagRow | undefined;
      return row ? this.mapTagRow(row) : null;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find tag with id ${id}`);
    }
  }

  /**
   * Find a tag by name (normalized to lowercase).
   *
   * @param name - The tag name
   * @returns The tag if found, null otherwise
   */
  findByName(name: string): Tag | null {
    const normalized = name.toLowerCase().trim();

    try {
      const stmt = this.db.prepare('SELECT * FROM tags WHERE name = ?');
      const row = stmt.get(normalized) as TagRow | undefined;
      return row ? this.mapTagRow(row) : null;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find tag "${name}"`);
    }
  }

  /**
   * Get all tags for a note.
   *
   * @param noteId - The note ID
   * @returns Array of tags ordered by name
   */
  findByNoteId(noteId: string): Tag[] {
    try {
      const stmt = this.db.prepare(`
        SELECT t.* FROM tags t
        JOIN note_tags nt ON nt.tag_id = t.id
        WHERE nt.note_id = ?
        ORDER BY t.name
      `);
      const rows = stmt.all(noteId) as TagRow[];
      return rows.map((row) => this.mapTagRow(row));
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find tags for note ${noteId}`);
    }
  }

  /**
   * Get all notes with a specific tag.
   *
   * @param tagName - The tag name (will be normalized)
   * @returns Array of notes ordered by updated_at descending
   */
  findNotesByTagName(tagName: string): Note[] {
    const normalized = tagName.toLowerCase().trim();

    try {
      const stmt = this.db.prepare(`
        SELECT n.* FROM notes n
        JOIN note_tags nt ON nt.note_id = n.id
        JOIN tags t ON t.id = nt.tag_id
        WHERE t.name = ?
        ORDER BY n.updated_at DESC
      `);
      const rows = stmt.all(normalized) as NoteRow[];
      return rows.map((row) => this.mapNoteRow(row));
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to find notes with tag "${tagName}"`);
    }
  }

  /**
   * Set tags for a note (replaces all existing tags).
   *
   * This is the primary method for managing note-tag associations.
   * It removes all existing tags for the note and adds the new ones.
   * Duplicate tag names (after normalization) are handled gracefully.
   *
   * @param noteId - The note ID
   * @param tagNames - Array of tag names (will be normalized)
   */
  setNoteTags(noteId: string, tagNames: string[]): void {
    try {
      // Deduplicate tag names after normalization
      const normalizedNames = [...new Set(tagNames.map((name) => name.toLowerCase().trim()))];

      const setTags = this.db.transaction(() => {
        // Remove existing tags for this note
        this.db.prepare('DELETE FROM note_tags WHERE note_id = ?').run(noteId);

        // Add new tags
        const insertStmt = this.db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)');

        for (const name of normalizedNames) {
          const tag = this.findOrCreate(name);
          insertStmt.run(noteId, tag.id);
        }
      });

      setTags();
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to set tags for note ${noteId}`);
    }
  }

  /**
   * Add a single tag to a note (does not remove existing tags).
   *
   * @param noteId - The note ID
   * @param tagName - The tag name to add
   * @returns true if the tag was added, false if it already existed
   */
  addTagToNote(noteId: string, tagName: string): boolean {
    try {
      const tag = this.findOrCreate(tagName);
      const stmt = this.db.prepare(
        'INSERT OR IGNORE INTO note_tags (note_id, tag_id) VALUES (?, ?)'
      );
      return stmt.run(noteId, tag.id).changes > 0;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to add tag "${tagName}" to note ${noteId}`);
    }
  }

  /**
   * Remove a single tag from a note.
   *
   * @param noteId - The note ID
   * @param tagName - The tag name to remove
   * @returns true if the tag was removed, false if it wasn't associated
   */
  removeTagFromNote(noteId: string, tagName: string): boolean {
    const normalized = tagName.toLowerCase().trim();

    try {
      const stmt = this.db.prepare(`
        DELETE FROM note_tags
        WHERE note_id = ? AND tag_id = (SELECT id FROM tags WHERE name = ?)
      `);
      return stmt.run(noteId, normalized).changes > 0;
    } catch (error) {
      throw wrapError(
        error,
        'QUERY_FAILED',
        `Failed to remove tag "${tagName}" from note ${noteId}`
      );
    }
  }

  /**
   * Get all tags with their usage counts.
   *
   * @returns Array of tags with counts, ordered by count descending, then name ascending
   */
  findAllWithCounts(): TagWithCount[] {
    try {
      const stmt = this.db.prepare(`
        SELECT t.*, COUNT(nt.note_id) as count
        FROM tags t
        LEFT JOIN note_tags nt ON nt.tag_id = t.id
        GROUP BY t.id
        ORDER BY count DESC, t.name ASC
      `);
      const rows = stmt.all() as (TagRow & { count: number })[];
      return rows.map((row) => ({
        ...this.mapTagRow(row),
        count: row.count,
      }));
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to get all tags with counts');
    }
  }

  /**
   * Get all tags (without counts).
   *
   * @returns Array of all tags ordered by name
   */
  findAll(): Tag[] {
    try {
      const stmt = this.db.prepare('SELECT * FROM tags ORDER BY name');
      const rows = stmt.all() as TagRow[];
      return rows.map((row) => this.mapTagRow(row));
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to get all tags');
    }
  }

  /**
   * Delete a tag by ID.
   *
   * Note: This will also remove all note-tag associations due to CASCADE.
   *
   * @param id - The tag ID
   * @returns true if deleted, false if not found
   */
  delete(id: number): boolean {
    try {
      const stmt = this.db.prepare('DELETE FROM tags WHERE id = ?');
      return stmt.run(id).changes > 0;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to delete tag with id ${id}`);
    }
  }

  /**
   * Delete unused tags (tags with no associated notes).
   *
   * Useful for cleanup after bulk note deletions.
   *
   * @returns Number of tags deleted
   */
  deleteUnused(): number {
    try {
      const stmt = this.db.prepare(`
        DELETE FROM tags
        WHERE id NOT IN (SELECT DISTINCT tag_id FROM note_tags)
      `);
      return stmt.run().changes;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', 'Failed to delete unused tags');
    }
  }

  /**
   * Count the number of notes with a specific tag.
   *
   * @param tagName - The tag name
   * @returns The count of notes with this tag
   */
  countNotesByTagName(tagName: string): number {
    const normalized = tagName.toLowerCase().trim();

    try {
      const stmt = this.db.prepare(`
        SELECT COUNT(*) as count
        FROM note_tags nt
        JOIN tags t ON t.id = nt.tag_id
        WHERE t.name = ?
      `);
      return (stmt.get(normalized) as { count: number }).count;
    } catch (error) {
      throw wrapError(error, 'QUERY_FAILED', `Failed to count notes with tag "${tagName}"`);
    }
  }

  /**
   * Map a database row to a Tag object.
   */
  private mapTagRow(row: TagRow): Tag {
    return {
      id: row.id,
      name: row.name,
    };
  }

  /**
   * Map a database row to a Note object.
   * Converts snake_case column names to camelCase properties.
   */
  private mapNoteRow(row: NoteRow): Note {
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
