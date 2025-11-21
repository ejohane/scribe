/**
 * Indexing-specific types and interfaces.
 *
 * This package provides both batch indexing for startup and incremental
 * update handling for file changes. Key features:
 *
 * 1. Startup Indexing:
 *    - `performStartupIndexing()` - Eagerly index all files in vault
 *    - Parallel parsing for large vaults
 *    - Populates all registries and indices
 *
 * 2. Incremental Updates:
 *    - `handleVaultChanges()` - Process file add/change/remove/rename events
 *    - `computeNoteDelta()` - Efficiently compute changes between versions
 *    - `applyNoteDelta()` - Apply only the changed parts to indices
 *
 * 3. Delta-based Updates:
 *    - Minimizes recomputation by tracking specific changes
 *    - Efficiently updates tag, heading, people, link, and embed indices
 *    - Tracks title and path changes for link resolution updates
 *
 * Example usage:
 *
 * ```typescript
 * // Startup
 * const state = createAppState();
 * await performStartupIndexing(vault, state);
 *
 * // Watch for changes
 * vaultWatcher.start(async (events) => {
 *   await handleVaultChanges(state, events);
 * });
 * ```
 */

export interface IndexingOptions {
  /**
   * Whether to build the graph index.
   */
  buildGraph?: boolean;

  /**
   * Whether to detect unlinked mentions.
   */
  detectUnlinkedMentions?: boolean;
}

/**
 * Event types for state change notifications.
 */
export type StateChangeEventType =
  | 'note-added'
  | 'note-updated'
  | 'note-removed'
  | 'indexing-started'
  | 'indexing-progress'
  | 'indexing-complete'
  | 'state-snapshot';

/**
 * Event payload for state changes.
 */
export interface StateChangeEvent {
  /**
   * Type of the event.
   */
  type: StateChangeEventType;

  /**
   * Timestamp of the event.
   */
  timestamp: number;

  /**
   * Event-specific data.
   */
  data?: any;
}

/**
 * Listener for state change events.
 */
export type StateChangeListener = (event: StateChangeEvent) => void;

/**
 * Transaction context for batching state updates.
 */
export interface TransactionContext {
  /**
   * Transaction ID.
   */
  id: string;

  /**
   * Start time of the transaction.
   */
  startTime: number;

  /**
   * Events accumulated during the transaction.
   */
  events: StateChangeEvent[];
}

/**
 * Indexing readiness state.
 */
export interface IndexingReadiness {
  /**
   * Whether initial indexing is complete.
   */
  isReady: boolean;

  /**
   * Number of files indexed so far.
   */
  filesIndexed: number;

  /**
   * Total number of files to index.
   */
  totalFiles: number;

  /**
   * Progress percentage (0-100).
   */
  progress: number;

  /**
   * Whether minimum threshold for UI readiness is met.
   */
  isMinimallyReady: boolean;
}
