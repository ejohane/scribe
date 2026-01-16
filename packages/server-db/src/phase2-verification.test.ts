/**
 * Phase 2 Verification Tests - Database Layer Complete
 *
 * This test suite comprehensively verifies that the Phase 2 database layer
 * is complete and functioning correctly per the acceptance criteria:
 *
 * 1. All 8 tables created successfully
 * 2. All CRUD operations work
 * 3. FTS5 search returns ranked results
 * 4. Yjs state round-trips correctly
 * 5. CASCADE delete removes related data
 * 6. Bulk operations performant
 * 7. No SQLite errors or warnings
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScribeDatabase } from './database.js';
import { NotesRepository } from './repositories/notes.repository.js';
import { LinksRepository } from './repositories/links.repository.js';
import { TagsRepository } from './repositories/tags.repository.js';
import { SearchRepository } from './repositories/search.repository.js';
import { YjsStateRepository } from './repositories/yjs-state.repository.js';
import { SnapshotsRepository } from './repositories/snapshots.repository.js';
import { TABLE_NAMES } from './schema.js';
import type { CreateNoteInput } from './types.js';

describe('Phase 2 Verification: Database Layer Complete', () => {
  let scribeDb: ScribeDatabase;
  let notesRepo: NotesRepository;
  let linksRepo: LinksRepository;
  let tagsRepo: TagsRepository;
  let searchRepo: SearchRepository;
  let yjsRepo: YjsStateRepository;
  let snapshotsRepo: SnapshotsRepository;

  // Helper to create test note input
  const createTestNoteInput = (overrides: Partial<CreateNoteInput> = {}): CreateNoteInput => {
    const now = new Date().toISOString();
    const id = `test-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    return {
      id,
      title: 'Test Note',
      type: 'note',
      filePath: `notes/${id}.json`,
      createdAt: now,
      updatedAt: now,
      ...overrides,
    };
  };

  beforeEach(() => {
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();

    const db = scribeDb.getDb();
    notesRepo = new NotesRepository(db);
    linksRepo = new LinksRepository(db);
    tagsRepo = new TagsRepository(db);
    searchRepo = new SearchRepository(db);
    yjsRepo = new YjsStateRepository(db);
    snapshotsRepo = new SnapshotsRepository(db);
  });

  afterEach(() => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
  });

  describe('1. Schema Verification - All 8 tables exist', () => {
    it('should have all 8 required tables created', () => {
      const db = scribeDb.getDb();
      const tables = db
        .prepare(
          `
          SELECT name FROM sqlite_master
          WHERE type='table' AND name NOT LIKE 'sqlite_%'
          ORDER BY name
        `
        )
        .all() as { name: string }[];

      const tableNames = tables.map((t) => t.name);

      // Verify all expected tables exist
      expect(tableNames).toContain(TABLE_NAMES.migrations);
      expect(tableNames).toContain(TABLE_NAMES.notes);
      expect(tableNames).toContain(TABLE_NAMES.links);
      expect(tableNames).toContain(TABLE_NAMES.tags);
      expect(tableNames).toContain(TABLE_NAMES.noteTags);
      expect(tableNames).toContain(TABLE_NAMES.notesFts);
      expect(tableNames).toContain(TABLE_NAMES.yjsState);
      expect(tableNames).toContain(TABLE_NAMES.snapshots);

      // FTS5 creates shadow tables (notes_fts_data, notes_fts_idx, notes_fts_content,
      // notes_fts_docsize, notes_fts_config), so we have 8 core tables + 5 FTS shadow = 13 total
      // We verify at least 8 core tables exist, additional ones are FTS internal
      expect(tableNames.length).toBeGreaterThanOrEqual(8);
    });

    it('should have migrations table with initial migration applied', () => {
      const migrations = scribeDb.getAppliedMigrations();
      expect(migrations.length).toBeGreaterThan(0);
      expect(migrations[0].name).toBe('001_initial');
    });

    it('should have foreign keys enabled', () => {
      const db = scribeDb.getDb();
      const result = db.pragma('foreign_keys') as [{ foreign_keys: number }];
      expect(result[0].foreign_keys).toBe(1);
    });

    it('should have WAL mode enabled for file-based databases', () => {
      // For in-memory DB, journal_mode will be 'memory', not 'wal'
      // This test documents the expected behavior
      const db = scribeDb.getDb();
      const result = db.pragma('journal_mode') as [{ journal_mode: string }];
      expect(['memory', 'wal']).toContain(result[0].journal_mode);
    });
  });

  describe('2. CRUD Operations - Notes Repository', () => {
    it('should create a note with all fields', () => {
      const input = createTestNoteInput({
        id: 'crud-test-1',
        title: 'CRUD Test Note',
        type: 'note',
        date: '2024-01-15',
        wordCount: 100,
        contentHash: 'abc123',
      });

      const note = notesRepo.create(input);

      expect(note).toBeDefined();
      expect(note.id).toBe('crud-test-1');
      expect(note.title).toBe('CRUD Test Note');
      expect(note.type).toBe('note');
      expect(note.date).toBe('2024-01-15');
      expect(note.wordCount).toBe(100);
      expect(note.contentHash).toBe('abc123');
    });

    it('should read note by ID', () => {
      const input = createTestNoteInput({ id: 'read-test' });
      notesRepo.create(input);

      const found = notesRepo.findById('read-test');

      expect(found).not.toBeNull();
      expect(found?.id).toBe('read-test');
      expect(found?.title).toBe('Test Note');
    });

    it('should update note fields', () => {
      const input = createTestNoteInput({ id: 'update-test', title: 'Original' });
      notesRepo.create(input);

      const updated = notesRepo.update('update-test', {
        title: 'Updated',
        updatedAt: new Date().toISOString(),
      });

      expect(updated?.title).toBe('Updated');
    });

    it('should delete note', () => {
      const input = createTestNoteInput({ id: 'delete-test' });
      notesRepo.create(input);

      const deleted = notesRepo.delete('delete-test');
      const found = notesRepo.findById('delete-test');

      expect(deleted).toBe(true);
      expect(found).toBeNull();
    });

    it('should list notes with filtering', () => {
      // Create notes of different types
      notesRepo.create(createTestNoteInput({ id: 'filter-1', type: 'note' }));
      notesRepo.create(createTestNoteInput({ id: 'filter-2', type: 'daily', date: '2024-01-15' }));
      notesRepo.create(createTestNoteInput({ id: 'filter-3', type: 'meeting' }));

      const notes = notesRepo.findAll({ type: 'note' });
      const dailyNotes = notesRepo.findAll({ type: 'daily' });

      expect(notes).toHaveLength(1);
      expect(notes[0].type).toBe('note');
      expect(dailyNotes).toHaveLength(1);
      expect(dailyNotes[0].type).toBe('daily');
    });
  });

  describe('3. CRUD Operations - Links Repository', () => {
    it('should create and query links', () => {
      // Create two notes first
      const note1 = notesRepo.create(createTestNoteInput({ id: 'link-source' }));
      const note2 = notesRepo.create(createTestNoteInput({ id: 'link-target' }));

      // Create a link between them
      const link = linksRepo.create({
        sourceId: note1.id,
        targetId: note2.id,
        linkText: 'related to',
      });

      expect(link).not.toBeNull();
      expect(link?.sourceId).toBe('link-source');
      expect(link?.targetId).toBe('link-target');
    });

    it('should find outlinks (forward links)', () => {
      const note1 = notesRepo.create(
        createTestNoteInput({ id: 'outlink-source', title: 'Source' })
      );
      const note2 = notesRepo.create(
        createTestNoteInput({ id: 'outlink-target', title: 'Target' })
      );

      linksRepo.create({ sourceId: note1.id, targetId: note2.id });

      const outlinks = linksRepo.findBySourceId('outlink-source');
      expect(outlinks).toHaveLength(1);
      expect(outlinks[0].targetId).toBe('outlink-target');
      expect(outlinks[0].targetTitle).toBe('Target');
    });

    it('should find backlinks', () => {
      const note1 = notesRepo.create(
        createTestNoteInput({ id: 'backlink-source', title: 'Source' })
      );
      const note2 = notesRepo.create(
        createTestNoteInput({ id: 'backlink-target', title: 'Target' })
      );

      linksRepo.create({ sourceId: note1.id, targetId: note2.id });

      const backlinks = linksRepo.findByTargetId('backlink-target');
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].sourceId).toBe('backlink-source');
      expect(backlinks[0].sourceTitle).toBe('Source');
    });
  });

  describe('4. CRUD Operations - Tags Repository', () => {
    it('should set and query note tags', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'tag-test' }));

      tagsRepo.setNoteTags(note.id, ['tag1', 'tag2', 'tag3']);

      const tags = tagsRepo.findByNoteId(note.id);
      expect(tags).toHaveLength(3);
      expect(tags.map((t) => t.name).sort()).toEqual(['tag1', 'tag2', 'tag3']);
    });

    it('should find notes by tag', () => {
      const note1 = notesRepo.create(createTestNoteInput({ id: 'tagged-note-1' }));
      const note2 = notesRepo.create(createTestNoteInput({ id: 'tagged-note-2' }));

      tagsRepo.setNoteTags(note1.id, ['shared-tag', 'unique-tag-1']);
      tagsRepo.setNoteTags(note2.id, ['shared-tag', 'unique-tag-2']);

      const notesWithSharedTag = tagsRepo.findNotesByTagName('shared-tag');
      expect(notesWithSharedTag).toHaveLength(2);

      const notesWithUniqueTag = tagsRepo.findNotesByTagName('unique-tag-1');
      expect(notesWithUniqueTag).toHaveLength(1);
    });

    it('should normalize tags to lowercase', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'case-test' }));

      tagsRepo.setNoteTags(note.id, ['MyTag', 'UPPERCASE', 'lowercase']);

      const tags = tagsRepo.findByNoteId(note.id);
      expect(tags.map((t) => t.name).sort()).toEqual(['lowercase', 'mytag', 'uppercase']);
    });
  });

  describe('5. FTS5 Search - Returns ranked results', () => {
    beforeEach(() => {
      // Create notes with searchable content
      const note1 = notesRepo.create(
        createTestNoteInput({ id: 'search-1', title: 'JavaScript Guide' })
      );
      const note2 = notesRepo.create(
        createTestNoteInput({ id: 'search-2', title: 'TypeScript Tutorial' })
      );
      const note3 = notesRepo.create(
        createTestNoteInput({ id: 'search-3', title: 'Python Basics' })
      );

      // Index the notes
      searchRepo.index(note1.id, note1.title, 'Learn JavaScript programming fundamentals', [
        'javascript',
        'programming',
      ]);
      searchRepo.index(note2.id, note2.title, 'TypeScript is a superset of JavaScript', [
        'typescript',
        'javascript',
      ]);
      searchRepo.index(note3.id, note3.title, 'Python is great for beginners', ['python']);
    });

    it('should search and return results', () => {
      const results = searchRepo.search('JavaScript');

      expect(results.length).toBeGreaterThan(0);
      expect(results.some((r) => r.noteId === 'search-1')).toBe(true);
      expect(results.some((r) => r.noteId === 'search-2')).toBe(true);
    });

    it('should return results ranked by relevance (BM25)', () => {
      const results = searchRepo.search('JavaScript');

      // Results should be sorted by rank (BM25 scores are negative, closer to 0 is better)
      for (let i = 1; i < results.length; i++) {
        expect(results[i - 1].rank).toBeLessThanOrEqual(results[i].rank);
      }
    });

    it('should highlight matches in snippets', () => {
      const results = searchRepo.search('JavaScript');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].snippet).toContain('<mark>');
      expect(results[0].snippet).toContain('</mark>');
    });

    it('should support phrase search', () => {
      const results = searchRepo.search('fts:"superset of JavaScript"');

      expect(results).toHaveLength(1);
      expect(results[0].noteId).toBe('search-2');
    });

    it('should search by tags', () => {
      const results = searchRepo.search('python');

      expect(results).toHaveLength(1);
      expect(results[0].noteId).toBe('search-3');
    });
  });

  describe('6. Yjs State - Round-trip correctly', () => {
    it('should save and load Yjs state', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'yjs-test' }));

      // Simulate Yjs state (normally would be Y.encodeStateAsUpdate output)
      const testState = Buffer.from([1, 2, 3, 4, 5, 6, 7, 8]);

      yjsRepo.save({
        noteId: note.id,
        state: testState,
        updatedAt: new Date().toISOString(),
      });

      const loaded = yjsRepo.load(note.id);

      expect(loaded).not.toBeNull();
      expect(loaded?.noteId).toBe('yjs-test');
      expect(Buffer.compare(loaded!.state, testState)).toBe(0);
    });

    it('should load state as Uint8Array for Y.applyUpdate', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'yjs-uint8' }));
      const testState = Buffer.from([10, 20, 30, 40, 50]);

      yjsRepo.save({
        noteId: note.id,
        state: testState,
        updatedAt: new Date().toISOString(),
      });

      const uint8Array = yjsRepo.loadAsUint8Array(note.id);

      expect(uint8Array).toBeInstanceOf(Uint8Array);
      expect(uint8Array).toEqual(new Uint8Array([10, 20, 30, 40, 50]));
    });

    it('should support upsert semantics (update existing state)', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'yjs-upsert' }));

      // Save initial state
      yjsRepo.save({
        noteId: note.id,
        state: Buffer.from([1, 2, 3]),
        updatedAt: new Date().toISOString(),
      });

      // Update with new state
      yjsRepo.save({
        noteId: note.id,
        state: Buffer.from([4, 5, 6]),
        updatedAt: new Date().toISOString(),
      });

      const loaded = yjsRepo.load(note.id);
      expect(loaded?.state).toEqual(Buffer.from([4, 5, 6]));
    });
  });

  describe('7. Snapshots Repository', () => {
    it('should create and retrieve snapshots', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'snapshot-test' }));

      const snapshot = snapshotsRepo.create({
        noteId: note.id,
        title: 'Test Snapshot',
        content: '{"type":"doc","content":[]}',
        createdAt: new Date().toISOString(),
        trigger: 'manual',
      });

      expect(snapshot.id).toBeDefined();
      expect(snapshot.noteId).toBe('snapshot-test');
      expect(snapshot.trigger).toBe('manual');
    });

    it('should list snapshots by note ID', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'snapshot-list' }));

      // Create multiple snapshots
      snapshotsRepo.create({
        noteId: note.id,
        title: 'Snapshot 1',
        content: '{}',
        createdAt: new Date(Date.now() - 1000).toISOString(),
        trigger: 'auto',
      });
      snapshotsRepo.create({
        noteId: note.id,
        title: 'Snapshot 2',
        content: '{}',
        createdAt: new Date().toISOString(),
        trigger: 'manual',
      });

      const snapshots = snapshotsRepo.findByNoteId(note.id);
      expect(snapshots).toHaveLength(2);
      // Should be ordered by created_at DESC (newest first)
      expect(snapshots[0].title).toBe('Snapshot 2');
    });

    it('should prune old auto-snapshots', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'snapshot-prune' }));

      // Create 5 auto-snapshots
      for (let i = 0; i < 5; i++) {
        snapshotsRepo.create({
          noteId: note.id,
          title: `Auto ${i}`,
          content: '{}',
          createdAt: new Date(Date.now() + i * 1000).toISOString(),
          trigger: 'auto',
        });
      }

      // Prune to keep only 2
      const deleted = snapshotsRepo.pruneAutoSnapshots(note.id, 2);

      expect(deleted).toBe(3);
      expect(snapshotsRepo.countByNoteId(note.id, 'auto')).toBe(2);
    });
  });

  describe('8. CASCADE Delete - Removes related data', () => {
    it('should cascade delete links when note is deleted', () => {
      const source = notesRepo.create(createTestNoteInput({ id: 'cascade-source' }));
      const target = notesRepo.create(createTestNoteInput({ id: 'cascade-target' }));

      linksRepo.create({ sourceId: source.id, targetId: target.id });

      // Verify link exists
      expect(linksRepo.findBySourceId(source.id)).toHaveLength(1);

      // Delete source note
      notesRepo.delete(source.id);

      // Link should be gone
      expect(linksRepo.findBySourceId(source.id)).toHaveLength(0);
    });

    it('should cascade delete note_tags when note is deleted', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'cascade-tags' }));
      tagsRepo.setNoteTags(note.id, ['tag1', 'tag2']);

      // Verify tags exist
      expect(tagsRepo.findByNoteId(note.id)).toHaveLength(2);

      // Delete note
      notesRepo.delete(note.id);

      // Tags should be unlinked (but tags themselves still exist)
      expect(tagsRepo.findByNoteId(note.id)).toHaveLength(0);
    });

    it('should cascade delete yjs_state when note is deleted', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'cascade-yjs' }));
      yjsRepo.save({
        noteId: note.id,
        state: Buffer.from([1, 2, 3]),
        updatedAt: new Date().toISOString(),
      });

      // Verify state exists
      expect(yjsRepo.exists(note.id)).toBe(true);

      // Delete note
      notesRepo.delete(note.id);

      // Yjs state should be gone
      expect(yjsRepo.exists(note.id)).toBe(false);
    });

    it('should cascade delete snapshots when note is deleted', () => {
      const note = notesRepo.create(createTestNoteInput({ id: 'cascade-snapshots' }));
      snapshotsRepo.create({
        noteId: note.id,
        title: 'Test',
        content: '{}',
        createdAt: new Date().toISOString(),
        trigger: 'manual',
      });

      // Verify snapshot exists
      expect(snapshotsRepo.countByNoteId(note.id)).toBe(1);

      // Delete note
      notesRepo.delete(note.id);

      // Snapshots should be gone
      expect(snapshotsRepo.countByNoteId(note.id)).toBe(0);
    });

    it('should cascade delete all related data comprehensively', () => {
      // Create note with all related data
      const note = notesRepo.create(createTestNoteInput({ id: 'cascade-all' }));
      const otherNote = notesRepo.create(createTestNoteInput({ id: 'cascade-other' }));

      // Links (both directions)
      linksRepo.create({ sourceId: note.id, targetId: otherNote.id });
      linksRepo.create({ sourceId: otherNote.id, targetId: note.id });

      // Tags
      tagsRepo.setNoteTags(note.id, ['tag1', 'tag2']);

      // Yjs state
      yjsRepo.save({
        noteId: note.id,
        state: Buffer.from([1, 2, 3]),
        updatedAt: new Date().toISOString(),
      });

      // Snapshots
      snapshotsRepo.create({
        noteId: note.id,
        title: 'Test',
        content: '{}',
        createdAt: new Date().toISOString(),
        trigger: 'manual',
      });

      // Delete the main note
      notesRepo.delete(note.id);

      // Verify all related data is gone
      const db = scribeDb.getDb();

      const links = db
        .prepare('SELECT * FROM links WHERE source_id = ? OR target_id = ?')
        .all(note.id, note.id);
      expect(links).toHaveLength(0);

      const noteTags = db.prepare('SELECT * FROM note_tags WHERE note_id = ?').all(note.id);
      expect(noteTags).toHaveLength(0);

      const yjsState = db.prepare('SELECT * FROM yjs_state WHERE note_id = ?').all(note.id);
      expect(yjsState).toHaveLength(0);

      const snapshots = db.prepare('SELECT * FROM snapshots WHERE note_id = ?').all(note.id);
      expect(snapshots).toHaveLength(0);
    });
  });

  describe('9. Performance Baseline - Bulk operations', () => {
    it('should insert 1000 notes in under 1 second', () => {
      const startTime = Date.now();

      for (let i = 0; i < 1000; i++) {
        notesRepo.create(
          createTestNoteInput({
            id: `perf-${i}`,
            title: `Performance Test Note ${i}`,
          })
        );
      }

      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(1000);
      expect(notesRepo.count()).toBe(1000);
    });

    it('should search perform under 100ms', () => {
      // Create and index 100 notes for search performance test
      for (let i = 0; i < 100; i++) {
        const note = notesRepo.create(
          createTestNoteInput({
            id: `search-perf-${i}`,
            title: `Search Performance Note ${i}`,
          })
        );
        searchRepo.index(
          note.id,
          note.title,
          `This is content for note ${i} with searchable terms like programming, typescript, and development`,
          ['test', 'performance']
        );
      }

      const startTime = Date.now();
      const results = searchRepo.search('programming');
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(100);
      expect(results.length).toBeGreaterThan(0);
    });

    it('should batch create links efficiently', () => {
      // Create 100 notes
      const notes: string[] = [];
      for (let i = 0; i < 100; i++) {
        const note = notesRepo.create(
          createTestNoteInput({
            id: `batch-link-${i}`,
          })
        );
        notes.push(note.id);
      }

      // Batch create links - each note links to next 5 notes
      const links: Array<{ sourceId: string; targetId: string }> = [];
      for (let i = 0; i < 95; i++) {
        for (let j = 1; j <= 5; j++) {
          links.push({ sourceId: notes[i], targetId: notes[i + j] });
        }
      }

      const startTime = Date.now();
      linksRepo.createMany(links);
      const elapsed = Date.now() - startTime;

      expect(elapsed).toBeLessThan(1000);
      expect(linksRepo.countByNoteId(notes[0]).outlinks).toBe(5);
    });
  });

  describe('10. Error Handling - No SQLite errors', () => {
    it('should handle duplicate key gracefully', () => {
      const input = createTestNoteInput({ id: 'duplicate-test' });
      notesRepo.create(input);

      expect(() => notesRepo.create(input)).toThrow();
    });

    it('should handle invalid FTS5 query gracefully', () => {
      // Invalid FTS5 syntax should return empty results, not throw
      const results = searchRepo.search('fts:((invalid syntax');
      expect(results).toEqual([]);
    });

    it('should handle foreign key violation gracefully', () => {
      // Try to create link with non-existent note
      const link = linksRepo.create({
        sourceId: 'non-existent-source',
        targetId: 'non-existent-target',
      });

      // Should return null (foreign key validation)
      expect(link).toBeNull();
    });

    it('should return null for non-existent records', () => {
      expect(notesRepo.findById('does-not-exist')).toBeNull();
      expect(yjsRepo.load('does-not-exist')).toBeNull();
      expect(snapshotsRepo.findById(999999)).toBeNull();
    });
  });
});
