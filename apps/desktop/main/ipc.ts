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
  ipcMain.handle('rpc-request', async (_event, message: any) => {
    try {
      console.log('[IPC] Received RPC request:', message.method);
      const result = await coreEngine.request(message.method, message.params);

      // Return JSON-RPC response format
      return {
        jsonrpc: '2.0',
        result,
        id: message.id,
      };
    } catch (error) {
      console.error('[IPC] RPC request error:', error);

      // Return JSON-RPC error format
      return {
        jsonrpc: '2.0',
        error: {
          code: -32603,
          message: error instanceof Error ? error.message : 'Internal error',
        },
        id: message.id,
      };
    }
  });

  console.log('[IPC] Handlers registered');
}
