import { contextBridge, ipcRenderer } from 'electron';
import type {
  Note,
  NoteId,
  SyncStatus,
  ConflictResolution,
  RecentOpenEntityType,
  DeepLinkAction,
} from '@scribe/shared';
import { IPC_CHANNELS, type ScribeAPI, type WindowAPI } from '@scribe/shared';

// Re-import SyncStatus for the event handler type annotation
type IpcRendererEvent = Electron.IpcRendererEvent;

// Create window API separately to handle the 'new' reserved keyword
const windowAPI: WindowAPI = {
  new: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_NEW),
  openNote: (noteId: string): Promise<void> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_OPEN_NOTE, noteId),
  getId: (): Promise<number> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_GET_ID),
  close: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_CLOSE),
  focus: (): Promise<void> => ipcRenderer.invoke(IPC_CHANNELS.WINDOW_FOCUS),
  reportCurrentNote: (noteId: string | null): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.WINDOW_REPORT_CURRENT_NOTE, noteId),
};

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
    showItemInFolder: (path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SHELL_SHOW_ITEM_IN_FOLDER, path),
  },

  app: {
    openDevTools: () => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_DEV_TOOLS),
    getLastOpenedNote: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_LAST_OPENED_NOTE),
    setLastOpenedNote: (noteId: NoteId | null) =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_SET_LAST_OPENED_NOTE, noteId),
    getConfig: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_CONFIG),
    setConfig: (config: Record<string, unknown>) =>
      ipcRenderer.invoke(IPC_CHANNELS.APP_SET_CONFIG, config),
    relaunch: () => ipcRenderer.invoke(IPC_CHANNELS.APP_RELAUNCH),
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

  dialog: {
    selectFolder: (options?: { title?: string; defaultPath?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.DIALOG_SELECT_FOLDER, options),
  },

  vault: {
    getPath: () => ipcRenderer.invoke(IPC_CHANNELS.VAULT_GET_PATH),
    setPath: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.VAULT_SET_PATH, path),
    create: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.VAULT_CREATE, path),
    validate: (path: string) => ipcRenderer.invoke(IPC_CHANNELS.VAULT_VALIDATE, path),
  },

  sync: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_STATUS),

    trigger: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_TRIGGER),

    getConflicts: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_GET_CONFLICTS),

    resolveConflict: (noteId: string, resolution: ConflictResolution) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_RESOLVE_CONFLICT, noteId, resolution),

    enable: (options: { apiKey: string; serverUrl?: string }) =>
      ipcRenderer.invoke(IPC_CHANNELS.SYNC_ENABLE, options),

    disable: () => ipcRenderer.invoke(IPC_CHANNELS.SYNC_DISABLE),

    onStatusChange: (callback: (status: SyncStatus) => void) => {
      const handler = (_event: IpcRendererEvent, status: SyncStatus) => {
        callback(status);
      };
      ipcRenderer.on(IPC_CHANNELS.SYNC_STATUS_CHANGED, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.SYNC_STATUS_CHANGED, handler);
      };
    },
  },

  recentOpens: {
    recordOpen: (entityId: string, entityType: RecentOpenEntityType) =>
      ipcRenderer.invoke(IPC_CHANNELS.RECENT_OPENS_RECORD, entityId, entityType),

    getRecent: (limit?: number) => ipcRenderer.invoke(IPC_CHANNELS.RECENT_OPENS_GET, limit),

    removeTracking: (entityId: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.RECENT_OPENS_REMOVE, entityId),
  },

  deepLink: {
    onDeepLink: (callback: (action: DeepLinkAction) => void) => {
      const handler = (_event: IpcRendererEvent, action: DeepLinkAction) => {
        callback(action);
      };
      ipcRenderer.on(IPC_CHANNELS.DEEP_LINK_RECEIVED, handler);
      return () => {
        ipcRenderer.removeListener(IPC_CHANNELS.DEEP_LINK_RECEIVED, handler);
      };
    },
  },

  raycast: {
    install: () => ipcRenderer.invoke(IPC_CHANNELS.RAYCAST_INSTALL),
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.RAYCAST_GET_STATUS),
    openInRaycast: () => ipcRenderer.invoke(IPC_CHANNELS.RAYCAST_OPEN_IN_RAYCAST),
  },

  assets: {
    save: (data: ArrayBuffer, mimeType: string, filename?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ASSETS_SAVE, data, mimeType, filename),
    load: (assetId: string) => ipcRenderer.invoke(IPC_CHANNELS.ASSETS_LOAD, assetId),
    delete: (assetId: string) => ipcRenderer.invoke(IPC_CHANNELS.ASSETS_DELETE, assetId),
    getPath: (assetId: string) => ipcRenderer.invoke(IPC_CHANNELS.ASSETS_GET_PATH, assetId),
  },

  window: windowAPI,
};

// Expose the API to the renderer via contextBridge
contextBridge.exposeInMainWorld('scribe', scribeAPI);

// Re-export the type for use in renderer-side type augmentation
export type { ScribeAPI };
