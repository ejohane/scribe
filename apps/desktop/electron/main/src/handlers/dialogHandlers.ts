/**
 * Dialog IPC Handlers
 *
 * This module provides IPC handlers for native OS dialogs.
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `dialog:selectFolder` | `{ title?: string, defaultPath?: string }` | `string \| null` | Opens folder picker |
 *
 * ## Platform Behavior
 *
 * - macOS: Native NSOpenPanel
 * - Windows: Native folder browser
 * - Linux: GTK file chooser (if available)
 *
 * @module handlers/dialogHandlers
 */

import { ipcMain, dialog } from 'electron';
import { IPC_CHANNELS, type FolderPickerOptions } from '@scribe/shared';

/**
 * Setup IPC handlers for native OS dialogs.
 */
export function setupDialogHandlers(): void {
  /**
   * IPC: `dialog:selectFolder`
   *
   * Opens the native OS folder picker dialog.
   *
   * @param options - Optional configuration for the dialog
   * @returns The selected folder path, or null if cancelled
   */
  ipcMain.handle(
    IPC_CHANNELS.DIALOG_SELECT_FOLDER,
    async (_event, options?: FolderPickerOptions) => {
      const result = await dialog.showOpenDialog({
        title: options?.title ?? 'Select Folder',
        defaultPath: options?.defaultPath,
        properties: ['openDirectory', 'createDirectory'],
      });

      if (result.canceled || result.filePaths.length === 0) {
        return null;
      }

      return result.filePaths[0];
    }
  );
}
