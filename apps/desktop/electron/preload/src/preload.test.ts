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
      expect(capturedApi).toHaveProperty('people');
      expect(capturedApi).toHaveProperty('daily');
      expect(capturedApi).toHaveProperty('meeting');
      expect(capturedApi).toHaveProperty('dictionary');
      expect(capturedApi).toHaveProperty('tasks');
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

  describe('People API', () => {
    it('list invokes correct channel', async () => {
      mockInvoke.mockResolvedValue([]);
      await capturedApi.people.list();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.PEOPLE_LIST);
    });

    it('create invokes correct channel with name', async () => {
      mockInvoke.mockResolvedValue({ id: 'person-id' });
      await capturedApi.people.create('John Doe');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.PEOPLE_CREATE, 'John Doe');
    });

    it('search invokes correct channel with query and default limit', async () => {
      mockInvoke.mockResolvedValue([]);
      await capturedApi.people.search('john');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.PEOPLE_SEARCH, 'john', 10);
    });

    it('search invokes correct channel with custom limit', async () => {
      mockInvoke.mockResolvedValue([]);
      await capturedApi.people.search('john', 5);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.PEOPLE_SEARCH, 'john', 5);
    });
  });

  describe('Daily API', () => {
    it('getOrCreate invokes correct channel without date', async () => {
      mockInvoke.mockResolvedValue({ note: {}, isNew: true });
      await capturedApi.daily.getOrCreate();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.DAILY_GET_OR_CREATE, undefined);
    });

    it('getOrCreate transforms Date to ISO string', async () => {
      const date = new Date('2024-12-21T10:30:00.000Z');
      mockInvoke.mockResolvedValue({ note: {}, isNew: false });
      await capturedApi.daily.getOrCreate(date);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.DAILY_GET_OR_CREATE, {
        date: '2024-12-21T10:30:00.000Z',
      });
    });

    it('find invokes correct channel with date string', async () => {
      mockInvoke.mockResolvedValue({ note: null });
      await capturedApi.daily.find('2024-12-21');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.DAILY_FIND, { date: '2024-12-21' });
    });
  });

  describe('Meeting API', () => {
    it('create invokes correct channel with title', async () => {
      mockInvoke.mockResolvedValue({ id: 'meeting-id' });
      await capturedApi.meeting.create('Team Standup');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.MEETING_CREATE, {
        title: 'Team Standup',
        date: undefined,
      });
    });

    it('create invokes correct channel with title and date', async () => {
      mockInvoke.mockResolvedValue({ id: 'meeting-id' });
      await capturedApi.meeting.create('Team Standup', '2024-12-21');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.MEETING_CREATE, {
        title: 'Team Standup',
        date: '2024-12-21',
      });
    });

    it('addAttendee invokes correct channel', async () => {
      const noteId = 'meeting-id' as import('@scribe/shared').NoteId;
      const personId = 'person-id' as import('@scribe/shared').NoteId;
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.meeting.addAttendee(noteId, personId);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.MEETING_ADD_ATTENDEE, {
        noteId,
        personId,
      });
    });

    it('removeAttendee invokes correct channel', async () => {
      const noteId = 'meeting-id' as import('@scribe/shared').NoteId;
      const personId = 'person-id' as import('@scribe/shared').NoteId;
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.meeting.removeAttendee(noteId, personId);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.MEETING_REMOVE_ATTENDEE, {
        noteId,
        personId,
      });
    });
  });

  describe('Dictionary API', () => {
    it('addWord invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.dictionary.addWord('customword');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.DICTIONARY_ADD_WORD, 'customword');
    });

    it('removeWord invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.dictionary.removeWord('customword');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.DICTIONARY_REMOVE_WORD, 'customword');
    });

    it('getLanguages invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(['en-US']);
      await capturedApi.dictionary.getLanguages();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.DICTIONARY_GET_LANGUAGES);
    });

    it('setLanguages invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.dictionary.setLanguages(['en-US', 'es']);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.DICTIONARY_SET_LANGUAGES, [
        'en-US',
        'es',
      ]);
    });

    it('getAvailableLanguages invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(['en-US', 'es', 'fr']);
      await capturedApi.dictionary.getAvailableLanguages();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.DICTIONARY_GET_AVAILABLE_LANGUAGES);
    });
  });

  describe('Tasks API', () => {
    it('list invokes correct channel without filter', async () => {
      mockInvoke.mockResolvedValue([]);
      await capturedApi.tasks.list();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.TASKS_LIST, undefined);
    });

    it('list invokes correct channel with filter', async () => {
      const filter = { completed: false } as import('@scribe/shared').TaskFilter;
      mockInvoke.mockResolvedValue([]);
      await capturedApi.tasks.list(filter);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.TASKS_LIST, filter);
    });

    it('toggle invokes correct channel with taskId', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.tasks.toggle('task-123');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.TASKS_TOGGLE, { taskId: 'task-123' });
    });

    it('reorder invokes correct channel with taskIds', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.tasks.reorder(['task-1', 'task-2', 'task-3']);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.TASKS_REORDER, {
        taskIds: ['task-1', 'task-2', 'task-3'],
      });
    });

    it('get invokes correct channel with taskId', async () => {
      mockInvoke.mockResolvedValue({ id: 'task-123' });
      await capturedApi.tasks.get('task-123');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.TASKS_GET, { taskId: 'task-123' });
    });

    it('onChange registers event listener and returns cleanup function', () => {
      const callback = vi.fn();
      const cleanup = capturedApi.tasks.onChange(callback);

      expect(mockOn).toHaveBeenCalledWith(IPC_CHANNELS.TASKS_CHANGED, expect.any(Function));
      expect(typeof cleanup).toBe('function');

      // Call cleanup
      cleanup();
      expect(mockRemoveListener).toHaveBeenCalledWith(
        IPC_CHANNELS.TASKS_CHANGED,
        expect.any(Function)
      );
    });

    it('onChange callback receives events', () => {
      const callback = vi.fn();
      capturedApi.tasks.onChange(callback);

      // Get the handler that was registered
      const handler = mockOn.mock.calls.find((call) => call[0] === IPC_CHANNELS.TASKS_CHANGED)?.[1];
      expect(handler).toBeDefined();

      // Simulate event
      const events = [{ type: 'toggle', taskId: 'task-1' }];
      handler({} as Electron.IpcRendererEvent, events);

      expect(callback).toHaveBeenCalledWith(events);
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
