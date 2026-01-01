/**
 * Raycast Extension IPC Handlers
 *
 * This module provides IPC handlers for managing the Scribe Raycast extension:
 * - Installing the extension (copy source, npm install, open Raycast import)
 * - Checking installation status
 * - Opening the Raycast import flow
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `raycast:install` | none | `RaycastInstallResult` | Full installation flow |
 * | `raycast:getStatus` | none | `RaycastStatus` | Gets detailed installation status |
 * | `raycast:openInRaycast` | none | `RaycastInstallResult` | Opens Raycast import URL |
 *
 * @module handlers/raycastHandlers
 */

import { ipcMain } from 'electron';
import { installRaycastExtension, getRaycastStatus, openRaycastImport } from '../raycast-installer';
import type { HandlerDependencies } from './types';

/**
 * Setup IPC handlers for Raycast extension operations.
 *
 * @param _deps - Handler dependencies (not used by Raycast handlers)
 */
export function setupRaycastHandlers(_deps: HandlerDependencies): void {
  /**
   * IPC: `raycast:install`
   *
   * Installs the Raycast extension by copying the bundled source,
   * running npm install, and opening the Raycast import flow.
   *
   * @returns `RaycastInstallResult` with success status and message
   */
  ipcMain.handle('raycast:install', async () => {
    return await installRaycastExtension();
  });

  /**
   * IPC: `raycast:getStatus`
   *
   * Gets detailed status of the Raycast extension installation including:
   * - Whether Raycast is installed
   * - Whether CLI is installed
   * - Whether extension source is bundled
   * - Whether extension is installed
   * - Whether dependencies are installed
   *
   * @returns `RaycastStatus` object with installation details
   */
  ipcMain.handle('raycast:getStatus', async () => {
    return getRaycastStatus();
  });

  /**
   * IPC: `raycast:openInRaycast`
   *
   * Opens the Raycast import URL to trigger the import flow.
   * Used to re-open Raycast after installation or to update.
   *
   * @returns `RaycastInstallResult` with success status
   */
  ipcMain.handle('raycast:openInRaycast', async () => {
    return await openRaycastImport();
  });
}
