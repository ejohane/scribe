import { useState, useEffect, useCallback, useMemo } from 'react';
import type { SyncStatus, SyncConflict, ConflictResolution } from '@scribe/shared';

/**
 * UI-friendly sync state derived from the underlying SyncStatus.
 * Provides simple, discrete states for conditional rendering.
 */
export type SyncUIState =
  | 'disabled' // Sync feature is off
  | 'offline' // No network connection
  | 'synced' // All changes synced
  | 'syncing' // Sync in progress
  | 'pending' // Has unsynced changes
  | 'error' // Sync failed
  | 'conflict'; // Has unresolved conflicts

/**
 * Result type for the useSyncStatus hook.
 * Provides sync status, actions, and derived state for UI components.
 */
export interface UseSyncStatusResult {
  /** Whether sync feature is enabled for this vault */
  isEnabled: boolean;

  /** Computed UI state for simple conditionals */
  state: SyncUIState;

  /** Detailed status from sync engine */
  status: SyncStatus | null;

  /** Pending conflicts awaiting resolution */
  conflicts: SyncConflict[];

  /** Number of pending local changes */
  pendingCount: number;

  /** Timestamp of last successful sync */
  lastSyncAt: number | null;

  /** Error message if sync is in error state */
  error: string | null;

  /** Whether a sync operation is in progress */
  isSyncing: boolean;

  /** Trigger a manual sync cycle */
  syncNow: () => Promise<void>;

  /** Resolve a specific conflict */
  resolveConflict: (noteId: string, resolution: ConflictResolution) => Promise<void>;

  /** Refresh status from the sync engine */
  refresh: () => Promise<void>;
}

/**
 * Hook for accessing sync status and controls.
 *
 * Automatically subscribes to sync status change events from the preload bridge.
 * Provides a computed `state` for simple UI conditionals and exposes actions
 * for triggering sync and resolving conflicts.
 *
 * @example
 * ```tsx
 * function SyncIndicator() {
 *   const { state, syncNow, conflicts, isSyncing } = useSyncStatus();
 *
 *   return (
 *     <button onClick={syncNow} disabled={isSyncing}>
 *       {state === 'syncing' ? 'Syncing...' : 'Sync'}
 *       {conflicts.length > 0 && <Badge>{conflicts.length}</Badge>}
 *     </button>
 *   );
 * }
 * ```
 */
export function useSyncStatus(): UseSyncStatusResult {
  const [isEnabled, setIsEnabled] = useState(false);
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [lastSyncAt, setLastSyncAt] = useState<number | null>(null);

  /**
   * Load initial sync state on mount.
   */
  const loadInitialState = useCallback(async () => {
    // Guard: sync API may not be available in test environments
    if (!window.scribe?.sync) {
      return;
    }

    try {
      const statusResult = await window.scribe.sync.getStatus();

      // Check if sync is enabled based on state
      const enabled = statusResult.state !== 'disabled';
      setIsEnabled(enabled);

      if (enabled) {
        setStatus(statusResult);
        setLastSyncAt(statusResult.lastSyncAt ?? null);

        // Check for error state
        if (statusResult.state === 'error' && statusResult.error) {
          setError(statusResult.error);
        }

        // Fetch any pending conflicts
        const pendingConflicts = await window.scribe.sync.getConflicts();
        setConflicts(pendingConflicts);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load sync status');
    }
  }, []);

  // Initial load
  useEffect(() => {
    loadInitialState();
  }, [loadInitialState]);

  // Subscribe to status changes
  useEffect(() => {
    // Guard: sync API may not be available in test environments
    if (!window.scribe?.sync?.onStatusChange) {
      return () => {};
    }

    const unsubscribe = window.scribe.sync.onStatusChange((newStatus: SyncStatus) => {
      setStatus(newStatus);

      // Update enabled state
      const enabled = newStatus.state !== 'disabled';
      setIsEnabled(enabled);

      // Update last sync timestamp
      if (newStatus.lastSyncAt) {
        setLastSyncAt(newStatus.lastSyncAt);
      }

      // Update error state
      if (newStatus.state === 'error' && newStatus.error) {
        setError(newStatus.error);
      } else if (newStatus.state !== 'error') {
        setError(null);
      }
    });

    return unsubscribe;
  }, []);

  /**
   * Trigger a manual sync cycle.
   */
  const syncNow = useCallback(async () => {
    if (!isEnabled || !window.scribe?.sync) return;

    try {
      setError(null);
      await window.scribe.sync.trigger();

      // Refresh conflicts after sync
      const updatedConflicts = await window.scribe.sync.getConflicts();
      setConflicts(updatedConflicts);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Sync failed');
    }
  }, [isEnabled]);

  /**
   * Resolve a sync conflict.
   */
  const resolveConflict = useCallback(async (noteId: string, resolution: ConflictResolution) => {
    if (!window.scribe?.sync) return;

    try {
      await window.scribe.sync.resolveConflict(noteId, resolution);
      // Remove resolved conflict from local state
      setConflicts((prev) => prev.filter((c) => c.noteId !== noteId));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resolve conflict');
    }
  }, []);

  /**
   * Refresh status from sync engine.
   */
  const refresh = useCallback(async () => {
    await loadInitialState();
  }, [loadInitialState]);

  /**
   * Number of pending local changes.
   */
  const pendingCount = status?.pendingChanges ?? 0;

  /**
   * Whether sync is currently in progress.
   */
  const isSyncing = status?.state === 'syncing';

  /**
   * Compute overall UI state from underlying data.
   * Priority: disabled > conflict > error > syncing > pending > offline > synced
   */
  const state = useMemo((): SyncUIState => {
    if (!isEnabled) return 'disabled';
    if (conflicts.length > 0) return 'conflict';
    if (error) return 'error';
    if (status?.state === 'syncing') return 'syncing';
    if (pendingCount > 0) return 'pending';
    if (status?.state === 'offline') return 'offline';
    return 'synced';
  }, [isEnabled, conflicts.length, error, status?.state, pendingCount]);

  return {
    isEnabled,
    state,
    status,
    conflicts,
    pendingCount,
    lastSyncAt,
    error,
    isSyncing,
    syncNow,
    resolveConflict,
    refresh,
  };
}

/**
 * Format a timestamp as a relative time string.
 * Used for displaying "Last synced: 5 minutes ago" style messages.
 *
 * @param timestamp - Unix timestamp in milliseconds
 * @returns Human-readable relative time string
 */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 60) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  return `${days} day${days === 1 ? '' : 's'} ago`;
}
