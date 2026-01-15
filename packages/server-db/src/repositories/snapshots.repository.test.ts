/**
 * Tests for SnapshotsRepository.
 *
 * These tests verify:
 * 1. Create snapshot with title, content, trigger
 * 2. List by note ID with ordering
 * 3. Prune old auto-snapshots
 * 4. Protect manual snapshots from deletion
 * 5. CASCADE delete when note deleted
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ScribeDatabase } from '../database.js';
import { NotesRepository } from './notes.repository.js';
import { SnapshotsRepository } from './snapshots.repository.js';
import type { CreateNoteInput, CreateSnapshotInput, SnapshotTrigger } from '../types.js';

describe('SnapshotsRepository', () => {
  let scribeDb: ScribeDatabase;
  let notesRepo: NotesRepository;
  let repo: SnapshotsRepository;

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

  // Helper to create test snapshot input
  const createTestSnapshotInput = (
    noteId: string,
    overrides: Partial<CreateSnapshotInput> = {}
  ): CreateSnapshotInput => {
    return {
      noteId,
      title: 'Snapshot Title',
      content: '{"type":"doc","content":[]}',
      createdAt: new Date().toISOString(),
      trigger: 'auto' as SnapshotTrigger,
      ...overrides,
    };
  };

  beforeEach(() => {
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();
    notesRepo = new NotesRepository(scribeDb.getDb());
    repo = new SnapshotsRepository(scribeDb.getDb());
  });

  afterEach(() => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
  });

  describe('create', () => {
    it('should create a snapshot with all fields', () => {
      const note = notesRepo.create(createTestNoteInput());
      const input = createTestSnapshotInput(note.id, {
        title: 'My Snapshot',
        content: '{"version":1}',
        trigger: 'manual',
      });

      const snapshot = repo.create(input);

      expect(snapshot).toBeDefined();
      expect(snapshot.id).toBeGreaterThan(0);
      expect(snapshot.noteId).toBe(note.id);
      expect(snapshot.title).toBe('My Snapshot');
      expect(snapshot.content).toBe('{"version":1}');
      expect(snapshot.createdAt).toBe(input.createdAt);
      expect(snapshot.trigger).toBe('manual');
    });

    it('should create snapshots with different triggers', () => {
      const note = notesRepo.create(createTestNoteInput());
      const triggers: SnapshotTrigger[] = ['manual', 'auto', 'pre_edit'];

      for (const trigger of triggers) {
        const input = createTestSnapshotInput(note.id, { trigger });
        const snapshot = repo.create(input);
        expect(snapshot.trigger).toBe(trigger);
      }
    });

    it('should throw error for non-existent note (FK constraint)', () => {
      const input = createTestSnapshotInput('non-existent-note');

      expect(() => repo.create(input)).toThrow();
    });

    it('should allow multiple snapshots for same note', () => {
      const note = notesRepo.create(createTestNoteInput());

      repo.create(createTestSnapshotInput(note.id, { title: 'Snapshot 1' }));
      repo.create(createTestSnapshotInput(note.id, { title: 'Snapshot 2' }));
      repo.create(createTestSnapshotInput(note.id, { title: 'Snapshot 3' }));

      const snapshots = repo.findByNoteId(note.id);
      expect(snapshots).toHaveLength(3);
    });
  });

  describe('findById', () => {
    it('should find an existing snapshot by id', () => {
      const note = notesRepo.create(createTestNoteInput());
      const created = repo.create(createTestSnapshotInput(note.id));

      const found = repo.findById(created.id);

      expect(found).not.toBeNull();
      expect(found?.id).toBe(created.id);
      expect(found?.noteId).toBe(note.id);
    });

    it('should return null for non-existent id', () => {
      const found = repo.findById(99999);
      expect(found).toBeNull();
    });
  });

  describe('findByNoteId', () => {
    let note: ReturnType<typeof notesRepo.create>;

    beforeEach(() => {
      note = notesRepo.create(createTestNoteInput());

      // Create snapshots with different timestamps (oldest to newest)
      const times = [
        '2024-01-01T00:00:00.000Z',
        '2024-01-02T00:00:00.000Z',
        '2024-01-03T00:00:00.000Z',
        '2024-01-04T00:00:00.000Z',
      ];

      repo.create(createTestSnapshotInput(note.id, { createdAt: times[0], trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { createdAt: times[1], trigger: 'manual' }));
      repo.create(createTestSnapshotInput(note.id, { createdAt: times[2], trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { createdAt: times[3], trigger: 'pre_edit' }));
    });

    it('should return all snapshots for a note', () => {
      const snapshots = repo.findByNoteId(note.id);
      expect(snapshots).toHaveLength(4);
    });

    it('should return snapshots newest first', () => {
      const snapshots = repo.findByNoteId(note.id);

      for (let i = 1; i < snapshots.length; i++) {
        expect(snapshots[i - 1].createdAt >= snapshots[i].createdAt).toBe(true);
      }
    });

    it('should filter by trigger type', () => {
      const autoSnapshots = repo.findByNoteId(note.id, { trigger: 'auto' });
      expect(autoSnapshots).toHaveLength(2);
      expect(autoSnapshots.every((s) => s.trigger === 'auto')).toBe(true);

      const manualSnapshots = repo.findByNoteId(note.id, { trigger: 'manual' });
      expect(manualSnapshots).toHaveLength(1);
    });

    it('should apply limit', () => {
      const snapshots = repo.findByNoteId(note.id, { limit: 2 });
      expect(snapshots).toHaveLength(2);
    });

    it('should apply offset', () => {
      const allSnapshots = repo.findByNoteId(note.id);
      const offsetSnapshots = repo.findByNoteId(note.id, { limit: 2, offset: 2 });

      expect(offsetSnapshots).toHaveLength(2);
      expect(offsetSnapshots[0].id).toBe(allSnapshots[2].id);
    });

    it('should return empty array for note without snapshots', () => {
      const emptyNote = notesRepo.create(createTestNoteInput());
      const snapshots = repo.findByNoteId(emptyNote.id);
      expect(snapshots).toEqual([]);
    });

    it('should return empty array for non-existent note', () => {
      const snapshots = repo.findByNoteId('non-existent-note');
      expect(snapshots).toEqual([]);
    });
  });

  describe('findLatest', () => {
    it('should return the most recent snapshot', () => {
      const note = notesRepo.create(createTestNoteInput());

      repo.create(
        createTestSnapshotInput(note.id, { createdAt: '2024-01-01T00:00:00.000Z', title: 'Oldest' })
      );
      repo.create(
        createTestSnapshotInput(note.id, { createdAt: '2024-01-03T00:00:00.000Z', title: 'Newest' })
      );
      repo.create(
        createTestSnapshotInput(note.id, { createdAt: '2024-01-02T00:00:00.000Z', title: 'Middle' })
      );

      const latest = repo.findLatest(note.id);

      expect(latest?.title).toBe('Newest');
    });

    it('should filter by trigger when specified', () => {
      const note = notesRepo.create(createTestNoteInput());

      repo.create(
        createTestSnapshotInput(note.id, {
          createdAt: '2024-01-03T00:00:00.000Z',
          trigger: 'auto',
          title: 'Latest Auto',
        })
      );
      repo.create(
        createTestSnapshotInput(note.id, {
          createdAt: '2024-01-02T00:00:00.000Z',
          trigger: 'manual',
          title: 'Latest Manual',
        })
      );

      const latestManual = repo.findLatest(note.id, 'manual');
      expect(latestManual?.title).toBe('Latest Manual');
    });

    it('should return null for note without snapshots', () => {
      const note = notesRepo.create(createTestNoteInput());
      const latest = repo.findLatest(note.id);
      expect(latest).toBeNull();
    });
  });

  describe('pruneAutoSnapshots', () => {
    it('should keep the most recent N auto-snapshots', () => {
      const note = notesRepo.create(createTestNoteInput());

      // Create 5 auto-snapshots
      for (let i = 0; i < 5; i++) {
        repo.create(
          createTestSnapshotInput(note.id, {
            createdAt: `2024-01-0${i + 1}T00:00:00.000Z`,
            trigger: 'auto',
          })
        );
      }

      expect(repo.countByNoteId(note.id, 'auto')).toBe(5);

      // Keep only 2
      const deleted = repo.pruneAutoSnapshots(note.id, 2);

      expect(deleted).toBe(3);
      expect(repo.countByNoteId(note.id, 'auto')).toBe(2);

      // Verify newest were kept
      const remaining = repo.findByNoteId(note.id, { trigger: 'auto' });
      expect(remaining[0].createdAt).toBe('2024-01-05T00:00:00.000Z');
      expect(remaining[1].createdAt).toBe('2024-01-04T00:00:00.000Z');
    });

    it('should not delete manual snapshots', () => {
      const note = notesRepo.create(createTestNoteInput());

      // Create auto and manual snapshots
      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'manual' }));

      repo.pruneAutoSnapshots(note.id, 0); // Delete all auto

      expect(repo.countByNoteId(note.id, 'auto')).toBe(0);
      expect(repo.countByNoteId(note.id, 'manual')).toBe(1);
    });

    it('should return 0 when no pruning needed', () => {
      const note = notesRepo.create(createTestNoteInput());

      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));

      const deleted = repo.pruneAutoSnapshots(note.id, 10); // Keep more than exist
      expect(deleted).toBe(0);
    });
  });

  describe('prunePreEditSnapshots', () => {
    it('should keep the most recent N pre_edit snapshots', () => {
      const note = notesRepo.create(createTestNoteInput());

      // Create 4 pre_edit snapshots
      for (let i = 0; i < 4; i++) {
        repo.create(
          createTestSnapshotInput(note.id, {
            createdAt: `2024-01-0${i + 1}T00:00:00.000Z`,
            trigger: 'pre_edit',
          })
        );
      }

      const deleted = repo.prunePreEditSnapshots(note.id, 2);

      expect(deleted).toBe(2);
      expect(repo.countByNoteId(note.id, 'pre_edit')).toBe(2);
    });

    it('should not affect auto or manual snapshots', () => {
      const note = notesRepo.create(createTestNoteInput());

      repo.create(createTestSnapshotInput(note.id, { trigger: 'pre_edit' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'manual' }));

      repo.prunePreEditSnapshots(note.id, 0);

      expect(repo.countByNoteId(note.id, 'pre_edit')).toBe(0);
      expect(repo.countByNoteId(note.id, 'auto')).toBe(1);
      expect(repo.countByNoteId(note.id, 'manual')).toBe(1);
    });
  });

  describe('delete', () => {
    it('should delete non-manual snapshot', () => {
      const note = notesRepo.create(createTestNoteInput());
      const snapshot = repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));

      const deleted = repo.delete(snapshot.id);

      expect(deleted).toBe(true);
      expect(repo.findById(snapshot.id)).toBeNull();
    });

    it('should not delete manual snapshot by default', () => {
      const note = notesRepo.create(createTestNoteInput());
      const snapshot = repo.create(createTestSnapshotInput(note.id, { trigger: 'manual' }));

      const deleted = repo.delete(snapshot.id);

      expect(deleted).toBe(false);
      expect(repo.findById(snapshot.id)).not.toBeNull();
    });

    it('should delete manual snapshot with force=true', () => {
      const note = notesRepo.create(createTestNoteInput());
      const snapshot = repo.create(createTestSnapshotInput(note.id, { trigger: 'manual' }));

      const deleted = repo.delete(snapshot.id, true);

      expect(deleted).toBe(true);
      expect(repo.findById(snapshot.id)).toBeNull();
    });

    it('should return false for non-existent snapshot', () => {
      const deleted = repo.delete(99999);
      expect(deleted).toBe(false);
    });
  });

  describe('deleteByNoteId', () => {
    it('should delete all non-manual snapshots', () => {
      const note = notesRepo.create(createTestNoteInput());

      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'pre_edit' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'manual' }));

      const deleted = repo.deleteByNoteId(note.id);

      expect(deleted).toBe(2);
      expect(repo.countByNoteId(note.id)).toBe(1);
      expect(repo.countByNoteId(note.id, 'manual')).toBe(1);
    });

    it('should delete all snapshots with force=true', () => {
      const note = notesRepo.create(createTestNoteInput());

      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'manual' }));

      const deleted = repo.deleteByNoteId(note.id, true);

      expect(deleted).toBe(2);
      expect(repo.countByNoteId(note.id)).toBe(0);
    });
  });

  describe('countByNoteId', () => {
    it('should count all snapshots for a note', () => {
      const note = notesRepo.create(createTestNoteInput());

      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'manual' }));

      expect(repo.countByNoteId(note.id)).toBe(2);
    });

    it('should count snapshots by trigger', () => {
      const note = notesRepo.create(createTestNoteInput());

      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'manual' }));

      expect(repo.countByNoteId(note.id, 'auto')).toBe(2);
      expect(repo.countByNoteId(note.id, 'manual')).toBe(1);
      expect(repo.countByNoteId(note.id, 'pre_edit')).toBe(0);
    });

    it('should return 0 for note without snapshots', () => {
      const note = notesRepo.create(createTestNoteInput());
      expect(repo.countByNoteId(note.id)).toBe(0);
    });
  });

  describe('count', () => {
    it('should count all snapshots in database', () => {
      const note1 = notesRepo.create(createTestNoteInput());
      const note2 = notesRepo.create(createTestNoteInput());

      expect(repo.count()).toBe(0);

      repo.create(createTestSnapshotInput(note1.id));
      repo.create(createTestSnapshotInput(note1.id));
      repo.create(createTestSnapshotInput(note2.id));

      expect(repo.count()).toBe(3);
    });
  });

  describe('cascade delete', () => {
    it('should delete snapshots when note is deleted', () => {
      const note = notesRepo.create(createTestNoteInput());
      repo.create(createTestSnapshotInput(note.id, { trigger: 'auto' }));
      repo.create(createTestSnapshotInput(note.id, { trigger: 'manual' }));

      // Verify snapshots exist
      expect(repo.countByNoteId(note.id)).toBe(2);

      // Delete the note
      notesRepo.delete(note.id);

      // Verify snapshots were cascade deleted
      expect(repo.countByNoteId(note.id)).toBe(0);
    });
  });

  describe('type safety', () => {
    it('should return properly typed Snapshot objects', () => {
      const note = notesRepo.create(createTestNoteInput());
      const input = createTestSnapshotInput(note.id, { trigger: 'manual' });
      const snapshot = repo.create(input);

      // TypeScript compilation would fail if types are incorrect
      const id: number = snapshot.id;
      const noteId: string = snapshot.noteId;
      const title: string = snapshot.title;
      const content: string = snapshot.content;
      const createdAt: string = snapshot.createdAt;
      const trigger: 'manual' | 'auto' | 'pre_edit' = snapshot.trigger;

      expect(id).toBeDefined();
      expect(noteId).toBeDefined();
      expect(title).toBeDefined();
      expect(content).toBeDefined();
      expect(createdAt).toBeDefined();
      expect(trigger).toBeDefined();
    });
  });

  describe('large content handling', () => {
    it('should handle large content strings', () => {
      const note = notesRepo.create(createTestNoteInput());
      // Create a large JSON content (100KB)
      const largeContent = JSON.stringify({
        type: 'doc',
        content: Array(1000)
          .fill(null)
          .map((_, i) => ({
            type: 'paragraph',
            content: [{ type: 'text', text: `Paragraph ${i}: ${'Lorem ipsum '.repeat(10)}` }],
          })),
      });

      const snapshot = repo.create(createTestSnapshotInput(note.id, { content: largeContent }));
      const loaded = repo.findById(snapshot.id);

      expect(loaded?.content).toBe(largeContent);
    });
  });
});
