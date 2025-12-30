import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ChangeTracker } from './change-tracker.js';
import { SyncDatabase } from './sync-database.js';
import { computeContentHash } from './content-hash.js';
import type { BaseNote, NoteId, NoteMetadata, EditorContent } from '@scribe/shared';
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
    id: 'test-note-1' as NoteId,
    title: 'Test Note',
    content: createEmptyEditorContent(),
    tags: ['test'],
    metadata: defaultMetadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
};

describe('ChangeTracker', () => {
  let db: SyncDatabase;
  let tracker: ChangeTracker;
  let tempDir: string;
  let dbPath: string;

  beforeEach(() => {
    // Create a temporary directory for the test database
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'change-tracker-test-'));
    dbPath = path.join(tempDir, 'sync.sqlite3');
    db = new SyncDatabase({ dbPath });
    tracker = new ChangeTracker({ database: db });
  });

  afterEach(() => {
    db.close();
    // Clean up temp directory
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('trackChange with create', () => {
    it('adds to queue', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });

      tracker.trackChange(note, 'create');

      expect(tracker.getPendingChangeCount()).toBe(1);
      const changes = db.getQueuedChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].noteId).toBe('note-1');
      expect(changes[0].operation).toBe('create');
      expect(changes[0].version).toBe(1);
    });

    it('sets sync state with pending status', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });

      tracker.trackChange(note, 'create');

      const state = db.getSyncState('note-1');
      expect(state).not.toBeNull();
      expect(state!.localVersion).toBe(1);
      expect(state!.serverVersion).toBeNull();
      expect(state!.status).toBe('pending');
      expect(state!.contentHash).toBe(computeContentHash(note));
    });

    it('stores note payload in queue', () => {
      const note = createTestNote({ id: 'note-1' as NoteId, title: 'My Note' });

      tracker.trackChange(note, 'create');

      const changes = db.getQueuedChanges();
      expect(changes[0].payload).not.toBeNull();
      const payload = JSON.parse(changes[0].payload!);
      expect(payload.title).toBe('My Note');
    });
  });

  describe('trackChange with update', () => {
    it('adds to queue with incremented version', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });

      // First create the note
      tracker.trackChange(note, 'create');

      // Then update it with different content
      const updatedNote = createTestNote({
        id: 'note-1' as NoteId,
        title: 'Updated Title',
      });
      tracker.trackChange(updatedNote, 'update');

      // Should have replaced the original change
      expect(tracker.getPendingChangeCount()).toBe(1);
      const changes = db.getQueuedChanges();
      expect(changes[0].operation).toBe('update');
      expect(changes[0].version).toBe(2);
    });

    it('skips if hash unchanged', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });

      // Create the note
      tracker.trackChange(note, 'create');

      // Get initial state
      const initialState = db.getSyncState('note-1');

      // Try to update with same content
      tracker.trackChange(note, 'update');

      // Should still only have one change
      expect(tracker.getPendingChangeCount()).toBe(1);
      const changes = db.getQueuedChanges();
      expect(changes[0].version).toBe(1); // Still version 1

      // State should not have changed
      const currentState = db.getSyncState('note-1');
      expect(currentState!.localVersion).toBe(initialState!.localVersion);
    });

    it('updates sync state when content changes', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });
      tracker.trackChange(note, 'create');

      const updatedNote = createTestNote({
        id: 'note-1' as NoteId,
        content: createEditorContent('New content'),
      });
      tracker.trackChange(updatedNote, 'update');

      const state = db.getSyncState('note-1');
      expect(state!.localVersion).toBe(2);
      expect(state!.contentHash).toBe(computeContentHash(updatedNote));
    });

    it('coalesces multiple rapid updates', () => {
      const note1 = createTestNote({ id: 'note-1' as NoteId, title: 'Version 1' });
      tracker.trackChange(note1, 'create');

      const note2 = createTestNote({ id: 'note-1' as NoteId, title: 'Version 2' });
      tracker.trackChange(note2, 'update');

      const note3 = createTestNote({ id: 'note-1' as NoteId, title: 'Version 3' });
      tracker.trackChange(note3, 'update');

      // Should only have one queued change
      expect(tracker.getPendingChangeCount()).toBe(1);

      // But version should be incremented for each update
      const state = db.getSyncState('note-1');
      expect(state!.localVersion).toBe(3);

      // Queue should contain latest state
      const changes = db.getQueuedChanges();
      const payload = JSON.parse(changes[0].payload!);
      expect(payload.title).toBe('Version 3');
    });
  });

  describe('trackDelete', () => {
    it('adds deletion to queue', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });
      tracker.trackChange(note, 'create');

      tracker.trackDelete('note-1');

      // Should have one delete change (replacing the create)
      expect(tracker.getPendingChangeCount()).toBe(1);
      const changes = db.getQueuedChanges();
      expect(changes[0].operation).toBe('delete');
      expect(changes[0].version).toBe(2);
      expect(changes[0].payload).toBeNull();
    });

    it('sets sync state with empty hash', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });
      tracker.trackChange(note, 'create');

      tracker.trackDelete('note-1');

      const state = db.getSyncState('note-1');
      expect(state!.contentHash).toBe('');
      expect(state!.status).toBe('pending');
    });

    it('handles deletion of non-existent note', () => {
      tracker.trackDelete('non-existent');

      expect(tracker.getPendingChangeCount()).toBe(1);
      const state = db.getSyncState('non-existent');
      expect(state!.localVersion).toBe(1);
    });

    it('replaces pending create/update with delete', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });
      tracker.trackChange(note, 'create');

      const updatedNote = createTestNote({
        id: 'note-1' as NoteId,
        title: 'Updated',
      });
      tracker.trackChange(updatedNote, 'update');

      tracker.trackDelete('note-1');

      // Should only have the delete
      expect(tracker.getPendingChangeCount()).toBe(1);
      const changes = db.getQueuedChanges();
      expect(changes[0].operation).toBe('delete');
    });
  });

  describe('hasPendingChanges', () => {
    it('returns false when empty', () => {
      expect(tracker.hasPendingChanges()).toBe(false);
    });

    it('returns true after tracking change', () => {
      const note = createTestNote();
      tracker.trackChange(note, 'create');

      expect(tracker.hasPendingChanges()).toBe(true);
    });

    it('returns true after tracking delete', () => {
      tracker.trackDelete('some-note');

      expect(tracker.hasPendingChanges()).toBe(true);
    });
  });

  describe('getPendingChangeCount', () => {
    it('returns 0 when empty', () => {
      expect(tracker.getPendingChangeCount()).toBe(0);
    });

    it('returns correct count for multiple notes', () => {
      const note1 = createTestNote({ id: 'note-1' as NoteId });
      const note2 = createTestNote({ id: 'note-2' as NoteId });
      const note3 = createTestNote({ id: 'note-3' as NoteId });

      tracker.trackChange(note1, 'create');
      tracker.trackChange(note2, 'create');
      tracker.trackChange(note3, 'create');

      expect(tracker.getPendingChangeCount()).toBe(3);
    });

    it('does not double count coalesced changes', () => {
      const note = createTestNote({ id: 'note-1' as NoteId, title: 'V1' });
      tracker.trackChange(note, 'create');

      const updated = createTestNote({ id: 'note-1' as NoteId, title: 'V2' });
      tracker.trackChange(updated, 'update');

      // Should be 1, not 2
      expect(tracker.getPendingChangeCount()).toBe(1);
    });
  });

  describe('markSynced', () => {
    it('updates sync state', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });
      tracker.trackChange(note, 'create');

      tracker.markSynced('note-1', 42);

      const state = db.getSyncState('note-1');
      expect(state!.serverVersion).toBe(42);
      expect(state!.status).toBe('synced');
      expect(state!.lastSyncedAt).not.toBeNull();
    });

    it('preserves local version', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });
      tracker.trackChange(note, 'create');

      tracker.markSynced('note-1', 42);

      const state = db.getSyncState('note-1');
      expect(state!.localVersion).toBe(1);
    });

    it('preserves content hash', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });
      tracker.trackChange(note, 'create');
      const originalHash = db.getSyncState('note-1')!.contentHash;

      tracker.markSynced('note-1', 42);

      const state = db.getSyncState('note-1');
      expect(state!.contentHash).toBe(originalHash);
    });

    it('handles non-existent note gracefully', () => {
      // Should not throw
      tracker.markSynced('non-existent', 42);

      // State should not exist
      const state = db.getSyncState('non-existent');
      expect(state).toBeNull();
    });

    it('sets lastSyncedAt to current time', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });
      tracker.trackChange(note, 'create');

      const before = Date.now();
      tracker.markSynced('note-1', 42);
      const after = Date.now();

      const state = db.getSyncState('note-1');
      expect(state!.lastSyncedAt).toBeGreaterThanOrEqual(before);
      expect(state!.lastSyncedAt).toBeLessThanOrEqual(after);
    });
  });

  describe('preserves server version through updates', () => {
    it('keeps serverVersion when tracking new changes after sync', () => {
      const note = createTestNote({ id: 'note-1' as NoteId });
      tracker.trackChange(note, 'create');
      tracker.markSynced('note-1', 100);

      // Now update the note
      const updatedNote = createTestNote({
        id: 'note-1' as NoteId,
        title: 'Updated after sync',
      });
      tracker.trackChange(updatedNote, 'update');

      const state = db.getSyncState('note-1');
      expect(state!.serverVersion).toBe(100); // Should preserve
      expect(state!.localVersion).toBe(2); // Should increment
      expect(state!.status).toBe('pending'); // Should change to pending
    });
  });
});
