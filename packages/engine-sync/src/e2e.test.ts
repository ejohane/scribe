/**
 * End-to-end sync scenario tests.
 *
 * These tests simulate real multi-device sync scenarios including:
 * - Initial sync from empty vault
 * - Two devices syncing concurrently
 * - Conflict detection on simultaneous edits
 * - Offline then online sync
 * - Large vault initial sync
 *
 * The transport layer is mocked but simulates realistic server behavior,
 * while all other components use real implementations.
 *
 * @module e2e.test
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
const createTestSyncConfig = (
  overrides: Partial<SyncConfig> = {},
  deviceId: string = 'test-device-123'
): SyncConfig => ({
  enabled: true,
  serverUrl: 'https://sync.test.com',
  deviceId,
  enabledAt: Date.now(),
  lastSyncSequence: 0,
  syncIntervalMs: 30000,
  ...overrides,
});

// =============================================================================
// Mock Server - Simulates a Real Sync Server
// =============================================================================

/**
 * MockServer simulates a sync server that can be shared between multiple
 * "devices" (SyncEngine instances) to test real multi-device sync scenarios.
 */
class MockServer {
  private notes: Map<string, BaseNote> = new Map();
  private sequence: number = 0;
  private changes: Array<{
    noteId: string;
    operation: 'create' | 'update' | 'delete';
    version: number;
    serverSequence: number;
    note?: BaseNote;
    timestamp: string;
  }> = [];

  /** Get current server sequence */
  getSequence(): number {
    return this.sequence;
  }

  /** Push changes to server, returns accepted/conflicts */
  push(request: SyncPushRequest): SyncPushResponse {
    const accepted: SyncPushResponse['accepted'] = [];
    const conflicts: SyncPushResponse['conflicts'] = [];

    for (const change of request.changes) {
      const existingNote = this.notes.get(change.noteId);

      // Check for conflicts (server has newer version)
      if (existingNote?.sync?.version && change.version <= existingNote.sync.version) {
        conflicts.push({
          noteId: change.noteId,
          serverVersion: existingNote.sync.version,
          serverNote: existingNote,
        });
        continue;
      }

      // Accept the change
      this.sequence++;

      // Server assigns its own version (always incrementing)
      const serverVersion = (existingNote?.sync?.version ?? 0) + 1;

      if (change.operation === 'delete') {
        this.notes.delete(change.noteId);
      } else if (change.payload) {
        const note = change.payload as BaseNote;
        // Update note with server metadata
        const serverNote: BaseNote = {
          ...note,
          sync: {
            version: serverVersion,
            contentHash: note.sync?.contentHash ?? 'server-hash',
            serverVersion: serverVersion,
            syncedAt: Date.now(),
            deviceId: note.sync?.deviceId,
          },
        };
        this.notes.set(change.noteId, serverNote);
      }

      // Record the change with server-assigned version
      this.changes.push({
        noteId: change.noteId,
        operation: change.operation,
        version: serverVersion,
        serverSequence: this.sequence,
        note: this.notes.get(change.noteId),
        timestamp: new Date().toISOString(),
      });

      accepted.push({
        noteId: change.noteId,
        serverVersion: serverVersion,
        serverSequence: this.sequence,
      });
    }

    return { accepted, conflicts, errors: [] };
  }

  /** Pull changes from server since a given sequence */
  pull(sinceSequence: number): SyncPullResponse {
    const newChanges = this.changes
      .filter((c) => c.serverSequence > sinceSequence)
      .map((c) => ({
        noteId: c.noteId,
        operation: c.operation,
        version: c.version,
        serverSequence: c.serverSequence,
        note: c.note,
        timestamp: c.timestamp,
      }));

    return {
      changes: newChanges,
      hasMore: false,
      latestSequence: this.sequence,
      serverTime: new Date().toISOString(),
    };
  }

  /** Get a note from the server */
  getNote(noteId: string): BaseNote | undefined {
    return this.notes.get(noteId);
  }

  /** Get all notes from the server */
  getAllNotes(): BaseNote[] {
    return Array.from(this.notes.values());
  }

  /** Reset server state */
  reset(): void {
    this.notes.clear();
    this.changes = [];
    this.sequence = 0;
  }
}

// =============================================================================
// Mock Transport Factory
// =============================================================================

type MockTransport = SyncTransport & {
  push: ReturnType<typeof vi.fn>;
  pull: ReturnType<typeof vi.fn>;
  checkStatus: ReturnType<typeof vi.fn>;
};

/**
 * Create a mock transport connected to a MockServer.
 * This allows multiple devices to share the same server state.
 */
const createMockTransport = (server: MockServer): MockTransport => {
  const transport = {
    push: vi
      .fn()
      .mockImplementation(async (request: SyncPushRequest): Promise<SyncPushResponse> => {
        return server.push(request);
      }),
    pull: vi
      .fn()
      .mockImplementation(
        async (request: { sinceSequence?: number }): Promise<SyncPullResponse> => {
          return server.pull(request.sinceSequence ?? 0);
        }
      ),
    checkStatus: vi.fn().mockResolvedValue({
      ok: true,
      serverTime: new Date().toISOString(),
    }),
  } as unknown as MockTransport;

  return transport;
};

// =============================================================================
// Device (SyncEngine + Local State) Factory
// =============================================================================

interface DeviceState {
  engine: SyncEngine;
  tempDir: string;
  localNotes: Map<string, BaseNote>;
  savedNotes: Map<string, BaseNote>;
  deletedNoteIds: Set<string>;
  networkMonitor: SimpleNetworkMonitor;
  transport: MockTransport;
  cleanup: () => Promise<void>;
}

/**
 * Create a "device" - a SyncEngine with its own local state, connected to a shared server.
 */
const createDevice = async (
  server: MockServer,
  deviceId: string,
  options: { online?: boolean } = {}
): Promise<DeviceState> => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), `e2e-${deviceId}-`));
  fs.mkdirSync(path.join(tempDir, 'derived'), { recursive: true });

  const localNotes = new Map<string, BaseNote>();
  const savedNotes = new Map<string, BaseNote>();
  const deletedNoteIds = new Set<string>();
  const networkMonitor = new SimpleNetworkMonitor(options.online ?? true);
  const transport = createMockTransport(server);

  const config: SyncEngineConfig = {
    vaultPath: tempDir,
    config: createTestSyncConfig({}, deviceId),
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
  };

  const engine = new SyncEngine(config);

  // Inject mock transport
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (engine as any).transport = transport;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (engine as any).coordinator.config.transport = transport;

  await engine.initialize();

  return {
    engine,
    tempDir,
    localNotes,
    savedNotes,
    deletedNoteIds,
    networkMonitor,
    transport,
    cleanup: async () => {
      await engine.shutdown();
      fs.rmSync(tempDir, { recursive: true, force: true });
    },
  };
};

// =============================================================================
// End-to-End Tests
// =============================================================================

describe('End-to-End Sync Scenarios', () => {
  let server: MockServer;

  beforeEach(() => {
    server = new MockServer();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ===========================================================================
  // Scenario: Initial sync from empty vault
  // ===========================================================================

  describe('Scenario: Initial sync from empty vault', () => {
    it('should sync local notes to server', async () => {
      const device = await createDevice(server, 'device-1');

      try {
        // Create local notes
        const notes = [
          createTestNote({ id: createNoteId('note-1'), title: 'First' }),
          createTestNote({ id: createNoteId('note-2'), title: 'Second' }),
        ];

        for (const note of notes) {
          device.localNotes.set(note.id, note);
          const noteWithSync = device.engine.addSyncMetadata(note);
          device.engine.queueChange(noteWithSync, 'create');
        }

        // Verify pending changes
        expect(device.engine.getStatus().pendingChanges).toBe(2);

        // Sync
        const result = await device.engine.triggerSync();

        expect(result.errors).toHaveLength(0);
        expect(result.pushed).toBe(2);
        expect(device.engine.getStatus().pendingChanges).toBe(0);

        // Verify notes are on server
        expect(server.getAllNotes()).toHaveLength(2);
      } finally {
        await device.cleanup();
      }
    });

    it('should pull notes from server on first sync', async () => {
      // Pre-populate server with notes (from another device)
      const device1 = await createDevice(server, 'device-1');
      try {
        const note = createTestNote({ id: createNoteId('server-note'), title: 'Server Note' });
        device1.localNotes.set(note.id, note);
        const noteWithSync = device1.engine.addSyncMetadata(note);
        device1.engine.queueChange(noteWithSync, 'create');
        await device1.engine.triggerSync();
      } finally {
        await device1.cleanup();
      }

      // Now create a new device and sync
      const device2 = await createDevice(server, 'device-2');
      try {
        const result = await device2.engine.triggerSync();

        expect(result.errors).toHaveLength(0);
        expect(result.pulled).toBe(1);
        expect(device2.savedNotes.has('server-note')).toBe(true);
        expect(device2.savedNotes.get('server-note')?.title).toBe('Server Note');
      } finally {
        await device2.cleanup();
      }
    });
  });

  // ===========================================================================
  // Scenario: Two devices syncing
  // ===========================================================================

  describe('Scenario: Two devices syncing', () => {
    it('should sync notes from device 1 to device 2', async () => {
      const device1 = await createDevice(server, 'device-1');
      const device2 = await createDevice(server, 'device-2');

      try {
        // Device 1 creates a note
        const note = createTestNote({ id: createNoteId('shared-note'), title: 'Shared' });
        device1.localNotes.set(note.id, note);
        const noteWithSync = device1.engine.addSyncMetadata(note);
        device1.engine.queueChange(noteWithSync, 'create');

        // Device 1 syncs
        await device1.engine.triggerSync();

        // Device 2 syncs and gets the note
        await device2.engine.triggerSync();

        expect(device2.savedNotes.has('shared-note')).toBe(true);
        const received = device2.savedNotes.get('shared-note');
        expect(received?.title).toBe('Shared');
      } finally {
        await device1.cleanup();
        await device2.cleanup();
      }
    });

    it('should handle non-conflicting edits', async () => {
      const device1 = await createDevice(server, 'device-1');
      const device2 = await createDevice(server, 'device-2');

      try {
        // Device 1 creates note-a
        const noteA = createTestNote({ id: createNoteId('note-a'), title: 'Note A' });
        device1.localNotes.set(noteA.id, noteA);
        device1.engine.queueChange(device1.engine.addSyncMetadata(noteA), 'create');

        // Device 2 creates note-b
        const noteB = createTestNote({ id: createNoteId('note-b'), title: 'Note B' });
        device2.localNotes.set(noteB.id, noteB);
        device2.engine.queueChange(device2.engine.addSyncMetadata(noteB), 'create');

        // Both sync
        await device1.engine.triggerSync();
        await device2.engine.triggerSync();
        await device1.engine.triggerSync(); // Device 1 gets note-b

        expect(device1.savedNotes.has('note-b')).toBe(true);
        expect(device2.savedNotes.has('note-a')).toBe(true);
      } finally {
        await device1.cleanup();
        await device2.cleanup();
      }
    });

    it('should detect conflict on simultaneous edit', async () => {
      const device1 = await createDevice(server, 'device-1');
      const device2 = await createDevice(server, 'device-2');

      try {
        // Create shared note on device 1 and sync
        const originalNote = createTestNote({
          id: createNoteId('conflict-note'),
          title: 'Original',
          content: createEditorContent('Original content'),
        });
        device1.localNotes.set(originalNote.id, originalNote);
        device1.engine.queueChange(device1.engine.addSyncMetadata(originalNote), 'create');
        await device1.engine.triggerSync(); // Server version 1

        // Device 2 syncs to get the note (local version 1)
        await device2.engine.triggerSync();

        // Device 2 makes an edit (local version 2, pending)
        const edit2 = {
          ...device2.savedNotes.get('conflict-note')!,
          title: 'Edit by Device 2',
          content: createEditorContent('Content from device 2'),
          sync: { version: 2, contentHash: 'hash2' },
        };
        device2.localNotes.set('conflict-note', edit2);
        device2.engine.queueChange(edit2, 'update');

        // Device 1 edits and syncs (server version 2)
        const edit1a = {
          ...(device1.savedNotes.get('conflict-note') ?? originalNote),
          title: 'Edit 1a by Device 1',
          content: createEditorContent('Content 1a from device 1'),
          sync: { version: 2, contentHash: 'hash1a' },
        };
        device1.localNotes.set('conflict-note', edit1a);
        device1.engine.queueChange(edit1a, 'update');
        await device1.engine.triggerSync(); // Server version 2

        // Device 1 edits AGAIN and syncs (server version 3)
        // This creates the version gap needed for conflict detection
        const edit1b = {
          ...edit1a,
          title: 'Edit 1b by Device 1',
          content: createEditorContent('Content 1b from device 1'),
          sync: { version: 3, contentHash: 'hash1b' },
        };
        device1.localNotes.set('conflict-note', edit1b);
        device1.engine.queueChange(edit1b, 'update');
        await device1.engine.triggerSync(); // Server version 3

        // Device 2 syncs - should detect conflict because:
        // - Device 2 has pending changes at local version 2
        // - Server now has version 3 with different content
        await device2.engine.triggerSync();

        const conflicts = device2.engine.getConflicts();
        expect(conflicts.length).toBeGreaterThan(0);
        expect(conflicts[0]?.noteId).toBe('conflict-note');
      } finally {
        await device1.cleanup();
        await device2.cleanup();
      }
    });

    it('should allow conflict resolution and continue syncing', async () => {
      const device1 = await createDevice(server, 'device-1');
      const device2 = await createDevice(server, 'device-2');

      try {
        // Create and sync initial note
        const note = createTestNote({
          id: createNoteId('resolve-test'),
          title: 'Original',
        });
        device1.localNotes.set(note.id, note);
        device1.engine.queueChange(device1.engine.addSyncMetadata(note), 'create');
        await device1.engine.triggerSync(); // Server version 1
        await device2.engine.triggerSync(); // Device 2 gets version 1

        // Device 2 queues a local edit (pending at version 2)
        const edit2 = {
          ...device2.savedNotes.get('resolve-test')!,
          title: 'D2 Edit',
          content: createEditorContent('D2 content'),
          sync: { version: 2, contentHash: 'h2' },
        };
        device2.localNotes.set('resolve-test', edit2);
        device2.engine.queueChange(edit2, 'update');

        // Device 1 makes two edits and syncs both (to get server to version 3)
        const edit1a = {
          ...(device1.savedNotes.get('resolve-test') ?? note),
          title: 'D1 Edit A',
          content: createEditorContent('D1 content A'),
          sync: { version: 2, contentHash: 'h1a' },
        };
        device1.localNotes.set('resolve-test', edit1a);
        device1.engine.queueChange(edit1a, 'update');
        await device1.engine.triggerSync(); // Server version 2

        const edit1b = {
          ...edit1a,
          title: 'D1 Edit B',
          content: createEditorContent('D1 content B'),
          sync: { version: 3, contentHash: 'h1b' },
        };
        device1.localNotes.set('resolve-test', edit1b);
        device1.engine.queueChange(edit1b, 'update');
        await device1.engine.triggerSync(); // Server version 3

        // Device 2 syncs - should get conflict (local v2 < server v3)
        await device2.engine.triggerSync();

        // Device 2 should have conflict
        expect(device2.engine.getConflicts().length).toBe(1);

        // Resolve with keep_local
        device2.engine.resolveConflict('resolve-test', { type: 'keep_local' });

        // Conflicts should be cleared
        expect(device2.engine.getConflicts().length).toBe(0);
        expect(device2.engine.getStatus().conflictCount).toBe(0);
      } finally {
        await device1.cleanup();
        await device2.cleanup();
      }
    });

    it('should handle three-way sync correctly', async () => {
      const device1 = await createDevice(server, 'device-1');
      const device2 = await createDevice(server, 'device-2');
      const device3 = await createDevice(server, 'device-3');

      try {
        // Device 1 creates a note
        const note = createTestNote({ id: createNoteId('three-way'), title: 'Original' });
        device1.localNotes.set(note.id, note);
        device1.engine.queueChange(device1.engine.addSyncMetadata(note), 'create');
        await device1.engine.triggerSync();

        // Device 2 and 3 sync to get the note
        await device2.engine.triggerSync();
        await device3.engine.triggerSync();

        // Verify all devices have the note
        expect(device1.localNotes.has('three-way')).toBe(true);
        expect(device2.savedNotes.has('three-way')).toBe(true);
        expect(device3.savedNotes.has('three-way')).toBe(true);

        // Device 2 makes an edit
        const edit = {
          ...note,
          title: 'Edited by D2',
          sync: { version: 2, contentHash: 'new-hash' },
        };
        device2.localNotes.set(note.id, edit);
        device2.engine.queueChange(edit, 'update');
        await device2.engine.triggerSync();

        // Devices 1 and 3 sync and get the edit
        await device1.engine.triggerSync();
        await device3.engine.triggerSync();

        expect(device1.savedNotes.get('three-way')?.title).toBe('Edited by D2');
        expect(device3.savedNotes.get('three-way')?.title).toBe('Edited by D2');
      } finally {
        await device1.cleanup();
        await device2.cleanup();
        await device3.cleanup();
      }
    });
  });

  // ===========================================================================
  // Scenario: Offline then online
  // ===========================================================================

  describe('Scenario: Offline then online', () => {
    it('should sync accumulated changes when back online', async () => {
      const device = await createDevice(server, 'device-1', { online: false });

      try {
        // Make changes "offline"
        for (let i = 0; i < 3; i++) {
          const note = createTestNote({
            id: createNoteId(`offline-${i}`),
            title: `Offline Note ${i}`,
          });
          device.localNotes.set(note.id, note);
          device.engine.queueChange(device.engine.addSyncMetadata(note), 'create');
        }

        // Verify changes are pending
        expect(device.engine.getStatus().pendingChanges).toBe(3);

        // Try to sync while offline - should fail
        const offlineResult = await device.engine.triggerSync();
        expect(offlineResult.errors).toContain('Offline');

        // Go back online
        device.networkMonitor.setOnline(true);

        // Wait for auto-sync to trigger
        await vi.advanceTimersByTimeAsync(100);

        // Verify all changes synced
        expect(device.engine.getStatus().pendingChanges).toBe(0);
        expect(server.getAllNotes()).toHaveLength(3);
      } finally {
        await device.cleanup();
      }
    });

    it('should handle offline edits that conflict with online changes', async () => {
      const device1 = await createDevice(server, 'device-1');
      const device2 = await createDevice(server, 'device-2', { online: true });

      try {
        // Device 1 creates a note
        const note = createTestNote({
          id: createNoteId('offline-conflict'),
          title: 'Original',
        });
        device1.localNotes.set(note.id, note);
        device1.engine.queueChange(device1.engine.addSyncMetadata(note), 'create');
        await device1.engine.triggerSync(); // Server version 1

        // Device 2 syncs to get the note (local version 1)
        await device2.engine.triggerSync();

        // Device 2 goes offline
        device2.networkMonitor.setOnline(false);

        // Device 2 makes offline edits (pending at version 2)
        const offlineEdit = {
          ...device2.savedNotes.get('offline-conflict')!,
          title: 'Offline Edit',
          content: createEditorContent('Offline content'),
          sync: { version: 2, contentHash: 'offline-hash' },
        };
        device2.localNotes.set('offline-conflict', offlineEdit);
        device2.engine.queueChange(offlineEdit, 'update');

        // Device 1 makes TWO online edits and syncs to get server to version 3
        const onlineEdit1 = {
          ...(device1.savedNotes.get('offline-conflict') ?? note),
          title: 'Online Edit 1',
          content: createEditorContent('Online content 1'),
          sync: { version: 2, contentHash: 'online-hash-1' },
        };
        device1.localNotes.set('offline-conflict', onlineEdit1);
        device1.engine.queueChange(onlineEdit1, 'update');
        await device1.engine.triggerSync(); // Server version 2

        const onlineEdit2 = {
          ...onlineEdit1,
          title: 'Online Edit 2',
          content: createEditorContent('Online content 2'),
          sync: { version: 3, contentHash: 'online-hash-2' },
        };
        device1.localNotes.set('offline-conflict', onlineEdit2);
        device1.engine.queueChange(onlineEdit2, 'update');
        await device1.engine.triggerSync(); // Server version 3

        // Device 2 comes back online and syncs (local v2 < server v3)
        device2.networkMonitor.setOnline(true);
        await vi.advanceTimersByTimeAsync(100);

        // Device 2 should have a conflict
        expect(device2.engine.getConflicts().length).toBeGreaterThan(0);
      } finally {
        await device1.cleanup();
        await device2.cleanup();
      }
    });

    it('should preserve offline changes across multiple sync attempts', async () => {
      const device = await createDevice(server, 'device-1', { online: false });

      try {
        // Create note while offline
        const note = createTestNote({
          id: createNoteId('persist-offline'),
          title: 'Persist Me',
        });
        device.localNotes.set(note.id, note);
        device.engine.queueChange(device.engine.addSyncMetadata(note), 'create');

        // Try multiple sync attempts while offline
        await device.engine.triggerSync();
        await device.engine.triggerSync();
        await device.engine.triggerSync();

        // Changes should still be pending
        expect(device.engine.getStatus().pendingChanges).toBe(1);

        // Go online and sync
        device.networkMonitor.setOnline(true);
        await device.engine.triggerSync();

        expect(device.engine.getStatus().pendingChanges).toBe(0);
        expect(server.getAllNotes()).toHaveLength(1);
      } finally {
        await device.cleanup();
      }
    });
  });

  // ===========================================================================
  // Scenario: Large vault initial sync
  // ===========================================================================

  describe('Scenario: Large vault initial sync', () => {
    it('should handle initial sync of many notes', async () => {
      const device = await createDevice(server, 'device-1');
      const noteCount = 50;

      try {
        // Create many notes
        for (let i = 0; i < noteCount; i++) {
          const note = createTestNote({
            id: createNoteId(`note-${i}`),
            title: `Note ${i}`,
            content: createEditorContent(`Content for note ${i}`),
          });
          device.localNotes.set(note.id, note);
          device.engine.queueChange(device.engine.addSyncMetadata(note), 'create');
        }

        expect(device.engine.getStatus().pendingChanges).toBe(noteCount);

        const result = await device.engine.triggerSync();

        expect(result.errors).toHaveLength(0);
        expect(result.pushed).toBe(noteCount);
        expect(device.engine.getStatus().pendingChanges).toBe(0);
        expect(server.getAllNotes()).toHaveLength(noteCount);
      } finally {
        await device.cleanup();
      }
    });

    it('should sync large vault to new device', async () => {
      // Device 1 creates many notes
      const device1 = await createDevice(server, 'device-1');
      const noteCount = 30;

      try {
        for (let i = 0; i < noteCount; i++) {
          const note = createTestNote({
            id: createNoteId(`bulk-${i}`),
            title: `Bulk Note ${i}`,
          });
          device1.localNotes.set(note.id, note);
          device1.engine.queueChange(device1.engine.addSyncMetadata(note), 'create');
        }
        await device1.engine.triggerSync();
      } finally {
        await device1.cleanup();
      }

      // New device syncs and gets all notes
      const device2 = await createDevice(server, 'device-2');
      try {
        const result = await device2.engine.triggerSync();

        expect(result.errors).toHaveLength(0);
        expect(result.pulled).toBe(noteCount);
        expect(device2.savedNotes.size).toBe(noteCount);
      } finally {
        await device2.cleanup();
      }
    });

    it('should handle mixed create/update/delete in large sync', async () => {
      const device = await createDevice(server, 'device-1');

      try {
        // Create initial notes
        const initialNotes: BaseNote[] = [];
        for (let i = 0; i < 20; i++) {
          const note = createTestNote({
            id: createNoteId(`mixed-${i}`),
            title: `Initial Note ${i}`,
          });
          initialNotes.push(note);
          device.localNotes.set(note.id, note);
          device.engine.queueChange(device.engine.addSyncMetadata(note), 'create');
        }
        await device.engine.triggerSync();

        // Now do mixed operations
        // Update some notes
        for (let i = 0; i < 5; i++) {
          const updatedNote = {
            ...initialNotes[i]!,
            title: `Updated Note ${i}`,
            sync: { version: 2, contentHash: `updated-${i}` },
          };
          device.localNotes.set(updatedNote.id, updatedNote);
          device.engine.queueChange(updatedNote, 'update');
        }

        // Delete some notes
        for (let i = 10; i < 15; i++) {
          device.engine.queueDelete(initialNotes[i]!.id);
        }

        // Create new notes
        for (let i = 0; i < 5; i++) {
          const newNote = createTestNote({
            id: createNoteId(`new-${i}`),
            title: `New Note ${i}`,
          });
          device.localNotes.set(newNote.id, newNote);
          device.engine.queueChange(device.engine.addSyncMetadata(newNote), 'create');
        }

        // Sync all changes
        const result = await device.engine.triggerSync();

        expect(result.errors).toHaveLength(0);
        // 5 updates + 5 deletes + 5 creates = 15 pushed
        expect(result.pushed).toBe(15);
      } finally {
        await device.cleanup();
      }
    });
  });

  // ===========================================================================
  // Scenario: Delete operations
  // ===========================================================================

  describe('Scenario: Delete operations', () => {
    it('should sync delete from one device to another', async () => {
      const device1 = await createDevice(server, 'device-1');
      const device2 = await createDevice(server, 'device-2');

      try {
        // Device 1 creates a note
        const note = createTestNote({ id: createNoteId('to-delete'), title: 'Delete Me' });
        device1.localNotes.set(note.id, note);
        device1.engine.queueChange(device1.engine.addSyncMetadata(note), 'create');
        await device1.engine.triggerSync();

        // Device 2 syncs and gets the note
        await device2.engine.triggerSync();
        expect(device2.savedNotes.has('to-delete')).toBe(true);

        // Device 1 deletes the note
        device1.engine.queueDelete('to-delete');
        await device1.engine.triggerSync();

        // Device 2 syncs and note should be deleted
        await device2.engine.triggerSync();
        expect(device2.deletedNoteIds.has('to-delete')).toBe(true);
      } finally {
        await device1.cleanup();
        await device2.cleanup();
      }
    });

    it('should handle delete on device that never had the note', async () => {
      const device1 = await createDevice(server, 'device-1');
      const device2 = await createDevice(server, 'device-2');
      const device3 = await createDevice(server, 'device-3');

      try {
        // Device 1 creates and syncs a note
        const note = createTestNote({ id: createNoteId('transient'), title: 'Transient' });
        device1.localNotes.set(note.id, note);
        device1.engine.queueChange(device1.engine.addSyncMetadata(note), 'create');
        await device1.engine.triggerSync();

        // Device 1 immediately deletes the note
        device1.engine.queueDelete('transient');
        await device1.engine.triggerSync();

        // Device 2 syncs - should see create then delete (or just nothing)
        await device2.engine.triggerSync();
        // Device 2 might have the delete in its history but not the note locally
        expect(device2.localNotes.has('transient')).toBe(false);

        // Device 3 syncs after everything
        await device3.engine.triggerSync();
        expect(device3.localNotes.has('transient')).toBe(false);
      } finally {
        await device1.cleanup();
        await device2.cleanup();
        await device3.cleanup();
      }
    });
  });

  // ===========================================================================
  // Scenario: Rapid updates
  // ===========================================================================

  describe('Scenario: Rapid updates', () => {
    it('should handle rapid consecutive updates to same note', async () => {
      const device = await createDevice(server, 'device-1');

      try {
        // Create initial note
        const note = createTestNote({ id: createNoteId('rapid'), title: 'Version 0' });
        device.localNotes.set(note.id, note);
        device.engine.queueChange(device.engine.addSyncMetadata(note), 'create');
        await device.engine.triggerSync();

        // Rapid updates
        for (let i = 1; i <= 10; i++) {
          const updated = {
            ...note,
            title: `Version ${i}`,
            sync: { version: i + 1, contentHash: `hash-${i}` },
          };
          device.localNotes.set(note.id, updated);
          device.engine.queueChange(updated, 'update');
        }

        // Sync all pending changes
        const result = await device.engine.triggerSync();

        expect(result.errors).toHaveLength(0);
        // The final version on server should be the last update
        const serverNote = server.getNote('rapid');
        expect(serverNote?.title).toBe('Version 10');
      } finally {
        await device.cleanup();
      }
    });

    it('should coalesce rapid updates before sync', async () => {
      const device = await createDevice(server, 'device-1');

      try {
        // Create initial note
        const note = createTestNote({ id: createNoteId('coalesce'), title: 'Initial' });
        device.localNotes.set(note.id, note);

        // Queue many updates without syncing
        for (let i = 0; i < 5; i++) {
          const updated = {
            ...note,
            title: `Update ${i}`,
            sync: { version: i + 1, contentHash: `hash-${i}` },
          };
          device.localNotes.set(note.id, updated);
          device.engine.queueChange(
            device.engine.addSyncMetadata(updated),
            i === 0 ? 'create' : 'update'
          );
        }

        // Sync once
        const result = await device.engine.triggerSync();

        expect(result.errors).toHaveLength(0);
        // Only the latest version should matter
        const serverNote = server.getNote('coalesce');
        expect(serverNote?.title).toBe('Update 4');
      } finally {
        await device.cleanup();
      }
    });
  });

  // ===========================================================================
  // Scenario: Recovery scenarios
  // ===========================================================================

  describe('Scenario: Recovery scenarios', () => {
    it('should recover sync state after engine restart', async () => {
      const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-restart-'));
      fs.mkdirSync(path.join(tempDir, 'derived'), { recursive: true });

      const localNotes = new Map<string, BaseNote>();
      const savedNotes = new Map<string, BaseNote>();

      try {
        // Create first engine instance
        const config1: SyncEngineConfig = {
          vaultPath: tempDir,
          config: createTestSyncConfig({}, 'restart-device'),
          networkMonitor: new SimpleNetworkMonitor(true),
          apiKey: 'sk_test_123',
          onSaveNote: async (note) => {
            savedNotes.set(note.id, note);
            localNotes.set(note.id, note);
          },
          onDeleteNote: async (noteId) => {
            localNotes.delete(noteId);
          },
          onReadNote: async (noteId) => localNotes.get(noteId) ?? null,
        };

        const engine1 = new SyncEngine(config1);
        const transport1 = createMockTransport(server);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (engine1 as any).transport = transport1;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (engine1 as any).coordinator.config.transport = transport1;

        await engine1.initialize();

        // Create and sync some notes
        const note = createTestNote({ id: createNoteId('persist'), title: 'Persisted' });
        localNotes.set(note.id, note);
        engine1.queueChange(engine1.addSyncMetadata(note), 'create');
        await engine1.triggerSync();

        // Shutdown
        await engine1.shutdown();

        // Create new engine instance with same vault
        const engine2 = new SyncEngine({
          ...config1,
          networkMonitor: new SimpleNetworkMonitor(true),
        });
        const transport2 = createMockTransport(server);
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (engine2 as any).transport = transport2;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (engine2 as any).coordinator.config.transport = transport2;

        await engine2.initialize();

        // The device ID should be preserved
        expect(engine2.getDeviceId()).toBe('restart-device');

        // Sync should work and not re-push already synced notes
        const result = await engine2.triggerSync();
        expect(result.pushed).toBe(0); // No new changes to push

        await engine2.shutdown();
      } finally {
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    });
  });
});
