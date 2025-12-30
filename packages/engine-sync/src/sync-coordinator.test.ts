import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SyncCoordinator } from './sync-coordinator.js';
import { SyncDatabase } from './sync-database.js';
import { SyncTransport } from './sync-transport.js';
import { ChangeTracker } from './change-tracker.js';
import { ConflictResolver } from './conflict-resolver.js';
import { SimpleNetworkMonitor } from './network-monitor.js';
import {
  createNoteId,
  type BaseNote,
  type NoteMetadata,
  type EditorContent,
  type SyncPushResponse,
  type SyncPullResponse,
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

// Mock SyncTransport
const createMockTransport = () => {
  return {
    push: vi.fn(),
    pull: vi.fn(),
    checkStatus: vi.fn(),
  } as unknown as SyncTransport & {
    push: ReturnType<typeof vi.fn>;
    pull: ReturnType<typeof vi.fn>;
  };
};

describe('SyncCoordinator', () => {
  let tempDir: string;
  let dbPath: string;
  let database: SyncDatabase;
  let transport: ReturnType<typeof createMockTransport>;
  let changeTracker: ChangeTracker;
  let conflictResolver: ConflictResolver;
  let networkMonitor: SimpleNetworkMonitor;
  let coordinator: SyncCoordinator;

  // Track notes saved/deleted for testing
  let savedNotes: Map<string, BaseNote>;
  let deletedNoteIds: Set<string>;
  let localNotes: Map<string, BaseNote>;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-coordinator-test-'));
    dbPath = path.join(tempDir, 'sync.sqlite3');
    database = new SyncDatabase({ dbPath });
    transport = createMockTransport();
    changeTracker = new ChangeTracker({ database });
    conflictResolver = new ConflictResolver({ database });
    networkMonitor = new SimpleNetworkMonitor(true);

    savedNotes = new Map();
    deletedNoteIds = new Set();
    localNotes = new Map();

    coordinator = new SyncCoordinator({
      database,
      transport,
      changeTracker,
      conflictResolver,
      networkMonitor,
      deviceId: 'test-device',
      onSaveNote: async (note) => {
        savedNotes.set(note.id, note);
      },
      onDeleteNote: async (noteId) => {
        deletedNoteIds.add(noteId);
      },
      onReadNote: async (noteId) => {
        return localNotes.get(noteId) ?? null;
      },
    });
  });

  afterEach(() => {
    database.close();
    fs.rmSync(tempDir, { recursive: true, force: true });
  });

  describe('runSyncCycle', () => {
    it('returns immediately if already in progress', async () => {
      // Set up transport to delay
      transport.push.mockImplementation(
        () =>
          new Promise((resolve) =>
            setTimeout(() => resolve({ accepted: [], conflicts: [], errors: [] }), 100)
          )
      );
      transport.pull.mockResolvedValue({
        changes: [],
        hasMore: false,
        latestSequence: 0,
        serverTime: new Date().toISOString(),
      });

      // Queue a change to trigger push
      database.queueChange('note-1', 'create', 1, createTestNote({ id: createNoteId('note-1') }));

      // Start first sync
      const firstSync = coordinator.runSyncCycle();

      // Try to start second sync immediately
      const secondResult = await coordinator.runSyncCycle();

      expect(secondResult.errors).toContain('Sync already in progress');
      expect(secondResult.pushed).toBe(0);
      expect(secondResult.pulled).toBe(0);

      // Wait for first sync to complete
      await firstSync;
    });

    it('returns immediately if offline', async () => {
      networkMonitor.setOnline(false);

      const result = await coordinator.runSyncCycle();

      expect(result.errors).toContain('Offline');
      expect(result.pushed).toBe(0);
      expect(result.pulled).toBe(0);
      expect(transport.push).not.toHaveBeenCalled();
      expect(transport.pull).not.toHaveBeenCalled();
    });

    it('runs push then pull', async () => {
      // Queue a change to trigger push
      const note = createTestNote({ id: createNoteId('test-note') });
      database.queueChange('test-note', 'create', 1, note);

      transport.push.mockResolvedValue({
        accepted: [{ noteId: 'test-note', serverVersion: 1, serverSequence: 1 }],
        conflicts: [],
        errors: [],
      });
      transport.pull.mockResolvedValue({
        changes: [],
        hasMore: false,
        latestSequence: 1,
        serverTime: new Date().toISOString(),
      });

      await coordinator.runSyncCycle();

      // Both push and pull should be called
      expect(transport.push).toHaveBeenCalled();
      expect(transport.pull).toHaveBeenCalled();
    });

    it('returns combined result from push and pull', async () => {
      const note = createTestNote({ id: createNoteId('local-note') });
      database.queueChange('local-note', 'create', 1, note);

      transport.push.mockResolvedValue({
        accepted: [{ noteId: 'local-note', serverVersion: 1, serverSequence: 1 }],
        conflicts: [],
        errors: [],
      });

      const remoteNote = createTestNote({ id: createNoteId('remote-note') });
      transport.pull.mockResolvedValue({
        changes: [
          {
            noteId: 'remote-note',
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
      });

      const result = await coordinator.runSyncCycle();

      expect(result.pushed).toBe(1);
      expect(result.pulled).toBe(1);
      expect(result.conflicts).toBe(0);
      expect(result.errors).toHaveLength(0);
    });
  });

  describe('pushChanges', () => {
    it('sends queued changes to server', async () => {
      const note = createTestNote({ id: createNoteId('push-note') });
      database.queueChange('push-note', 'create', 1, note);

      transport.push.mockResolvedValue({
        accepted: [{ noteId: 'push-note', serverVersion: 1, serverSequence: 1 }],
        conflicts: [],
        errors: [],
      });

      const result = await coordinator.pushChanges();

      expect(result.pushed).toBe(1);
      expect(transport.push).toHaveBeenCalledWith({
        deviceId: 'test-device',
        changes: expect.arrayContaining([
          expect.objectContaining({
            noteId: 'push-note',
            operation: 'create',
            version: 1,
          }),
        ]),
      });
    });

    it('removes accepted changes from queue', async () => {
      const note = createTestNote({ id: createNoteId('accepted-note') });
      database.queueChange('accepted-note', 'create', 1, note);
      database.setSyncState('accepted-note', {
        localVersion: 1,
        serverVersion: null,
        contentHash: 'hash123',
        lastSyncedAt: null,
        status: 'pending',
      });

      expect(database.getQueueSize()).toBe(1);

      transport.push.mockResolvedValue({
        accepted: [{ noteId: 'accepted-note', serverVersion: 1, serverSequence: 1 }],
        conflicts: [],
        errors: [],
      });

      await coordinator.pushChanges();

      expect(database.getQueueSize()).toBe(0);
    });

    it('updates sync state for accepted changes', async () => {
      const note = createTestNote({ id: createNoteId('sync-update-note') });
      database.queueChange('sync-update-note', 'create', 1, note);
      database.setSyncState('sync-update-note', {
        localVersion: 1,
        serverVersion: null,
        contentHash: 'hash123',
        lastSyncedAt: null,
        status: 'pending',
      });

      transport.push.mockResolvedValue({
        accepted: [{ noteId: 'sync-update-note', serverVersion: 5, serverSequence: 10 }],
        conflicts: [],
        errors: [],
      });

      await coordinator.pushChanges();

      const state = database.getSyncState('sync-update-note');
      expect(state?.serverVersion).toBe(5);
      expect(state?.status).toBe('synced');
      expect(state?.lastSyncedAt).toBeGreaterThan(0);
    });

    it('handles push conflicts by storing in conflict resolver', async () => {
      const localNote = createTestNote({ id: createNoteId('conflict-note'), title: 'Local' });
      const serverNote = createTestNote({ id: createNoteId('conflict-note'), title: 'Server' });
      database.queueChange('conflict-note', 'update', 2, localNote);
      localNotes.set('conflict-note', localNote);

      transport.push.mockResolvedValue({
        accepted: [],
        conflicts: [{ noteId: 'conflict-note', serverVersion: 3, serverNote }],
        errors: [],
      });

      const result = await coordinator.pushChanges();

      expect(result.pushed).toBe(0);
      expect(result.errors).toContain('Conflict detected for note conflict-note');
      expect(conflictResolver.getConflictCount()).toBe(1);
    });

    it('marks retryable errors for retry', async () => {
      const note = createTestNote({ id: createNoteId('error-note') });
      database.queueChange('error-note', 'create', 1, note);

      transport.push.mockResolvedValue({
        accepted: [],
        conflicts: [],
        errors: [{ noteId: 'error-note', error: 'Server timeout', retryable: true }],
      });

      const result = await coordinator.pushChanges();

      expect(result.errors).toContain('Error syncing error-note: Server timeout');

      // Change should still be in queue for retry
      const queued = database.getQueuedChanges();
      expect(queued).toHaveLength(1);
      expect(queued[0].attempts).toBe(1);
      expect(queued[0].error).toBe('Server timeout');
    });

    it('returns empty result when no changes queued', async () => {
      const result = await coordinator.pushChanges();

      expect(result.pushed).toBe(0);
      expect(result.errors).toHaveLength(0);
      expect(transport.push).not.toHaveBeenCalled();
    });

    it('handles transport errors gracefully', async () => {
      const note = createTestNote({ id: createNoteId('transport-error-note') });
      database.queueChange('transport-error-note', 'create', 1, note);

      transport.push.mockRejectedValue(new Error('Network error'));

      const result = await coordinator.pushChanges();

      expect(result.pushed).toBe(0);
      expect(result.errors).toContain('Network error');
    });
  });

  describe('pullChanges', () => {
    it('fetches and applies remote changes', async () => {
      const remoteNote = createTestNote({ id: createNoteId('remote-note'), title: 'Remote Note' });
      transport.pull.mockResolvedValue({
        changes: [
          {
            noteId: 'remote-note',
            operation: 'create' as const,
            version: 1,
            serverSequence: 1,
            note: remoteNote,
            timestamp: new Date().toISOString(),
          },
        ],
        hasMore: false,
        latestSequence: 1,
        serverTime: new Date().toISOString(),
      });

      const result = await coordinator.pullChanges();

      expect(result.pulled).toBe(1);
      expect(savedNotes.has('remote-note')).toBe(true);
      expect(savedNotes.get('remote-note')?.title).toBe('Remote Note');
    });

    it('updates sync state after applying changes', async () => {
      const remoteNote = createTestNote({
        id: createNoteId('sync-state-note'),
        sync: { version: 5, contentHash: 'remotehash' },
      });
      transport.pull.mockResolvedValue({
        changes: [
          {
            noteId: 'sync-state-note',
            operation: 'update' as const,
            version: 5,
            serverSequence: 10,
            note: remoteNote,
            timestamp: new Date().toISOString(),
          },
        ],
        hasMore: false,
        latestSequence: 10,
        serverTime: new Date().toISOString(),
      });

      await coordinator.pullChanges();

      const state = database.getSyncState('sync-state-note');
      expect(state?.localVersion).toBe(5);
      expect(state?.serverVersion).toBe(5);
      expect(state?.status).toBe('synced');
    });

    it('handles delete operations', async () => {
      database.setSyncState('delete-note', {
        localVersion: 1,
        serverVersion: 1,
        contentHash: 'hash',
        lastSyncedAt: Date.now(),
        status: 'synced',
      });

      transport.pull.mockResolvedValue({
        changes: [
          {
            noteId: 'delete-note',
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

      const result = await coordinator.pullChanges();

      expect(result.pulled).toBe(1);
      expect(deletedNoteIds.has('delete-note')).toBe(true);
      expect(database.getSyncState('delete-note')).toBeNull();
    });

    it('updates last sync sequence', async () => {
      expect(database.getLastSyncSequence()).toBe(0);

      transport.pull.mockResolvedValue({
        changes: [],
        hasMore: false,
        latestSequence: 42,
        serverTime: new Date().toISOString(),
      });

      await coordinator.pullChanges();

      expect(database.getLastSyncSequence()).toBe(42);
    });

    it('detects conflicts with pending local changes', async () => {
      // Set up a note with pending local changes
      const localNote = createTestNote({
        id: createNoteId('conflict-pull-note'),
        title: 'Local Version',
      });
      localNotes.set('conflict-pull-note', localNote);
      database.setSyncState('conflict-pull-note', {
        localVersion: 2,
        serverVersion: 1,
        contentHash: 'localhash',
        lastSyncedAt: Date.now(),
        status: 'pending',
      });

      // Server has a different version
      const remoteNote = createTestNote({
        id: createNoteId('conflict-pull-note'),
        title: 'Server Version',
      });
      transport.pull.mockResolvedValue({
        changes: [
          {
            noteId: 'conflict-pull-note',
            operation: 'update' as const,
            version: 3,
            serverSequence: 5,
            note: remoteNote,
            timestamp: new Date().toISOString(),
          },
        ],
        hasMore: false,
        latestSequence: 5,
        serverTime: new Date().toISOString(),
      });

      const result = await coordinator.pullChanges();

      expect(result.pulled).toBe(0); // Should not apply due to conflict
      expect(result.errors).toContain('Conflict detected for note conflict-pull-note');
      expect(conflictResolver.getConflictCount()).toBe(1);
    });

    it('handles transport errors gracefully', async () => {
      transport.pull.mockRejectedValue(new Error('Connection refused'));

      const result = await coordinator.pullChanges();

      expect(result.pulled).toBe(0);
      expect(result.errors).toContain('Connection refused');
    });

    it('sends correct sinceSequence parameter', async () => {
      database.setLastSyncSequence(100);

      transport.pull.mockResolvedValue({
        changes: [],
        hasMore: false,
        latestSequence: 100,
        serverTime: new Date().toISOString(),
      });

      await coordinator.pullChanges();

      expect(transport.pull).toHaveBeenCalledWith({
        deviceId: 'test-device',
        sinceSequence: 100,
      });
    });
  });

  describe('getStatus', () => {
    it('returns idle status initially', () => {
      const status = coordinator.getStatus();

      expect(status.phase).toBe('idle');
      expect(status.inProgress).toBe(false);
    });

    it('returns inProgress during sync', async () => {
      transport.push.mockImplementation(
        () =>
          new Promise((resolve) => {
            // Check status during push
            const status = coordinator.getStatus();
            expect(status.inProgress).toBe(true);
            resolve({ accepted: [], conflicts: [], errors: [] });
          })
      );
      transport.pull.mockResolvedValue({
        changes: [],
        hasMore: false,
        latestSequence: 0,
        serverTime: new Date().toISOString(),
      });

      // Queue something to trigger push
      database.queueChange('status-note', 'create', 1, createTestNote());

      await coordinator.runSyncCycle();

      // After sync completes, should be idle again
      const status = coordinator.getStatus();
      expect(status.phase).toBe('idle');
      expect(status.inProgress).toBe(false);
    });
  });

  describe('progress callback', () => {
    it('calls onProgress with phase updates', async () => {
      const progressUpdates: Array<{ phase: string }> = [];

      const coordinatorWithProgress = new SyncCoordinator({
        database,
        transport,
        changeTracker,
        conflictResolver,
        networkMonitor,
        deviceId: 'test-device',
        onSaveNote: async () => {},
        onDeleteNote: async () => {},
        onReadNote: async () => null,
        onProgress: (progress) => {
          progressUpdates.push({ phase: progress.phase });
        },
      });

      transport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      transport.pull.mockResolvedValue({
        changes: [],
        hasMore: false,
        latestSequence: 0,
        serverTime: new Date().toISOString(),
      });

      await coordinatorWithProgress.runSyncCycle();

      // Should have gone through pushing, pulling, and idle phases
      expect(progressUpdates.some((u) => u.phase === 'pushing')).toBe(true);
      expect(progressUpdates.some((u) => u.phase === 'pulling')).toBe(true);
      expect(progressUpdates.some((u) => u.phase === 'idle')).toBe(true);
    });
  });
});
