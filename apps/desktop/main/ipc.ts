/**
 * IPC handlers for communication between renderer and main process.
 */

import { ipcMain, BrowserWindow } from 'electron';
import type { CoreEngineManager } from './core-engine-manager.js';

/**
 * Setup IPC handlers.
 */
export function setupIPC(window: BrowserWindow, coreEngine: CoreEngineManager): void {
  // Forward RPC requests from renderer to Core Engine
  ipcMain.handle('rpc-request', async (_event, message) => {
    try {
      const response = await coreEngine.request(message.method, message.params);
      return response;
    } catch (error) {
      console.error('[IPC] RPC request error:', error);
      throw error;
    }
  });

  console.log('[IPC] Handlers registered');
}
