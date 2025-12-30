/**
 * Integration tests for network failure recovery.
 *
 * These tests verify sync behavior during network failures, including:
 * - Offline detection and sync prevention
 * - Change queuing while offline
 * - Syncing queued changes when back online
 * - Retry logic for transient failures
 * - Partial failure handling
 * - Timeout handling
 * - Server error handling
 *
 * The transport layer is mocked, but all other components use real implementations.
 *
 * @module network-recovery.integration.test
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

// =============================================================================
// Integration Tests
// =============================================================================

describe('Network Recovery Integration Tests', () => {
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'network-recovery-integration-'));
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
  // Offline Detection Tests
  // ===========================================================================

  describe('Offline Detection', () => {
    it('should not attempt sync when offline', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      // Start offline
      networkMonitor.setOnline(false);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Create and queue a note
      const note = createTestNote({
        id: createNoteId('offline-note-1'),
        title: 'Offline Note',
        content: createEditorContent('Created while offline'),
      });
      localNotes.set(note.id, note);
      const noteWithSync = engine.addSyncMetadata(note);
      engine.queueChange(noteWithSync, 'create');

      // Try to sync
      const result = await engine.triggerSync();

      // Sync should fail due to being offline
      expect(result.pushed).toBe(0);
      expect(result.pulled).toBe(0);
      expect(result.errors).toContain('Offline');

      // Transport should NOT have been called
      expect(mockTransport.push).not.toHaveBeenCalled();
      expect(mockTransport.pull).not.toHaveBeenCalled();

      await engine.shutdown();
    });

    it('should queue changes while offline', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      // Start offline
      networkMonitor.setOnline(false);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Queue multiple changes while offline
      for (let i = 0; i < 3; i++) {
        const note = createTestNote({
          id: createNoteId(`queued-note-${i}`),
          title: `Queued Note ${i}`,
        });
        localNotes.set(note.id, note);
        const noteWithSync = engine.addSyncMetadata(note);
        engine.queueChange(noteWithSync, 'create');
      }

      // Verify changes are queued
      expect(engine.getStatus().pendingChanges).toBe(3);

      // Sync should fail
      const result = await engine.triggerSync();
      expect(result.errors).toContain('Offline');

      // Changes should still be queued
      expect(engine.getStatus().pendingChanges).toBe(3);

      await engine.shutdown();
    });

    it('should sync queued changes when back online', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      // Start offline
      networkMonitor.setOnline(false);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Queue a change while offline
      const note = createTestNote({
        id: createNoteId('queued-for-online'),
        title: 'Queued For Online',
        content: createEditorContent('Will sync when online'),
      });
      localNotes.set(note.id, note);
      const noteWithSync = engine.addSyncMetadata(note);
      engine.queueChange(noteWithSync, 'create');

      // Verify sync fails while offline
      const offlineResult = await engine.triggerSync();
      expect(offlineResult.errors).toContain('Offline');
      expect(engine.getStatus().pendingChanges).toBe(1);

      // Go back online
      networkMonitor.setOnline(true);

      // Wait for the automatically triggered sync
      await vi.advanceTimersByTimeAsync(100);

      // Verify the change was synced
      expect(mockState.pushCount).toBe(1);
      expect(engine.getStatus().pendingChanges).toBe(0);

      await engine.shutdown();
    });

    it('should report correct status when offline', async () => {
      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Online initially
      expect(engine.getStatus().state).toBe('idle');

      // Go offline
      networkMonitor.setOnline(false);

      // Status should reflect offline state
      expect(engine.getStatus().state).toBe('offline');

      // Go back online
      networkMonitor.setOnline(true);

      // Wait for auto-sync to complete
      await vi.advanceTimersByTimeAsync(100);

      // Status should be idle again
      expect(engine.getStatus().state).toBe('idle');

      await engine.shutdown();
    });

    it('should stop polling when going offline', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(
        createEngineConfig({
          config: createTestSyncConfig({ syncIntervalMs: 1000 }),
        })
      );
      injectMockTransport(engine);

      await engine.initialize();

      // Should be polling while online
      const initialPullCount = mockState.pullCount;

      // Advance time to trigger a poll
      await vi.advanceTimersByTimeAsync(1100);
      expect(mockState.pullCount).toBeGreaterThan(initialPullCount);

      // Go offline
      networkMonitor.setOnline(false);
      const offlinePullCount = mockState.pullCount;

      // Advance time - should NOT trigger polls while offline
      await vi.advanceTimersByTimeAsync(3000);
      expect(mockState.pullCount).toBe(offlinePullCount);

      await engine.shutdown();
    });

    it('should resume polling when coming back online', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(
        createEngineConfig({
          config: createTestSyncConfig({ syncIntervalMs: 1000 }),
        })
      );
      injectMockTransport(engine);

      await engine.initialize();

      // Go offline
      networkMonitor.setOnline(false);
      const offlinePullCount = mockState.pullCount;

      // Advance time while offline
      await vi.advanceTimersByTimeAsync(2000);
      expect(mockState.pullCount).toBe(offlinePullCount);

      // Go back online
      networkMonitor.setOnline(true);

      // Wait for immediate sync on coming online
      await vi.advanceTimersByTimeAsync(100);
      expect(mockState.pullCount).toBeGreaterThan(offlinePullCount);

      // Advance time to verify polling resumed
      const onlinePullCount = mockState.pullCount;
      await vi.advanceTimersByTimeAsync(1100);
      expect(mockState.pullCount).toBeGreaterThan(onlinePullCount);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Transient Failure Tests
  // ===========================================================================

  describe('Transient Failures', () => {
    it('should retry on temporary network error', async () => {
      // First push fails, subsequent ones succeed
      let pushAttempts = 0;
      mockTransport.push.mockImplementation(async (request: SyncPushRequest) => {
        pushAttempts++;
        if (pushAttempts === 1) {
          throw new Error('Network error: connection reset');
        }
        mockState.pushCount++;
        return {
          accepted: request.changes.map((change) => ({
            noteId: change.noteId,
            serverVersion: change.version,
            serverSequence: ++mockState.serverSequence,
          })),
          conflicts: [],
          errors: [],
        };
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('retry-note'),
        title: 'Retry Note',
      });
      localNotes.set(note.id, note);
      const noteWithSync = engine.addSyncMetadata(note);
      engine.queueChange(noteWithSync, 'create');

      // First sync fails
      const result1 = await engine.triggerSync();
      expect(result1.pushed).toBe(0);
      expect(result1.errors.length).toBeGreaterThan(0);
      expect(result1.errors.some((e) => e.includes('Network error'))).toBe(true);

      // Change should still be pending
      expect(engine.getStatus().pendingChanges).toBe(1);

      // Second sync succeeds (retry)
      const result2 = await engine.triggerSync();
      expect(result2.pushed).toBe(1);
      expect(result2.errors.length).toBe(0);

      // Change should be synced
      expect(engine.getStatus().pendingChanges).toBe(0);

      await engine.shutdown();
    });

    it('should preserve changes after failed sync', async () => {
      mockTransport.push.mockRejectedValue(new Error('Server unavailable'));
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Queue multiple changes
      for (let i = 0; i < 3; i++) {
        const note = createTestNote({
          id: createNoteId(`preserved-note-${i}`),
          title: `Preserved Note ${i}`,
        });
        localNotes.set(note.id, note);
        const noteWithSync = engine.addSyncMetadata(note);
        engine.queueChange(noteWithSync, 'create');
      }

      expect(engine.getStatus().pendingChanges).toBe(3);

      // Sync fails
      const result = await engine.triggerSync();
      expect(result.pushed).toBe(0);
      expect(result.errors.some((e) => e.includes('Server unavailable'))).toBe(true);

      // All changes should still be pending
      expect(engine.getStatus().pendingChanges).toBe(3);

      await engine.shutdown();
    });

    it('should handle intermittent failures gracefully', async () => {
      // Simulate intermittent failures: fail, succeed, fail, succeed
      let callCount = 0;
      mockTransport.push.mockImplementation(async (request: SyncPushRequest) => {
        callCount++;
        if (callCount % 2 === 1 && callCount < 4) {
          throw new Error('Intermittent failure');
        }
        mockState.pushCount++;
        return {
          accepted: request.changes.map((change) => ({
            noteId: change.noteId,
            serverVersion: change.version,
            serverSequence: ++mockState.serverSequence,
          })),
          conflicts: [],
          errors: [],
        };
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('intermittent-note'),
        title: 'Intermittent Note',
      });
      localNotes.set(note.id, note);
      const noteWithSync = engine.addSyncMetadata(note);
      engine.queueChange(noteWithSync, 'create');

      // First attempt fails
      const result1 = await engine.triggerSync();
      expect(result1.pushed).toBe(0);
      expect(engine.getStatus().pendingChanges).toBe(1);

      // Second attempt succeeds
      const result2 = await engine.triggerSync();
      expect(result2.pushed).toBe(1);
      expect(engine.getStatus().pendingChanges).toBe(0);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Partial Failure Tests
  // ===========================================================================

  describe('Partial Failures', () => {
    it('should handle partial push success', async () => {
      // Accept first note, error on second
      mockTransport.push.mockImplementation(async (request: SyncPushRequest) => {
        mockState.pushCount++;
        const accepted = [];
        const errors = [];

        for (const change of request.changes) {
          if (change.noteId.includes('success')) {
            mockState.serverSequence++;
            accepted.push({
              noteId: change.noteId,
              serverVersion: change.version,
              serverSequence: mockState.serverSequence,
            });
          } else {
            errors.push({
              noteId: change.noteId,
              error: 'Validation failed',
              retryable: true,
            });
          }
        }

        return { accepted, conflicts: [], errors };
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Queue two notes - one will succeed, one will fail
      const successNote = createTestNote({
        id: createNoteId('success-note'),
        title: 'Success Note',
      });
      const failNote = createTestNote({
        id: createNoteId('fail-note'),
        title: 'Fail Note',
      });

      localNotes.set(successNote.id, successNote);
      localNotes.set(failNote.id, failNote);

      engine.queueChange(engine.addSyncMetadata(successNote), 'create');
      engine.queueChange(engine.addSyncMetadata(failNote), 'create');

      expect(engine.getStatus().pendingChanges).toBe(2);

      const result = await engine.triggerSync();

      // One should succeed, one should fail
      expect(result.pushed).toBe(1);
      expect(result.errors.some((e) => e.includes('fail-note'))).toBe(true);

      // Failed note should still be pending
      expect(engine.getStatus().pendingChanges).toBe(1);

      await engine.shutdown();
    });

    it('should retry failed items on next sync', async () => {
      let syncCount = 0;
      mockTransport.push.mockImplementation(async (request: SyncPushRequest) => {
        syncCount++;
        mockState.pushCount++;

        // First sync: fail one note
        // Second sync: accept all
        if (syncCount === 1) {
          return {
            accepted: [],
            conflicts: [],
            errors: request.changes.map((change) => ({
              noteId: change.noteId,
              error: 'Temporary failure',
              retryable: true,
            })),
          };
        }

        return {
          accepted: request.changes.map((change) => ({
            noteId: change.noteId,
            serverVersion: change.version,
            serverSequence: ++mockState.serverSequence,
          })),
          conflicts: [],
          errors: [],
        };
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('retry-item'),
        title: 'Retry Item',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      // First sync fails
      const result1 = await engine.triggerSync();
      expect(result1.pushed).toBe(0);
      expect(engine.getStatus().pendingChanges).toBe(1);

      // Second sync succeeds
      const result2 = await engine.triggerSync();
      expect(result2.pushed).toBe(1);
      expect(engine.getStatus().pendingChanges).toBe(0);

      await engine.shutdown();
    });

    it('should handle mixed success and conflict responses', async () => {
      const conflictNote = createTestNote({
        id: createNoteId('conflict-note'),
        title: 'Remote Version',
        content: createEditorContent('Remote content'),
        sync: { version: 5, contentHash: 'remotehash' },
      });

      mockTransport.push.mockImplementation(async (request: SyncPushRequest) => {
        const accepted = [];
        const conflicts = [];

        for (const change of request.changes) {
          if (change.noteId.includes('success')) {
            accepted.push({
              noteId: change.noteId,
              serverVersion: change.version,
              serverSequence: ++mockState.serverSequence,
            });
          } else {
            conflicts.push({
              noteId: change.noteId,
              serverVersion: 5,
              serverNote: conflictNote,
            });
          }
        }

        return { accepted, conflicts, errors: [] };
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const successNote = createTestNote({
        id: createNoteId('success-mixed'),
        title: 'Success Note',
      });
      const localConflictNote = createTestNote({
        id: createNoteId('conflict-note'),
        title: 'Local Version',
        content: createEditorContent('Local content'),
        sync: { version: 2, contentHash: 'localhash' },
      });

      localNotes.set(successNote.id, successNote);
      localNotes.set(localConflictNote.id, localConflictNote);

      engine.queueChange(engine.addSyncMetadata(successNote), 'create');
      engine.queueChange(engine.addSyncMetadata(localConflictNote), 'update');

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(1);
      expect(result.conflicts).toBeGreaterThan(0);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Timeout Handling Tests
  // ===========================================================================

  describe('Timeout Handling', () => {
    it('should handle slow push requests', async () => {
      // Simulate a very slow push that will be interrupted
      mockTransport.push.mockImplementation(async () => {
        // This will be cleaned up when the test ends
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return { accepted: [], conflicts: [], errors: [] };
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('slow-note'),
        title: 'Slow Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      // Start sync (won't complete due to slow transport)
      const syncPromise = engine.triggerSync();

      // Advance time but not enough for the slow request to complete
      await vi.advanceTimersByTimeAsync(100);

      // The sync should still be in progress
      expect(engine.getStatus().state).toBe('syncing');

      // Advance more time
      await vi.advanceTimersByTimeAsync(5000);
      await syncPromise;

      await engine.shutdown();
    });

    it('should handle slow pull requests', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);

      // Simulate a very slow pull
      mockTransport.pull.mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 5000));
        return {
          changes: [],
          hasMore: false,
          latestSequence: 0,
          serverTime: new Date().toISOString(),
        };
      });

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Start sync
      const syncPromise = engine.triggerSync();

      // Status should show syncing
      expect(engine.getStatus().state).toBe('syncing');

      // Advance time
      await vi.advanceTimersByTimeAsync(5000);
      await syncPromise;

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Server Error Tests
  // ===========================================================================

  describe('Server Errors', () => {
    it('should handle 5xx server errors gracefully', async () => {
      mockTransport.push.mockRejectedValue({
        status: 500,
        message: 'Internal Server Error',
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('server-error-note'),
        title: 'Server Error Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);

      // Change should be preserved for retry
      expect(engine.getStatus().pendingChanges).toBe(1);

      await engine.shutdown();
    });

    it('should handle 502 Bad Gateway errors', async () => {
      mockTransport.push.mockRejectedValue({
        status: 502,
        message: 'Bad Gateway',
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('gateway-error-note'),
        title: 'Gateway Error Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(0);
      expect(engine.getStatus().pendingChanges).toBe(1);

      await engine.shutdown();
    });

    it('should handle 503 Service Unavailable errors', async () => {
      mockTransport.push.mockRejectedValue({
        status: 503,
        message: 'Service Unavailable',
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('unavailable-note'),
        title: 'Unavailable Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(0);
      expect(engine.getStatus().pendingChanges).toBe(1);

      await engine.shutdown();
    });

    it('should handle 401 auth errors', async () => {
      mockTransport.push.mockRejectedValue({
        status: 401,
        message: 'Unauthorized',
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('auth-error-note'),
        title: 'Auth Error Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(0);
      expect(result.errors.length).toBeGreaterThan(0);

      // Change should be preserved
      expect(engine.getStatus().pendingChanges).toBe(1);

      await engine.shutdown();
    });

    it('should handle 403 forbidden errors', async () => {
      mockTransport.push.mockRejectedValue({
        status: 403,
        message: 'Forbidden',
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('forbidden-note'),
        title: 'Forbidden Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(0);
      expect(engine.getStatus().pendingChanges).toBe(1);

      await engine.shutdown();
    });

    it('should handle 429 rate limit errors', async () => {
      mockTransport.push.mockRejectedValue({
        status: 429,
        message: 'Too Many Requests',
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('rate-limit-note'),
        title: 'Rate Limit Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      const result = await engine.triggerSync();

      expect(result.pushed).toBe(0);
      // Should preserve for retry after rate limit
      expect(engine.getStatus().pendingChanges).toBe(1);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Network Transition Tests
  // ===========================================================================

  describe('Network Transitions', () => {
    it('should handle rapid online/offline transitions', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Queue a change
      const note = createTestNote({
        id: createNoteId('transition-note'),
        title: 'Transition Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      // Rapid transitions
      networkMonitor.setOnline(false);
      networkMonitor.setOnline(true);
      networkMonitor.setOnline(false);
      networkMonitor.setOnline(true);

      // Wait for things to settle
      await vi.advanceTimersByTimeAsync(200);

      // Should have synced successfully
      expect(mockState.pushCount).toBeGreaterThan(0);

      await engine.shutdown();
    });

    it('should handle offline during active sync', async () => {
      let pushStarted = false;
      mockTransport.push.mockImplementation(async (request: SyncPushRequest) => {
        pushStarted = true;
        // Simulate some work
        await new Promise((resolve) => setTimeout(resolve, 100));

        mockState.pushCount++;
        return {
          accepted: request.changes.map((change) => ({
            noteId: change.noteId,
            serverVersion: change.version,
            serverSequence: ++mockState.serverSequence,
          })),
          conflicts: [],
          errors: [],
        };
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('mid-sync-note'),
        title: 'Mid Sync Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      // Start sync
      const syncPromise = engine.triggerSync();

      // Wait for push to start
      await vi.advanceTimersByTimeAsync(10);
      expect(pushStarted).toBe(true);

      // Go offline during sync
      networkMonitor.setOnline(false);

      // Complete the sync
      await vi.advanceTimersByTimeAsync(200);
      await syncPromise;

      // The ongoing sync should complete (network check is at cycle start)
      expect(mockState.pushCount).toBe(1);

      await engine.shutdown();
    });

    it('should not start new sync if went offline', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Go offline
      networkMonitor.setOnline(false);

      // Queue a change
      const note = createTestNote({
        id: createNoteId('no-start-note'),
        title: 'No Start Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      // Advance time (would normally trigger auto-sync)
      await vi.advanceTimersByTimeAsync(2000);

      // Should not have tried to sync
      expect(mockState.pushCount).toBe(0);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Pull Error Tests
  // ===========================================================================

  describe('Pull Errors', () => {
    it('should handle pull failures gracefully', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      mockTransport.pull.mockRejectedValue(new Error('Pull failed'));

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const result = await engine.triggerSync();

      expect(result.pulled).toBe(0);
      expect(result.errors.some((e) => e.includes('Pull failed'))).toBe(true);

      await engine.shutdown();
    });

    it('should complete push even if pull fails', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      mockTransport.pull.mockRejectedValue(new Error('Pull failed'));

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('push-before-pull'),
        title: 'Push Before Pull',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      const result = await engine.triggerSync();

      // Push should succeed
      expect(result.pushed).toBe(1);

      // Pull should fail
      expect(result.pulled).toBe(0);
      expect(result.errors.some((e) => e.includes('Pull failed'))).toBe(true);

      await engine.shutdown();
    });

    it('should handle partial pull failures', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);

      // First pull succeeds, second fails (simulating pagination)
      let pullCount = 0;
      mockTransport.pull.mockImplementation(async () => {
        pullCount++;
        if (pullCount === 1) {
          return {
            changes: [
              {
                noteId: 'remote-note-1',
                operation: 'create' as const,
                version: 1,
                serverSequence: 1,
                note: createTestNote({
                  id: createNoteId('remote-note-1'),
                  title: 'Remote Note 1',
                  sync: { version: 1, contentHash: 'hash1' },
                }),
                timestamp: new Date().toISOString(),
              },
            ],
            hasMore: true,
            latestSequence: 1,
            serverTime: new Date().toISOString(),
          };
        }
        throw new Error('Connection lost during pagination');
      });

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const result = await engine.triggerSync();

      // First page should have been applied
      expect(result.pulled).toBe(1);
      expect(localNotes.has('remote-note-1')).toBe(true);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Recovery Scenario Tests
  // ===========================================================================

  describe('Recovery Scenarios', () => {
    it('should recover from extended offline period', async () => {
      setupMockTransportAcceptAll(mockTransport, mockState);
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      // Go offline
      networkMonitor.setOnline(false);

      // Accumulate changes over "time"
      for (let i = 0; i < 5; i++) {
        const note = createTestNote({
          id: createNoteId(`offline-accumulated-${i}`),
          title: `Offline Note ${i}`,
        });
        localNotes.set(note.id, note);
        engine.queueChange(engine.addSyncMetadata(note), 'create');
      }

      expect(engine.getStatus().pendingChanges).toBe(5);

      // Simulate extended offline period
      await vi.advanceTimersByTimeAsync(60000);

      // Still offline, still pending
      expect(engine.getStatus().pendingChanges).toBe(5);

      // Come back online
      networkMonitor.setOnline(true);

      // Wait for sync
      await vi.advanceTimersByTimeAsync(200);

      // All changes should be synced
      expect(engine.getStatus().pendingChanges).toBe(0);
      expect(mockState.pushCount).toBe(1); // Batched

      await engine.shutdown();
    });

    it('should handle server recovery after errors', async () => {
      let callCount = 0;
      mockTransport.push.mockImplementation(async (request: SyncPushRequest) => {
        callCount++;
        // Fail first 3 attempts, then succeed
        if (callCount <= 3) {
          throw new Error(`Server error (attempt ${callCount})`);
        }
        mockState.pushCount++;
        return {
          accepted: request.changes.map((change) => ({
            noteId: change.noteId,
            serverVersion: change.version,
            serverSequence: ++mockState.serverSequence,
          })),
          conflicts: [],
          errors: [],
        };
      });
      setupMockTransportEmptyPull(mockTransport, mockState);

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      await engine.initialize();

      const note = createTestNote({
        id: createNoteId('recovery-note'),
        title: 'Recovery Note',
      });
      localNotes.set(note.id, note);
      engine.queueChange(engine.addSyncMetadata(note), 'create');

      // First 3 attempts fail
      for (let i = 0; i < 3; i++) {
        const result = await engine.triggerSync();
        expect(result.pushed).toBe(0);
        expect(engine.getStatus().pendingChanges).toBe(1);
      }

      // Fourth attempt succeeds
      const result = await engine.triggerSync();
      expect(result.pushed).toBe(1);
      expect(engine.getStatus().pendingChanges).toBe(0);

      await engine.shutdown();
    });
  });
});
