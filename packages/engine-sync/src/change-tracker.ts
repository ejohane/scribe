/**
 * Change tracker for observing and queuing local note changes.
 *
 * This module observes note CRUD operations and queues them for sync.
 * Multiple rapid saves to the same note are coalesced - only the latest
 * state matters for sync.
 *
 * @module change-tracker
 * @since 1.0.0
 */

import type { BaseNote } from '@scribe/shared';
import type { SyncDatabase } from './sync-database.js';
import { computeContentHash } from './content-hash.js';

/**
 * Type of change operation.
 */
export type ChangeType = 'create' | 'update' | 'delete';

/**
 * Configuration for the ChangeTracker.
 */
export interface ChangeTrackerConfig {
  database: SyncDatabase;
}

/**
 * Tracks local note changes for synchronization.
 *
 * ## Tracking Strategy
 *
 * - CREATE: Record new note with content hash, queue for push
 * - UPDATE: Compute new hash, compare to stored, record if different
 * - DELETE: Record tombstone, queue for push
 *
 * ## Deduplication
 *
 * Multiple rapid saves to the same note are coalesced:
 * - Only the latest state matters for sync
 * - Earlier pending changes for same noteId are replaced
 *
 * @example
 * ```typescript
 * const tracker = new ChangeTracker({ database: syncDb });
 *
 * // Track note creation
 * tracker.trackChange(note, 'create');
 *
 * // Track note update
 * tracker.trackChange(updatedNote, 'update');
 *
 * // Track note deletion
 * tracker.trackDelete(noteId);
 *
 * // Check pending changes
 * if (tracker.hasPendingChanges()) {
 *   console.log(`${tracker.getPendingChangeCount()} changes to sync`);
 * }
 *
 * // After successful sync
 * tracker.markSynced(noteId, serverVersion);
 * ```
 */
export class ChangeTracker {
  private readonly database: SyncDatabase;

  constructor(config: ChangeTrackerConfig) {
    this.database = config.database;
  }

  /**
   * Track a note create or update.
   * Computes content hash and records change in queue.
   *
   * For updates, the change is skipped if the content hash hasn't changed.
   *
   * @param note - The note that was created or updated
   * @param changeType - Whether this is a 'create' or 'update' operation
   */
  trackChange(note: BaseNote, changeType: 'create' | 'update'): void {
    const contentHash = computeContentHash(note);

    // Get existing sync state
    const existingState = this.database.getSyncState(note.id);

    // Skip if content hasn't actually changed (for updates)
    if (changeType === 'update' && existingState?.contentHash === contentHash) {
      return;
    }

    // Determine version
    const newVersion = existingState ? existingState.localVersion + 1 : 1;

    // Update sync state
    this.database.setSyncState(note.id, {
      localVersion: newVersion,
      serverVersion: existingState?.serverVersion ?? null,
      contentHash,
      lastSyncedAt: existingState?.lastSyncedAt ?? null,
      status: 'pending',
    });

    // Remove any existing queued change for this note (coalesce)
    this.database.removeQueuedChangesForNote(note.id);

    // Queue the change
    this.database.queueChange(note.id, changeType, newVersion, note);
  }

  /**
   * Track a note deletion.
   * Records tombstone in change queue.
   *
   * @param noteId - The ID of the note that was deleted
   */
  trackDelete(noteId: string): void {
    const existingState = this.database.getSyncState(noteId);
    const version = existingState ? existingState.localVersion + 1 : 1;

    // Update sync state to mark as deleted
    this.database.setSyncState(noteId, {
      localVersion: version,
      serverVersion: existingState?.serverVersion ?? null,
      contentHash: '', // Empty hash for deleted notes
      lastSyncedAt: existingState?.lastSyncedAt ?? null,
      status: 'pending',
    });

    // Remove any existing queued change for this note
    this.database.removeQueuedChangesForNote(noteId);

    // Queue the deletion
    this.database.queueChange(noteId, 'delete', version, null);
  }

  /**
   * Get count of pending changes.
   *
   * @returns The number of changes waiting to be synced
   */
  getPendingChangeCount(): number {
    return this.database.getQueueSize();
  }

  /**
   * Check if there are any pending changes.
   *
   * @returns True if there are changes waiting to be synced
   */
  hasPendingChanges(): boolean {
    return this.getPendingChangeCount() > 0;
  }

  /**
   * Mark a change as successfully synced.
   * Called after server accepts the change.
   *
   * @param noteId - The ID of the note that was synced
   * @param serverVersion - The version number assigned by the server
   */
  markSynced(noteId: string, serverVersion: number): void {
    const state = this.database.getSyncState(noteId);
    if (state) {
      this.database.setSyncState(noteId, {
        ...state,
        serverVersion,
        lastSyncedAt: Date.now(),
        status: 'synced',
      });
    }
  }
}
