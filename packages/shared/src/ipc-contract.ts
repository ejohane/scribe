/**
 * IPC Contract: Single source of truth for Scribe's Electron IPC surface
 *
 * This module defines all IPC channel names and typed interfaces for communication
 * between the renderer process and main process via the preload bridge.
 *
 * Note: Many operations (notes, search, graph, export) are now handled by the
 * daemon via tRPC. This contract only covers Electron-specific operations that
 * must remain in the main process.
 *
 * Usage:
 * - Preload: Import and implement using `createPreloadBridge()`
 * - Renderer types: Re-export `ScribeAPI` for ambient type declarations
 * - Main process: Reference channel names for handler registration
 *
 * @module @scribe/shared/ipc-contract
 * @since 1.0.0
 */

import type { NoteId } from './types.js';

// ============================================================================
// Deep Link Types
// ============================================================================

/**
 * Types of deep link actions supported by Scribe.
 */
export type DeepLinkAction =
  | { type: 'note'; noteId: string }
  | { type: 'daily'; date?: string } // date is optional, defaults to today
  | { type: 'search'; query: string }
  | { type: 'unknown'; url: string };

/**
 * Result from parsing a deep link URL.
 */
export interface DeepLinkParseResult {
  /** Whether the URL was successfully parsed */
  valid: boolean;
  /** The parsed action, or unknown if invalid */
  action: DeepLinkAction;
  /** The original URL */
  originalUrl: string;
}

// ============================================================================
// IPC Channel Names
// ============================================================================

/**
 * All IPC channel names used by the Scribe application.
 * These are the string identifiers passed to ipcRenderer.invoke/send.
 *
 * Note: Notes, search, graph, and export operations are now handled by the
 * daemon via tRPC and are not part of the IPC surface.
 */
export const IPC_CHANNELS = {
  // Core
  PING: 'ping',

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:openExternal',
  SHELL_SHOW_ITEM_IN_FOLDER: 'shell:showItemInFolder',

  // App
  APP_OPEN_DEV_TOOLS: 'app:openDevTools',
  APP_GET_LAST_OPENED_NOTE: 'app:getLastOpenedNote',
  APP_SET_LAST_OPENED_NOTE: 'app:setLastOpenedNote',
  APP_GET_CONFIG: 'app:getConfig',
  APP_SET_CONFIG: 'app:setConfig',
  APP_RELAUNCH: 'app:relaunch',

  // Update
  UPDATE_CHECK: 'update:check',
  UPDATE_INSTALL: 'update:install',
  UPDATE_CHECKING: 'update:checking',
  UPDATE_AVAILABLE: 'update:available',
  UPDATE_NOT_AVAILABLE: 'update:not-available',
  UPDATE_DOWNLOADED: 'update:downloaded',
  UPDATE_ERROR: 'update:error',

  // Dialog
  DIALOG_SELECT_FOLDER: 'dialog:selectFolder',

  // Vault
  VAULT_GET_PATH: 'vault:getPath',
  VAULT_SET_PATH: 'vault:setPath',
  VAULT_CREATE: 'vault:create',
  VAULT_VALIDATE: 'vault:validate',

  // Deep Links
  DEEP_LINK_RECEIVED: 'deepLink:received',

  // Assets
  ASSETS_SAVE: 'assets:save',
  ASSETS_LOAD: 'assets:load',
  ASSETS_DELETE: 'assets:delete',
  ASSETS_GET_PATH: 'assets:getPath',

  // Window Management
  WINDOW_NEW: 'window:new',
  WINDOW_OPEN_NOTE: 'window:openNote',
  WINDOW_GET_ID: 'window:getId',
  WINDOW_CLOSE: 'window:close',
  WINDOW_FOCUS: 'window:focus',
  WINDOW_REPORT_CURRENT_NOTE: 'window:reportCurrentNote',

  // Daemon Connection
  SCRIBE_GET_DAEMON_PORT: 'scribe:getDaemonPort',
} as const;

// ============================================================================
// API Response Types
// ============================================================================

/** Standard success response for mutating operations */
export interface SuccessResponse {
  success: boolean;
}

/** Update info payload */
export interface UpdateInfo {
  version: string;
}

/** Update error payload */
export interface UpdateError {
  message: string;
}

// ============================================================================
// API Namespace Interfaces
// ============================================================================

/**
 * Shell API for system-level operations
 */
export interface ShellAPI {
  /**
   * Open a URL in the system's default browser.
   * Only http:// and https:// URLs are allowed for security.
   */
  openExternal(url: string): Promise<SuccessResponse>;

  /**
   * Show a file in the system's file manager (Finder on macOS).
   * Opens the containing folder with the file selected.
   *
   * @param path - Absolute path to the file to reveal
   */
  showItemInFolder(path: string): Promise<SuccessResponse>;
}

/**
 * App API for application-level operations
 */
export interface AppAPI {
  /** Open developer tools */
  openDevTools(): Promise<SuccessResponse>;

  /** Get the last opened note ID */
  getLastOpenedNote(): Promise<NoteId | null>;

  /** Set the last opened note ID */
  setLastOpenedNote(noteId: NoteId | null): Promise<SuccessResponse>;

  /** Get app configuration */
  getConfig(): Promise<Record<string, unknown>>;

  /** Set app configuration (merges with existing) */
  setConfig(config: Record<string, unknown>): Promise<SuccessResponse>;

  /** Relaunch the application (for vault switching and updates) */
  relaunch(): Promise<void>;
}

/**
 * Update API for auto-update functionality
 */
export interface UpdateAPI {
  /** Manually trigger update check */
  check(): Promise<void>;

  /** Quit and install downloaded update */
  install(): void;

  /** Subscribe to checking event, returns unsubscribe function */
  onChecking(callback: () => void): () => void;

  /** Subscribe to available event with version info */
  onAvailable(callback: (info: UpdateInfo) => void): () => void;

  /** Subscribe to not-available event */
  onNotAvailable(callback: () => void): () => void;

  /** Subscribe to downloaded event with version info */
  onDownloaded(callback: (info: UpdateInfo) => void): () => void;

  /** Subscribe to error event with error message */
  onError(callback: (error: UpdateError) => void): () => void;
}

/**
 * Options for the folder picker dialog
 */
export interface FolderPickerOptions {
  /** Dialog window title */
  title?: string;
  /** Initial directory to display */
  defaultPath?: string;
}

/**
 * Dialog API for native OS dialogs
 */
export interface DialogAPI {
  /**
   * Open the native OS folder picker dialog.
   *
   * @param options - Optional configuration for the dialog
   * @returns The selected folder path, or null if cancelled
   */
  selectFolder(options?: FolderPickerOptions): Promise<string | null>;
}

/**
 * Result of vault switching operation
 */
export interface VaultSwitchResult {
  success: boolean;
  path: string;
  error?: string;
  /** Whether app restart is required (always true in MVP) */
  requiresRestart?: boolean;
}

/**
 * Result of vault creation operation
 */
export interface VaultCreateResult {
  success: boolean;
  path: string;
  error?: string;
}

/**
 * Result of vault validation
 */
export interface VaultValidationResult {
  valid: boolean;
  missingDirs?: string[];
}

/**
 * Vault API for vault management operations
 */
export interface VaultAPI {
  /**
   * Get the current vault path.
   *
   * @returns The absolute path to the current vault
   */
  getPath(): Promise<string>;

  /**
   * Set the vault path (switch vaults).
   * Note: Requires app restart to take effect.
   *
   * @param path - The new vault path
   * @returns Result of the switch operation
   */
  setPath(path: string): Promise<VaultSwitchResult>;

  /**
   * Create a new vault at the specified path.
   *
   * @param path - Path where to create the vault
   * @returns Result of the creation operation
   */
  create(path: string): Promise<VaultCreateResult>;

  /**
   * Validate if a path is a valid vault.
   *
   * @param path - Path to validate
   * @returns Validation result
   */
  validate(path: string): Promise<VaultValidationResult>;
}

/**
 * Deep Link API for handling scribe:// URLs
 */
export interface DeepLinkAPI {
  /**
   * Subscribe to deep link events.
   * Called when the app receives a scribe:// URL.
   *
   * @param callback - Function called with the parsed deep link action
   * @returns Unsubscribe function for cleanup
   */
  onDeepLink(callback: (action: DeepLinkAction) => void): () => void;
}

// ============================================================================
// Asset Types
// ============================================================================

/**
 * Result of an asset save operation
 */
export interface AssetSaveResult {
  /** Whether the save succeeded */
  success: boolean;
  /** The generated asset ID (UUID) if successful */
  assetId?: string;
  /** The file extension (e.g., "png", "jpg") if successful */
  ext?: string;
  /** Error message if save failed */
  error?: string;
}

/**
 * Assets API for binary asset management (images)
 */
export interface AssetsAPI {
  /**
   * Save a binary asset to the vault.
   * @param data - The binary data to save
   * @param mimeType - MIME type of the asset (e.g., "image/png")
   * @param filename - Optional original filename for extension detection
   * @returns Result containing the generated asset ID and extension
   */
  save(data: ArrayBuffer, mimeType: string, filename?: string): Promise<AssetSaveResult>;

  /**
   * Load a binary asset from the vault.
   * @param assetId - The asset ID (with or without extension)
   * @returns The binary data, or null if not found
   */
  load(assetId: string): Promise<ArrayBuffer | null>;

  /**
   * Delete an asset from the vault.
   * @param assetId - The asset ID to delete
   * @returns Whether the deletion succeeded
   */
  delete(assetId: string): Promise<boolean>;

  /**
   * Get the absolute file path for an asset.
   * @param assetId - The asset ID
   * @returns The absolute path to the asset file, or null if not found
   */
  getPath(assetId: string): Promise<string | null>;
}

/**
 * API for window management operations.
 * Enables multi-window support in Scribe.
 */
export interface WindowAPI {
  /**
   * Opens a new empty window.
   * The new window will show the default view (last opened note or empty state).
   */
  'new'(): Promise<void>;

  /**
   * Opens a specific note in a new window.
   * @param noteId - The ID of the note to open
   */
  openNote(noteId: string): Promise<void>;

  /**
   * Gets the ID of the current window.
   * Useful for window-specific operations or tracking.
   * @returns The Electron BrowserWindow ID
   */
  getId(): Promise<number>;

  /**
   * Closes the current window.
   * On macOS, closing the last window leaves the app running.
   * On Windows/Linux, closing the last window quits the app.
   */
  close(): Promise<void>;

  /**
   * Brings the current window to the front and focuses it.
   */
  focus(): Promise<void>;

  /**
   * Reports the current note ID being viewed in this window.
   * Used for smart deep link routing to find windows with specific notes.
   * @param noteId - The note ID currently being viewed (null if no note)
   */
  reportCurrentNote(noteId: string | null): Promise<{ success: boolean }>;
}

// ============================================================================
// Complete Scribe API Interface
// ============================================================================

/**
 * Scribe Daemon API for getting daemon connection info.
 */
export interface ScribeDaemonAPI {
  /**
   * Get the port number of the running daemon.
   * Used by the renderer to establish tRPC connection.
   *
   * @returns The port number the daemon is listening on
   */
  getDaemonPort(): Promise<number>;
}

/**
 * Complete Scribe API exposed to the renderer process via contextBridge.
 *
 * This interface is the single source of truth for the IPC API surface.
 * The preload script implements this interface, and the renderer consumes it
 * via `window.scribe`.
 *
 * Note: Notes, search, graph, and export operations are now handled by the
 * daemon via tRPC and are not part of this API.
 */
export interface ScribeAPI {
  /** Simple ping for testing IPC connectivity */
  ping(): Promise<{ message: string; timestamp: number }>;

  /** System shell operations */
  shell: ShellAPI;

  /** App-level operations */
  app: AppAPI;

  /** Auto-update functionality */
  update: UpdateAPI;

  /** Native OS dialogs */
  dialog: DialogAPI;

  /** Vault management */
  vault: VaultAPI;

  /** Deep link handling for scribe:// URLs */
  deepLink: DeepLinkAPI;

  /** Binary asset management (images) */
  assets: AssetsAPI;

  /** Window management for multi-window support */
  window: WindowAPI;

  /** Daemon connection info for tRPC client */
  scribe: ScribeDaemonAPI;
}
