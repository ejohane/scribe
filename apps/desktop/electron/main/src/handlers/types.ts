import type { FileSystemVault } from '@scribe/storage-fs';
import type { GraphEngine } from '@scribe/engine-graph';
import type { SearchEngine } from '@scribe/engine-search';
import type { WindowManager } from '../window-manager';
import { ScribeError } from '@scribe/shared';

/**
 * Dependencies injected into each handler module.
 * All properties may be null during early startup.
 */
export interface HandlerDependencies {
  vault: FileSystemVault | null;
  graphEngine: GraphEngine | null;
  searchEngine: SearchEngine | null;
  windowManager: WindowManager | null;
}

/**
 * Configuration loaded from config.json
 */
export interface AppConfig {
  lastOpenedNoteId?: string;
  theme?: 'light' | 'dark' | 'system';
  vaultPath?: string;
}

/**
 * Helper to get a guaranteed non-null vault, throwing if not initialized.
 */
export function requireVault(deps: HandlerDependencies): FileSystemVault {
  if (!deps.vault) {
    throw new Error('Vault not initialized');
  }
  return deps.vault;
}

/**
 * Helper to get a guaranteed non-null graphEngine, throwing if not initialized.
 */
export function requireGraphEngine(deps: HandlerDependencies): GraphEngine {
  if (!deps.graphEngine) {
    throw new Error('Graph engine not initialized');
  }
  return deps.graphEngine;
}

/**
 * Helper to get a guaranteed non-null searchEngine, throwing if not initialized.
 */
export function requireSearchEngine(deps: HandlerDependencies): SearchEngine {
  if (!deps.searchEngine) {
    throw new Error('Search engine not initialized');
  }
  return deps.searchEngine;
}

/**
 * Helper to get a guaranteed non-null windowManager, throwing if not initialized.
 */
export function requireWindowManager(deps: HandlerDependencies): WindowManager {
  if (!deps.windowManager) {
    throw new Error('WindowManager not initialized');
  }
  return deps.windowManager;
}

/**
 * Type-safe bundle of all initialized engines.
 * Used by {@link withEngines} to provide pre-validated engine references.
 */
export interface Engines {
  vault: FileSystemVault;
  graphEngine: GraphEngine;
  searchEngine: SearchEngine;
}

/**
 * Higher-order function to wrap IPC handlers that require all engines.
 *
 * Consolidates the common pattern of calling requireVault, requireGraphEngine,
 * and requireSearchEngine at the start of each handler.
 *
 * @param deps - Handler dependencies that may have null engines during startup
 * @param handler - The handler function that receives validated engines and IPC args
 * @returns A wrapped handler suitable for ipcMain.handle
 *
 * @example
 * ```typescript
 * ipcMain.handle('notes:save', withEngines(deps, async (engines, note: Note) => {
 *   await engines.vault.save(note);
 *   engines.graphEngine.addNote(note);
 *   engines.searchEngine.indexNote(note);
 *   return { success: true };
 * }));
 * ```
 *
 * @throws Error if any engine is not initialized when the handler is invoked
 */
export function withEngines<T extends unknown[], R>(
  deps: HandlerDependencies,
  handler: (engines: Engines, ...args: T) => Promise<R>
): (_event: Electron.IpcMainInvokeEvent, ...args: T) => Promise<R> {
  return async (_event: Electron.IpcMainInvokeEvent, ...args: T): Promise<R> => {
    if (!deps.vault || !deps.graphEngine || !deps.searchEngine) {
      throw new Error('Engines not initialized');
    }
    const engines: Engines = {
      vault: deps.vault,
      graphEngine: deps.graphEngine,
      searchEngine: deps.searchEngine,
    };
    return handler(engines, ...args);
  };
}

/**
 * Wrap ScribeError for IPC transport with user-friendly message.
 *
 * ScribeErrors are converted to plain Errors with user-friendly messages
 * since Error subclasses don't serialize properly over IPC.
 *
 * @param error - The error to wrap
 * @throws Always throws - either wrapped ScribeError or original error
 *
 * @example
 * ```typescript
 * try {
 *   const note = vault.read(noteId);
 * } catch (error) {
 *   wrapError(error);
 * }
 * ```
 */
export function wrapError(error: unknown): never {
  if (error instanceof ScribeError) {
    const userError = new Error(error.getUserMessage());
    userError.name = error.code;
    throw userError;
  }
  throw error;
}
