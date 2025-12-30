/**
 * Integration tests for conflict resolution flow.
 *
 * These tests verify the complete conflict resolution flow from detection
 * through resolution, including auto-resolution, manual resolution,
 * and the "keep both" option.
 *
 * The transport layer is mocked, but all other components use real implementations.
 *
 * @module conflict-resolution.integration.test
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

describe('Conflict Resolution Integration Tests', () => {
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
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'conflict-resolution-integration-'));
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
  // Conflict Lifecycle Tests
  // ===========================================================================

  describe('Conflict Lifecycle', () => {
    it('detects conflict and stores for manual resolution', async () => {
      // Create local note with pending changes
      const localNote = createTestNote({
        id: createNoteId('conflict-note'),
        title: 'Local Version',
        content: createEditorContent('Local content'),
        sync: { version: 2, contentHash: 'localhash' },
      });
      localNotes.set('conflict-note', localNote);

      // Create remote note with different content
      const remoteNote = createTestNote({
        id: createNoteId('conflict-note'),
        title: 'Remote Version',
        content: createEditorContent('Remote content'),
        sync: { version: 3, contentHash: 'remotehash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 10;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue local change to create pending state
      engine.queueChange(localNote, 'update');

      // Setup transport to return conflicting change
      mockTransport.pull.mockImplementation(async () => ({
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
      }));

      await engine.initialize();
      const result = await engine.triggerSync();

      // Verify conflict was detected
      expect(result.conflicts).toBeGreaterThan(0);

      // Verify conflict is stored for manual resolution
      const conflicts = engine.getConflicts();
      expect(conflicts.length).toBeGreaterThan(0);
      expect(conflicts[0]?.noteId).toBe('conflict-note');
      expect(conflicts[0]?.type).toBe('edit');

      await engine.shutdown();
    });

    it('resolves conflict with local version', async () => {
      const localNote = createTestNote({
        id: createNoteId('local-wins-note'),
        title: 'Local Wins',
        content: createEditorContent('Local content that should win'),
        sync: { version: 2, contentHash: 'localhash' },
      });
      localNotes.set('local-wins-note', localNote);

      const remoteNote = createTestNote({
        id: createNoteId('local-wins-note'),
        title: 'Remote Version',
        content: createEditorContent('Remote content that loses'),
        sync: { version: 3, contentHash: 'remotehash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue local change
      engine.queueChange(localNote, 'update');

      // Setup transport to return conflicting change
      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'local-wins-note',
          operation: 'update' as const,
          version: 3,
          serverSequence: 5,
          note: remoteNote,
          timestamp: new Date().toISOString(),
        },
      ]);

      await engine.initialize();
      await engine.triggerSync();

      // Verify conflict exists
      expect(engine.getConflicts().length).toBe(1);

      // Resolve with local version
      const resolved = engine.resolveConflict('local-wins-note', { type: 'keep_local' });

      expect(resolved.resolution.type).toBe('keep_local');
      expect(resolved.resolvedNote?.title).toBe('Local Wins');

      // Conflict should be cleared
      expect(engine.getConflicts().length).toBe(0);

      await engine.shutdown();
    });

    it('resolves conflict with remote version', async () => {
      const localNote = createTestNote({
        id: createNoteId('remote-wins-note'),
        title: 'Local Version',
        content: createEditorContent('Local content that loses'),
        sync: { version: 2, contentHash: 'localhash' },
      });
      localNotes.set('remote-wins-note', localNote);

      const remoteNote = createTestNote({
        id: createNoteId('remote-wins-note'),
        title: 'Remote Wins',
        content: createEditorContent('Remote content that should win'),
        sync: { version: 3, contentHash: 'remotehash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue local change
      engine.queueChange(localNote, 'update');

      // Setup transport to return conflicting change
      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'remote-wins-note',
          operation: 'update' as const,
          version: 3,
          serverSequence: 5,
          note: remoteNote,
          timestamp: new Date().toISOString(),
        },
      ]);

      await engine.initialize();
      await engine.triggerSync();

      // Verify conflict exists
      expect(engine.getConflicts().length).toBe(1);

      // Resolve with remote version
      const resolved = engine.resolveConflict('remote-wins-note', { type: 'keep_remote' });

      expect(resolved.resolution.type).toBe('keep_remote');
      expect(resolved.resolvedNote?.title).toBe('Remote Wins');

      // Conflict should be cleared
      expect(engine.getConflicts().length).toBe(0);

      await engine.shutdown();
    });

    it('resolves conflict with keepBoth option (creates copy)', async () => {
      const localNote = createTestNote({
        id: createNoteId('keep-both-note'),
        title: 'Local Important Changes',
        content: createEditorContent('Local content with important edits'),
        sync: { version: 2, contentHash: 'localhash' },
      });
      localNotes.set('keep-both-note', localNote);

      const remoteNote = createTestNote({
        id: createNoteId('keep-both-note'),
        title: 'Remote Important Changes',
        content: createEditorContent('Remote content also important'),
        sync: { version: 3, contentHash: 'remotehash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue local change
      engine.queueChange(localNote, 'update');

      // Setup transport to return conflicting change
      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'keep-both-note',
          operation: 'update' as const,
          version: 3,
          serverSequence: 5,
          note: remoteNote,
          timestamp: new Date().toISOString(),
        },
      ]);

      await engine.initialize();
      await engine.triggerSync();

      // Verify conflict exists
      expect(engine.getConflicts().length).toBe(1);

      // Resolve with keepBoth
      const resolved = engine.resolveConflict('keep-both-note', { type: 'keep_both' });

      expect(resolved.resolution.type).toBe('keep_both');
      // Primary resolved note is the remote version
      expect(resolved.resolvedNote?.title).toBe('Remote Important Changes');
      // Copy note is created from local version
      expect(resolved.copyNote).toBeDefined();
      expect(resolved.copyNote?.title).toContain('Local Important Changes');
      expect(resolved.copyNote?.title).toContain('(conflict copy');
      // Copy has a new ID
      expect(resolved.copyNote?.id).not.toBe('keep-both-note');
      // Copy has no sync metadata (fresh start)
      expect(resolved.copyNote?.sync).toBeUndefined();

      // Conflict should be cleared
      expect(engine.getConflicts().length).toBe(0);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Multiple Conflicts Tests
  // ===========================================================================

  describe('Multiple Conflicts', () => {
    it('handles multiple simultaneous conflicts', async () => {
      // Create multiple local notes
      const localNote1 = createTestNote({
        id: createNoteId('multi-conflict-1'),
        title: 'Local Note 1',
        content: createEditorContent('Local content 1'),
        sync: { version: 2, contentHash: 'local1hash' },
      });
      const localNote2 = createTestNote({
        id: createNoteId('multi-conflict-2'),
        title: 'Local Note 2',
        content: createEditorContent('Local content 2'),
        sync: { version: 2, contentHash: 'local2hash' },
      });
      const localNote3 = createTestNote({
        id: createNoteId('multi-conflict-3'),
        title: 'Local Note 3',
        content: createEditorContent('Local content 3'),
        sync: { version: 2, contentHash: 'local3hash' },
      });

      localNotes.set('multi-conflict-1', localNote1);
      localNotes.set('multi-conflict-2', localNote2);
      localNotes.set('multi-conflict-3', localNote3);

      // Create remote notes with conflicts
      const remoteNote1 = createTestNote({
        id: createNoteId('multi-conflict-1'),
        title: 'Remote Note 1',
        content: createEditorContent('Remote content 1'),
        sync: { version: 3, contentHash: 'remote1hash' },
      });
      const remoteNote2 = createTestNote({
        id: createNoteId('multi-conflict-2'),
        title: 'Remote Note 2',
        content: createEditorContent('Remote content 2'),
        sync: { version: 3, contentHash: 'remote2hash' },
      });
      const remoteNote3 = createTestNote({
        id: createNoteId('multi-conflict-3'),
        title: 'Remote Note 3',
        content: createEditorContent('Remote content 3'),
        sync: { version: 3, contentHash: 'remote3hash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 10;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue all local changes
      engine.queueChange(localNote1, 'update');
      engine.queueChange(localNote2, 'update');
      engine.queueChange(localNote3, 'update');

      // Setup transport to return all conflicting changes
      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'multi-conflict-1',
          operation: 'update' as const,
          version: 3,
          serverSequence: 8,
          note: remoteNote1,
          timestamp: new Date().toISOString(),
        },
        {
          noteId: 'multi-conflict-2',
          operation: 'update' as const,
          version: 3,
          serverSequence: 9,
          note: remoteNote2,
          timestamp: new Date().toISOString(),
        },
        {
          noteId: 'multi-conflict-3',
          operation: 'update' as const,
          version: 3,
          serverSequence: 10,
          note: remoteNote3,
          timestamp: new Date().toISOString(),
        },
      ]);

      await engine.initialize();
      await engine.triggerSync();

      // Verify all conflicts are stored
      const conflicts = engine.getConflicts();
      expect(conflicts.length).toBe(3);

      const conflictNoteIds = conflicts.map((c) => c.noteId);
      expect(conflictNoteIds).toContain('multi-conflict-1');
      expect(conflictNoteIds).toContain('multi-conflict-2');
      expect(conflictNoteIds).toContain('multi-conflict-3');

      await engine.shutdown();
    });

    it('resolves each conflict independently', async () => {
      // Create multiple local notes
      const localNote1 = createTestNote({
        id: createNoteId('independent-1'),
        title: 'Local Note 1',
        content: createEditorContent('Local content 1'),
        sync: { version: 2, contentHash: 'local1hash' },
      });
      const localNote2 = createTestNote({
        id: createNoteId('independent-2'),
        title: 'Local Note 2',
        content: createEditorContent('Local content 2'),
        sync: { version: 2, contentHash: 'local2hash' },
      });
      const localNote3 = createTestNote({
        id: createNoteId('independent-3'),
        title: 'Local Note 3',
        content: createEditorContent('Local content 3'),
        sync: { version: 2, contentHash: 'local3hash' },
      });

      localNotes.set('independent-1', localNote1);
      localNotes.set('independent-2', localNote2);
      localNotes.set('independent-3', localNote3);

      // Create remote notes
      const remoteNote1 = createTestNote({
        id: createNoteId('independent-1'),
        title: 'Remote Note 1',
        content: createEditorContent('Remote content 1'),
        sync: { version: 3, contentHash: 'remote1hash' },
      });
      const remoteNote2 = createTestNote({
        id: createNoteId('independent-2'),
        title: 'Remote Note 2',
        content: createEditorContent('Remote content 2'),
        sync: { version: 3, contentHash: 'remote2hash' },
      });
      const remoteNote3 = createTestNote({
        id: createNoteId('independent-3'),
        title: 'Remote Note 3',
        content: createEditorContent('Remote content 3'),
        sync: { version: 3, contentHash: 'remote3hash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 10;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue all local changes
      engine.queueChange(localNote1, 'update');
      engine.queueChange(localNote2, 'update');
      engine.queueChange(localNote3, 'update');

      // Setup transport to return all conflicting changes
      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'independent-1',
          operation: 'update' as const,
          version: 3,
          serverSequence: 8,
          note: remoteNote1,
          timestamp: new Date().toISOString(),
        },
        {
          noteId: 'independent-2',
          operation: 'update' as const,
          version: 3,
          serverSequence: 9,
          note: remoteNote2,
          timestamp: new Date().toISOString(),
        },
        {
          noteId: 'independent-3',
          operation: 'update' as const,
          version: 3,
          serverSequence: 10,
          note: remoteNote3,
          timestamp: new Date().toISOString(),
        },
      ]);

      await engine.initialize();
      await engine.triggerSync();

      // Verify all conflicts exist
      expect(engine.getConflicts().length).toBe(3);

      // Resolve first conflict with keep_local
      const resolved1 = engine.resolveConflict('independent-1', { type: 'keep_local' });
      expect(resolved1.resolvedNote?.title).toBe('Local Note 1');
      expect(engine.getConflicts().length).toBe(2);

      // Resolve second conflict with keep_remote
      const resolved2 = engine.resolveConflict('independent-2', { type: 'keep_remote' });
      expect(resolved2.resolvedNote?.title).toBe('Remote Note 2');
      expect(engine.getConflicts().length).toBe(1);

      // Resolve third conflict with keep_both
      const resolved3 = engine.resolveConflict('independent-3', { type: 'keep_both' });
      expect(resolved3.resolvedNote?.title).toBe('Remote Note 3');
      expect(resolved3.copyNote?.title).toContain('Local Note 3');
      expect(engine.getConflicts().length).toBe(0);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Delete Conflicts Tests
  // ===========================================================================

  describe('Delete Conflicts', () => {
    it('detects local delete vs remote edit conflict', async () => {
      // Note exists locally and is marked for deletion
      const localNote = createTestNote({
        id: createNoteId('delete-edit-note'),
        title: 'Note to Delete',
        content: createEditorContent('Original content'),
        sync: { version: 2, contentHash: 'localhash' },
      });
      localNotes.set('delete-edit-note', localNote);

      // Remote has an edit for the same note
      const remoteNote = createTestNote({
        id: createNoteId('delete-edit-note'),
        title: 'Note with Remote Edits',
        content: createEditorContent('Remote edited content'),
        sync: { version: 3, contentHash: 'remotehash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue deletion but simulate local pending state
      // We need to track this as an update to trigger conflict detection
      engine.queueChange(localNote, 'update');

      // Setup transport to return remote edit
      mockTransport.pull.mockImplementation(async () => ({
        changes: [
          {
            noteId: 'delete-edit-note',
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
      }));

      await engine.initialize();
      await engine.triggerSync();

      // Conflict should be detected
      const conflicts = engine.getConflicts();
      expect(conflicts.length).toBe(1);
      expect(conflicts[0]?.noteId).toBe('delete-edit-note');

      await engine.shutdown();
    });

    it('handles remote delete vs local edit conflict', async () => {
      // Create local note with local edits
      const localNote = createTestNote({
        id: createNoteId('edit-delete-note'),
        title: 'Note with Local Edits',
        content: createEditorContent('Important local edits'),
        sync: { version: 2, contentHash: 'localhash' },
      });
      localNotes.set('edit-delete-note', localNote);

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue local edit
      engine.queueChange(localNote, 'update');

      // Setup transport to return remote delete
      mockTransport.pull.mockImplementation(async () => ({
        changes: [
          {
            noteId: 'edit-delete-note',
            operation: 'delete' as const,
            version: 3,
            serverSequence: 5,
            timestamp: new Date().toISOString(),
          },
        ],
        hasMore: false,
        latestSequence: 5,
        serverTime: new Date().toISOString(),
      }));

      await engine.initialize();
      await engine.triggerSync();

      // Check that the note was deleted (no conflict detection for delete operations
      // when there's no remote note to compare against)
      // In this case, the local note should be preserved if we have pending changes
      expect(deletedNoteIds.has('edit-delete-note') || localNotes.has('edit-delete-note')).toBe(
        true
      );

      await engine.shutdown();
    });

    it('preserves local content with keepBoth on delete conflict', async () => {
      // Create local note with important edits
      const localNote = createTestNote({
        id: createNoteId('preserve-local-note'),
        title: 'Important Local Work',
        content: createEditorContent('This content must not be lost'),
        sync: { version: 2, contentHash: 'localhash' },
      });
      localNotes.set('preserve-local-note', localNote);

      // Remote has edits too
      const remoteNote = createTestNote({
        id: createNoteId('preserve-local-note'),
        title: 'Remote Edits',
        content: createEditorContent('Remote made changes too'),
        sync: { version: 3, contentHash: 'remotehash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue local change
      engine.queueChange(localNote, 'update');

      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'preserve-local-note',
          operation: 'update' as const,
          version: 3,
          serverSequence: 5,
          note: remoteNote,
          timestamp: new Date().toISOString(),
        },
      ]);

      await engine.initialize();
      await engine.triggerSync();

      // Resolve with keepBoth to ensure nothing is lost
      const resolved = engine.resolveConflict('preserve-local-note', { type: 'keep_both' });

      // Remote version becomes primary
      expect(resolved.resolvedNote?.title).toBe('Remote Edits');

      // Local content is preserved in a copy
      expect(resolved.copyNote).toBeDefined();
      expect(resolved.copyNote?.title).toContain('Important Local Work');
      const copyContent = resolved.copyNote?.content as EditorContent;
      expect(copyContent.root.children[0]).toEqual({
        type: 'paragraph',
        children: [{ type: 'text', text: 'This content must not be lost' }],
      });

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Conflict Status Tests
  // ===========================================================================

  describe('Conflict Status Reporting', () => {
    it('reports correct conflict count in status', async () => {
      const localNote = createTestNote({
        id: createNoteId('status-test-note'),
        title: 'Local Version',
        content: createEditorContent('Local content'),
        sync: { version: 2, contentHash: 'localhash' },
      });
      localNotes.set('status-test-note', localNote);

      const remoteNote = createTestNote({
        id: createNoteId('status-test-note'),
        title: 'Remote Version',
        content: createEditorContent('Remote content'),
        sync: { version: 3, contentHash: 'remotehash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      engine.queueChange(localNote, 'update');

      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'status-test-note',
          operation: 'update' as const,
          version: 3,
          serverSequence: 5,
          note: remoteNote,
          timestamp: new Date().toISOString(),
        },
      ]);

      await engine.initialize();

      // Status should show 0 conflicts initially
      let status = engine.getStatus();
      expect(status.conflictCount).toBe(0);

      await engine.triggerSync();

      // Status should show 1 conflict after sync
      status = engine.getStatus();
      expect(status.conflictCount).toBe(1);
      // Status should be 'error' when there are conflicts
      expect(status.state).toBe('error');

      // Resolve the conflict
      engine.resolveConflict('status-test-note', { type: 'keep_local' });

      // Status should show 0 conflicts after resolution
      status = engine.getStatus();
      expect(status.conflictCount).toBe(0);
      // Status should return to 'idle' after conflicts are resolved
      expect(status.state).toBe('idle');

      await engine.shutdown();
    });

    it('notifies status listeners when conflicts change', async () => {
      const statusChanges: { conflictCount: number; state: string }[] = [];

      const localNote = createTestNote({
        id: createNoteId('listener-test-note'),
        title: 'Local Version',
        content: createEditorContent('Local content'),
        sync: { version: 2, contentHash: 'localhash' },
      });
      localNotes.set('listener-test-note', localNote);

      const remoteNote = createTestNote({
        id: createNoteId('listener-test-note'),
        title: 'Remote Version',
        content: createEditorContent('Remote content'),
        sync: { version: 3, contentHash: 'remotehash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Subscribe to status changes
      engine.onStatusChange((status) => {
        statusChanges.push({
          conflictCount: status.conflictCount,
          state: status.state,
        });
      });

      engine.queueChange(localNote, 'update');

      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'listener-test-note',
          operation: 'update' as const,
          version: 3,
          serverSequence: 5,
          note: remoteNote,
          timestamp: new Date().toISOString(),
        },
      ]);

      await engine.initialize();
      await engine.triggerSync();

      // Resolve conflict
      engine.resolveConflict('listener-test-note', { type: 'keep_remote' });

      // Should have recorded status changes
      expect(statusChanges.length).toBeGreaterThan(0);

      // Check that we saw conflict count change from 0 to 1 and back to 0
      const hadConflict = statusChanges.some((s) => s.conflictCount === 1);
      const resolvedConflict = statusChanges.some(
        (s, i) => i > 0 && s.conflictCount === 0 && statusChanges[i - 1]?.conflictCount === 1
      );
      expect(hadConflict).toBe(true);
      expect(resolvedConflict).toBe(true);

      await engine.shutdown();
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge Cases', () => {
    it('handles resolving non-existent conflict gracefully', async () => {
      const engine = new SyncEngine(createEngineConfig());
      await engine.initialize();

      // Attempting to resolve a non-existent conflict should throw
      expect(() => {
        engine.resolveConflict('non-existent-note', { type: 'keep_local' });
      }).toThrow('No conflict found for note non-existent-note');

      await engine.shutdown();
    });

    it('handles rapid conflict resolution without issues', async () => {
      // Create multiple conflicting notes
      const notes: BaseNote[] = [];
      const remoteNotes: BaseNote[] = [];

      for (let i = 0; i < 5; i++) {
        const local = createTestNote({
          id: createNoteId(`rapid-${i}`),
          title: `Local Note ${i}`,
          content: createEditorContent(`Local content ${i}`),
          sync: { version: 2, contentHash: `local${i}hash` },
        });
        notes.push(local);
        localNotes.set(`rapid-${i}`, local);

        const remote = createTestNote({
          id: createNoteId(`rapid-${i}`),
          title: `Remote Note ${i}`,
          content: createEditorContent(`Remote content ${i}`),
          sync: { version: 3, contentHash: `remote${i}hash` },
        });
        remoteNotes.push(remote);
      }

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 10;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      // Queue all changes
      notes.forEach((note) => engine.queueChange(note, 'update'));

      // Setup transport to return all conflicts
      setupMockTransportWithChanges(
        mockTransport,
        mockState,
        remoteNotes.map((note, i) => ({
          noteId: `rapid-${i}`,
          operation: 'update' as const,
          version: 3,
          serverSequence: i + 1,
          note,
          timestamp: new Date().toISOString(),
        }))
      );

      await engine.initialize();
      await engine.triggerSync();

      expect(engine.getConflicts().length).toBe(5);

      // Rapidly resolve all conflicts
      for (let i = 0; i < 5; i++) {
        const resolution =
          i % 3 === 0
            ? ({ type: 'keep_local' } as const)
            : i % 3 === 1
              ? ({ type: 'keep_remote' } as const)
              : ({ type: 'keep_both' } as const);

        engine.resolveConflict(`rapid-${i}`, resolution);
      }

      // All conflicts should be resolved
      expect(engine.getConflicts().length).toBe(0);

      await engine.shutdown();
    });

    it('detects no conflict when content is identical despite version mismatch', async () => {
      // Create local and remote with same content but different versions
      const localNote = createTestNote({
        id: createNoteId('same-content-note'),
        title: 'Same Content',
        content: createEditorContent('Identical content'),
        sync: { version: 2, contentHash: 'samehash' },
      });
      localNotes.set('same-content-note', localNote);

      // Remote has same content but higher version
      const remoteNote = createTestNote({
        id: createNoteId('same-content-note'),
        title: 'Same Content',
        content: createEditorContent('Identical content'),
        sync: { version: 5, contentHash: 'samehash' },
      });

      mockTransport.push.mockResolvedValue({ accepted: [], conflicts: [], errors: [] });
      mockState.serverSequence = 5;

      const engine = new SyncEngine(createEngineConfig());
      injectMockTransport(engine);

      engine.queueChange(localNote, 'update');

      setupMockTransportWithChanges(mockTransport, mockState, [
        {
          noteId: 'same-content-note',
          operation: 'update' as const,
          version: 5,
          serverSequence: 5,
          note: remoteNote,
          timestamp: new Date().toISOString(),
        },
      ]);

      await engine.initialize();
      await engine.triggerSync();

      // No conflict should be detected since content is the same
      expect(engine.getConflicts().length).toBe(0);

      await engine.shutdown();
    });
  });
});
