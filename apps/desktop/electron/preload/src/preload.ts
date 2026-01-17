import { contextBridge, ipcRenderer } from 'electron';
import type { DeepLinkAction } from '@scribe/shared';
import { IPC_CHANNELS, type ScribeAPI, type WindowAPI } from '@scribe/shared';

// Re-import for the event handler type annotation
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
 *
 * Note: Notes, search, graph, and export operations are now handled by
 * the daemon via tRPC and are not part of this API surface.
 */
const scribeAPI: ScribeAPI = {
  ping: () => ipcRenderer.invoke(IPC_CHANNELS.PING),

  shell: {
    openExternal: (url: string) => ipcRenderer.invoke(IPC_CHANNELS.SHELL_OPEN_EXTERNAL, url),
    showItemInFolder: (path: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.SHELL_SHOW_ITEM_IN_FOLDER, path),
  },

  app: {
    openDevTools: () => ipcRenderer.invoke(IPC_CHANNELS.APP_OPEN_DEV_TOOLS),
    getLastOpenedNote: () => ipcRenderer.invoke(IPC_CHANNELS.APP_GET_LAST_OPENED_NOTE),
    setLastOpenedNote: (noteId: string | null) =>
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

  assets: {
    save: (data: ArrayBuffer, mimeType: string, filename?: string) =>
      ipcRenderer.invoke(IPC_CHANNELS.ASSETS_SAVE, data, mimeType, filename),
    load: (assetId: string) => ipcRenderer.invoke(IPC_CHANNELS.ASSETS_LOAD, assetId),
    delete: (assetId: string) => ipcRenderer.invoke(IPC_CHANNELS.ASSETS_DELETE, assetId),
    getPath: (assetId: string) => ipcRenderer.invoke(IPC_CHANNELS.ASSETS_GET_PATH, assetId),
  },

  window: windowAPI,

  scribe: {
    getDaemonPort: () => ipcRenderer.invoke(IPC_CHANNELS.SCRIBE_GET_DAEMON_PORT),
  },
};

// Expose the API to the renderer via contextBridge
contextBridge.exposeInMainWorld('scribe', scribeAPI);

// Re-export the type for use in renderer-side type augmentation
export type { ScribeAPI };
