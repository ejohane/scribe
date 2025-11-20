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
