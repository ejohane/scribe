import type { WindowManager } from '../window-manager';

/**
 * Dependencies injected into each handler module.
 * All properties may be null during early startup.
 *
 * Note: vault, graphEngine, and searchEngine are no longer needed for IPC handlers
 * as their functionality has been migrated to the daemon via tRPC. They remain
 * in the main process for initial note loading, but handlers no longer use them.
 */
export interface HandlerDependencies {
  windowManager: WindowManager | null;
  /**
   * Port number where the embedded daemon is listening.
   * Used by the renderer to establish tRPC connection.
   * Will be dynamically assigned when embedded daemon is implemented (scribe-i2zx).
   */
  daemonPort?: number;
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
 * Helper to get a guaranteed non-null windowManager, throwing if not initialized.
 */
export function requireWindowManager(deps: HandlerDependencies): WindowManager {
  if (!deps.windowManager) {
    throw new Error('WindowManager not initialized');
  }
  return deps.windowManager;
}
