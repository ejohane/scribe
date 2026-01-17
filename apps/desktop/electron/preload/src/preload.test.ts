/**
 * Preload Script Tests
 *
 * Tests the security boundary between renderer and main process.
 * The preload script is critical for Electron security - it's the only
 * bridge between the sandboxed renderer and privileged main process.
 *
 * Test Strategy:
 * 1. Verify API shape matches ScribeAPI contract
 * 2. Verify each method calls the correct IPC channel
 * 3. Verify argument transformations (especially Date serialization)
 * 4. Verify event listener setup/cleanup
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { IPC_CHANNELS, type ScribeAPI } from '@scribe/shared';

// Mock electron before importing anything that uses it
const mockInvoke = vi.fn();
const mockSend = vi.fn();
const mockOn = vi.fn();
const mockRemoveListener = vi.fn();
const mockExposeInMainWorld = vi.fn();

vi.mock('electron', () => ({
  ipcRenderer: {
    invoke: mockInvoke,
    send: mockSend,
    on: mockOn,
    removeListener: mockRemoveListener,
  },
  contextBridge: {
    exposeInMainWorld: mockExposeInMainWorld,
  },
}));

// Import after mocking
// We need to access the scribeAPI object that gets exposed
// Since contextBridge.exposeInMainWorld is mocked, we capture what's passed to it
let capturedApi: ScribeAPI;

describe('Preload Security Boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Re-import preload to capture the exposed API
    vi.resetModules();
    mockExposeInMainWorld.mockImplementation((_name: string, api: unknown) => {
      capturedApi = api as ScribeAPI;
    });

    // Dynamic import to trigger the module execution
    return import('./preload').then(() => {
      // API should now be captured
    });
  });

  afterEach(() => {
    vi.resetModules();
  });

  describe('API Exposure', () => {
    it('exposes scribe API via contextBridge', () => {
      expect(mockExposeInMainWorld).toHaveBeenCalledWith('scribe', expect.any(Object));
    });

    it('has all expected namespaces', () => {
      expect(capturedApi).toHaveProperty('ping');
      expect(capturedApi).toHaveProperty('notes');
      expect(capturedApi).toHaveProperty('search');
      expect(capturedApi).toHaveProperty('graph');
      expect(capturedApi).toHaveProperty('shell');
      expect(capturedApi).toHaveProperty('app');
      expect(capturedApi).toHaveProperty('update');
      expect(capturedApi).toHaveProperty('cli');
      expect(capturedApi).toHaveProperty('export');
    });
  });

  describe('Core API', () => {
    it('ping invokes correct channel', async () => {
      mockInvoke.mockResolvedValue('pong');
      await capturedApi.ping();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.PING);
    });
  });

  describe('Notes API', () => {
    it('list invokes correct channel', async () => {
      mockInvoke.mockResolvedValue([]);
      await capturedApi.notes.list();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.NOTES_LIST);
    });

    it('read invokes correct channel with noteId', async () => {
      const noteId = 'test-note-id' as import('@scribe/shared').NoteId;
      mockInvoke.mockResolvedValue(null);
      await capturedApi.notes.read(noteId);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.NOTES_READ, noteId);
    });

    it('create invokes correct channel', async () => {
      mockInvoke.mockResolvedValue({ id: 'new-id' });
      await capturedApi.notes.create();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.NOTES_CREATE);
    });

    it('save invokes correct channel with note', async () => {
      const note = { id: 'test-id', title: 'Test' } as import('@scribe/shared').Note;
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.notes.save(note);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.NOTES_SAVE, note);
    });

    it('delete invokes correct channel with noteId', async () => {
      const noteId = 'test-note-id' as import('@scribe/shared').NoteId;
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.notes.delete(noteId);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.NOTES_DELETE, noteId);
    });

    it('findByTitle invokes correct channel with title', async () => {
      mockInvoke.mockResolvedValue(null);
      await capturedApi.notes.findByTitle('Test Title');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.NOTES_FIND_BY_TITLE, 'Test Title');
    });

    it('searchTitles invokes correct channel with query and default limit', async () => {
      mockInvoke.mockResolvedValue([]);
      await capturedApi.notes.searchTitles('test');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.NOTES_SEARCH_TITLES, 'test', 10);
    });

    it('searchTitles invokes correct channel with custom limit', async () => {
      mockInvoke.mockResolvedValue([]);
      await capturedApi.notes.searchTitles('test', 5);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.NOTES_SEARCH_TITLES, 'test', 5);
    });

    it('findByDate invokes correct channel with date options', async () => {
      mockInvoke.mockResolvedValue([]);
      await capturedApi.notes.findByDate('2024-12-21', true, false);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.NOTES_FIND_BY_DATE, {
        date: '2024-12-21',
        includeCreated: true,
        includeUpdated: false,
      });
    });
  });

  describe('Search API', () => {
    it('query invokes correct channel with search text', async () => {
      mockInvoke.mockResolvedValue([]);
      await capturedApi.search.query('test query');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.SEARCH_QUERY, 'test query');
    });
  });

  describe('Graph API', () => {
    it('forNote invokes correct channel with noteId', async () => {
      const noteId = 'test-note-id' as import('@scribe/shared').NoteId;
      mockInvoke.mockResolvedValue({ nodes: [], edges: [] });
      await capturedApi.graph.forNote(noteId);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.GRAPH_FOR_NOTE, noteId);
    });

    it('backlinks invokes correct channel with noteId', async () => {
      const noteId = 'test-note-id' as import('@scribe/shared').NoteId;
      mockInvoke.mockResolvedValue([]);
      await capturedApi.graph.backlinks(noteId);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.GRAPH_BACKLINKS, noteId);
    });

    it('notesWithTag invokes correct channel with tag', async () => {
      mockInvoke.mockResolvedValue([]);
      await capturedApi.graph.notesWithTag('important');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.GRAPH_NOTES_WITH_TAG, 'important');
    });
  });

  describe('Shell API', () => {
    it('openExternal invokes correct channel with URL', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.shell.openExternal('https://example.com');
      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.SHELL_OPEN_EXTERNAL,
        'https://example.com'
      );
    });
  });

  describe('App API', () => {
    it('openDevTools invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.app.openDevTools();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_OPEN_DEV_TOOLS);
    });

    it('getLastOpenedNote invokes correct channel', async () => {
      mockInvoke.mockResolvedValue('note-id');
      await capturedApi.app.getLastOpenedNote();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_GET_LAST_OPENED_NOTE);
    });

    it('setLastOpenedNote invokes correct channel with noteId', async () => {
      const noteId = 'test-note-id' as import('@scribe/shared').NoteId;
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.app.setLastOpenedNote(noteId);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_SET_LAST_OPENED_NOTE, noteId);
    });

    it('setLastOpenedNote handles null', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.app.setLastOpenedNote(null);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_SET_LAST_OPENED_NOTE, null);
    });

    it('getConfig invokes correct channel', async () => {
      mockInvoke.mockResolvedValue({});
      await capturedApi.app.getConfig();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_GET_CONFIG);
    });

    it('setConfig invokes correct channel with config', async () => {
      const config = { theme: 'dark' };
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.app.setConfig(config);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_SET_CONFIG, config);
    });
  });

  describe('Update API', () => {
    it('check invokes correct channel', async () => {
      mockInvoke.mockResolvedValue({ updateAvailable: false });
      await capturedApi.update.check();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.UPDATE_CHECK);
    });

    it('install sends correct channel (not invoke)', () => {
      capturedApi.update.install();
      expect(mockSend).toHaveBeenCalledWith(IPC_CHANNELS.UPDATE_INSTALL);
    });

    it('onChecking registers listener and returns cleanup', () => {
      const callback = vi.fn();
      const cleanup = capturedApi.update.onChecking(callback);

      expect(mockOn).toHaveBeenCalledWith(IPC_CHANNELS.UPDATE_CHECKING, expect.any(Function));
      expect(typeof cleanup).toBe('function');

      cleanup();
      expect(mockRemoveListener).toHaveBeenCalled();
    });

    it('onAvailable registers listener with info', () => {
      const callback = vi.fn();
      capturedApi.update.onAvailable(callback);

      const handler = mockOn.mock.calls.find(
        (call) => call[0] === IPC_CHANNELS.UPDATE_AVAILABLE
      )?.[1];
      expect(handler).toBeDefined();

      handler({} as Electron.IpcRendererEvent, { version: '1.2.0' });
      expect(callback).toHaveBeenCalledWith({ version: '1.2.0' });
    });

    it('onNotAvailable registers listener', () => {
      const callback = vi.fn();
      capturedApi.update.onNotAvailable(callback);

      expect(mockOn).toHaveBeenCalledWith(IPC_CHANNELS.UPDATE_NOT_AVAILABLE, expect.any(Function));
    });

    it('onDownloaded registers listener with info', () => {
      const callback = vi.fn();
      capturedApi.update.onDownloaded(callback);

      const handler = mockOn.mock.calls.find(
        (call) => call[0] === IPC_CHANNELS.UPDATE_DOWNLOADED
      )?.[1];
      expect(handler).toBeDefined();

      handler({} as Electron.IpcRendererEvent, { version: '1.2.0' });
      expect(callback).toHaveBeenCalledWith({ version: '1.2.0' });
    });

    it('onError registers listener with error info', () => {
      const callback = vi.fn();
      capturedApi.update.onError(callback);

      const handler = mockOn.mock.calls.find((call) => call[0] === IPC_CHANNELS.UPDATE_ERROR)?.[1];
      expect(handler).toBeDefined();

      handler({} as Electron.IpcRendererEvent, { message: 'Network error' });
      expect(callback).toHaveBeenCalledWith({ message: 'Network error' });
    });
  });

  describe('CLI API', () => {
    it('install invokes correct channel', async () => {
      mockInvoke.mockResolvedValue({ success: true });
      await capturedApi.cli.install();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.CLI_INSTALL);
    });

    it('isInstalled invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(true);
      await capturedApi.cli.isInstalled();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.CLI_IS_INSTALLED);
    });

    it('uninstall invokes correct channel', async () => {
      mockInvoke.mockResolvedValue({ success: true });
      await capturedApi.cli.uninstall();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.CLI_UNINSTALL);
    });

    it('getStatus invokes correct channel', async () => {
      mockInvoke.mockResolvedValue({ installed: true, path: '/usr/local/bin/scribe' });
      await capturedApi.cli.getStatus();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.CLI_GET_STATUS);
    });
  });

  describe('Export API', () => {
    it('toMarkdown invokes correct channel with noteId', async () => {
      const noteId = 'test-note-id' as import('@scribe/shared').NoteId;
      mockInvoke.mockResolvedValue({ success: true });
      await capturedApi.export.toMarkdown(noteId);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.EXPORT_TO_MARKDOWN, noteId);
    });
  });
});
