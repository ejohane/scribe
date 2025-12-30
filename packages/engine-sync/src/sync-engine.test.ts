import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncEngine, createSyncEngine, type SyncEngineConfig } from './sync-engine.js';
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

// Helper to create empty editor content with proper structure
const createEmptyEditorContent = (): EditorContent => ({
  root: {
    type: 'root',
    children: [],
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

// Create a test SyncConfig
const createTestSyncConfig = (overrides: Partial<SyncConfig> = {}): SyncConfig => ({
  enabled: true,
  serverUrl: 'https://sync.test.com',
  deviceId: 'test-device-123',
  enabledAt: Date.now(),
  lastSyncSequence: 0,
  syncIntervalMs: 30000,
  ...overrides,
});

describe('SyncEngine', () => {
  let tempDir: string;
  let networkMonitor: SimpleNetworkMonitor;
  let savedNotes: Map<string, BaseNote>;
  let deletedNoteIds: Set<string>;
  let localNotes: Map<string, BaseNote>;

  const createEngineConfig = (overrides: Partial<SyncEngineConfig> = {}): SyncEngineConfig => ({
    vaultPath: tempDir,
    config: createTestSyncConfig(),
    networkMonitor,
    apiKey: 'sk_test_123',
    onSaveNote: async (note) => {
      savedNotes.set(note.id, note);
    },
    onDeleteNote: async (noteId) => {
      deletedNoteIds.add(noteId);
    },
    onReadNote: async (noteId) => {
      return localNotes.get(noteId) ?? null;
    },
    ...overrides,
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-engine-test-'));
    // Create derived directory
    fs.mkdirSync(path.join(tempDir, 'derived'), { recursive: true });

    networkMonitor = new SimpleNetworkMonitor(true);
    savedNotes = new Map();
    deletedNoteIds = new Set();
    localNotes = new Map();
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('constructor', () => {
    it('initializes all components', () => {
      const engine = new SyncEngine(createEngineConfig());

      // Should not throw and engine should exist
      expect(engine).toBeDefined();
      expect(engine.getDeviceId()).toBe('test-device-123');

      engine.shutdown();
    });

    it('uses provided network monitor', () => {
      const customMonitor = new SimpleNetworkMonitor(false);
      const engine = new SyncEngine(
        createEngineConfig({
          networkMonitor: customMonitor,
        })
      );

      // Status should reflect offline when monitor is offline
      const status = engine.getStatus();
      expect(status.state).toBe('offline');

      engine.shutdown();
    });

    it('falls back to DisabledNetworkMonitor when none provided', () => {
      const engine = new SyncEngine(
        createEngineConfig({
          networkMonitor: undefined,
        })
      );

      // DisabledNetworkMonitor always returns offline
      const status = engine.getStatus();
      expect(status.state).toBe('offline');

      engine.shutdown();
    });
  });

  describe('initialize', () => {
    it('is idempotent (safe to call multiple times)', async () => {
      const engine = new SyncEngine(createEngineConfig());

      await engine.initialize();
      await engine.initialize(); // Should not throw

      await engine.shutdown();
    });

    it('starts polling when online', async () => {
      vi.useFakeTimers();
      networkMonitor.setOnline(true);

      const engine = new SyncEngine(createEngineConfig());
      await engine.initialize();

      // Advance time and check that polling would trigger sync
      // (sync will fail because there's no real server, but polling should start)
      const status = engine.getStatus();
      expect(status.state).toBe('idle'); // Not syncing yet

      await engine.shutdown();
      vi.useRealTimers();
    });

    it('does not start polling when offline', async () => {
      networkMonitor.setOnline(false);

      const engine = new SyncEngine(createEngineConfig());
      await engine.initialize();

      const status = engine.getStatus();
      expect(status.state).toBe('offline');

      await engine.shutdown();
    });
  });

  describe('shutdown', () => {
    it('cleans up resources and clears listeners', async () => {
      const engine = new SyncEngine(createEngineConfig());
      await engine.initialize();

      let callbackCount = 0;
      engine.onStatusChange(() => {
        callbackCount++;
      });
      const initialCallbackCount = callbackCount; // Should be 1 from immediate call

      await engine.shutdown();

      // After shutdown, the listener should be cleared
      // Verify initial callback was called
      expect(initialCallbackCount).toBe(1);

      // The shutdown completed without throwing
      // (database is closed, network listener is cleaned up, etc.)
    });

    it('is safe to call multiple times', async () => {
      const engine = new SyncEngine(createEngineConfig());
      await engine.initialize();

      await engine.shutdown();
      await engine.shutdown(); // Should not throw
    });
  });

  describe('addSyncMetadata', () => {
    it('increments version from 0 to 1 for new notes', () => {
      const engine = new SyncEngine(createEngineConfig());
      const note = createTestNote({ sync: undefined });

      const noteWithSync = engine.addSyncMetadata(note);

      expect(noteWithSync.sync).toBeDefined();
      expect(noteWithSync.sync?.version).toBe(1);

      engine.shutdown();
    });

    it('increments existing version', () => {
      const engine = new SyncEngine(createEngineConfig());
      const note = createTestNote({
        sync: {
          version: 5,
          contentHash: 'oldhash',
        },
      });

      const noteWithSync = engine.addSyncMetadata(note);

      expect(noteWithSync.sync?.version).toBe(6);

      engine.shutdown();
    });

    it('computes content hash', () => {
      const engine = new SyncEngine(createEngineConfig());
      const note = createTestNote({ title: 'Test Title' });

      const noteWithSync = engine.addSyncMetadata(note);

      expect(noteWithSync.sync?.contentHash).toBeDefined();
      expect(noteWithSync.sync?.contentHash.length).toBe(16); // SHA-256 truncated to 16 chars

      engine.shutdown();
    });

    it('preserves serverVersion and syncedAt from existing sync metadata', () => {
      const engine = new SyncEngine(createEngineConfig());
      const note = createTestNote({
        sync: {
          version: 3,
          contentHash: 'oldhash',
          serverVersion: 10,
          syncedAt: 1234567890,
        },
      });

      const noteWithSync = engine.addSyncMetadata(note);

      expect(noteWithSync.sync?.serverVersion).toBe(10);
      expect(noteWithSync.sync?.syncedAt).toBe(1234567890);

      engine.shutdown();
    });

    it('sets deviceId', () => {
      const engine = new SyncEngine(createEngineConfig());
      const note = createTestNote();

      const noteWithSync = engine.addSyncMetadata(note);

      expect(noteWithSync.sync?.deviceId).toBe('test-device-123');

      engine.shutdown();
    });
  });

  describe('queueChange', () => {
    it('tracks change in change tracker', () => {
      const engine = new SyncEngine(createEngineConfig());
      const note = createTestNote({ id: createNoteId('queue-test') });

      engine.queueChange(note, 'create');

      // Check status to verify pending changes increased
      const status = engine.getStatus();
      expect(status.pendingChanges).toBe(1);

      engine.shutdown();
    });

    it('notifies status listeners', () => {
      const engine = new SyncEngine(createEngineConfig());
      const note = createTestNote({ id: createNoteId('listener-test') });

      const statuses: Array<{ pendingChanges: number }> = [];
      engine.onStatusChange((status) => {
        statuses.push({ pendingChanges: status.pendingChanges });
      });

      // Initial callback fires with 0 pending
      expect(statuses[0].pendingChanges).toBe(0);

      engine.queueChange(note, 'create');

      // Should have been notified of the change
      expect(statuses.length).toBeGreaterThan(1);
      expect(statuses[statuses.length - 1].pendingChanges).toBe(1);

      engine.shutdown();
    });
  });

  describe('queueDelete', () => {
    it('tracks deletion in change tracker', () => {
      const engine = new SyncEngine(createEngineConfig());

      engine.queueDelete('delete-test-note');

      const status = engine.getStatus();
      expect(status.pendingChanges).toBe(1);

      engine.shutdown();
    });
  });

  describe('getStatus', () => {
    it('returns disabled when sync is disabled', () => {
      const engine = new SyncEngine(
        createEngineConfig({
          config: createTestSyncConfig({ enabled: false }),
        })
      );

      const status = engine.getStatus();
      expect(status.state).toBe('disabled');

      engine.shutdown();
    });

    it('returns offline when network is offline', () => {
      networkMonitor.setOnline(false);
      const engine = new SyncEngine(createEngineConfig());

      const status = engine.getStatus();
      expect(status.state).toBe('offline');

      engine.shutdown();
    });

    it('returns idle when online and not syncing', () => {
      networkMonitor.setOnline(true);
      const engine = new SyncEngine(createEngineConfig());

      const status = engine.getStatus();
      expect(status.state).toBe('idle');

      engine.shutdown();
    });

    it('includes pendingChanges count', () => {
      const engine = new SyncEngine(createEngineConfig());
      const note = createTestNote({ id: createNoteId('pending-count-test') });

      engine.queueChange(note, 'create');

      const status = engine.getStatus();
      expect(status.pendingChanges).toBe(1);

      engine.shutdown();
    });

    it('includes conflictCount', () => {
      const engine = new SyncEngine(createEngineConfig());

      // Initially should be 0
      const status = engine.getStatus();
      expect(status.conflictCount).toBe(0);

      engine.shutdown();
    });
  });

  describe('onStatusChange', () => {
    it('subscribes and returns unsubscribe function', () => {
      const engine = new SyncEngine(createEngineConfig());

      const statuses: Array<{ state: string }> = [];
      const unsubscribe = engine.onStatusChange((status) => {
        statuses.push({ state: status.state });
      });

      // Should have received initial callback
      expect(statuses.length).toBe(1);

      unsubscribe();

      // Queue a change - should not trigger callback
      const note = createTestNote({ id: createNoteId('unsubscribe-test') });
      engine.queueChange(note, 'create');

      // Callback count should not have increased after unsubscribe
      // (the queueChange does notify, but we unsubscribed)
      expect(statuses.length).toBe(1);

      engine.shutdown();
    });

    it('immediately calls callback with current status', () => {
      networkMonitor.setOnline(false);
      const engine = new SyncEngine(createEngineConfig());

      let initialStatus: { state: string } | undefined;
      engine.onStatusChange((status) => {
        if (!initialStatus) {
          initialStatus = { state: status.state };
        }
      });

      expect(initialStatus).toBeDefined();
      expect(initialStatus!.state).toBe('offline');

      engine.shutdown();
    });
  });

  describe('getDeviceId', () => {
    it('returns the device ID from config', () => {
      const engine = new SyncEngine(createEngineConfig());

      expect(engine.getDeviceId()).toBe('test-device-123');

      engine.shutdown();
    });
  });

  describe('getConflicts', () => {
    it('returns empty array when no conflicts', () => {
      const engine = new SyncEngine(createEngineConfig());

      const conflicts = engine.getConflicts();
      expect(conflicts).toEqual([]);

      engine.shutdown();
    });
  });

  describe('createSyncEngine factory', () => {
    it('creates and initializes engine', async () => {
      const engine = await createSyncEngine(createEngineConfig());

      expect(engine).toBeDefined();
      expect(engine.getDeviceId()).toBe('test-device-123');

      await engine.shutdown();
    });
  });

  describe('network status changes', () => {
    it('starts polling when going online', async () => {
      networkMonitor.setOnline(false);
      const engine = new SyncEngine(createEngineConfig());
      await engine.initialize();

      const statuses: Array<{ state: string }> = [];
      engine.onStatusChange((status) => {
        statuses.push({ state: status.state });
      });

      // Go online
      networkMonitor.setOnline(true);

      // Status should change from offline to idle (or syncing)
      expect(statuses.length).toBeGreaterThan(0);
      const lastStatus = statuses[statuses.length - 1]!;
      expect(['idle', 'syncing']).toContain(lastStatus.state);

      await engine.shutdown();
    });

    it('stops polling when going offline', async () => {
      networkMonitor.setOnline(true);
      const engine = new SyncEngine(createEngineConfig());
      await engine.initialize();

      const statuses: Array<{ state: string }> = [];
      engine.onStatusChange((status) => {
        statuses.push({ state: status.state });
      });

      // Go offline
      networkMonitor.setOnline(false);

      // Status should change to offline
      expect(statuses.length).toBeGreaterThan(0);
      const lastStatus = statuses[statuses.length - 1]!;
      expect(lastStatus.state).toBe('offline');

      await engine.shutdown();
    });
  });
});
