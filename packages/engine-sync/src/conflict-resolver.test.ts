import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConflictResolver } from './conflict-resolver.js';
import { SyncDatabase } from './sync-database.js';
import {
  createNoteId,
  type BaseNote,
  type NoteMetadata,
  type EditorContent,
  type SyncConflict,
} from '@scribe/shared';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// Helper to create empty editor content with proper structure
const createEmptyEditorContent = (): EditorContent => ({
  root: {
    type: 'root',
    children: [],
  },
});

// Helper to create editor content with text
const createEditorContent = (text: string): EditorContent => ({
  root: {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
  },
});

// Helper to create test notes with proper types
const createTestNote = (overrides: Partial<BaseNote> = {}): BaseNote => {
  const defaultMetadata: NoteMetadata = {
    title: null,
    tags: [],
    links: [],
    mentions: [],
  };

  return {
    id: createNoteId('test-note-1'),
    title: 'Test Note',
    content: createEmptyEditorContent(),
    tags: ['test'],
    metadata: defaultMetadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
};

describe('ConflictResolver', () => {
  let tempDir: string;
  let dbPath: string;
  let database: SyncDatabase;
  let resolver: ConflictResolver;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conflict-resolver-test-'));
    dbPath = path.join(tempDir, 'sync.sqlite3');
    database = new SyncDatabase({ dbPath });
    resolver = new ConflictResolver({ database });
  });

  afterEach(() => {
    database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('hasConflict', () => {
    it('returns false when versions match', () => {
      const localNote = createTestNote({ title: 'Local' });
      const remoteNote = createTestNote({ title: 'Remote' });

      // When local version >= remote version, no conflict
      expect(resolver.hasConflict(localNote, remoteNote, 5, 5)).toBe(false);
      expect(resolver.hasConflict(localNote, remoteNote, 6, 5)).toBe(false);
    });

    it('returns false when content is same', () => {
      const localNote = createTestNote({ title: 'Same Title' });
      const remoteNote = createTestNote({ title: 'Same Title' });

      // Even with version mismatch, same content = no conflict
      expect(resolver.hasConflict(localNote, remoteNote, 1, 2)).toBe(false);
    });

    it('returns true when versions differ and content differs', () => {
      const localNote = createTestNote({ title: 'Local Title' });
      const remoteNote = createTestNote({ title: 'Remote Title' });

      // Local version < remote version AND different content = conflict
      expect(resolver.hasConflict(localNote, remoteNote, 1, 2)).toBe(true);
    });

    it('returns false when local version is higher despite different content', () => {
      const localNote = createTestNote({ title: 'Local Title' });
      const remoteNote = createTestNote({ title: 'Remote Title' });

      // Local version > remote version = no conflict (local is authoritative)
      expect(resolver.hasConflict(localNote, remoteNote, 3, 2)).toBe(false);
    });
  });

  describe('detectConflict', () => {
    it('stores conflict in database when conflict exists', () => {
      const localNote = createTestNote({
        id: createNoteId('note-123'),
        title: 'Local Title',
      });
      const remoteNote = createTestNote({
        id: createNoteId('note-123'),
        title: 'Remote Title',
      });

      const conflict = resolver.detectConflict(localNote, remoteNote, 1, 2);

      expect(conflict).not.toBeNull();
      expect(conflict?.noteId).toBe('note-123');
      expect(conflict?.localVersion).toBe(1);
      expect(conflict?.remoteVersion).toBe(2);
      expect(conflict?.type).toBe('edit');

      // Verify it was stored in database
      const storedConflict = database.getConflict('note-123');
      expect(storedConflict).not.toBeNull();
      expect(storedConflict?.noteId).toBe('note-123');
    });

    it('returns null when no conflict exists', () => {
      const localNote = createTestNote({ title: 'Same Title' });
      const remoteNote = createTestNote({ title: 'Same Title' });

      const conflict = resolver.detectConflict(localNote, remoteNote, 1, 2);

      expect(conflict).toBeNull();
      expect(database.getConflictCount()).toBe(0);
    });

    it('stores the correct conflict type', () => {
      const localNote = createTestNote({ title: 'Local' });
      const remoteNote = createTestNote({ title: 'Remote' });

      const conflict = resolver.detectConflict(localNote, remoteNote, 1, 2, 'delete-edit');

      expect(conflict?.type).toBe('delete-edit');
    });
  });

  describe('tryAutoResolve', () => {
    it('returns resolution when timestamps are close (local newer)', () => {
      const now = Date.now();
      const localNote = createTestNote({
        title: 'Local',
        updatedAt: now + 2000, // 2 seconds after remote
      });
      const remoteNote = createTestNote({
        title: 'Remote',
        updatedAt: now,
      });

      const conflict: SyncConflict = {
        noteId: 'test-note-1',
        localNote,
        remoteNote,
        localVersion: 1,
        remoteVersion: 2,
        detectedAt: now,
        type: 'edit',
      };

      const result = resolver.tryAutoResolve(conflict);

      expect(result).not.toBeNull();
      expect(result?.resolution.type).toBe('keep_local');
      expect(result?.resolvedNote).toBe(localNote);
    });

    it('returns resolution when timestamps are close (remote newer)', () => {
      const now = Date.now();
      const localNote = createTestNote({
        title: 'Local',
        updatedAt: now,
      });
      const remoteNote = createTestNote({
        title: 'Remote',
        updatedAt: now + 2000, // 2 seconds after local
      });

      const conflict: SyncConflict = {
        noteId: 'test-note-1',
        localNote,
        remoteNote,
        localVersion: 1,
        remoteVersion: 2,
        detectedAt: now,
        type: 'edit',
      };

      const result = resolver.tryAutoResolve(conflict);

      expect(result).not.toBeNull();
      expect(result?.resolution.type).toBe('keep_remote');
      expect(result?.resolvedNote).toBe(remoteNote);
    });

    it('returns null when timestamps are far apart', () => {
      const now = Date.now();
      const localNote = createTestNote({
        title: 'Local',
        updatedAt: now,
      });
      const remoteNote = createTestNote({
        title: 'Remote',
        updatedAt: now + 10000, // 10 seconds apart (beyond 5s threshold)
      });

      const conflict: SyncConflict = {
        noteId: 'test-note-1',
        localNote,
        remoteNote,
        localVersion: 1,
        remoteVersion: 2,
        detectedAt: now,
        type: 'edit',
      };

      const result = resolver.tryAutoResolve(conflict);

      expect(result).toBeNull();
    });

    it('respects custom autoResolveThresholdMs', () => {
      const customResolver = new ConflictResolver({
        database,
        autoResolveThresholdMs: 1000, // Only 1 second threshold
      });

      const now = Date.now();
      const localNote = createTestNote({
        title: 'Local',
        updatedAt: now,
      });
      const remoteNote = createTestNote({
        title: 'Remote',
        updatedAt: now + 2000, // 2 seconds apart
      });

      const conflict: SyncConflict = {
        noteId: 'test-note-1',
        localNote,
        remoteNote,
        localVersion: 1,
        remoteVersion: 2,
        detectedAt: now,
        type: 'edit',
      };

      // With 1s threshold, 2s difference should not auto-resolve
      const result = customResolver.tryAutoResolve(conflict);
      expect(result).toBeNull();
    });
  });

  describe('resolve', () => {
    const setupConflict = () => {
      const localNote = createTestNote({
        id: createNoteId('conflict-note'),
        title: 'Local Title',
        content: createEditorContent('Local content'),
      });
      const remoteNote = createTestNote({
        id: createNoteId('conflict-note'),
        title: 'Remote Title',
        content: createEditorContent('Remote content'),
      });

      // Store conflict directly in database
      database.storeConflict({
        noteId: 'conflict-note',
        localNote,
        remoteNote,
        localVersion: 1,
        remoteVersion: 2,
        detectedAt: Date.now(),
        type: 'edit',
      });

      return { localNote, remoteNote };
    };

    it('with keep_local returns local note', () => {
      const { localNote } = setupConflict();

      const result = resolver.resolve('conflict-note', { type: 'keep_local' });

      expect(result.resolution.type).toBe('keep_local');
      expect(result.resolvedNote?.title).toBe('Local Title');
      expect((result.resolvedNote?.content as EditorContent).root.children[0]).toEqual(
        (localNote.content as EditorContent).root.children[0]
      );
    });

    it('with keep_remote returns remote note', () => {
      const { remoteNote } = setupConflict();

      const result = resolver.resolve('conflict-note', { type: 'keep_remote' });

      expect(result.resolution.type).toBe('keep_remote');
      expect(result.resolvedNote?.title).toBe('Remote Title');
      expect((result.resolvedNote?.content as EditorContent).root.children[0]).toEqual(
        (remoteNote.content as EditorContent).root.children[0]
      );
    });

    it('with keep_both creates copy', () => {
      setupConflict();

      const result = resolver.resolve('conflict-note', { type: 'keep_both' });

      expect(result.resolution.type).toBe('keep_both');
      // Primary resolved note is the remote
      expect(result.resolvedNote?.title).toBe('Remote Title');
      // Copy note is created from local
      expect(result.copyNote).toBeDefined();
      expect(result.copyNote?.title).toContain('Local Title');
      expect(result.copyNote?.title).toContain('(conflict copy');
      // Copy has a new ID
      expect(result.copyNote?.id).not.toBe('conflict-note');
      // Copy has no sync metadata
      expect(result.copyNote?.sync).toBeUndefined();
    });

    it('removes conflict from database after resolution', () => {
      setupConflict();

      expect(database.getConflictCount()).toBe(1);

      resolver.resolve('conflict-note', { type: 'keep_local' });

      expect(database.getConflictCount()).toBe(0);
      expect(database.getConflict('conflict-note')).toBeNull();
    });

    it('throws error when no conflict exists', () => {
      expect(() => {
        resolver.resolve('nonexistent-note', { type: 'keep_local' });
      }).toThrow('No conflict found for note nonexistent-note');
    });
  });

  describe('getPendingConflicts', () => {
    it('returns all pending conflicts', () => {
      const note1 = createTestNote({ id: createNoteId('note-1'), title: 'Note 1' });
      const note2 = createTestNote({ id: createNoteId('note-2'), title: 'Note 2' });
      const remote1 = createTestNote({ id: createNoteId('note-1'), title: 'Remote 1' });
      const remote2 = createTestNote({ id: createNoteId('note-2'), title: 'Remote 2' });

      resolver.detectConflict(note1, remote1, 1, 2);
      resolver.detectConflict(note2, remote2, 1, 2);

      const conflicts = resolver.getPendingConflicts();

      expect(conflicts).toHaveLength(2);
      expect(conflicts.map((c) => c.noteId)).toContain('note-1');
      expect(conflicts.map((c) => c.noteId)).toContain('note-2');
    });

    it('returns empty array when no conflicts', () => {
      const conflicts = resolver.getPendingConflicts();
      expect(conflicts).toHaveLength(0);
    });
  });

  describe('getConflictCount', () => {
    it('returns correct count', () => {
      expect(resolver.getConflictCount()).toBe(0);

      const note1 = createTestNote({ id: createNoteId('note-1'), title: 'Note 1' });
      const remote1 = createTestNote({ id: createNoteId('note-1'), title: 'Remote 1' });
      resolver.detectConflict(note1, remote1, 1, 2);

      expect(resolver.getConflictCount()).toBe(1);

      const note2 = createTestNote({ id: createNoteId('note-2'), title: 'Note 2' });
      const remote2 = createTestNote({ id: createNoteId('note-2'), title: 'Remote 2' });
      resolver.detectConflict(note2, remote2, 1, 2);

      expect(resolver.getConflictCount()).toBe(2);
    });
  });

  describe('hasConflictForNote', () => {
    it('returns true when conflict exists for note', () => {
      const note = createTestNote({ id: createNoteId('note-with-conflict'), title: 'Local' });
      const remote = createTestNote({ id: createNoteId('note-with-conflict'), title: 'Remote' });
      resolver.detectConflict(note, remote, 1, 2);

      expect(resolver.hasConflictForNote('note-with-conflict')).toBe(true);
    });

    it('returns false when no conflict exists for note', () => {
      expect(resolver.hasConflictForNote('nonexistent-note')).toBe(false);
    });
  });

  describe('clearConflict', () => {
    it('removes conflict without resolution', () => {
      const note = createTestNote({ id: createNoteId('note-to-clear'), title: 'Local' });
      const remote = createTestNote({ id: createNoteId('note-to-clear'), title: 'Remote' });
      resolver.detectConflict(note, remote, 1, 2);

      expect(resolver.hasConflictForNote('note-to-clear')).toBe(true);

      resolver.clearConflict('note-to-clear');

      expect(resolver.hasConflictForNote('note-to-clear')).toBe(false);
      expect(resolver.getConflictCount()).toBe(0);
    });

    it('does not throw when clearing nonexistent conflict', () => {
      expect(() => {
        resolver.clearConflict('nonexistent-note');
      }).not.toThrow();
    });
  });
});
