/**
 * Tests for VaultMigrator.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { SyncDatabase } from './sync-database.js';
import {
  VaultMigrator,
  type MigrationProgress,
  type VaultMigratorConfig,
} from './vault-migrator.js';
import type { BaseNote, NoteId, NoteMetadata, EditorContent } from '@scribe/shared';

// Helper to create empty editor content with proper structure
const createEmptyEditorContent = (): EditorContent => ({
  root: {
    type: 'root',
    children: [],
  },
});

// Helper to create test notes with proper types
const createTestNote = (id: string, overrides: Partial<BaseNote> = {}): BaseNote => {
  const defaultMetadata: NoteMetadata = {
    title: null,
    tags: [],
    links: [],
    mentions: [],
  };

  return {
    id: id as NoteId,
    title: `Test Note ${id}`,
    content: createEmptyEditorContent(),
    tags: ['test'],
    metadata: defaultMetadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
};

describe('VaultMigrator', () => {
  let db: SyncDatabase;
  let tempDir: string;
  let dbPath: string;
  let mockNotes: Map<string, BaseNote>;
  let savedNotes: Map<string, BaseNote>;

  const createMigrator = (overrides: Partial<VaultMigratorConfig> = {}) => {
    return new VaultMigrator({
      database: db,
      deviceId: 'test-device-123',
      listNoteIds: async () => Array.from(mockNotes.keys()),
      readNote: async (noteId) => mockNotes.get(noteId) ?? null,
      saveNote: async (note) => {
        savedNotes.set(note.id, note);
        mockNotes.set(note.id, note);
      },
      ...overrides,
    });
  };

  beforeEach(async () => {
    // Create a temporary directory for each test
    tempDir = await mkdtemp(join(tmpdir(), 'vault-migrator-test-'));
    dbPath = join(tempDir, 'sync.sqlite3');
    db = new SyncDatabase({ dbPath });
    mockNotes = new Map();
    savedNotes = new Map();
  });

  afterEach(async () => {
    db.close();
    // Clean up the temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('needsMigration', () => {
    it('should return false for empty vault', async () => {
      const migrator = createMigrator();
      expect(await migrator.needsMigration()).toBe(false);
    });

    it('should return true when notes have no sync metadata', async () => {
      mockNotes.set('note-1', createTestNote('note-1'));
      mockNotes.set('note-2', createTestNote('note-2'));

      const migrator = createMigrator();
      expect(await migrator.needsMigration()).toBe(true);
    });

    it('should return false when all notes have sync metadata', async () => {
      mockNotes.set(
        'note-1',
        createTestNote('note-1', {
          sync: { version: 1, contentHash: 'abc123', deviceId: 'device-1' },
        })
      );
      mockNotes.set(
        'note-2',
        createTestNote('note-2', {
          sync: { version: 2, contentHash: 'def456', deviceId: 'device-1' },
        })
      );

      const migrator = createMigrator();
      expect(await migrator.needsMigration()).toBe(false);
    });

    it('should return true when some notes have sync metadata and some do not', async () => {
      mockNotes.set(
        'note-1',
        createTestNote('note-1', {
          sync: { version: 1, contentHash: 'abc123', deviceId: 'device-1' },
        })
      );
      mockNotes.set('note-2', createTestNote('note-2')); // No sync metadata

      const migrator = createMigrator();
      expect(await migrator.needsMigration()).toBe(true);
    });
  });

  describe('migrateVault', () => {
    it('should handle empty vault gracefully', async () => {
      const progressUpdates: MigrationProgress[] = [];
      const migrator = createMigrator({
        onProgress: (p) => progressUpdates.push({ ...p }),
      });

      const result = await migrator.migrateVault();

      expect(result.migrated).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(progressUpdates).toContainEqual({ total: 0, completed: 0, phase: 'scanning' });
      expect(progressUpdates).toContainEqual({ total: 0, completed: 0, phase: 'complete' });
    });

    it('should add sync metadata to notes without it', async () => {
      mockNotes.set('note-1', createTestNote('note-1'));
      mockNotes.set('note-2', createTestNote('note-2'));

      const migrator = createMigrator();
      const result = await migrator.migrateVault();

      expect(result.migrated).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Check that notes were saved with sync metadata
      const savedNote1 = savedNotes.get('note-1');
      const savedNote2 = savedNotes.get('note-2');

      expect(savedNote1?.sync).toBeDefined();
      expect(savedNote1?.sync?.version).toBe(1);
      expect(savedNote1?.sync?.contentHash).toMatch(/^[a-f0-9]{16}$/);
      expect(savedNote1?.sync?.deviceId).toBe('test-device-123');
      expect(savedNote1?.sync?.serverVersion).toBeUndefined();
      expect(savedNote1?.sync?.syncedAt).toBeUndefined();

      expect(savedNote2?.sync).toBeDefined();
      expect(savedNote2?.sync?.version).toBe(1);
    });

    it('should skip notes that already have sync metadata', async () => {
      const existingSync = { version: 5, contentHash: 'existing-hash', deviceId: 'other-device' };
      mockNotes.set('note-1', createTestNote('note-1', { sync: existingSync }));
      mockNotes.set('note-2', createTestNote('note-2')); // No sync metadata

      const migrator = createMigrator();
      const result = await migrator.migrateVault();

      expect(result.migrated).toBe(2);

      // note-1 should NOT have been saved (already had sync metadata)
      const savedNote1 = savedNotes.get('note-1');
      expect(savedNote1).toBeUndefined();

      // note-2 should have been saved with new sync metadata
      const savedNote2 = savedNotes.get('note-2');
      expect(savedNote2?.sync?.version).toBe(1);
      expect(savedNote2?.sync?.deviceId).toBe('test-device-123');
    });

    it('should record sync state in database', async () => {
      mockNotes.set('note-1', createTestNote('note-1'));

      const migrator = createMigrator();
      await migrator.migrateVault();

      const syncState = db.getSyncState('note-1');
      expect(syncState).not.toBeNull();
      expect(syncState?.localVersion).toBe(1);
      expect(syncState?.serverVersion).toBeNull();
      expect(syncState?.contentHash).toMatch(/^[a-f0-9]{16}$/);
      expect(syncState?.lastSyncedAt).toBeNull();
      expect(syncState?.status).toBe('pending');
    });

    it('should queue all notes for initial push', async () => {
      mockNotes.set('note-1', createTestNote('note-1'));
      mockNotes.set('note-2', createTestNote('note-2'));

      const migrator = createMigrator();
      await migrator.migrateVault();

      const queuedChanges = db.getQueuedChanges();
      expect(queuedChanges).toHaveLength(2);

      const noteIds = queuedChanges.map((c) => c.noteId).sort();
      expect(noteIds).toEqual(['note-1', 'note-2']);

      // All should be 'create' operations
      expect(queuedChanges.every((c) => c.operation === 'create')).toBe(true);
      expect(queuedChanges.every((c) => c.version === 1)).toBe(true);
    });

    it('should call progress callback correctly', async () => {
      mockNotes.set('note-1', createTestNote('note-1'));
      mockNotes.set('note-2', createTestNote('note-2'));
      mockNotes.set('note-3', createTestNote('note-3'));

      const progressUpdates: MigrationProgress[] = [];
      const migrator = createMigrator({
        onProgress: (p) => progressUpdates.push({ ...p }),
      });

      await migrator.migrateVault();

      // Should have scanning phase
      expect(progressUpdates.some((p) => p.phase === 'scanning')).toBe(true);

      // Should have migrating phases for each note
      const migratingUpdates = progressUpdates.filter((p) => p.phase === 'migrating');
      expect(migratingUpdates.length).toBeGreaterThanOrEqual(3);
      expect(migratingUpdates.every((p) => p.total === 3)).toBe(true);

      // Should have queueing phase
      expect(progressUpdates.some((p) => p.phase === 'queueing')).toBe(true);

      // Should have complete phase
      const completeUpdate = progressUpdates.find((p) => p.phase === 'complete');
      expect(completeUpdate).toBeDefined();
      expect(completeUpdate?.total).toBe(3);
      expect(completeUpdate?.completed).toBe(3);
    });

    it('should handle errors during migration and continue with other notes', async () => {
      mockNotes.set('note-1', createTestNote('note-1'));
      mockNotes.set('note-2', createTestNote('note-2'));
      mockNotes.set('note-3', createTestNote('note-3'));

      const migrator = createMigrator({
        saveNote: async (note) => {
          if (note.id === 'note-2') {
            throw new Error('Simulated save error');
          }
          savedNotes.set(note.id, note);
          mockNotes.set(note.id, note);
        },
      });

      // Suppress console.error for this test
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await migrator.migrateVault();

      consoleSpy.mockRestore();

      // Should have migrated 2 out of 3 notes (note-2 failed)
      expect(result.migrated).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('note-2');
      expect(result.errors[0]).toContain('Simulated save error');
    });

    it('should handle notes that disappear during migration', async () => {
      mockNotes.set('note-1', createTestNote('note-1'));
      mockNotes.set('note-2', createTestNote('note-2'));

      const migrator = createMigrator({
        readNote: async (noteId) => {
          // Return null for note-2 (simulating deletion)
          if (noteId === 'note-2') {
            return null;
          }
          return mockNotes.get(noteId) ?? null;
        },
      });

      const result = await migrator.migrateVault();

      // note-1 should be migrated, note-2 skipped (not found)
      // The migrated count includes notes that were skipped gracefully (null returns)
      // since they didn't error out
      expect(result.migrated).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Only note-1 should have been saved
      expect(savedNotes.has('note-1')).toBe(true);
      expect(savedNotes.has('note-2')).toBe(false);
    });
  });

  describe('content hash computation', () => {
    it('should compute consistent content hashes', async () => {
      const note1 = createTestNote('note-1', { title: 'Same Title', tags: ['tag1'] });
      const note2 = createTestNote('note-2', { title: 'Same Title', tags: ['tag1'] });

      mockNotes.set('note-1', note1);
      mockNotes.set('note-2', note2);

      const migrator = createMigrator();
      await migrator.migrateVault();

      const saved1 = savedNotes.get('note-1');
      const saved2 = savedNotes.get('note-2');

      // Same content should produce same hash
      expect(saved1?.sync?.contentHash).toBe(saved2?.sync?.contentHash);
    });

    it('should compute different hashes for different content', async () => {
      const note1 = createTestNote('note-1', { title: 'Title A' });
      const note2 = createTestNote('note-2', { title: 'Title B' });

      mockNotes.set('note-1', note1);
      mockNotes.set('note-2', note2);

      const migrator = createMigrator();
      await migrator.migrateVault();

      const saved1 = savedNotes.get('note-1');
      const saved2 = savedNotes.get('note-2');

      // Different content should produce different hashes
      expect(saved1?.sync?.contentHash).not.toBe(saved2?.sync?.contentHash);
    });
  });

  describe('database integration', () => {
    it('should store sync state with correct content hash', async () => {
      const note = createTestNote('note-1', { title: 'Test Title' });
      mockNotes.set('note-1', note);

      const migrator = createMigrator();
      await migrator.migrateVault();

      const syncState = db.getSyncState('note-1');
      const savedNote = savedNotes.get('note-1');

      // Hash in database should match hash in saved note
      expect(syncState?.contentHash).toBe(savedNote?.sync?.contentHash);
    });

    it('should queue changes with correct payload', async () => {
      const note = createTestNote('note-1', { title: 'Test Note Title' });
      mockNotes.set('note-1', note);

      const migrator = createMigrator();
      await migrator.migrateVault();

      const queuedChanges = db.getQueuedChanges();
      expect(queuedChanges).toHaveLength(1);

      const change = queuedChanges[0];
      expect(change.noteId).toBe('note-1');
      expect(change.operation).toBe('create');

      // Parse the payload and verify it contains the migrated note
      const payload = JSON.parse(change.payload!);
      expect(payload.title).toBe('Test Note Title');
      expect(payload.sync).toBeDefined();
      expect(payload.sync.version).toBe(1);
    });
  });
});
