/**
 * App Configuration and Shell IPC Handlers
 *
 * This module provides IPC handlers for:
 * - Application configuration (theme, last opened note)
 * - Developer tools
 * - External URL handling
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `ping` | none | `{ message: 'pong', timestamp: number }` | Health check endpoint |
 * | `app:openDevTools` | none | `{ success: true }` | Opens Chrome DevTools |
 * | `app:getLastOpenedNote` | none | `NoteId \| null` | Gets last opened note ID |
 * | `app:setLastOpenedNote` | `noteId: NoteId \| null` | `{ success: true }` | Sets last opened note ID |
 * | `app:getConfig` | none | `AppConfig` | Gets full app configuration |
 * | `app:setConfig` | `Partial<AppConfig>` | `{ success: true }` | Merges partial config with existing |
 * | `shell:openExternal` | `url: string` | `{ success: true }` | Opens URL in default browser |
 *
 * ## Error Conditions
 *
 * - `shell:openExternal` throws if URL doesn't start with `http://` or `https://`
 * - `app:openDevTools` throws if main window is not available
 *
 * ## Configuration Storage
 *
 * Configuration is stored in `~/Scribe/config.json` as JSON.
 * The config file is created automatically on first write.
 *
 * @module handlers/appHandlers
 */

import { ipcMain, shell, app } from 'electron';
import * as fs from 'node:fs/promises';
import path from 'path';
import { homedir } from 'node:os';
import type { NoteId } from '@scribe/shared';
import { HandlerDependencies, AppConfig, requireWindowManager } from './types';
import { configLogger } from '../logger';

const CONFIG_DIR = path.join(homedir(), 'Scribe');
const CONFIG_PATH = path.join(CONFIG_DIR, 'config.json');

/**
 * Load app configuration from disk.
 *
 * @returns The loaded configuration, or empty object if file doesn't exist or is invalid
 *
 * @remarks
 * Returns empty config if file doesn't exist (ENOENT).
 * Logs warnings for other errors (JSON parse, permissions) but still returns empty config
 * to allow the app to continue operating.
 */
async function loadConfig(): Promise<AppConfig> {
  try {
    const data = await fs.readFile(CONFIG_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (error: unknown) {
    // Handle different error types appropriately
    if (error instanceof SyntaxError) {
      // JSON parse error - config file is corrupt
      configLogger.warn(`Failed to parse config file at ${CONFIG_PATH}: ${error.message}`);
      return {};
    }

    // Check for Node.js filesystem errors
    if (error && typeof error === 'object' && 'code' in error) {
      const fsError = error as NodeJS.ErrnoException;

      if (fsError.code === 'ENOENT') {
        // File doesn't exist yet - this is normal on first run
        return {};
      }

      if (fsError.code === 'EACCES' || fsError.code === 'EPERM') {
        // Permission denied
        configLogger.warn(`Permission denied reading config file at ${CONFIG_PATH}`);
        return {};
      }

      // Other filesystem errors (EISDIR, EMFILE, etc.)
      configLogger.warn(`Failed to read config file at ${CONFIG_PATH}: ${fsError.code}`);
      return {};
    }

    // Unknown error type
    configLogger.warn(`Unexpected error loading config: ${error}`);
    return {};
  }
}

/**
 * Save app configuration to disk.
 *
 * Creates the config directory if it doesn't exist.
 * Writes config as formatted JSON (2-space indent).
 *
 * @param config - The configuration object to save
 *
 * @remarks
 * Errors are logged but not thrown, allowing the app to continue
 * operating even if config persistence fails.
 */
async function saveConfig(config: AppConfig): Promise<void> {
  try {
    await fs.mkdir(CONFIG_DIR, { recursive: true });
    await fs.writeFile(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
  } catch (error) {
    configLogger.error('Failed to save config', { error });
  }
}

/**
 * Setup IPC handlers for app configuration and shell operations.
 *
 * @param deps - Handler dependencies (requires mainWindow for some operations)
 *
 * @example
 * ```typescript
 * // From main process
 * setupAppHandlers({ mainWindow, vault: null, ... });
 *
 * // From renderer
 * const result = await window.api.invoke('ping');
 * // { message: 'pong', timestamp: 1699999999999 }
 * ```
 */
export function setupAppHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `ping`
   *
   * Health check endpoint to verify IPC communication is working.
   *
   * @returns `{ message: 'pong', timestamp: number }` - Current timestamp in milliseconds
   */
  ipcMain.handle('ping', async () => {
    return { message: 'pong', timestamp: Date.now() };
  });

  /**
   * IPC: `app:openDevTools`
   *
   * Opens Chrome DevTools for the main window.
   *
   * @returns `{ success: true }`
   * @throws Error if main window is not available
   */
  ipcMain.handle('app:openDevTools', async () => {
    const windowManager = requireWindowManager(deps);
    const focusedWindow = windowManager.getFocusedWindow();
    if (focusedWindow) {
      focusedWindow.webContents.openDevTools();
    }
    return { success: true };
  });

  /**
   * IPC: `app:getLastOpenedNote`
   *
   * Retrieves the ID of the last opened note for session restoration.
   *
   * @returns `NoteId | null` - The last opened note ID, or null if none
   */
  ipcMain.handle('app:getLastOpenedNote', async () => {
    const config = await loadConfig();
    return config.lastOpenedNoteId || null;
  });

  /**
   * IPC: `app:setLastOpenedNote`
   *
   * Persists the ID of the currently opened note for session restoration.
   *
   * @param noteId - The note ID to save, or null to clear
   * @returns `{ success: true }`
   */
  ipcMain.handle('app:setLastOpenedNote', async (_event, noteId: NoteId | null) => {
    const config = await loadConfig();
    config.lastOpenedNoteId = noteId || undefined;
    await saveConfig(config);
    return { success: true };
  });

  /**
   * IPC: `app:getConfig`
   *
   * Retrieves the full application configuration.
   *
   * @returns `AppConfig` - The current configuration object
   */
  ipcMain.handle('app:getConfig', async () => {
    return await loadConfig();
  });

  /**
   * IPC: `app:setConfig`
   *
   * Updates application configuration by merging with existing values.
   * Only provided fields are updated; others are preserved.
   *
   * @param partialConfig - Partial configuration to merge
   * @returns `{ success: true }`
   */
  ipcMain.handle('app:setConfig', async (_event, partialConfig: Partial<AppConfig>) => {
    const config = await loadConfig();
    const updatedConfig = { ...config, ...partialConfig };
    await saveConfig(updatedConfig);
    return { success: true };
  });

  /**
   * IPC: `shell:openExternal`
   *
   * Opens a URL in the user's default browser.
   * Only HTTP and HTTPS URLs are allowed for security.
   *
   * @param url - The URL to open (must start with http:// or https://)
   * @returns `{ success: true }`
   * @throws Error if URL doesn't start with http:// or https://
   *
   * @security
   * URL validation prevents arbitrary command execution via shell.
   * Only web URLs are permitted.
   */
  ipcMain.handle('shell:openExternal', async (_event, url: string) => {
    // Validate URL to prevent arbitrary command execution
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      throw new Error('Only http:// and https:// URLs are allowed');
    }
    await shell.openExternal(url);
    return { success: true };
  });

  /**
   * IPC: `shell:showItemInFolder`
   *
   * Opens the system's file manager with the specified file selected.
   * On macOS, this opens Finder with the file highlighted.
   *
   * @param filePath - The absolute path to the file to reveal
   * @returns `{ success: true }`
   *
   * @security
   * This only reveals existing files; it cannot execute arbitrary commands.
   */
  ipcMain.handle('shell:showItemInFolder', async (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
    return { success: true };
  });

  /**
   * IPC: `app:relaunch`
   *
   * Relaunches the application. Used for vault switching and updates
   * that require a full restart to take effect.
   *
   * @returns void (never resolves - app exits before response)
   */
  ipcMain.handle('app:relaunch', async () => {
    app.relaunch();
    app.exit(0);
  });

  /**
   * IPC: `scribe:getDaemonPort`
   *
   * Returns the port number of the embedded daemon.
   * The renderer uses this to establish tRPC connection.
   *
   * @returns The port number the daemon is listening on
   *
   * @remarks
   * This handler is a placeholder that returns the default daemon port.
   * When the embedded daemon is implemented (scribe-i2zx), this will
   * return the actual dynamically-assigned port.
   */
  ipcMain.handle('scribe:getDaemonPort', async () => {
    // Default daemon port - will be dynamic when embedded daemon is implemented
    // TODO: scribe-i2zx will update this to return the actual daemon port
    return deps.daemonPort ?? 4455;
  });
}

// Re-export loadConfig and saveConfig for use in other modules if needed
export { loadConfig, saveConfig };
