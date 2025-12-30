/**
 * Integration tests for complete sync flow.
 *
 * These tests verify the complete sync flow including pushing local changes,
 * pulling remote changes, and proper coordination between components.
 *
 * The transport layer is mocked, but all other components use real implementations.
 *
 * @module sync-flow.integration.test
 * @since 1.0.0
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncEngine, type SyncEngineConfig } from './sync-engine.js';
import { SyncTransport } from './sync-transport.js';
import { SimpleNetworkMonitor } from './network-monitor.js';
import {
  createNoteId,
  type BaseNote,
  type NoteMetadata,
  type EditorContent,
  type SyncConfig,
  type SyncPushResponse,
  type SyncPullResponse,
  type SyncPushRequest,
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

// =============================================================================
// Mock Transport
// =============================================================================

type MockTransport = SyncTransport & {
  push: ReturnType<typeof vi.fn>;
  pull: ReturnType<typeof vi.fn>;
  checkStatus: ReturnType<typeof vi.fn>;
};

interface MockServerState {
  serverNotes: Map<string, BaseNote>;
  serverSequence: number;
  pushCount: number;
  pullCount: number;
}

const createMockTransport = (): { transport: MockTransport; state: MockServerState } => {
  const state: MockServerState = {
    serverNotes: new Map(),
    serverSequence: 0,
    pushCount: 0,
    pullCount: 0,
  };

  const transport = {
    push: vi.fn(),
    pull: vi.fn(),
    checkStatus: vi.fn().mockResolvedValue({
      ok: true,
      serverTime: new Date().toISOString(),
    }),
  } as unknown as MockTransport;

  return { transport, state };
};

/**
 * Set up mock transport to accept all pushes.
 */
const setupMockTransportAcceptAll = (transport: MockTransport, state: MockServerState): void => {
  transport.push.mockImplementation(async (request: SyncPushRequest): Promise<SyncPushResponse> => {
    state.pushCount++;
    const accepted = request.changes.map((change) => {
      state.serverSequence++;
      if (change.payload) {
        state.serverNotes.set(change.noteId, change.payload as BaseNote);
      }
      return {
        noteId: change.noteId,
        serverVersion: change.version,
        serverSequence: state.serverSequence,
      };
    });
    return { accepted, conflicts: [], errors: [] };
  });
};

/**
 * Set up mock transport with no changes to pull.
 */
const setupMockTransportEmptyPull = (transport: MockTransport, state: MockServerState): void => {
  transport.pull.mockImplementation(async (): Promise<SyncPullResponse> => {
    state.pullCount++;
    return {
      changes: [],
      hasMore: false,
      latestSequence: state.serverSequence,
      serverTime: new Date().toISOString(),
    };
  });
};

/**
 * Set up mock transport to return specific changes on pull.
 */
const setupMockTransportWithChanges = (
  transport: MockTransport,
  state: MockServerState,
  changes: SyncPullResponse['changes']
): void => {
  transport.pull.mockImplementation(async (): Promise<SyncPullResponse> => {
    state.pullCount++;
    return {
      changes,
      hasMore: false,
      latestSequence: state.serverSequence,
      serverTime: new Date().toISOString(),
    };
  });
};

// =============================================================================
// Integration Tests
// =============================================================================

describe('Sync Flow Integration Tests', () => {
  let tempDir: string;
  let networkMonitor: SimpleNetworkMonitor;
  let mockTransport: MockTransport;
  let mockState: MockServerState;
  let savedNotes: Map<string, BaseNote>;
  let deletedNoteIds: Set<string>;
  let localNotes: Map<string, BaseNote>;

  /** Helper to inject mock transport into engine */
  const injectMockTransport = (engine: SyncEngine): void => {
    // Access private transport property and replace with mock
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).transport = mockTransport;
    // Also inject into coordinator
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (engine as any).coordinator.config.transport = mockTransport;
  };

  const createEngineConfig = (overrides: Partial<SyncEngineConfig> = {}): SyncEngineConfig => ({
    vaultPath: tempDir,
    config: createTestSyncConfig(),
    networkMonitor,
    apiKey: 'sk_test_123',
    onSaveNote: async (note) => {
      savedNotes.set(note.id, note);
      localNotes.set(note.id, note);
    },
    onDeleteNote: async (noteId) => {
      deletedNoteIds.add(noteId);
      localNotes.delete(noteId);
    },
    onReadNote: async (noteId) => {
      return localNotes.get(noteId) ?? null;
    },
    ...overrides,
  });

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-flow-integration-'));
    fs.mkdirSync(path.join(tempDir, 'derived'), { recursive: true });

    networkMonitor = new SimpleNetworkMonitor(true);
    const mock = createMockTransport();
    mockTransport = mock.transport;
    mockState = mock.state;
    savedNotes = new Map();
    deletedNoteIds = new Set();
    localNotes = new Map();

    // Disable automatic timers to control sync timing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  // ===========================================================================
  // Push Flow Tests
  // ===========================================================================

  describe('Push Flow', () => {
    it('pushes local changes to server', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Create and queue a note
      const note = createTestNote({
        id: createNoteId('push-test-note'),
        title: 'Push Test Note',
        content: createEditorContent('Test content'),
      });
      localNotes.set(note.id, note);
      const noteWithSync = engine.addSyncMetadata(note);
      engine.queueChange(noteWithSync, 'create');

      // Verify pending changes
      expect(engine.getStatus().pendingChanges).toBe(1);

      // Trigger sync
      const result = await engine.triggerSync();

      expect(result.pushed).toBe(1);
      expect(result.errors).toHaveLength(0);
      expect(mockTransport.push).toHaveBeenCalled();

      await engine.shutdown();
    });

    it('pushes multiple changes in batch', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Create multiple notes
      for (let i = 0; i < 5; i++) {
        const note = createTestNote({
          id: createNoteId(`batch-note-${i}`),
          title: `Batch Note ${i}`,
        });
        localNotes.set(note.id, note);
        const noteWithSync = engine.addSyncMetadata(note);
        engine.queueChange(noteWithSync, 'create');
      }

      expect(engine.getStatus().pendingChanges).toBe(5);

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(5);
      expect(mockState.pushCount).toBe(1); // All changes in one batch

      await engine.shutdown();
    });

    it('tracks progress during push', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      const statuses: Array<{ state: string; pendingChanges: number }> = [];

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      engine.onStatusChange((status) => {
        statuses.push({ state: status.state, pendingChanges: status.pendingChanges });
      });

      await engine.initialize();

      const note = createTestNote({ id: createNoteId('progress-note') });
      localNotes.set(note.id, note);
      const noteWithSync = engine.addSyncMetadata(note);
      engine.queueChange(noteWithSync, 'create');

      await engine.triggerSync();

      // Should have transitioned through states
      expect(statuses.some((s) => s.state === 'syncing')).toBe(true);
      expect(statuses.some((s) => s.pendingChanges === 0)).toBe(true);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Pull Flow Tests
  // ===========================================================================

  describe('Pull Flow', () => {
    it('pulls remote changes from server', async () => {
      const remoteNote = createTestNote({
        id: createNoteId('remote-note'),
        title: 'Remote Note',
        sync: { version: 1, contentHash: 'abc123' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 10;
      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'remote-note',
          operation: 'create',
          version: 1,
          serverSequence: 10,
          note: remoteNote,
          timestamp: new Date().toISOString(),
        },
      ]);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const result = await engine.triggerSync();

      expect(result.pulled).toBe(1);
      expect(savedNotes.has('remote-note')).toBe(true);
      expect(savedNotes.get('remote-note')?.title).toBe('Remote Note');

      await engine.shutdown();
    });

    it('applies pulled changes to local storage', async () => {
      const remoteNote1 = createTestNote({
        id: createNoteId('remote-1'),
        title: 'Remote Note 1',
        sync: { version: 1, contentHash: 'hash1' },
      });
      const remoteNote2 = createTestNote({
        id: createNoteId('remote-2'),
        title: 'Remote Note 2',
        sync: { version: 1, contentHash: 'hash2' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 20;
      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'remote-1',
          operation: 'create',
          version: 1,
          serverSequence: 19,
          note: remoteNote1,
          timestamp: new Date().toISOString(),
        },
        {
          noteId: 'remote-2',
          operation: 'create',
          version: 1,
          serverSequence: 20,
          note: remoteNote2,
          timestamp: new Date().toISOString(),
        },
      ]);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();
      await engine.triggerSync();

      expect(localNotes.size).toBe(2);
      expect(localNotes.get('remote-1')?.title).toBe('Remote Note 1');
      expect(localNotes.get('remote-2')?.title).toBe('Remote Note 2');

      await engine.shutdown();
    });

    it('tracks progress during pull', async () => {
      const statuses: Array<{ state: string }> = [];

      const remoteNote = createTestNote({
        id: createNoteId('pull-progress-note'),
        sync: { version: 1, contentHash: 'hash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;
      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'pull-progress-note',
          operation: 'create',
          version: 1,
          serverSequence: 5,
          note: remoteNote,
          timestamp: new Date().toISOString(),
        },
      ]);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      engine.onStatusChange((status) => {
        statuses.push({ state: status.state });
      });

      await engine.initialize();
      await engine.triggerSync();

      expect(statuses.some((s) => s.state === 'syncing')).toBe(true);
      expect(statuses[statuses.length - 1]?.state).toBe('idle');

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Coordination Tests
  // ===========================================================================

  describe('Coordination', () => {
    it('queues changes while sync is in progress', async () => {
      // Slow push to simulate in-progress sync
      mockTransport.push.mockImplementation(
        () =>
          new Promise((resolve) => {
            setTimeout(
              () => resolve({ accepted: [], conflicts: [], errors: [] } as SyncPushResponse),
              100
            );
          })
      );
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Start a sync (no changes to push)
      const syncPromise = engine.triggerSync();

      // Queue a change while sync is in progress
      const note = createTestNote({ id: createNoteId('queued-note') });
      localNotes.set(note.id, note);
      const noteWithSync = engine.addSyncMetadata(note);
      engine.queueChange(noteWithSync, 'create');

      // Wait for sync to complete
      vi.advanceTimersByTime(200);
      await syncPromise;

      // Change should be queued for next sync
      expect(engine.getStatus().pendingChanges).toBe(1);

      await engine.shutdown();
    });

    it('detects conflicts during pull', async () => {
      const localNote = createTestNote({
        id: createNoteId('conflict-note'),
        title: 'Local Version',
        sync: { version: 2, contentHash: 'localhash' },
      });
      localNotes.set('conflict-note', localNote);

      const remoteNote = createTestNote({
        id: createNoteId('conflict-note'),
        title: 'Remote Version',
        sync: { version: 3, contentHash: 'remotehash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 10;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue local change to create pending state
      engine.queueChange(localNote, 'update');

      // Setup transport to return conflicting change
      mockTransport.pull.mockImplementation(async () => {
        return {
          changes: [
            {
              noteId: 'conflict-note',
              operation: 'update' as const,
              version: 3,
              serverSequence: 10,
              note: remoteNote,
              timestamp: new Date().toISOString(),
            },
          ],
          hasMore: false,
          latestSequence: 10,
          serverTime: new Date().toISOString(),
        };
      });

      await engine.initialize();
      const result = await engine.triggerSync();

      expect(result.conflicts).toBeGreaterThan(0);
      expect(engine.getConflicts().length).toBeGreaterThan(0);

      await engine.shutdown();
    });

    it('handles network errors gracefully', async () => {
      mockTransport.push.mockRejectedValue(new Error('Network timeout'));
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({ id: createNoteId('error-note') });
      localNotes.set(note.id, note);
      const noteWithSync = engine.addSyncMetadata(note);
      engine.queueChange(noteWithSync, 'create');

      const result = await engine.triggerSync();

      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors.some((e) => e.includes('timeout') || e.includes('Network'))).toBe(true);

      // Change should still be queued for retry
      expect(engine.getStatus().pendingChanges).toBe(1);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // End-to-End Tests
  // ===========================================================================

  describe('End-to-End', () => {
    it('completes full sync cycle (push then pull)', async () => {
      const localNote = createTestNote({
        id: createNoteId('local-e2e'),
        title: 'Local E2E Note',
      });
      localNotes.set(localNote.id, localNote);

      const remoteNote = createTestNote({
        id: createNoteId('remote-e2e'),
        title: 'Remote E2E Note',
        sync: { version: 1, contentHash: 'remotehash' },
      });

      // Setup mock transport
      mockTransport.push.mockImplementation(
        async (request: SyncPushRequest): Promise<SyncPushResponse> => {
          mockState.serverSequence++;
          return {
            accepted: request.changes.map((c) => ({
              noteId: c.noteId,
              serverVersion: c.version,
              serverSequence: mockState.serverSequence,
            })),
            conflicts: [],
            errors: [],
          };
        }
      );

      mockTransport.pull.mockImplementation(
        async (): Promise<SyncPullResponse> => ({
          changes: [
            {
              noteId: 'remote-e2e',
              operation: 'create' as const,
              version: 1,
              serverSequence: 2,
              note: remoteNote,
              timestamp: new Date().toISOString(),
            },
          ],
          hasMore: false,
          latestSequence: 2,
          serverTime: new Date().toISOString(),
        })
      );

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Queue local change
      const noteWithSync = engine.addSyncMetadata(localNote);
      engine.queueChange(noteWithSync, 'create');

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(1);
      expect(result.pulled).toBe(1);
      expect(result.errors).toHaveLength(0);

      // Both notes should exist locally
      expect(localNotes.has(localNote.id)).toBe(true);
      expect(localNotes.has('remote-e2e')).toBe(true);

      await engine.shutdown();
    });

    it('handles sync with no changes', async () => {
      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(0);
      expect(result.pulled).toBe(0);
      expect(result.conflicts).toBe(0);
      expect(result.errors).toHaveLength(0);

      // Push should not be called if no changes
      expect(mockTransport.push).not.toHaveBeenCalled();
      // Pull should still be called
      expect(mockTransport.pull).toHaveBeenCalled();

      await engine.shutdown();
    });

    it('handles sync with only local changes', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Create local notes
      for (let i = 0; i < 3; i++) {
        const note = createTestNote({
          id: createNoteId(`local-only-${i}`),
          title: `Local Only ${i}`,
        });
        localNotes.set(note.id, note);
        const noteWithSync = engine.addSyncMetadata(note);
        engine.queueChange(noteWithSync, 'create');
      }

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(3);
      expect(result.pulled).toBe(0);
      expect(result.errors).toHaveLength(0);

      await engine.shutdown();
    });

    it('handles sync with only remote changes', async () => {
      const remoteNotes = [
        createTestNote({
          id: createNoteId('remote-only-1'),
          title: 'Remote Only 1',
          sync: { version: 1, contentHash: 'hash1' },
        }),
        createTestNote({
          id: createNoteId('remote-only-2'),
          title: 'Remote Only 2',
          sync: { version: 1, contentHash: 'hash2' },
        }),
      ];

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 10;
      setupMockTransportWithChanges(
        mockTransport,
        mockState,
        remoteNotes.map((note, i) => ({
          noteId: note.id,
          operation: 'create' as const,
          version: 1,
          serverSequence: i + 1,
          note,
          timestamp: new Date().toISOString(),
        }))
      );

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(0);
      expect(result.pulled).toBe(2);
      expect(localNotes.size).toBe(2);

      await engine.shutdown();
    });

    it('handles delete operations correctly', async () => {
      // Pre-existing note
      const existingNote = createTestNote({
        id: createNoteId('to-delete'),
        title: 'Note To Delete',
      });
      localNotes.set('to-delete', existingNote);

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;
      mockTransport.pull.mockResolvedValue({
        changes: [
          {
            noteId: 'to-delete',
            operation: 'delete' as const,
            version: 2,
            serverSequence: 5,
            timestamp: new Date().toISOString(),
          },
        ],
        hasMore: false,
        latestSequence: 5,
        serverTime: new Date().toISOString(),
      });

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();
      await engine.triggerSync();

      expect(deletedNoteIds.has('to-delete')).toBe(true);
      expect(localNotes.has('to-delete')).toBe(false);

      await engine.shutdown();
    });

    it('handles offline to online transition', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      networkMonitor.setOnline(false);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Queue change while offline
      const note = createTestNote({ id: createNoteId('offline-note') });
      localNotes.set(note.id, note);
      const noteWithSync = engine.addSyncMetadata(note);
      engine.queueChange(noteWithSync, 'create');

      // Verify sync fails when offline
      const offlineResult = await engine.triggerSync();
      expect(offlineResult.errors).toContain('Offline');

      // Go online - the network monitor triggers an automatic sync
      // The change should have been queued and will be synced
      networkMonitor.setOnline(true);

      // Wait for the automatically triggered sync to complete
      // The sync is triggered by the network status change handler
      await vi.advanceTimersByTimeAsync(100);

      // Verify the change was pushed (either by auto-sync or we can check the state)
      // The pushCount should now be 1
      expect(mockState.pushCount).toBe(1);
      expect(engine.getStatus().pendingChanges).toBe(0);

      await engine.shutdown();
    });

    it('multiple consecutive syncs work correctly', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // First sync with one note
      const note1 = createTestNote({ id: createNoteId('multi-1'), title: 'Multi 1' });
      localNotes.set(note1.id, note1);
      engine.queueChange(engine.addSyncMetadata(note1), 'create');

      const result1 = await engine.triggerSync();
      expect(result1.pushed).toBe(1);

      // Second sync with another note
      const note2 = createTestNote({ id: createNoteId('multi-2'), title: 'Multi 2' });
      localNotes.set(note2.id, note2);
      engine.queueChange(engine.addSyncMetadata(note2), 'create');

      const result2 = await engine.triggerSync();
      expect(result2.pushed).toBe(1);

      // Third sync with no changes
      const result3 = await engine.triggerSync();
      expect(result3.pushed).toBe(0);

      // Verify all syncs completed successfully
      expect(mockState.pushCount).toBe(2); // Only 2 pushes (third had no changes)

      await engine.shutdown();
    });
  });
});
