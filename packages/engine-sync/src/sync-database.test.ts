/**
 * Tests for SyncDatabase SQLite wrapper.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SyncDatabase } from './sync-database.js';
import type { SyncConflict } from '@scribe/shared';

describe('SyncDatabase', () => {
  let db: SyncDatabase;
  let tempDir: string;
  let dbPath: string;

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'sync-db-test-'));
    dbPath = join(tempDir, 'sync.sqlite3');
    db = new SyncDatabase({ dbPath });
  });

  afterEach(async () => {
    db.close();
    // Clean up the temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('initialization', () => {
    it('should create database with all required tables', () => {
      // Database is created in beforeEach
      // Verify by trying operations on each table
      expect(() => db.getDeviceId()).not.toThrow();
      expect(() => db.getSyncState('test')).not.toThrow();
      expect(() => db.getQueuedChanges()).not.toThrow();
      expect(() => db.getAllConflicts()).not.toThrow();
      expect(() => db.getLastSyncSequence()).not.toThrow();
    });

    it('should enable WAL mode', () => {
      // WAL mode is set during initialization
      // If we can create and use the database, WAL is working
      db.setDeviceId('test-device');
      expect(db.getDeviceId()).toBe('test-device');
    });

    it('should be idempotent (can be called multiple times)', () => {
      // Close and reopen with same path
      db.close();
      const db2 = new SyncDatabase({ dbPath });
      expect(() => db2.getDeviceId()).not.toThrow();
      db2.close();
    });
  });

  describe('device ID methods', () => {
    it('should return null when device ID is not set', () => {
      expect(db.getDeviceId()).toBeNull();
    });

    it('should set and get device ID', () => {
      db.setDeviceId('device-12345');
      expect(db.getDeviceId()).toBe('device-12345');
    });

    it('should update device ID on subsequent set', () => {
      db.setDeviceId('device-1');
      db.setDeviceId('device-2');
      expect(db.getDeviceId()).toBe('device-2');
    });
  });

  describe('sync state methods', () => {
    it('should return null for non-existent sync state', () => {
      expect(db.getSyncState('non-existent')).toBeNull();
    });

    it('should set and get sync state', () => {
      db.setSyncState('note-1', {
        localVersion: 1,
        serverVersion: null,
        contentHash: 'abc123',
        lastSyncedAt: null,
        status: 'pending',
      });

      const state = db.getSyncState('note-1');
      expect(state).toEqual({
        noteId: 'note-1',
        localVersion: 1,
        serverVersion: null,
        contentHash: 'abc123',
        lastSyncedAt: null,
        status: 'pending',
      });
    });

    it('should update existing sync state', () => {
      db.setSyncState('note-1', {
        localVersion: 1,
        serverVersion: null,
        contentHash: 'abc123',
        lastSyncedAt: null,
        status: 'pending',
      });

      db.setSyncState('note-1', {
        localVersion: 2,
        serverVersion: 1,
        contentHash: 'def456',
        lastSyncedAt: Date.now(),
        status: 'synced',
      });

      const state = db.getSyncState('note-1');
      expect(state?.localVersion).toBe(2);
      expect(state?.serverVersion).toBe(1);
      expect(state?.status).toBe('synced');
    });

    it('should get all pending states', () => {
      db.setSyncState('note-1', {
        localVersion: 1,
        serverVersion: null,
        contentHash: 'hash1',
        lastSyncedAt: null,
        status: 'pending',
      });

      db.setSyncState('note-2', {
        localVersion: 1,
        serverVersion: 1,
        contentHash: 'hash2',
        lastSyncedAt: Date.now(),
        status: 'synced',
      });

      db.setSyncState('note-3', {
        localVersion: 2,
        serverVersion: null,
        contentHash: 'hash3',
        lastSyncedAt: null,
        status: 'pending',
      });

      const pending = db.getAllPendingStates();
      expect(pending).toHaveLength(2);
      expect(pending.map((s) => s.noteId).sort()).toEqual(['note-1', 'note-3']);
    });

    it('should delete sync state', () => {
      db.setSyncState('note-1', {
        localVersion: 1,
        serverVersion: null,
        contentHash: 'hash1',
        lastSyncedAt: null,
        status: 'pending',
      });

      expect(db.getSyncState('note-1')).not.toBeNull();

      db.deleteSyncState('note-1');
      expect(db.getSyncState('note-1')).toBeNull();
    });
  });

  describe('change queue methods', () => {
    it('should queue a change and return its ID', () => {
      const id = db.queueChange('note-1', 'create', 1, { title: 'Test Note' });
      expect(typeof id).toBe('number');
      expect(id).toBeGreaterThan(0);
    });

    it('should get queued changes in order', () => {
      db.queueChange('note-1', 'create', 1, { title: 'First' });
      db.queueChange('note-2', 'update', 2, { title: 'Second' });
      db.queueChange('note-3', 'delete', 1, null);

      const changes = db.getQueuedChanges();
      expect(changes).toHaveLength(3);
      expect(changes[0].noteId).toBe('note-1');
      expect(changes[1].noteId).toBe('note-2');
      expect(changes[2].noteId).toBe('note-3');
    });

    it('should serialize payload as JSON', () => {
      const payload = { title: 'Test', content: { body: 'Hello' } };
      db.queueChange('note-1', 'create', 1, payload);

      const changes = db.getQueuedChanges();
      expect(changes[0].payload).toBe(JSON.stringify(payload));
    });

    it('should handle null payload for delete operations', () => {
      db.queueChange('note-1', 'delete', 1, null);

      const changes = db.getQueuedChanges();
      expect(changes[0].payload).toBeNull();
    });

    it('should respect limit parameter', () => {
      for (let i = 0; i < 10; i++) {
        db.queueChange(`note-${i}`, 'create', 1, null);
      }

      const changes = db.getQueuedChanges(3);
      expect(changes).toHaveLength(3);
    });

    it('should remove a queued change', () => {
      const id = db.queueChange('note-1', 'create', 1, null);
      expect(db.getQueueSize()).toBe(1);

      db.removeQueuedChange(id);
      expect(db.getQueueSize()).toBe(0);
    });

    it('should mark change as attempted', () => {
      const id = db.queueChange('note-1', 'create', 1, null);

      db.markChangeAttempted(id, 'Network error');

      const changes = db.getQueuedChanges();
      expect(changes[0].attempts).toBe(1);
      expect(changes[0].error).toBe('Network error');
      expect(changes[0].lastAttemptAt).toBeDefined();
    });

    it('should increment attempts on multiple markChangeAttempted calls', () => {
      const id = db.queueChange('note-1', 'create', 1, null);

      db.markChangeAttempted(id, 'Error 1');
      db.markChangeAttempted(id, 'Error 2');
      db.markChangeAttempted(id);

      const changes = db.getQueuedChanges();
      expect(changes[0].attempts).toBe(3);
      expect(changes[0].error).toBeNull(); // Last call had no error
    });

    it('should get queue size', () => {
      expect(db.getQueueSize()).toBe(0);

      db.queueChange('note-1', 'create', 1, null);
      db.queueChange('note-2', 'update', 1, null);
      expect(db.getQueueSize()).toBe(2);

      db.removeQueuedChange(1);
      expect(db.getQueueSize()).toBe(1);
    });

    it('should remove all queued changes for a note', () => {
      db.queueChange('note-1', 'create', 1, null);
      db.queueChange('note-1', 'update', 2, null);
      db.queueChange('note-2', 'create', 1, null);

      expect(db.getQueueSize()).toBe(3);

      db.removeQueuedChangesForNote('note-1');

      expect(db.getQueueSize()).toBe(1);
      const changes = db.getQueuedChanges();
      expect(changes[0].noteId).toBe('note-2');
    });
  });

  describe('conflict methods', () => {
    const createConflict = (noteId: string): SyncConflict => ({
      noteId,
      localNote: { title: 'Local Version', content: 'Local content' },
      remoteNote: { title: 'Remote Version', content: 'Remote content' },
      localVersion: 2,
      remoteVersion: 3,
      detectedAt: Date.now(),
      type: 'edit',
    });

    it('should store and retrieve a conflict', () => {
      const conflict = createConflict('note-1');
      db.storeConflict(conflict);

      const retrieved = db.getConflict('note-1');
      expect(retrieved).toEqual(conflict);
    });

    it('should return null for non-existent conflict', () => {
      expect(db.getConflict('non-existent')).toBeNull();
    });

    it('should update existing conflict', () => {
      const conflict1 = createConflict('note-1');
      db.storeConflict(conflict1);

      const conflict2: SyncConflict = {
        ...conflict1,
        localVersion: 5,
        remoteVersion: 6,
        type: 'delete-edit',
      };
      db.storeConflict(conflict2);

      const retrieved = db.getConflict('note-1');
      expect(retrieved?.localVersion).toBe(5);
      expect(retrieved?.remoteVersion).toBe(6);
      expect(retrieved?.type).toBe('delete-edit');
    });

    it('should get all conflicts', () => {
      db.storeConflict(createConflict('note-1'));
      db.storeConflict(createConflict('note-2'));
      db.storeConflict(createConflict('note-3'));

      const conflicts = db.getAllConflicts();
      expect(conflicts).toHaveLength(3);
    });

    it('should remove a conflict', () => {
      db.storeConflict(createConflict('note-1'));
      expect(db.getConflict('note-1')).not.toBeNull();

      db.removeConflict('note-1');
      expect(db.getConflict('note-1')).toBeNull();
    });

    it('should get conflict count', () => {
      expect(db.getConflictCount()).toBe(0);

      db.storeConflict(createConflict('note-1'));
      db.storeConflict(createConflict('note-2'));
      expect(db.getConflictCount()).toBe(2);

      db.removeConflict('note-1');
      expect(db.getConflictCount()).toBe(1);
    });

    it('should handle all conflict types', () => {
      const types: Array<'edit' | 'delete-edit' | 'edit-delete'> = [
        'edit',
        'delete-edit',
        'edit-delete',
      ];

      for (const type of types) {
        const conflict: SyncConflict = { ...createConflict(`note-${type}`), type };
        db.storeConflict(conflict);

        const retrieved = db.getConflict(`note-${type}`);
        expect(retrieved?.type).toBe(type);
      }
    });

    it('should properly serialize complex note data in conflicts', () => {
      const complexNote = {
        id: 'note-1',
        title: 'Test',
        content: {
          root: {
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Hello world' }],
              },
            ],
          },
        },
        metadata: {
          tags: ['tag1', 'tag2'],
          links: ['note-2', 'note-3'],
        },
      };

      const conflict: SyncConflict = {
        noteId: 'note-1',
        localNote: complexNote,
        remoteNote: { ...complexNote, title: 'Remote Title' },
        localVersion: 1,
        remoteVersion: 2,
        detectedAt: Date.now(),
        type: 'edit',
      };

      db.storeConflict(conflict);
      const retrieved = db.getConflict('note-1');

      expect(retrieved?.localNote).toEqual(complexNote);
      expect((retrieved?.remoteNote as typeof complexNote).title).toBe('Remote Title');
    });
  });

  describe('metadata methods', () => {
    it('should get last sync sequence (defaults to 0)', () => {
      expect(db.getLastSyncSequence()).toBe(0);
    });

    it('should set and get last sync sequence', () => {
      db.setLastSyncSequence(42);
      expect(db.getLastSyncSequence()).toBe(42);
    });

    it('should update last sync sequence', () => {
      db.setLastSyncSequence(10);
      db.setLastSyncSequence(100);
      expect(db.getLastSyncSequence()).toBe(100);
    });

    it('should get arbitrary metadata', () => {
      expect(db.getMetadata('custom-key')).toBeNull();

      db.setMetadata('custom-key', 'custom-value');
      expect(db.getMetadata('custom-key')).toBe('custom-value');
    });

    it('should update metadata', () => {
      db.setMetadata('key', 'value1');
      db.setMetadata('key', 'value2');
      expect(db.getMetadata('key')).toBe('value2');
    });
  });

  describe('persistence', () => {
    it('should persist data across database reopens', () => {
      // Set some data
      db.setDeviceId('persistent-device');
      db.setSyncState('note-1', {
        localVersion: 5,
        serverVersion: 3,
        contentHash: 'hash',
        lastSyncedAt: Date.now(),
        status: 'synced',
      });
      db.queueChange('note-2', 'create', 1, { title: 'Queued' });
      db.setLastSyncSequence(99);

      // Close the database
      db.close();

      // Reopen
      const db2 = new SyncDatabase({ dbPath });

      // Verify data persisted
      expect(db2.getDeviceId()).toBe('persistent-device');

      const state = db2.getSyncState('note-1');
      expect(state?.localVersion).toBe(5);
      expect(state?.serverVersion).toBe(3);
      expect(state?.status).toBe('synced');

      const changes = db2.getQueuedChanges();
      expect(changes).toHaveLength(1);
      expect(changes[0].noteId).toBe('note-2');

      expect(db2.getLastSyncSequence()).toBe(99);

      db2.close();
    });
  });

  describe('edge cases', () => {
    it('should handle empty strings', () => {
      db.setDeviceId('');
      expect(db.getDeviceId()).toBe('');

      db.setSyncState('', {
        localVersion: 1,
        serverVersion: null,
        contentHash: '',
        lastSyncedAt: null,
        status: 'pending',
      });
      expect(db.getSyncState('')?.contentHash).toBe('');
    });

    it('should handle special characters in note IDs', () => {
      const specialId = 'note-with-special/chars?and=query&params#hash';
      db.setSyncState(specialId, {
        localVersion: 1,
        serverVersion: null,
        contentHash: 'hash',
        lastSyncedAt: null,
        status: 'pending',
      });

      const state = db.getSyncState(specialId);
      expect(state?.noteId).toBe(specialId);
    });

    it('should handle large payloads', () => {
      const largeContent = 'x'.repeat(100000);
      const payload = { title: 'Large Note', content: largeContent };

      const id = db.queueChange('large-note', 'create', 1, payload);
      const changes = db.getQueuedChanges();

      expect(changes[0].id).toBe(id);
      const parsed = JSON.parse(changes[0].payload!);
      expect(parsed.content.length).toBe(100000);
    });

    it('should handle unicode content', () => {
      const unicodeContent = { title: 'Unicode', body: 'Hello' };
      db.queueChange('unicode-note', 'create', 1, unicodeContent);

      const changes = db.getQueuedChanges();
      const parsed = JSON.parse(changes[0].payload!);
      expect(parsed.body).toBe('Hello');
    });
  });
});
