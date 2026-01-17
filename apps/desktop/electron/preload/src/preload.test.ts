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
 * 3. Verify argument transformations
 * 4. Verify event listener setup/cleanup
 *
 * Note: Notes, search, graph, export, CLI, sync, and raycast operations
 * are now handled by the daemon via tRPC and are not part of this API.
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

    it('has all expected namespaces (Electron-only)', () => {
      expect(capturedApi).toHaveProperty('ping');
      expect(capturedApi).toHaveProperty('shell');
      expect(capturedApi).toHaveProperty('app');
      expect(capturedApi).toHaveProperty('update');
      expect(capturedApi).toHaveProperty('dialog');
      expect(capturedApi).toHaveProperty('vault');
      expect(capturedApi).toHaveProperty('deepLink');
      expect(capturedApi).toHaveProperty('assets');
      expect(capturedApi).toHaveProperty('window');
      expect(capturedApi).toHaveProperty('scribe');
    });

    it('does not expose daemon-handled namespaces', () => {
      // These are now handled by the daemon via tRPC
      expect(capturedApi).not.toHaveProperty('notes');
      expect(capturedApi).not.toHaveProperty('search');
      expect(capturedApi).not.toHaveProperty('graph');
      expect(capturedApi).not.toHaveProperty('export');
      expect(capturedApi).not.toHaveProperty('cli');
      expect(capturedApi).not.toHaveProperty('sync');
      expect(capturedApi).not.toHaveProperty('raycast');
      expect(capturedApi).not.toHaveProperty('recentOpens');
    });
  });

  describe('Core API', () => {
    it('ping invokes correct channel', async () => {
      mockInvoke.mockResolvedValue('pong');
      await capturedApi.ping();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.PING);
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

    it('showItemInFolder invokes correct channel with path', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.shell.showItemInFolder('/path/to/file');
      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.SHELL_SHOW_ITEM_IN_FOLDER,
        '/path/to/file'
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
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.app.setLastOpenedNote('test-note-id');
      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.APP_SET_LAST_OPENED_NOTE,
        'test-note-id'
      );
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

    it('relaunch invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.app.relaunch();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.APP_RELAUNCH);
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

  describe('Dialog API', () => {
    it('selectFolder invokes correct channel', async () => {
      mockInvoke.mockResolvedValue('/selected/path');
      await capturedApi.dialog.selectFolder();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.DIALOG_SELECT_FOLDER, undefined);
    });

    it('selectFolder invokes with options', async () => {
      mockInvoke.mockResolvedValue('/selected/path');
      await capturedApi.dialog.selectFolder({ title: 'Select', defaultPath: '/home' });
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.DIALOG_SELECT_FOLDER, {
        title: 'Select',
        defaultPath: '/home',
      });
    });
  });

  describe('Vault API', () => {
    it('getPath invokes correct channel', async () => {
      mockInvoke.mockResolvedValue('/vault/path');
      await capturedApi.vault.getPath();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.VAULT_GET_PATH);
    });

    it('setPath invokes correct channel with path', async () => {
      mockInvoke.mockResolvedValue({ success: true, path: '/new/path' });
      await capturedApi.vault.setPath('/new/path');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.VAULT_SET_PATH, '/new/path');
    });

    it('create invokes correct channel with path', async () => {
      mockInvoke.mockResolvedValue({ success: true, path: '/new/vault' });
      await capturedApi.vault.create('/new/vault');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.VAULT_CREATE, '/new/vault');
    });

    it('validate invokes correct channel with path', async () => {
      mockInvoke.mockResolvedValue({ valid: true });
      await capturedApi.vault.validate('/vault/path');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.VAULT_VALIDATE, '/vault/path');
    });
  });

  describe('DeepLink API', () => {
    it('onDeepLink registers listener and returns cleanup', () => {
      const callback = vi.fn();
      const cleanup = capturedApi.deepLink.onDeepLink(callback);

      expect(mockOn).toHaveBeenCalledWith(IPC_CHANNELS.DEEP_LINK_RECEIVED, expect.any(Function));
      expect(typeof cleanup).toBe('function');

      cleanup();
      expect(mockRemoveListener).toHaveBeenCalled();
    });

    it('onDeepLink callback receives parsed action', () => {
      const callback = vi.fn();
      capturedApi.deepLink.onDeepLink(callback);

      const handler = mockOn.mock.calls.find(
        (call) => call[0] === IPC_CHANNELS.DEEP_LINK_RECEIVED
      )?.[1];
      expect(handler).toBeDefined();

      const action = { type: 'note' as const, noteId: 'test-id' };
      handler({} as Electron.IpcRendererEvent, action);
      expect(callback).toHaveBeenCalledWith(action);
    });
  });

  describe('Assets API', () => {
    it('save invokes correct channel with data', async () => {
      const data = new ArrayBuffer(8);
      mockInvoke.mockResolvedValue({ success: true, assetId: 'uuid' });
      await capturedApi.assets.save(data, 'image/png', 'test.png');
      expect(mockInvoke).toHaveBeenCalledWith(
        IPC_CHANNELS.ASSETS_SAVE,
        data,
        'image/png',
        'test.png'
      );
    });

    it('load invokes correct channel with assetId', async () => {
      mockInvoke.mockResolvedValue(new ArrayBuffer(8));
      await capturedApi.assets.load('asset-id');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.ASSETS_LOAD, 'asset-id');
    });

    it('delete invokes correct channel with assetId', async () => {
      mockInvoke.mockResolvedValue(true);
      await capturedApi.assets.delete('asset-id');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.ASSETS_DELETE, 'asset-id');
    });

    it('getPath invokes correct channel with assetId', async () => {
      mockInvoke.mockResolvedValue('/path/to/asset');
      await capturedApi.assets.getPath('asset-id');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.ASSETS_GET_PATH, 'asset-id');
    });
  });

  describe('Window API', () => {
    it('new invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.window.new();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW_NEW);
    });

    it('openNote invokes correct channel with noteId', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.window.openNote('note-id');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW_OPEN_NOTE, 'note-id');
    });

    it('getId invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(1);
      await capturedApi.window.getId();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW_GET_ID);
    });

    it('close invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.window.close();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW_CLOSE);
    });

    it('focus invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(undefined);
      await capturedApi.window.focus();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW_FOCUS);
    });

    it('reportCurrentNote invokes correct channel with noteId', async () => {
      mockInvoke.mockResolvedValue({ success: true });
      await capturedApi.window.reportCurrentNote('note-id');
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW_REPORT_CURRENT_NOTE, 'note-id');
    });

    it('reportCurrentNote handles null', async () => {
      mockInvoke.mockResolvedValue({ success: true });
      await capturedApi.window.reportCurrentNote(null);
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.WINDOW_REPORT_CURRENT_NOTE, null);
    });
  });

  describe('Scribe Daemon API', () => {
    it('getDaemonPort invokes correct channel', async () => {
      mockInvoke.mockResolvedValue(4455);
      const port = await capturedApi.scribe.getDaemonPort();
      expect(mockInvoke).toHaveBeenCalledWith(IPC_CHANNELS.SCRIBE_GET_DAEMON_PORT);
      expect(port).toBe(4455);
    });
  });
});
