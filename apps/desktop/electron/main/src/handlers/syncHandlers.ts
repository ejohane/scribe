/**
 * Sync IPC Handlers
 *
 * This module provides IPC handlers for sync operations:
 * - Get sync status (idle, syncing, offline, error, disabled)
 * - Trigger manual sync cycles
 * - Get and resolve conflicts
 * - Enable/disable sync for the vault
 *
 * ## Handler Patterns
 *
 * This module uses a graceful fallback pattern for sync operations. Since sync
 * is an optional feature that may be disabled, handlers return sensible defaults
 * when `syncEngine` is null rather than throwing errors.
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `sync:getStatus` | none | `SyncStatus` | Get current sync status |
 * | `sync:trigger` | none | `SyncResult` | Trigger immediate sync cycle |
 * | `sync:getConflicts` | none | `SyncConflict[]` | Get unresolved conflicts |
 * | `sync:resolveConflict` | `noteId, resolution` | `{ success }` | Resolve a conflict |
 * | `sync:enable` | `{ apiKey, serverUrl? }` | `{ success, error? }` | Enable sync |
 * | `sync:disable` | none | `{ success }` | Disable sync |
 *
 * ## Events
 *
 * | Event | Payload | Description |
 * |-------|---------|-------------|
 * | `sync:statusChanged` | `SyncStatus` | Emitted when sync status changes |
 *
 * @module handlers/syncHandlers
 */

import { ipcMain } from 'electron';
import { IPC_CHANNELS } from '@scribe/shared';
import type { SyncStatus, SyncResult, SyncConflict, ConflictResolution } from '@scribe/shared';
import type { HandlerDependencies } from './types.js';

/**
 * Setup IPC handlers for sync operations.
 *
 * @param deps - Handler dependencies (syncEngine may be null if sync is disabled)
 *
 * @example
 * ```typescript
 * // From renderer
 * const status = await window.scribe.sync.getStatus();
 * // { state: 'idle', pendingChanges: 0, conflictCount: 0 }
 * ```
 */
export function setupSyncHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `sync:getStatus`
   *
   * Gets the current sync status.
   * Returns 'disabled' state if sync engine is not initialized.
   *
   * @returns `SyncStatus` - Current sync state including pending changes and conflicts
   */
  ipcMain.handle(IPC_CHANNELS.SYNC_GET_STATUS, async (): Promise<SyncStatus> => {
    if (!deps.syncEngine) {
      return {
        state: 'disabled',
        pendingChanges: 0,
        conflictCount: 0,
      };
    }
    return deps.syncEngine.getStatus();
  });

  /**
   * IPC: `sync:trigger`
   *
   * Triggers an immediate sync cycle (push + pull).
   * Returns empty result with error message if sync is disabled.
   *
   * @returns `SyncResult` - Number of pushed/pulled changes, conflicts, and errors
   */
  ipcMain.handle(IPC_CHANNELS.SYNC_TRIGGER, async (): Promise<SyncResult> => {
    if (!deps.syncEngine) {
      return { pushed: 0, pulled: 0, conflicts: 0, errors: ['Sync is disabled'] };
    }
    return deps.syncEngine.triggerSync();
  });

  /**
   * IPC: `sync:getConflicts`
   *
   * Gets all unresolved conflicts.
   * Returns empty array if sync is disabled.
   *
   * @returns `SyncConflict[]` - Array of conflicts awaiting resolution
   */
  ipcMain.handle(IPC_CHANNELS.SYNC_GET_CONFLICTS, async (): Promise<SyncConflict[]> => {
    if (!deps.syncEngine) {
      return [];
    }
    return deps.syncEngine.getConflicts();
  });

  /**
   * IPC: `sync:resolveConflict`
   *
   * Resolves a sync conflict with the given strategy.
   * Does nothing if sync is disabled.
   *
   * @param noteId - The ID of the note with the conflict
   * @param resolution - How to resolve: keep_local, keep_remote, or keep_both
   * @returns `{ success: boolean }` - Whether the resolution succeeded
   */
  ipcMain.handle(
    IPC_CHANNELS.SYNC_RESOLVE_CONFLICT,
    async (
      _event,
      noteId: string,
      resolution: ConflictResolution
    ): Promise<{ success: boolean }> => {
      if (!deps.syncEngine) {
        return { success: false };
      }
      deps.syncEngine.resolveConflict(noteId, resolution);
      return { success: true };
    }
  );

  /**
   * IPC: `sync:enable`
   *
   * Enables sync for the current vault.
   * Requires an API key for authentication.
   *
   * Note: Full implementation requires:
   * 1. Saving sync config to .scribe/sync.json
   * 2. Storing API key securely via Electron's safeStorage
   * 3. Creating and initializing a new SyncEngine instance
   *
   * @param options.apiKey - API key for sync server authentication
   * @param options.serverUrl - Optional custom server URL (defaults to production)
   * @returns `{ success, error? }` - Success status with optional error message
   */
  ipcMain.handle(
    IPC_CHANNELS.SYNC_ENABLE,
    async (
      _event,
      _options: { apiKey: string; serverUrl?: string }
    ): Promise<{ success: boolean; error?: string }> => {
      // TODO: Implement enable sync flow
      // 1. Validate API key with server
      // 2. Save sync config to vault/.scribe/sync.json
      // 3. Store API key securely using safeStorage
      // 4. Create and initialize SyncEngine
      // 5. Update deps.syncEngine reference
      return { success: false, error: 'Enable sync flow not yet implemented' };
    }
  );

  /**
   * IPC: `sync:disable`
   *
   * Disables sync for the current vault.
   * Shuts down the sync engine and clears the reference.
   *
   * @returns `{ success: boolean }` - Whether disable succeeded
   */
  ipcMain.handle(IPC_CHANNELS.SYNC_DISABLE, async (): Promise<{ success: boolean }> => {
    if (!deps.syncEngine) {
      return { success: true }; // Already disabled
    }
    await deps.syncEngine.shutdown();
    deps.syncEngine = null;
    return { success: true };
  });
}

/**
 * Setup sync status change forwarding to renderer.
 *
 * Subscribes to SyncEngine status changes and forwards them to all
 * windows via WindowManager.broadcast(). This enables the UI to react
 * to sync state changes in real-time across all windows.
 *
 * @param deps - Handler dependencies (syncEngine and windowManager may be null)
 * @returns Cleanup function to unsubscribe from status changes
 *
 * @example
 * ```typescript
 * // In main process setup
 * const cleanup = setupSyncStatusForwarding(deps);
 *
 * // On app shutdown
 * cleanup();
 * ```
 */
export function setupSyncStatusForwarding(deps: HandlerDependencies): () => void {
  if (!deps.syncEngine || !deps.windowManager) {
    return () => {}; // No-op cleanup
  }

  return deps.syncEngine.onStatusChange((status) => {
    deps.windowManager!.broadcast(IPC_CHANNELS.SYNC_STATUS_CHANGED, status);
  });
}
