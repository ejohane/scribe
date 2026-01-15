/**
 * Tests for SQLite schema definitions.
 *
 * These tests verify:
 * 1. Schema can be applied to a fresh database (idempotent)
 * 2. All tables are created with correct structure
 * 3. Foreign key constraints work correctly (ON DELETE CASCADE)
 * 4. Indexes are created
 * 5. FTS5 virtual table is functional
 */

import Database from 'better-sqlite3';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PRAGMAS, FULL_SCHEMA, TABLE_NAMES, ALL_TABLES } from './schema.js';
import type { Note, Tag, NoteTag, Snapshot } from './types.js';

describe('SQLite Schema', () => {
  let db: Database.Database;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Apply pragmas
    const pragmaStatements = PRAGMAS.split(';').filter((s) => s.trim());
    for (const stmt of pragmaStatements) {
      if (stmt.trim()) {
        db.exec(stmt);
      }
    }
  });

  afterEach(() => {
    db.close();
  });

  describe('Schema Creation', () => {
    it('should create all tables from FULL_SCHEMA', () => {
      // Apply full schema
      db.exec(FULL_SCHEMA);

      // Verify all tables exist
      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);

      expect(tableNames).toContain(TABLE_NAMES.migrations);
      expect(tableNames).toContain(TABLE_NAMES.notes);
      expect(tableNames).toContain(TABLE_NAMES.links);
      expect(tableNames).toContain(TABLE_NAMES.tags);
      expect(tableNames).toContain(TABLE_NAMES.noteTags);
      expect(tableNames).toContain(TABLE_NAMES.yjsState);
      expect(tableNames).toContain(TABLE_NAMES.snapshots);
      // FTS5 creates multiple internal tables, check the main virtual table
      expect(tableNames).toContain(TABLE_NAMES.notesFts);
    });

    it('should be idempotent - applying schema twice should not error', () => {
      // Apply schema twice
      db.exec(FULL_SCHEMA);
      expect(() => db.exec(FULL_SCHEMA)).not.toThrow();
    });

    it('should create all tables using ALL_TABLES array', () => {
      // Apply tables one by one
      for (const tableSQL of ALL_TABLES) {
        db.exec(tableSQL);
      }

      const tables = db
        .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
        .all() as { name: string }[];

      expect(tables.length).toBeGreaterThanOrEqual(8);
    });

    it('should create all indexes using ALL_INDEXES array', () => {
      // First create tables
      db.exec(FULL_SCHEMA);

      // Verify indexes exist
      const indexes = db
        .prepare("SELECT name FROM sqlite_master WHERE type='index' AND name LIKE 'idx_%'")
        .all() as { name: string }[];

      expect(indexes).toContainEqual({ name: 'idx_notes_type' });
      expect(indexes).toContainEqual({ name: 'idx_notes_date' });
      expect(indexes).toContainEqual({ name: 'idx_notes_updated_at' });
      expect(indexes).toContainEqual({ name: 'idx_links_source' });
      expect(indexes).toContainEqual({ name: 'idx_links_target' });
      expect(indexes).toContainEqual({ name: 'idx_note_tags_tag' });
      expect(indexes).toContainEqual({ name: 'idx_snapshots_note' });
      expect(indexes).toContainEqual({ name: 'idx_snapshots_created' });
    });
  });

  describe('Notes Table', () => {
    beforeEach(() => {
      db.exec(FULL_SCHEMA);
    });

    it('should insert and retrieve a note', () => {
      const note: Omit<Note, 'id'> & { id: string } = {
        id: 'note-001',
        title: 'Test Note',
        type: 'note',
        date: null,
        createdAt: '2024-01-01T00:00:00Z',
        updatedAt: '2024-01-01T00:00:00Z',
        wordCount: 100,
        filePath: '/notes/test.json',
        contentHash: 'abc123',
      };

      db.prepare(
        `
        INSERT INTO notes (id, title, type, date, created_at, updated_at, word_count, file_path, content_hash)
        VALUES (@id, @title, @type, @date, @createdAt, @updatedAt, @wordCount, @filePath, @contentHash)
      `
      ).run(note);

      const result = db.prepare('SELECT * FROM notes WHERE id = ?').get('note-001') as Record<
        string,
        unknown
      >;

      expect(result).toBeDefined();
      expect(result.id).toBe('note-001');
      expect(result.title).toBe('Test Note');
      expect(result.type).toBe('note');
    });

    it('should enforce type CHECK constraint', () => {
      expect(() => {
        db.prepare(
          `
          INSERT INTO notes (id, title, type, created_at, updated_at, file_path)
          VALUES ('note-002', 'Test', 'invalid_type', '2024-01-01', '2024-01-01', '/test.json')
        `
        ).run();
      }).toThrow();
    });

    it('should enforce unique file_path constraint', () => {
      db.prepare(
        `
        INSERT INTO notes (id, title, type, created_at, updated_at, file_path)
        VALUES ('note-001', 'Test 1', 'note', '2024-01-01', '2024-01-01', '/test.json')
      `
      ).run();

      expect(() => {
        db.prepare(
          `
          INSERT INTO notes (id, title, type, created_at, updated_at, file_path)
          VALUES ('note-002', 'Test 2', 'note', '2024-01-01', '2024-01-01', '/test.json')
        `
        ).run();
      }).toThrow();
    });

    it('should allow all valid note types', () => {
      const types = ['note', 'daily', 'meeting', 'person'];

      for (const type of types) {
        db.prepare(
          `
          INSERT INTO notes (id, title, type, created_at, updated_at, file_path)
          VALUES (?, ?, ?, '2024-01-01', '2024-01-01', ?)
        `
        ).run(`note-${type}`, `Test ${type}`, type, `/test-${type}.json`);
      }

      const count = db.prepare('SELECT COUNT(*) as count FROM notes').get() as { count: number };
      expect(count.count).toBe(4);
    });
  });

  describe('Links Table - Foreign Keys', () => {
    beforeEach(() => {
      db.exec(FULL_SCHEMA);

      // Create two notes for linking
      db.prepare(
        `
        INSERT INTO notes (id, title, type, created_at, updated_at, file_path)
        VALUES ('note-a', 'Note A', 'note', '2024-01-01', '2024-01-01', '/a.json')
      `
      ).run();
      db.prepare(
        `
        INSERT INTO notes (id, title, type, created_at, updated_at, file_path)
        VALUES ('note-b', 'Note B', 'note', '2024-01-01', '2024-01-01', '/b.json')
      `
      ).run();
    });

    it('should create links between notes', () => {
      db.prepare(
        `
        INSERT INTO links (source_id, target_id, link_text)
        VALUES ('note-a', 'note-b', 'Related to')
      `
      ).run();

      const link = db.prepare('SELECT * FROM links WHERE source_id = ?').get('note-a') as Record<
        string,
        unknown
      >;
      expect(link).toBeDefined();
      expect(link.target_id).toBe('note-b');
      expect(link.link_text).toBe('Related to');
    });

    it('should enforce ON DELETE CASCADE for source note', () => {
      db.prepare(
        `
        INSERT INTO links (source_id, target_id, link_text)
        VALUES ('note-a', 'note-b', 'Related to')
      `
      ).run();

      // Delete source note
      db.prepare('DELETE FROM notes WHERE id = ?').run('note-a');

      // Link should be deleted
      const link = db.prepare('SELECT * FROM links WHERE source_id = ?').get('note-a');
      expect(link).toBeUndefined();
    });

    it('should enforce ON DELETE CASCADE for target note', () => {
      db.prepare(
        `
        INSERT INTO links (source_id, target_id, link_text)
        VALUES ('note-a', 'note-b', 'Related to')
      `
      ).run();

      // Delete target note
      db.prepare('DELETE FROM notes WHERE id = ?').run('note-b');

      // Link should be deleted
      const link = db.prepare('SELECT * FROM links WHERE target_id = ?').get('note-b');
      expect(link).toBeUndefined();
    });

    it('should enforce unique constraint on source_id, target_id, link_text', () => {
      db.prepare(
        `
        INSERT INTO links (source_id, target_id, link_text)
        VALUES ('note-a', 'note-b', 'Related to')
      `
      ).run();

      // Same link should fail
      expect(() => {
        db.prepare(
          `
          INSERT INTO links (source_id, target_id, link_text)
          VALUES ('note-a', 'note-b', 'Related to')
        `
        ).run();
      }).toThrow();

      // Different link_text should succeed
      expect(() => {
        db.prepare(
          `
          INSERT INTO links (source_id, target_id, link_text)
          VALUES ('note-a', 'note-b', 'See also')
        `
        ).run();
      }).not.toThrow();
    });
  });

  describe('Tags Table', () => {
    beforeEach(() => {
      db.exec(FULL_SCHEMA);
    });

    it('should create and retrieve tags', () => {
      db.prepare('INSERT INTO tags (name) VALUES (?)').run('javascript');
      db.prepare('INSERT INTO tags (name) VALUES (?)').run('typescript');

      const tags = db.prepare('SELECT * FROM tags').all() as Tag[];
      expect(tags).toHaveLength(2);
      expect(tags.map((t) => t.name)).toContain('javascript');
      expect(tags.map((t) => t.name)).toContain('typescript');
    });

    it('should enforce unique tag names', () => {
      db.prepare('INSERT INTO tags (name) VALUES (?)').run('javascript');

      expect(() => {
        db.prepare('INSERT INTO tags (name) VALUES (?)').run('javascript');
      }).toThrow();
    });
  });

  describe('Note Tags Junction Table', () => {
    beforeEach(() => {
      db.exec(FULL_SCHEMA);

      // Create a note
      db.prepare(
        `
        INSERT INTO notes (id, title, type, created_at, updated_at, file_path)
        VALUES ('note-1', 'Test Note', 'note', '2024-01-01', '2024-01-01', '/test.json')
      `
      ).run();

      // Create tags
      db.prepare('INSERT INTO tags (id, name) VALUES (1, ?)').run('tag1');
      db.prepare('INSERT INTO tags (id, name) VALUES (2, ?)').run('tag2');
    });

    it('should create note-tag associations', () => {
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('note-1', 1);
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('note-1', 2);

      const noteTags = db
        .prepare('SELECT * FROM note_tags WHERE note_id = ?')
        .all('note-1') as NoteTag[];
      expect(noteTags).toHaveLength(2);
    });

    it('should cascade delete note-tags when note is deleted', () => {
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('note-1', 1);

      // Delete note
      db.prepare('DELETE FROM notes WHERE id = ?').run('note-1');

      // Note-tags should be deleted
      const noteTags = db.prepare('SELECT * FROM note_tags WHERE note_id = ?').all('note-1');
      expect(noteTags).toHaveLength(0);
    });

    it('should cascade delete note-tags when tag is deleted', () => {
      db.prepare('INSERT INTO note_tags (note_id, tag_id) VALUES (?, ?)').run('note-1', 1);

      // Delete tag
      db.prepare('DELETE FROM tags WHERE id = ?').run(1);

      // Note-tags should be deleted
      const noteTags = db.prepare('SELECT * FROM note_tags WHERE tag_id = ?').all(1);
      expect(noteTags).toHaveLength(0);
    });
  });

  describe('FTS5 Virtual Table', () => {
    beforeEach(() => {
      db.exec(FULL_SCHEMA);
    });

    it('should insert and search using FTS5', () => {
      // Insert into FTS table
      db.prepare(
        `
        INSERT INTO notes_fts (title, content, tags, note_id)
        VALUES ('JavaScript Tutorial', 'Learn about functions and variables in JavaScript', 'programming javascript', 'note-001')
      `
      ).run();

      // Search using FTS
      const results = db
        .prepare(`SELECT * FROM notes_fts WHERE notes_fts MATCH 'JavaScript'`)
        .all() as { title: string; content: string; note_id: string }[];

      expect(results).toHaveLength(1);
      expect(results[0].note_id).toBe('note-001');
    });

    it('should support porter stemming', () => {
      db.prepare(
        `
        INSERT INTO notes_fts (title, content, tags, note_id)
        VALUES ('Running Guide', 'Learn how to run efficiently', 'fitness', 'note-001')
      `
      ).run();

      // Search for 'running' should match 'run' due to porter stemming
      const results = db.prepare(`SELECT * FROM notes_fts WHERE notes_fts MATCH 'runs'`).all();

      expect(results).toHaveLength(1);
    });

    it('should support multiple search terms', () => {
      db.prepare(
        `
        INSERT INTO notes_fts (title, content, tags, note_id)
        VALUES ('JavaScript Functions', 'Learn about arrow functions', 'programming', 'note-001')
      `
      ).run();
      db.prepare(
        `
        INSERT INTO notes_fts (title, content, tags, note_id)
        VALUES ('Python Functions', 'Learn about Python functions', 'programming', 'note-002')
      `
      ).run();

      // Search for both terms
      const results = db
        .prepare(`SELECT * FROM notes_fts WHERE notes_fts MATCH 'JavaScript AND functions'`)
        .all();

      expect(results).toHaveLength(1);
    });
  });

  describe('Yjs State Table', () => {
    beforeEach(() => {
      db.exec(FULL_SCHEMA);

      // Create a note
      db.prepare(
        `
        INSERT INTO notes (id, title, type, created_at, updated_at, file_path)
        VALUES ('note-1', 'Test Note', 'note', '2024-01-01', '2024-01-01', '/test.json')
      `
      ).run();
    });

    it('should store and retrieve Yjs state as BLOB', () => {
      const state = Buffer.from([1, 2, 3, 4, 5]);

      db.prepare(
        `
        INSERT INTO yjs_state (note_id, state, updated_at)
        VALUES (?, ?, ?)
      `
      ).run('note-1', state, '2024-01-01T00:00:00Z');

      const result = db.prepare('SELECT * FROM yjs_state WHERE note_id = ?').get('note-1') as {
        note_id: string;
        state: Buffer;
        updated_at: string;
      };

      expect(result).toBeDefined();
      expect(Buffer.isBuffer(result.state)).toBe(true);
      expect(result.state).toEqual(state);
    });

    it('should cascade delete when note is deleted', () => {
      const state = Buffer.from([1, 2, 3]);
      db.prepare(
        `
        INSERT INTO yjs_state (note_id, state, updated_at)
        VALUES (?, ?, ?)
      `
      ).run('note-1', state, '2024-01-01T00:00:00Z');

      // Delete note
      db.prepare('DELETE FROM notes WHERE id = ?').run('note-1');

      // Yjs state should be deleted
      const result = db.prepare('SELECT * FROM yjs_state WHERE note_id = ?').get('note-1');
      expect(result).toBeUndefined();
    });
  });

  describe('Snapshots Table', () => {
    beforeEach(() => {
      db.exec(FULL_SCHEMA);

      // Create a note
      db.prepare(
        `
        INSERT INTO notes (id, title, type, created_at, updated_at, file_path)
        VALUES ('note-1', 'Test Note', 'note', '2024-01-01', '2024-01-01', '/test.json')
      `
      ).run();
    });

    it('should create snapshots with different triggers', () => {
      const triggers = ['manual', 'auto', 'pre_edit'];

      for (const trigger of triggers) {
        db.prepare(
          `
          INSERT INTO snapshots (note_id, title, content, created_at, trigger)
          VALUES (?, ?, ?, ?, ?)
        `
        ).run('note-1', 'Test Note', '{"content": "test"}', '2024-01-01T00:00:00Z', trigger);
      }

      const snapshots = db.prepare('SELECT * FROM snapshots').all() as Snapshot[];
      expect(snapshots).toHaveLength(3);
    });

    it('should enforce trigger CHECK constraint', () => {
      expect(() => {
        db.prepare(
          `
          INSERT INTO snapshots (note_id, title, content, created_at, trigger)
          VALUES (?, ?, ?, ?, ?)
        `
        ).run('note-1', 'Test', '{}', '2024-01-01', 'invalid_trigger');
      }).toThrow();
    });

    it('should cascade delete when note is deleted', () => {
      db.prepare(
        `
        INSERT INTO snapshots (note_id, title, content, created_at, trigger)
        VALUES (?, ?, ?, ?, ?)
      `
      ).run('note-1', 'Test', '{}', '2024-01-01', 'manual');

      // Delete note
      db.prepare('DELETE FROM notes WHERE id = ?').run('note-1');

      // Snapshots should be deleted
      const snapshots = db.prepare('SELECT * FROM snapshots WHERE note_id = ?').all('note-1');
      expect(snapshots).toHaveLength(0);
    });
  });

  describe('Migrations Table', () => {
    beforeEach(() => {
      db.exec(FULL_SCHEMA);
    });

    it('should track applied migrations', () => {
      db.prepare(
        `
        INSERT INTO _migrations (id, name)
        VALUES (1, '001_initial')
      `
      ).run();

      const migrations = db.prepare('SELECT * FROM _migrations').all() as {
        id: number;
        name: string;
        applied_at: string;
      }[];

      expect(migrations).toHaveLength(1);
      expect(migrations[0].name).toBe('001_initial');
      expect(migrations[0].applied_at).toBeDefined();
    });

    it('should enforce unique migration names', () => {
      db.prepare(
        `
        INSERT INTO _migrations (id, name)
        VALUES (1, '001_initial')
      `
      ).run();

      expect(() => {
        db.prepare(
          `
          INSERT INTO _migrations (id, name)
          VALUES (2, '001_initial')
        `
        ).run();
      }).toThrow();
    });
  });
});
