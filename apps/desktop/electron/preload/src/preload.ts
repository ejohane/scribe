import { contextBridge, ipcRenderer } from 'electron';
import type { Note, NoteId, TaskFilter, TaskChangeEvent } from '@scribe/shared';
import { IPC_CHANNELS, type ScribeAPI } from '@scribe/shared';

/**
 * Scribe API implementation exposed to the renderer process.
 *
 * This implementation uses the shared IPC contract from @scribe/shared
 * as the single source of truth for the API surface. All types and
 * documentation are defined in packages/shared/src/ipc-contract.ts.
 */
const scribeAPI: ScribeAPI = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.PING),

  notes: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.NOTES_LIST),
    read: (id: NoteId) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_READ, id),
    create: () => ipcRenderer.invoke(IPC_CHANNELS.NOTES_CREATE),
    save: (note: Note) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_SAVE, note),
    delete: (id: NoteId) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_DELETE, id),
    findByTitle: (title: string) => ipcRenderer.invoke(IPC_CHANNELS.NOTES_FIND_BY_TITLE, title),
    searchTitles: (query: string, limit?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTES_SEARCH_TITLES, query, limit ?? 10),
    findByDate: (date: string, includeCreated: boolean, includeUpdated: boolean) =>
      ipcRenderer.invoke(IPC_CHANNELS.NOTES_FIND_BY_DATE, { date, includeCreated, includeUpdated }),
  },

  search: {
    query: (text: string) => ipcRenderer.invoke(IPC_CHANNELS.SEARCH_QUERY, text),
  },

  graph: {
    forNote: (id: NoteId) => ipcRenderer.invoke(IPC_CHANNELS.GRAPH_FOR_NOTE, id),
    backlinks: (id: NoteId) => ipcRenderer.invoke(IPC_CHANNELS.GRAPH_BACKLINKS, id),
    notesWithTag: (tag: string) => ipcRenderer.invoke(IPC_CHANNELS.GRAPH_NOTES_WITH_TAG, tag),
  },

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),
  },

  app: {
    openDevTools: () => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_DEV_TOOLS),
    getLastOpenedNote: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_LAST_OPENED_NOTE),
    setLastOpenedNote: (noteId: NoteId | null) =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_SET_LAST_OPENED_NOTE, noteId),
    getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_CONFIG),
    setConfig: (config: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_SET_CONFIG, config),
  },

  people: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.PEOPLE_LIST),
    create: (name: string) => ipcRenderer.invoke(IPC_CHANNELS.PEOPLE_CREATE, name),
    search: (query: string, limit?: number) =>
      ipcRenderer.invoke(IPC_CHANNELS.PEOPLE_SEARCH, query, limit ?? 10),
  },

  daily: {
    getOrCreate: (date?: Date) =>
      ipcRenderer.invoke(
        IPC_CHANNELS.DAILY_GET_OR_CREATE,
        date ? { date: date.toISOString() } : undefined
      ),
    find: (date: string) => ipcRenderer.invoke(IPC_CHANNELS.DAILY_FIND, { date }),
  },

  meeting: {
    create: (title: string, date?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.MEETING_CREATE, { title, date }),
    addAttendee: (noteId: NoteId, personId: NoteId) =>
      ipcRenderer.invoke(IPC_CHANNELS.MEETING_ADD_ATTENDEE, { noteId, personId }),
    removeAttendee: (noteId: NoteId, personId: NoteId) =>
      ipcRenderer.invoke(IPC_CHANNELS.MEETING_REMOVE_ATTENDEE, { noteId, personId }),
  },

  dictionary: {
    addWord: (word: string) => ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_ADD_WORD, word),
    removeWord: (word: string) => ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_REMOVE_WORD, word),
    getLanguages: () => ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_GET_LANGUAGES),
    setLanguages: (languages: string[]) =>
      ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_SET_LANGUAGES, languages),
    getAvailableLanguages: () =>
      ipcRenderer.invoke(IPC_CHANNELS.DICTIONARY_GET_AVAILABLE_LANGUAGES),
  },

  tasks: {
    list: (filter?: TaskFilter) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_LIST, filter),
    toggle: (taskId: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_TOGGLE, { taskId }),
    reorder: (taskIds: string[]) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_REORDER, { taskIds }),
    get: (taskId: string) => ipcRenderer.invoke(IPC_CHANNELS.TASKS_GET, { taskId }),
    onChange: (callback: (events: TaskChangeEvent[]) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, events: TaskChangeEvent[]) =>
        callback(events);
      ipcRenderer.on(IPC_CHANNELS.TASKS_CHANGED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.TASKS_CHANGED, handler);
    },
  },

  update: {
    check: () => ipcRenderer.invoke(IPC_CHANNELS.UPDATE_CHECK),
    install: () => ipcRenderer.send(IPC_CHANNELS.UPDATE_INSTALL),
    onChecking: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC_CHANNELS.UPDATE_CHECKING, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_CHECKING, handler);
    },
    onAvailable: (callback: (info: { version: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: { version: string }) =>
        callback(info);
      ipcRenderer.on(IPC_CHANNELS.UPDATE_AVAILABLE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_AVAILABLE, handler);
    },
    onNotAvailable: (callback: () => void) => {
      const handler = () => callback();
      ipcRenderer.on(IPC_CHANNELS.UPDATE_NOT_AVAILABLE, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_NOT_AVAILABLE, handler);
    },
    onDownloaded: (callback: (info: { version: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, info: { version: string }) =>
        callback(info);
      ipcRenderer.on(IPC_CHANNELS.UPDATE_DOWNLOADED, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_DOWNLOADED, handler);
    },
    onError: (callback: (error: { message: string }) => void) => {
      const handler = (_event: Electron.IpcRendererEvent, error: { message: string }) =>
        callback(error);
      ipcRenderer.on(IPC_CHANNELS.UPDATE_ERROR, handler);
      return () => ipcRenderer.removeListener(IPC_CHANNELS.UPDATE_ERROR, handler);
    },
  },

  cli: {
    install: () => ipcRenderer.invoke(IPC_CHANNELS.CLI_INSTALL),
    isInstalled: () => ipcRenderer.invoke(IPC_CHANNELS.CLI_IS_INSTALLED),
    uninstall: () => ipcRenderer.invoke(IPC_CHANNELS.CLI_UNINSTALL),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.CLI_GET_STATUS),
  },

  export: {
    toMarkdown: (noteId: NoteId) => ipcRenderer.invoke(IPC_CHANNELS.EXPORT_TO_MARKDOWN, noteId),
  },
};

// Expose the API to the renderer via contextBridge
contextBridge.exposeInMainWorld('scribe', scribeAPI);

// Re-export the type for use in renderer-side type augmentation
export type { ScribeAPI };
