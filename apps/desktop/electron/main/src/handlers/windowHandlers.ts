/**
 * Window Management IPC Handlers
 *
 * This module provides IPC handlers for multi-window management:
 * - Creating new windows (empty or with specific note)
 * - Getting current window ID
 * - Closing and focusing windows
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `window:new` | none | `{ windowId: number }` | Creates a new empty window |
 * | `window:openNote` | `noteId: string` | `{ windowId: number }` | Opens a note in a new window |
 * | `window:getId` | none | `number \| null` | Gets the current window's ID |
 * | `window:close` | none | `{ success: true }` | Closes the current window |
 * | `window:focus` | none | `{ success: true }` | Focuses the current window |
 *
 * ## Error Conditions
 *
 * - All handlers throw if WindowManager is not initialized
 *
 * @module handlers/windowHandlers
 */

import { ipcMain, BrowserWindow } from 'electron';
import { IPC_CHANNELS } from '@scribe/shared';
import type { HandlerDependencies } from './types';
import { requireWindowManager } from './types';

/**
 * Setup IPC handlers for window management operations.
 *
 * @param deps - Handler dependencies (requires windowManager)
 *
 * @example
 * ```typescript
 * // From main process
 * setupWindowHandlers(deps);
 *
 * // From renderer
 * const { windowId } = await window.api.invoke('window:new');
 * ```
 */
export function setupWindowHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `window:new`
   *
   * Creates a new empty window.
   *
   * @returns `{ windowId: number }` - The ID of the newly created window
   * @throws Error if WindowManager is not initialized
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_NEW, () => {
    const windowManager = requireWindowManager(deps);
    const win = windowManager.createWindow();
    return { windowId: win.id };
  });

  /**
   * IPC: `window:openNote`
   *
   * Opens a specific note in a new window.
   *
   * @param noteId - The ID of the note to open
   * @returns `{ windowId: number }` - The ID of the newly created window
   * @throws Error if WindowManager is not initialized
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_OPEN_NOTE, (_, noteId: string) => {
    const windowManager = requireWindowManager(deps);
    const win = windowManager.createWindow({ noteId });
    return { windowId: win.id };
  });

  /**
   * IPC: `window:getId`
   *
   * Gets the ID of the window that sent this IPC message.
   *
   * @returns `number | null` - The window ID, or null if window not found
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_GET_ID, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    return win?.id ?? null;
  });

  /**
   * IPC: `window:close`
   *
   * Closes the window that sent this IPC message.
   *
   * @returns `{ success: true }`
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_CLOSE, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      win.close();
    }
    return { success: true };
  });

  /**
   * IPC: `window:focus`
   *
   * Focuses the window that sent this IPC message.
   * If the window is minimized, it will be restored first.
   *
   * @returns `{ success: true }`
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_FOCUS, (event) => {
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    }
    return { success: true };
  });

  /**
   * IPC: `window:reportCurrentNote`
   *
   * Reports the current note ID being viewed in the window.
   * Used for smart deep link routing to find windows with specific notes.
   *
   * @param noteId - The note ID being viewed (null if no note)
   * @returns `{ success: true }`
   */
  ipcMain.handle(IPC_CHANNELS.WINDOW_REPORT_CURRENT_NOTE, (event, noteId: string | null) => {
    const windowManager = requireWindowManager(deps);
    const win = BrowserWindow.fromWebContents(event.sender);
    if (win && !win.isDestroyed()) {
      windowManager.setWindowNote(win.id, noteId);
    }
    return { success: true };
  });
}
