/**
 * CLI Installation IPC Handlers
 *
 * This module provides IPC handlers for managing the Scribe CLI:
 * - Installing the CLI (creating symlink to ~/.local/bin/scribe)
 * - Checking installation status
 * - Uninstalling the CLI (removing symlink)
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `cli:install` | none | `CLIInstallResult` | Installs CLI by creating symlink |
 * | `cli:is-installed` | none | `boolean` | Checks if CLI is installed |
 * | `cli:uninstall` | none | `CLIInstallResult` | Uninstalls CLI by removing symlink |
 * | `cli:get-status` | none | `CLIStatus` | Gets detailed installation status |
 *
 * ## Error Handling
 *
 * All handlers return result objects with success/error information.
 * No exceptions are thrown to the renderer process.
 *
 * @module handlers/cliHandlers
 */

import { ipcMain } from 'electron';
import { installCLI, uninstallCLI, isCLIInstalled, getCLIStatus } from '../cli-installer';
import type { HandlerDependencies } from './types';

/**
 * Setup IPC handlers for CLI installation operations.
 *
 * @param _deps - Handler dependencies (not used by CLI handlers)
 *
 * @example
 * ```typescript
 * // From main process
 * setupCLIHandlers({ mainWindow: null, vault: null, ... });
 *
 * // From renderer
 * const result = await window.scribe.cli.install();
 * // { success: true, message: 'CLI installed...', needsPathSetup: true }
 * ```
 */
export function setupCLIHandlers(_deps: HandlerDependencies): void {
  /**
   * IPC: `cli:install`
   *
   * Installs the Scribe CLI by creating a symlink from the app bundle
   * to ~/.local/bin/scribe.
   *
   * @returns `CLIInstallResult` with success status and message
   */
  ipcMain.handle('cli:install', async () => {
    return await installCLI();
  });

  /**
   * IPC: `cli:is-installed`
   *
   * Checks if the CLI is currently installed.
   *
   * @returns `boolean` - true if CLI is installed
   */
  ipcMain.handle('cli:is-installed', async () => {
    return isCLIInstalled();
  });

  /**
   * IPC: `cli:uninstall`
   *
   * Uninstalls the CLI by removing the symlink at ~/.local/bin/scribe.
   * Only removes if the symlink points to this app's binary (safety check).
   *
   * @returns `CLIInstallResult` with success status and message
   */
  ipcMain.handle('cli:uninstall', async () => {
    return await uninstallCLI();
  });

  /**
   * IPC: `cli:get-status`
   *
   * Gets detailed status of the CLI installation including:
   * - Whether CLI is installed
   * - Whether it's linked to this app's binary
   * - Whether the binary exists in the app bundle
   * - Whether ~/.local/bin is in PATH
   *
   * @returns `CLIStatus` object with installation details
   */
  ipcMain.handle('cli:get-status', async () => {
    return getCLIStatus();
  });
}
