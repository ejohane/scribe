/**
 * Sync coordinator for orchestrating complete sync cycles.
 *
 * The SyncCoordinator ties together all sync components to run full sync cycles:
 * 1. Gather pending local changes from the change queue
 * 2. PUSH: Send local changes to server via SyncTransport
 * 3. PULL: Request changes since last sync sequence
 * 4. DETECT: Compare pulled notes with local state for conflicts
 * 5. APPLY: Update local vault with non-conflicting notes
 * 6. Update last sync sequence
 *
 * @module sync-coordinator
 * @since 1.0.0
 */

import type {
  BaseNote,
  SyncPushRequest,
  SyncPullRequest,
  SyncConflict,
  SyncResult,
} from '@scribe/shared';
import type { SyncDatabase } from './sync-database.js';
import type { SyncTransport } from './sync-transport.js';
import type { ChangeTracker } from './change-tracker.js';
import type { ConflictResolver } from './conflict-resolver.js';
import type { INetworkMonitor } from './network-monitor.js';

/**
 * Current phase of the sync cycle.
 */
export type SyncPhase = 'idle' | 'gathering' | 'pushing' | 'pulling' | 'applying' | 'resolving';

/**
 * Progress information for sync operations.
 */
export interface SyncProgress {
  /** Current sync phase */
  phase: SyncPhase;
  /** Total number of items to process in current phase */
  totalItems: number;
  /** Number of items processed so far */
  processedItems: number;
  /** Number of conflicts detected */
  conflicts: number;
}

/**
 * Configuration for the SyncCoordinator.
 */
export interface SyncCoordinatorConfig {
  /** Database for sync state persistence */
  database: SyncDatabase;
  /** Transport layer for server communication */
  transport: SyncTransport;
  /** Change tracker for observing local changes */
  changeTracker: ChangeTracker;
  /** Conflict resolver for handling sync conflicts */
  conflictResolver: ConflictResolver;
  /** Network monitor for online/offline status */
  networkMonitor: INetworkMonitor;
  /** Unique device identifier */
  deviceId: string;

  /** Callback to save a note locally */
  onSaveNote: (note: BaseNote) => Promise<void>;
  /** Callback to delete a note locally */
  onDeleteNote: (noteId: string) => Promise<void>;
  /** Callback to read a note locally */
  onReadNote: (noteId: string) => Promise<BaseNote | null>;
  /** Callback for progress updates */
  onProgress?: (progress: SyncProgress) => void;
}

/**
 * Coordinates complete sync cycles between local and remote.
 *
 * ## Sync Cycle Flow
 *
 * 1. **Push Phase**: Send local changes to server
 *    - Gather pending changes from the queue
 *    - Send to server via transport
 *    - Process accepted changes (update sync state, remove from queue)
 *    - Handle conflicts (store for resolution)
 *    - Handle errors (mark for retry)
 *
 * 2. **Pull Phase**: Fetch remote changes
 *    - Request changes since last sync sequence
 *    - Check for conflicts with local pending changes
 *    - Apply non-conflicting changes
 *    - Update sync sequence
 *
 * @example
 * ```typescript
 * const coordinator = new SyncCoordinator({
 *   database,
 *   transport,
 *   changeTracker,
 *   conflictResolver,
 *   networkMonitor,
 *   deviceId: 'device-123',
 *   onSaveNote: async (note) => vault.saveNote(note),
 *   onDeleteNote: async (id) => vault.deleteNote(id),
 *   onReadNote: async (id) => vault.getNote(id),
 *   onProgress: (progress) => console.log('Sync progress:', progress),
 * });
 *
 * // Run a full sync cycle
 * const result = await coordinator.runSyncCycle();
 * console.log(`Pushed: ${result.pushed}, Pulled: ${result.pulled}`);
 * ```
 */
export class SyncCoordinator {
  private readonly config: SyncCoordinatorConfig;
  private currentPhase: SyncPhase = 'idle';
  private syncInProgress = false;

  constructor(config: SyncCoordinatorConfig) {
    this.config = config;
  }

  /**
   * Run a complete sync cycle (push + pull).
   *
   * @returns Result of the sync operation
   */
  async runSyncCycle(): Promise<SyncResult> {
    if (this.syncInProgress) {
      return { pushed: 0, pulled: 0, conflicts: 0, errors: ['Sync already in progress'] };
    }

    if (!this.config.networkMonitor.isOnline()) {
      return { pushed: 0, pulled: 0, conflicts: 0, errors: ['Offline'] };
    }

    this.syncInProgress = true;
    const errors: string[] = [];
    let pushed = 0;
    let pulled = 0;

    try {
      // Phase 1: Push local changes
      this.setPhase('pushing');
      const pushResult = await this.pushChanges();
      pushed = pushResult.pushed;
      errors.push(...pushResult.errors);

      // Phase 2: Pull remote changes
      this.setPhase('pulling');
      const pullResult = await this.pullChanges();
      pulled = pullResult.pulled;
      errors.push(...pullResult.errors);

      this.setPhase('idle');

      return {
        pushed,
        pulled,
        conflicts: this.config.conflictResolver.getConflictCount(),
        errors,
      };
    } catch (error) {
      this.setPhase('idle');
      return {
        pushed,
        pulled,
        conflicts: this.config.conflictResolver.getConflictCount(),
        errors: [...errors, error instanceof Error ? error.message : 'Unknown error'],
      };
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * Push only - send local changes to server.
   *
   * @returns Number of changes pushed and any errors
   */
  async pushChanges(): Promise<{ pushed: number; errors: string[] }> {
    const errors: string[] = [];
    this.setPhase('gathering');

    const queuedChanges = this.config.database.getQueuedChanges();
    if (queuedChanges.length === 0) {
      return { pushed: 0, errors: [] };
    }

    this.setPhase('pushing');

    // Build push request
    const changes = queuedChanges.map((change) => {
      const payload = change.payload ? JSON.parse(change.payload) : null;
      return {
        noteId: change.noteId,
        operation: change.operation as 'create' | 'update' | 'delete',
        version: change.version,
        contentHash: change.operation === 'delete' ? undefined : payload?.sync?.contentHash,
        payload: change.operation === 'delete' ? undefined : payload,
      };
    });

    const request: SyncPushRequest = {
      deviceId: this.config.deviceId,
      changes,
    };

    try {
      const response = await this.config.transport.push(request);

      // Process accepted changes
      for (const accepted of response.accepted) {
        // Update sync state with server version
        const state = this.config.database.getSyncState(accepted.noteId);
        if (state) {
          this.config.database.setSyncState(accepted.noteId, {
            ...state,
            serverVersion: accepted.serverVersion,
            lastSyncedAt: Date.now(),
            status: 'synced',
          });
        }

        // Remove from queue
        const queuedChange = queuedChanges.find((c) => c.noteId === accepted.noteId);
        if (queuedChange) {
          this.config.database.removeQueuedChange(queuedChange.id);
        }
      }

      // Handle conflicts
      for (const conflict of response.conflicts) {
        const localNote = await this.config.onReadNote(conflict.noteId);
        if (localNote) {
          this.config.conflictResolver.detectConflict(
            localNote,
            conflict.serverNote as BaseNote,
            localNote.sync?.version ?? 1,
            conflict.serverVersion,
            'edit'
          );
        }
        errors.push(`Conflict detected for note ${conflict.noteId}`);
      }

      // Handle errors
      for (const error of response.errors) {
        errors.push(`Error syncing ${error.noteId}: ${error.error}`);
        if (error.retryable) {
          const queuedChange = queuedChanges.find((c) => c.noteId === error.noteId);
          if (queuedChange) {
            this.config.database.markChangeAttempted(queuedChange.id, error.error);
          }
        }
      }

      return { pushed: response.accepted.length, errors };
    } catch (error) {
      return { pushed: 0, errors: [error instanceof Error ? error.message : 'Push failed'] };
    }
  }

  /**
   * Pull only - fetch remote changes.
   *
   * @returns Number of changes pulled and any errors
   */
  async pullChanges(): Promise<{ pulled: number; errors: string[] }> {
    const errors: string[] = [];
    this.setPhase('pulling');

    const lastSequence = this.config.database.getLastSyncSequence();

    const request: SyncPullRequest = {
      deviceId: this.config.deviceId,
      sinceSequence: lastSequence,
    };

    try {
      const response = await this.config.transport.pull(request);

      this.setPhase('applying');
      let applied = 0;

      for (const change of response.changes) {
        try {
          // Check for local pending changes that might conflict
          const localState = this.config.database.getSyncState(change.noteId);

          if (localState?.status === 'pending') {
            // Potential conflict - local has pending changes
            const localNote = await this.config.onReadNote(change.noteId);
            if (localNote && change.note) {
              const hasConflict = this.config.conflictResolver.hasConflict(
                localNote,
                change.note as BaseNote,
                localState.localVersion,
                change.version
              );

              if (hasConflict) {
                this.config.conflictResolver.detectConflict(
                  localNote,
                  change.note as BaseNote,
                  localState.localVersion,
                  change.version,
                  change.operation === 'delete' ? 'delete-edit' : 'edit'
                );
                errors.push(`Conflict detected for note ${change.noteId}`);
                continue;
              }
            }
          }

          // Apply the change
          if (change.operation === 'delete') {
            await this.config.onDeleteNote(change.noteId);
            this.config.database.deleteSyncState(change.noteId);
          } else if (change.note) {
            await this.config.onSaveNote(change.note as BaseNote);
            this.config.database.setSyncState(change.noteId, {
              localVersion: change.version,
              serverVersion: change.version,
              contentHash: (change.note as BaseNote).sync?.contentHash ?? '',
              lastSyncedAt: Date.now(),
              status: 'synced',
            });
          }

          applied++;
        } catch (err) {
          errors.push(`Failed to apply change for ${change.noteId}: ${err}`);
        }
      }

      // Update sync sequence
      if (response.latestSequence > lastSequence) {
        this.config.database.setLastSyncSequence(response.latestSequence);
      }

      return { pulled: applied, errors };
    } catch (error) {
      return { pulled: 0, errors: [error instanceof Error ? error.message : 'Pull failed'] };
    }
  }

  /**
   * Get current sync status.
   *
   * @returns Current phase and whether sync is in progress
   */
  getStatus(): { phase: SyncPhase; inProgress: boolean } {
    return {
      phase: this.currentPhase,
      inProgress: this.syncInProgress,
    };
  }

  /**
   * Set the current sync phase and notify progress callback.
   */
  private setPhase(phase: SyncPhase): void {
    this.currentPhase = phase;
    this.config.onProgress?.({
      phase,
      totalItems: 0,
      processedItems: 0,
      conflicts: this.config.conflictResolver.getConflictCount(),
    });
  }
}
