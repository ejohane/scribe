import type { BrowserWindow } from 'electron';
import type { FileSystemVault } from '@scribe/storage-fs';
import type { GraphEngine } from '@scribe/engine-graph';
import type { SearchEngine } from '@scribe/engine-search';
import type { TaskIndex } from '@scribe/engine-core/node';

/**
 * Dependencies injected into each handler module.
 * All properties may be null during early startup.
 */
export interface HandlerDependencies {
  vault: FileSystemVault | null;
  graphEngine: GraphEngine | null;
  searchEngine: SearchEngine | null;
  taskIndex: TaskIndex | null;
  mainWindow: BrowserWindow | null;
}

/**
 * Configuration loaded from config.json
 */
export interface AppConfig {
  lastOpenedNoteId?: string;
  theme?: 'light' | 'dark' | 'system';
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
 * Helper to get a guaranteed non-null taskIndex, throwing if not initialized.
 */
export function requireTaskIndex(deps: HandlerDependencies): TaskIndex {
  if (!deps.taskIndex) {
    throw new Error('Task index not initialized');
  }
  return deps.taskIndex;
}

/**
 * Helper to get a guaranteed non-null mainWindow, throwing if not available.
 */
export function requireMainWindow(deps: HandlerDependencies): BrowserWindow {
  if (!deps.mainWindow) {
    throw new Error('Main window not available');
  }
  return deps.mainWindow;
}
