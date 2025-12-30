/**
 * Main SyncEngine class that coordinates all sync components.
 *
 * The SyncEngine is the public API for the sync system, providing:
 * - Lifecycle management (initialize, shutdown)
 * - Sync metadata management for notes
 * - Change tracking for local modifications
 * - Manual sync triggers
 * - Conflict management
 * - Status monitoring
 *
 * @module sync-engine
 * @since 1.0.0
 */

import type {
  BaseNote,
  SyncConfig,
  SyncStatus,
  SyncResult,
  SyncConflict,
  ConflictResolution,
  SyncMetadata,
} from '@scribe/shared';
import { SyncDatabase } from './sync-database.js';
import { SyncCoordinator } from './sync-coordinator.js';
import { SyncTransport } from './sync-transport.js';
import { ChangeTracker } from './change-tracker.js';
import { ConflictResolver, type ResolvedConflict } from './conflict-resolver.js';
import { type INetworkMonitor, DisabledNetworkMonitor } from './network-monitor.js';
import { computeContentHash } from './content-hash.js';

/**
 * Configuration for creating a SyncEngine instance.
 *
 * @since 1.0.0
 */
export interface SyncEngineConfig {
  /** Path to the vault */
  vaultPath: string;
  /** Sync configuration (loaded from .scribe/sync.json) */
  config: SyncConfig;
  /** Network monitor (injected - platform specific) */
  networkMonitor?: INetworkMonitor;
  /** API key for authentication */
  apiKey: string;
  /** Callback to save a note to the vault */
  onSaveNote: (note: BaseNote) => Promise<void>;
  /** Callback to delete a note from the vault */
  onDeleteNote: (noteId: string) => Promise<void>;
  /** Callback to read a note from the vault */
  onReadNote: (noteId: string) => Promise<BaseNote | null>;
}

/**
 * Main SyncEngine class that coordinates all sync components.
 *
 * ## Usage
 *
 * ```typescript
 * const engine = await createSyncEngine({
 *   vaultPath: '/path/to/vault',
 *   config: syncConfig,
 *   apiKey: 'sk_...',
 *   onSaveNote: async (note) => vault.saveNote(note),
 *   onDeleteNote: async (id) => vault.deleteNote(id),
 *   onReadNote: async (id) => vault.getNote(id),
 * });
 *
 * // Queue changes
 * engine.queueChange(note, 'update');
 *
 * // Manual sync
 * await engine.triggerSync();
 *
 * // Monitor status
 * engine.onStatusChange((status) => console.log('Sync status:', status.state));
 *
 * // Cleanup
 * await engine.shutdown();
 * ```
 *
 * @since 1.0.0
 */
export class SyncEngine {
  private readonly database: SyncDatabase;
  private readonly transport: SyncTransport;
  private readonly changeTracker: ChangeTracker;
  private readonly conflictResolver: ConflictResolver;
  private readonly coordinator: SyncCoordinator;
  private readonly networkMonitor: INetworkMonitor;
  private readonly config: SyncConfig;

  private statusListeners: Set<(status: SyncStatus) => void> = new Set();
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private networkUnsubscribe: (() => void) | null = null;
  private initialized = false;

  constructor(engineConfig: SyncEngineConfig) {
    // Initialize database
    const dbPath = `${engineConfig.vaultPath}/derived/sync.sqlite3`;
    this.database = new SyncDatabase({ dbPath });
    this.config = engineConfig.config;

    // Initialize network monitor (use disabled if not provided)
    this.networkMonitor = engineConfig.networkMonitor ?? new DisabledNetworkMonitor();

    // Initialize device ID if needed
    if (!this.database.getDeviceId()) {
      this.database.setDeviceId(engineConfig.config.deviceId);
    }

    // Initialize transport
    this.transport = new SyncTransport({
      serverUrl: engineConfig.config.serverUrl,
      apiKey: engineConfig.apiKey,
    });

    // Initialize change tracker
    this.changeTracker = new ChangeTracker({
      database: this.database,
    });

    // Initialize conflict resolver
    this.conflictResolver = new ConflictResolver({
      database: this.database,
    });

    // Initialize coordinator
    this.coordinator = new SyncCoordinator({
      database: this.database,
      transport: this.transport,
      changeTracker: this.changeTracker,
      conflictResolver: this.conflictResolver,
      networkMonitor: this.networkMonitor,
      deviceId: this.getDeviceId(),
      onSaveNote: engineConfig.onSaveNote,
      onDeleteNote: engineConfig.onDeleteNote,
      onReadNote: engineConfig.onReadNote,
      onProgress: () => {
        // Update status on progress changes
        this.notifyStatusChange();
      },
    });
  }

  /**
   * Initialize the sync engine and start background sync.
   * Safe to call multiple times - will only initialize once.
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Listen for network changes
    this.networkUnsubscribe = this.networkMonitor.onStatusChange((online) => {
      if (online) {
        this.triggerSync().catch(() => {}); // Sync when coming online
        this.startPolling();
      } else {
        this.stopPolling();
      }
      this.notifyStatusChange();
    });

    // Start polling if online
    if (this.networkMonitor.isOnline()) {
      this.startPolling();
    }

    this.initialized = true;
  }

  /**
   * Shutdown the sync engine and clean up resources.
   * Should be called when the vault is closed or the app is shutting down.
   */
  async shutdown(): Promise<void> {
    this.stopPolling();
    this.networkUnsubscribe?.();
    this.networkUnsubscribe = null;
    this.statusListeners.clear();
    this.database.close();
    this.initialized = false;
  }

  /**
   * Add sync metadata to a note (for new notes or updates).
   * Increments the version and computes a new content hash.
   *
   * @param note - The note to add sync metadata to
   * @returns A new note object with updated sync metadata
   */
  addSyncMetadata(note: BaseNote): BaseNote {
    const existingVersion = note.sync?.version ?? 0;
    const contentHash = computeContentHash(note);

    const syncMetadata: SyncMetadata = {
      version: existingVersion + 1,
      contentHash,
      serverVersion: note.sync?.serverVersion,
      syncedAt: note.sync?.syncedAt,
      deviceId: this.getDeviceId(),
    };

    return {
      ...note,
      sync: syncMetadata,
    };
  }

  /**
   * Queue a note change for sync.
   * Will trigger a sync after a short delay if online.
   *
   * @param note - The note that was created or updated
   * @param operation - Whether this is a 'create' or 'update'
   */
  queueChange(note: BaseNote, operation: 'create' | 'update'): void {
    this.changeTracker.trackChange(note, operation);
    this.notifyStatusChange();

    // Trigger sync if online (debounced via setTimeout)
    if (this.networkMonitor.isOnline()) {
      setTimeout(() => this.triggerSync().catch(() => {}), 1000);
    }
  }

  /**
   * Queue a note deletion for sync.
   * Will trigger a sync after a short delay if online.
   *
   * @param noteId - The ID of the note that was deleted
   */
  queueDelete(noteId: string): void {
    this.changeTracker.trackDelete(noteId);
    this.notifyStatusChange();

    // Trigger sync if online
    if (this.networkMonitor.isOnline()) {
      setTimeout(() => this.triggerSync().catch(() => {}), 1000);
    }
  }

  /**
   * Trigger a manual sync cycle.
   * Performs both push and pull operations.
   *
   * @returns Result of the sync operation
   */
  async triggerSync(): Promise<SyncResult> {
    this.notifyStatusChange();
    const result = await this.coordinator.runSyncCycle();

    // Update last sync timestamp
    if (result.pushed > 0 || result.pulled > 0) {
      this.database.setMetadata('lastSyncAt', Date.now().toString());
    }

    this.notifyStatusChange();
    return result;
  }

  /**
   * Get all unresolved conflicts.
   *
   * @returns Array of sync conflicts awaiting resolution
   */
  getConflicts(): SyncConflict[] {
    return this.conflictResolver.getPendingConflicts();
  }

  /**
   * Resolve a conflict with the given strategy.
   *
   * @param noteId - The ID of the note with a conflict
   * @param resolution - How to resolve the conflict
   * @returns The resolved conflict result
   */
  resolveConflict(noteId: string, resolution: ConflictResolution): ResolvedConflict {
    const result = this.conflictResolver.resolve(noteId, resolution);
    this.notifyStatusChange();
    return result;
  }

  /**
   * Get current sync status.
   * Returns the current state, pending changes, conflicts, etc.
   *
   * @returns Current sync status
   */
  getStatus(): SyncStatus {
    const coordinatorStatus = this.coordinator.getStatus();

    let state: SyncStatus['state'];
    if (!this.config.enabled) {
      state = 'disabled';
    } else if (!this.networkMonitor.isOnline()) {
      state = 'offline';
    } else if (coordinatorStatus.inProgress) {
      state = 'syncing';
    } else if (this.conflictResolver.getConflictCount() > 0) {
      state = 'error'; // Has conflicts that need resolution
    } else {
      state = 'idle';
    }

    const lastSyncAtStr = this.database.getMetadata('lastSyncAt');
    const lastSyncAt = lastSyncAtStr ? parseInt(lastSyncAtStr, 10) : undefined;

    return {
      state,
      lastSyncAt,
      pendingChanges: this.database.getQueueSize(),
      conflictCount: this.conflictResolver.getConflictCount(),
      error: undefined,
      nextSyncAt: this.pollTimer ? Date.now() + this.config.syncIntervalMs : undefined,
    };
  }

  /**
   * Subscribe to status changes.
   * The callback is immediately called with the current status.
   *
   * @param callback - Function to call when status changes
   * @returns Unsubscribe function
   */
  onStatusChange(callback: (status: SyncStatus) => void): () => void {
    this.statusListeners.add(callback);
    // Immediately notify with current status
    callback(this.getStatus());
    return () => this.statusListeners.delete(callback);
  }

  /**
   * Get the device ID for this sync instance.
   *
   * @returns The unique device identifier
   */
  getDeviceId(): string {
    return this.database.getDeviceId() ?? this.config.deviceId;
  }

  // ===========================================================================
  // Private methods
  // ===========================================================================

  private startPolling(): void {
    if (this.pollTimer) return;

    this.pollTimer = setInterval(
      () => this.triggerSync().catch(() => {}),
      this.config.syncIntervalMs
    );
  }

  private stopPolling(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  private notifyStatusChange(): void {
    const status = this.getStatus();
    for (const listener of this.statusListeners) {
      listener(status);
    }
  }
}

/**
 * Factory function to create and initialize a SyncEngine.
 *
 * @param config - Configuration for the sync engine
 * @returns An initialized SyncEngine instance
 *
 * @example
 * ```typescript
 * const engine = await createSyncEngine({
 *   vaultPath: '/path/to/vault',
 *   config: syncConfig,
 *   apiKey: 'sk_...',
 *   onSaveNote: async (note) => vault.saveNote(note),
 *   onDeleteNote: async (id) => vault.deleteNote(id),
 *   onReadNote: async (id) => vault.getNote(id),
 * });
 * ```
 */
export async function createSyncEngine(config: SyncEngineConfig): Promise<SyncEngine> {
  const engine = new SyncEngine(config);
  await engine.initialize();
  return engine;
}
