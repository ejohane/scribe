/**
 * Integration tests for vault migration scenarios.
 *
 * These tests verify the complete migration path for existing vaults that don't
 * have sync enabled, ensuring a smooth upgrade experience without data loss.
 *
 * Unlike the unit tests in vault-migrator.test.ts, these integration tests:
 * - Use real filesystem operations
 * - Create actual note files on disk
 * - Test the full SyncEngine initialization flow
 * - Verify database state after migration
 *
 * @module vault-migration.integration.test
 * @since 1.1.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncEngine } from './sync-engine.js';
import { SyncDatabase } from './sync-database.js';
import { VaultMigrator } from './vault-migrator.js';
import { loadSyncConfig, saveSyncConfig, createDefaultSyncConfig } from './sync-config.js';
import { SimpleNetworkMonitor } from './network-monitor.js';
import {
  createNoteId,
  type BaseNote,
  type NoteMetadata,
  type EditorContent,
  type SyncConfig,
} from '@scribe/shared';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';

// =============================================================================
// Test Helpers
// =============================================================================

/** Create empty editor content with proper structure */
const createEmptyEditorContent = (): EditorContent => ({
  root: {
    type: 'root',
    children: [],
  },
});

/** Create editor content with text */
const createEditorContent = (text: string): EditorContent => ({
  root: {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
  },
});

/** Create test notes with proper types */
const createTestNote = (id: string, overrides: Partial<BaseNote> = {}): BaseNote => {
  const defaultMetadata: NoteMetadata = {
    title: null,
    tags: [],
    links: [],
    mentions: [],
  };

  return {
    id: createNoteId(id),
    title: `Test Note ${id}`,
    content: createEmptyEditorContent(),
    tags: ['test'],
    metadata: defaultMetadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
};

/** Create a test SyncConfig */
const createTestSyncConfig = (overrides: Partial<SyncConfig> = {}): SyncConfig => ({
  enabled: true,
  serverUrl: 'https://sync.test.com',
  deviceId: 'test-device-123',
  enabledAt: Date.now(),
  lastSyncSequence: 0,
  syncIntervalMs: 30000,
  ...overrides,
});

/** Helper to write a note to the filesystem as JSON */
const writeNoteToFile = (vaultPath: string, note: BaseNote): void => {
  const notesDir = path.join(vaultPath, 'notes');
  fs.mkdirSync(notesDir, { recursive: true });
  fs.writeFileSync(path.join(notesDir, `${note.id}.json`), JSON.stringify(note, null, 2));
};

/** Helper to read a note from the filesystem */
const readNoteFromFile = (vaultPath: string, noteId: string): BaseNote | null => {
  const notePath = path.join(vaultPath, 'notes', `${noteId}.json`);
  try {
    const content = fs.readFileSync(notePath, 'utf-8');
    return JSON.parse(content) as BaseNote;
  } catch {
    return null;
  }
};

/** Helper to list all note IDs in the vault */
const listNoteIds = (vaultPath: string): string[] => {
  const notesDir = path.join(vaultPath, 'notes');
  try {
    const files = fs.readdirSync(notesDir);
    return files.filter((f) => f.endsWith('.json')).map((f) => f.replace('.json', ''));
  } catch {
    return [];
  }
};

// =============================================================================
// Integration Tests
// =============================================================================

describe('Vault Migration Integration', () => {
  let tempDir: string;
  let vaultPath: string;
  let networkMonitor: SimpleNetworkMonitor;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'migration-test-'));
    vaultPath = tempDir;
    networkMonitor = new SimpleNetworkMonitor(false); // Start offline to prevent auto-sync

    // Create required directory structure
    fs.mkdirSync(path.join(vaultPath, 'derived'), { recursive: true });
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // Fresh Vault Tests
  // ===========================================================================

  describe('fresh vault', () => {
    it('should initialize sync database for a new vault', async () => {
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');

      // Verify database doesn't exist yet
      expect(fs.existsSync(dbPath)).toBe(false);

      const engine = new SyncEngine({
        vaultPath,
        config: createTestSyncConfig(),
        networkMonitor,
        apiKey: 'test-key',
        onSaveNote: vi.fn(),
        onDeleteNote: vi.fn(),
        onReadNote: vi.fn().mockResolvedValue(null),
      });

      await engine.initialize();

      // Should have created sync database
      expect(fs.existsSync(dbPath)).toBe(true);

      // Verify database is valid by checking we can read from it
      const db = new SyncDatabase({ dbPath });
      expect(db.getQueueSize()).toBe(0);
      expect(db.getAllConflicts()).toHaveLength(0);
      db.close();

      await engine.shutdown();
    });

    it('should start with empty sync state for new vault', async () => {
      const engine = new SyncEngine({
        vaultPath,
        config: createTestSyncConfig(),
        networkMonitor,
        apiKey: 'test-key',
        onSaveNote: vi.fn(),
        onDeleteNote: vi.fn(),
        onReadNote: vi.fn().mockResolvedValue(null),
      });

      await engine.initialize();

      const status = engine.getStatus();
      expect(status.pendingChanges).toBe(0);
      expect(status.conflictCount).toBe(0);

      await engine.shutdown();
    });

    it('should preserve device ID across restarts', async () => {
      const config = createTestSyncConfig({ deviceId: 'unique-device-id-123' });

      // First initialization
      const engine1 = new SyncEngine({
        vaultPath,
        config,
        networkMonitor,
        apiKey: 'test-key',
        onSaveNote: vi.fn(),
        onDeleteNote: vi.fn(),
        onReadNote: vi.fn().mockResolvedValue(null),
      });

      await engine1.initialize();
      const deviceId1 = engine1.getDeviceId();
      await engine1.shutdown();

      // Second initialization (simulating restart)
      const engine2 = new SyncEngine({
        vaultPath,
        config,
        networkMonitor,
        apiKey: 'test-key',
        onSaveNote: vi.fn(),
        onDeleteNote: vi.fn(),
        onReadNote: vi.fn().mockResolvedValue(null),
      });

      await engine2.initialize();
      const deviceId2 = engine2.getDeviceId();
      await engine2.shutdown();

      // Device ID should be preserved
      expect(deviceId1).toBe(deviceId2);
      expect(deviceId1).toBe('unique-device-id-123');
    });
  });

  // ===========================================================================
  // Existing Vault Without Sync Tests
  // ===========================================================================

  describe('existing vault without sync', () => {
    beforeEach(() => {
      // Create a vault structure with notes that have no sync metadata
      const note1 = createTestNote('note-1', {
        title: 'Existing Note 1',
        content: createEditorContent('existing content 1'),
      });
      const note2 = createTestNote('note-2', {
        title: 'Existing Note 2',
        content: createEditorContent('existing content 2'),
      });

      writeNoteToFile(vaultPath, note1);
      writeNoteToFile(vaultPath, note2);
    });

    it('should not modify existing notes during engine initialization', async () => {
      // Read original notes
      const originalNote1 = readNoteFromFile(vaultPath, 'note-1');
      const originalNote2 = readNoteFromFile(vaultPath, 'note-2');

      expect(originalNote1).not.toBeNull();
      expect(originalNote2).not.toBeNull();

      // Initialize engine (should not auto-migrate)
      const engine = new SyncEngine({
        vaultPath,
        config: createTestSyncConfig(),
        networkMonitor,
        apiKey: 'test-key',
        onSaveNote: vi.fn(),
        onDeleteNote: vi.fn(),
        onReadNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
      });

      await engine.initialize();

      // Existing notes should be unchanged (no sync metadata added automatically)
      const noteAfter1 = readNoteFromFile(vaultPath, 'note-1');
      const noteAfter2 = readNoteFromFile(vaultPath, 'note-2');

      expect(noteAfter1?.title).toBe(originalNote1?.title);
      expect(noteAfter2?.title).toBe(originalNote2?.title);
      expect(noteAfter1?.sync).toBeUndefined(); // No sync metadata added
      expect(noteAfter2?.sync).toBeUndefined();

      await engine.shutdown();
    });

    it('should detect notes needing migration via VaultMigrator', async () => {
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');
      const db = new SyncDatabase({ dbPath });

      const migrator = new VaultMigrator({
        database: db,
        deviceId: 'test-device',
        listNoteIds: async () => listNoteIds(vaultPath),
        readNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
        saveNote: async (note) => writeNoteToFile(vaultPath, note),
      });

      // Should detect notes needing migration
      const needsMigration = await migrator.needsMigration();
      expect(needsMigration).toBe(true);

      db.close();
    });

    it('should compute hashes for existing notes during migration', async () => {
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');
      const db = new SyncDatabase({ dbPath });

      const migrator = new VaultMigrator({
        database: db,
        deviceId: 'test-device-456',
        listNoteIds: async () => listNoteIds(vaultPath),
        readNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
        saveNote: async (note) => writeNoteToFile(vaultPath, note),
      });

      // Run migration
      const result = await migrator.migrateVault();

      expect(result.migrated).toBe(2);
      expect(result.errors).toHaveLength(0);

      // Verify notes have sync metadata with hashes
      const note1 = readNoteFromFile(vaultPath, 'note-1');
      const note2 = readNoteFromFile(vaultPath, 'note-2');

      expect(note1?.sync).toBeDefined();
      expect(note1?.sync?.contentHash).toMatch(/^[a-f0-9]{16}$/);
      expect(note1?.sync?.version).toBe(1);
      expect(note1?.sync?.deviceId).toBe('test-device-456');

      expect(note2?.sync).toBeDefined();
      expect(note2?.sync?.contentHash).toMatch(/^[a-f0-9]{16}$/);

      // Hashes should be stored in database
      const syncState1 = db.getSyncState('note-1');
      const syncState2 = db.getSyncState('note-2');

      expect(syncState1?.contentHash).toBe(note1?.sync?.contentHash);
      expect(syncState2?.contentHash).toBe(note2?.sync?.contentHash);

      db.close();
    });

    it('should queue all existing notes for initial sync after migration', async () => {
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');
      const db = new SyncDatabase({ dbPath });

      const migrator = new VaultMigrator({
        database: db,
        deviceId: 'test-device',
        listNoteIds: async () => listNoteIds(vaultPath),
        readNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
        saveNote: async (note) => writeNoteToFile(vaultPath, note),
      });

      await migrator.migrateVault();

      // All notes should be queued for initial push
      const queuedChanges = db.getQueuedChanges();
      expect(queuedChanges.length).toBe(2);

      const noteIds = queuedChanges.map((c) => c.noteId).sort();
      expect(noteIds).toEqual(['note-1', 'note-2']);

      // All should be 'create' operations
      expect(queuedChanges.every((c) => c.operation === 'create')).toBe(true);

      db.close();
    });

    it('should preserve original note content during migration', async () => {
      const originalNote1 = readNoteFromFile(vaultPath, 'note-1');

      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');
      const db = new SyncDatabase({ dbPath });

      const migrator = new VaultMigrator({
        database: db,
        deviceId: 'test-device',
        listNoteIds: async () => listNoteIds(vaultPath),
        readNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
        saveNote: async (note) => writeNoteToFile(vaultPath, note),
      });

      await migrator.migrateVault();

      // Content should be preserved
      const migratedNote1 = readNoteFromFile(vaultPath, 'note-1');

      expect(migratedNote1?.title).toBe(originalNote1?.title);
      expect(migratedNote1?.content).toEqual(originalNote1?.content);
      expect(migratedNote1?.tags).toEqual(originalNote1?.tags);
      expect(migratedNote1?.createdAt).toBe(originalNote1?.createdAt);

      db.close();
    });
  });

  // ===========================================================================
  // Vault with Partial Sync State Tests
  // ===========================================================================

  describe('vault with partial sync state', () => {
    beforeEach(() => {
      // Create a vault with some notes that have sync metadata and some that don't
      const syncedNote = createTestNote('synced-note', {
        title: 'Synced Note',
        content: createEditorContent('synced content'),
        sync: {
          version: 3,
          contentHash: 'existing-hash-123',
          serverVersion: 2,
          syncedAt: Date.now() - 86400000, // 1 day ago
          deviceId: 'other-device',
        },
      });

      const unsyncedNote = createTestNote('unsynced-note', {
        title: 'Unsynced Note',
        content: createEditorContent('unsynced content'),
        // No sync metadata
      });

      const partialSyncNote = createTestNote('partial-sync-note', {
        title: 'Partial Sync Note',
        sync: {
          version: 1,
          contentHash: 'partial-hash',
          // No serverVersion or syncedAt (never successfully synced)
          deviceId: 'this-device',
        },
      });

      writeNoteToFile(vaultPath, syncedNote);
      writeNoteToFile(vaultPath, unsyncedNote);
      writeNoteToFile(vaultPath, partialSyncNote);
    });

    it('should detect notes that need syncing', async () => {
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');
      const db = new SyncDatabase({ dbPath });

      const migrator = new VaultMigrator({
        database: db,
        deviceId: 'test-device',
        listNoteIds: async () => listNoteIds(vaultPath),
        readNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
        saveNote: async (note) => writeNoteToFile(vaultPath, note),
      });

      // Should detect unsynced note
      const needsMigration = await migrator.needsMigration();
      expect(needsMigration).toBe(true);

      db.close();
    });

    it('should skip notes that already have sync metadata during migration', async () => {
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');
      const db = new SyncDatabase({ dbPath });

      const savedNotes: string[] = [];
      const migrator = new VaultMigrator({
        database: db,
        deviceId: 'test-device',
        listNoteIds: async () => listNoteIds(vaultPath),
        readNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
        saveNote: async (note) => {
          savedNotes.push(note.id);
          writeNoteToFile(vaultPath, note);
        },
      });

      await migrator.migrateVault();

      // Only the unsynced note should have been saved (modified)
      expect(savedNotes).toContain('unsynced-note');
      expect(savedNotes).not.toContain('synced-note');
      expect(savedNotes).not.toContain('partial-sync-note');

      // Synced note should retain original sync metadata
      const syncedNote = readNoteFromFile(vaultPath, 'synced-note');
      expect(syncedNote?.sync?.version).toBe(3);
      expect(syncedNote?.sync?.serverVersion).toBe(2);
      expect(syncedNote?.sync?.contentHash).toBe('existing-hash-123');

      db.close();
    });

    it('should correctly handle mixed sync states in database', async () => {
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');
      const db = new SyncDatabase({ dbPath });

      const migrator = new VaultMigrator({
        database: db,
        deviceId: 'test-device',
        listNoteIds: async () => listNoteIds(vaultPath),
        readNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
        saveNote: async (note) => writeNoteToFile(vaultPath, note),
      });

      await migrator.migrateVault();

      // Check database state for unsynced note
      const unsyncedState = db.getSyncState('unsynced-note');
      expect(unsyncedState).not.toBeNull();
      expect(unsyncedState?.localVersion).toBe(1);
      expect(unsyncedState?.serverVersion).toBeNull();
      expect(unsyncedState?.status).toBe('pending');

      // Previously synced notes should not be in the sync state table
      // (unless we explicitly tracked them).
      // syncedState depends on implementation - may or may not be present

      db.close();
    });
  });

  // ===========================================================================
  // Sync Database Upgrade Tests
  // ===========================================================================

  describe('sync database upgrade', () => {
    it('should handle opening fresh database', async () => {
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');

      // Should not throw when creating new database
      const db = new SyncDatabase({ dbPath });

      expect(db.getDeviceId()).toBeNull();
      expect(db.getQueueSize()).toBe(0);
      expect(db.getLastSyncSequence()).toBe(0);

      db.close();
    });

    it('should preserve data across database close and reopen', async () => {
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');

      // First session - write data
      const db1 = new SyncDatabase({ dbPath });
      db1.setDeviceId('test-device-789');
      db1.setLastSyncSequence(42);
      db1.setSyncState('note-123', {
        localVersion: 5,
        serverVersion: 4,
        contentHash: 'abc123def456',
        lastSyncedAt: Date.now(),
        status: 'synced',
      });
      db1.queueChange('note-456', 'update', 2, { title: 'Test' });
      db1.close();

      // Second session - read data
      const db2 = new SyncDatabase({ dbPath });

      expect(db2.getDeviceId()).toBe('test-device-789');
      expect(db2.getLastSyncSequence()).toBe(42);

      const syncState = db2.getSyncState('note-123');
      expect(syncState?.localVersion).toBe(5);
      expect(syncState?.serverVersion).toBe(4);
      expect(syncState?.contentHash).toBe('abc123def456');
      expect(syncState?.status).toBe('synced');

      expect(db2.getQueueSize()).toBe(1);

      db2.close();
    });

    it('should handle concurrent engine initialization', async () => {
      // This tests that the database handles WAL mode correctly
      const config = createTestSyncConfig();

      const engines: SyncEngine[] = [];

      // Create multiple engines (simulating multiple processes/windows)
      for (let i = 0; i < 3; i++) {
        const engine = new SyncEngine({
          vaultPath,
          config,
          networkMonitor,
          apiKey: 'test-key',
          onSaveNote: vi.fn(),
          onDeleteNote: vi.fn(),
          onReadNote: vi.fn().mockResolvedValue(null),
        });
        engines.push(engine);
      }

      // Initialize all engines concurrently - should not throw
      await Promise.all(engines.map((e) => e.initialize()));

      // All should report same device ID
      const deviceIds = engines.map((e) => e.getDeviceId());
      expect(new Set(deviceIds).size).toBe(1);

      // Clean up
      await Promise.all(engines.map((e) => e.shutdown()));
    });
  });

  // ===========================================================================
  // Config Migration Tests
  // ===========================================================================

  describe('config migration', () => {
    it('should load sync config from standard location', async () => {
      // Save config to .scribe/sync.json
      const config = createDefaultSyncConfig();
      await saveSyncConfig(vaultPath, config);

      // Load it back
      const result = await loadSyncConfig(vaultPath);

      expect(result.status).toBe('enabled');
      if (result.status === 'enabled') {
        expect(result.config.enabled).toBe(true);
        expect(result.config.serverUrl).toBeDefined();
        expect(result.config.deviceId).toBe(config.deviceId);
      }
    });

    it('should return disabled status when config file is missing', async () => {
      const result = await loadSyncConfig(vaultPath);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('missing');
      }
    });

    it('should handle malformed config file gracefully', async () => {
      // Create malformed config
      const scribeDir = path.join(vaultPath, '.scribe');
      fs.mkdirSync(scribeDir, { recursive: true });
      fs.writeFileSync(path.join(scribeDir, 'sync.json'), '{ invalid json }');

      const result = await loadSyncConfig(vaultPath);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('malformed');
      }
    });

    it('should return disabled when enabled is false', async () => {
      const config = createDefaultSyncConfig(false);
      await saveSyncConfig(vaultPath, config);

      const result = await loadSyncConfig(vaultPath);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('disabled');
      }
    });

    it('should handle partial config with missing required fields', async () => {
      const scribeDir = path.join(vaultPath, '.scribe');
      fs.mkdirSync(scribeDir, { recursive: true });
      // Missing required fields like deviceId, syncIntervalMs
      fs.writeFileSync(
        path.join(scribeDir, 'sync.json'),
        JSON.stringify({
          enabled: true,
          serverUrl: 'https://sync.test.com',
          // Missing deviceId, enabledAt, lastSyncSequence, syncIntervalMs
        })
      );

      const result = await loadSyncConfig(vaultPath);

      expect(result.status).toBe('disabled');
      if (result.status === 'disabled') {
        expect(result.reason).toBe('malformed');
      }
    });

    it('should preserve config values across save and load', async () => {
      const originalConfig: SyncConfig = {
        enabled: true,
        serverUrl: 'https://custom-server.example.com/sync',
        deviceId: 'custom-device-id-xyz',
        enabledAt: 1703980800000, // 2024-01-01
        lastSyncSequence: 12345,
        syncIntervalMs: 60000,
      };

      await saveSyncConfig(vaultPath, originalConfig);
      const result = await loadSyncConfig(vaultPath);

      expect(result.status).toBe('enabled');
      if (result.status === 'enabled') {
        expect(result.config).toEqual(originalConfig);
      }
    });
  });

  // ===========================================================================
  // End-to-End Migration Scenario Tests
  // ===========================================================================

  describe('end-to-end migration scenarios', () => {
    it('should complete full migration flow: detect, migrate, verify', async () => {
      // Step 1: Create an existing vault with notes (no sync)
      const notes = [
        createTestNote('note-a', { title: 'Note A', content: createEditorContent('Content A') }),
        createTestNote('note-b', { title: 'Note B', content: createEditorContent('Content B') }),
        createTestNote('note-c', { title: 'Note C', content: createEditorContent('Content C') }),
      ];

      for (const note of notes) {
        writeNoteToFile(vaultPath, note);
      }

      // Step 2: Initialize sync database and migrator
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');
      const db = new SyncDatabase({ dbPath });

      const progressUpdates: string[] = [];
      const migrator = new VaultMigrator({
        database: db,
        deviceId: 'migration-test-device',
        listNoteIds: async () => listNoteIds(vaultPath),
        readNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
        saveNote: async (note) => writeNoteToFile(vaultPath, note),
        onProgress: (p) => progressUpdates.push(p.phase),
      });

      // Step 3: Verify migration is needed
      expect(await migrator.needsMigration()).toBe(true);

      // Step 4: Run migration
      const result = await migrator.migrateVault();

      expect(result.migrated).toBe(3);
      expect(result.errors).toHaveLength(0);

      // Step 5: Verify progress updates
      expect(progressUpdates).toContain('scanning');
      expect(progressUpdates).toContain('migrating');
      expect(progressUpdates).toContain('queueing');
      expect(progressUpdates).toContain('complete');

      // Step 6: Verify all notes have sync metadata
      for (const note of notes) {
        const migratedNote = readNoteFromFile(vaultPath, note.id);
        expect(migratedNote?.sync).toBeDefined();
        expect(migratedNote?.sync?.version).toBe(1);
        expect(migratedNote?.sync?.deviceId).toBe('migration-test-device');
      }

      // Step 7: Verify database state
      expect(db.getQueueSize()).toBe(3);
      for (const note of notes) {
        const syncState = db.getSyncState(note.id);
        expect(syncState?.status).toBe('pending');
      }

      // Step 8: Verify migration is no longer needed
      expect(await migrator.needsMigration()).toBe(false);

      db.close();
    });

    it('should handle migration with errors gracefully', async () => {
      // Create notes
      const note1 = createTestNote('good-note', { title: 'Good Note' });
      const note2 = createTestNote('bad-note', { title: 'Bad Note' });
      const note3 = createTestNote('another-good-note', { title: 'Another Good Note' });

      writeNoteToFile(vaultPath, note1);
      writeNoteToFile(vaultPath, note2);
      writeNoteToFile(vaultPath, note3);

      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');
      const db = new SyncDatabase({ dbPath });

      // Create migrator that fails on one note
      const migrator = new VaultMigrator({
        database: db,
        deviceId: 'test-device',
        listNoteIds: async () => listNoteIds(vaultPath),
        readNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
        saveNote: async (note) => {
          if (note.id === 'bad-note') {
            throw new Error('Simulated save failure');
          }
          writeNoteToFile(vaultPath, note);
        },
      });

      // Suppress console.error
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const result = await migrator.migrateVault();

      consoleSpy.mockRestore();

      // Should have migrated 2 out of 3
      expect(result.migrated).toBe(2);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('bad-note');

      // Good notes should be migrated
      const goodNote = readNoteFromFile(vaultPath, 'good-note');
      expect(goodNote?.sync).toBeDefined();

      db.close();
    });

    it('should integrate with SyncEngine after migration', async () => {
      // Create existing notes
      const note = createTestNote('integration-note', {
        title: 'Integration Test Note',
        content: createEditorContent('Integration test content'),
      });
      writeNoteToFile(vaultPath, note);

      // Run migration first
      const dbPath = path.join(vaultPath, 'derived', 'sync.sqlite3');
      const db = new SyncDatabase({ dbPath });

      const migrator = new VaultMigrator({
        database: db,
        deviceId: 'integration-device',
        listNoteIds: async () => listNoteIds(vaultPath),
        readNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
        saveNote: async (note) => writeNoteToFile(vaultPath, note),
      });

      await migrator.migrateVault();
      db.close();

      // Now initialize SyncEngine
      const engine = new SyncEngine({
        vaultPath,
        config: createTestSyncConfig({ deviceId: 'integration-device' }),
        networkMonitor,
        apiKey: 'test-key',
        onSaveNote: async (n) => writeNoteToFile(vaultPath, n),
        onDeleteNote: vi.fn(),
        onReadNote: async (noteId) => readNoteFromFile(vaultPath, noteId),
      });

      await engine.initialize();

      // Engine should see the pending changes from migration
      const status = engine.getStatus();
      expect(status.pendingChanges).toBe(1);

      // Device ID should match
      expect(engine.getDeviceId()).toBe('integration-device');

      await engine.shutdown();
    });
  });
});
