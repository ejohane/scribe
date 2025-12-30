/**
 * Sync configuration types for Scribe
 *
 * This module contains types for the sync configuration stored at {vault}/.scribe/sync.json.
 * The sync config is vault-specific, allowing different vaults to have different sync settings
 * (e.g., corporate vault with sync disabled, personal vault with sync enabled).
 *
 * @since 1.0.0
 */

/**
 * Sync configuration stored at {vault}/.scribe/sync.json
 *
 * This file is created when the user enables sync and contains
 * all vault-specific sync settings. The API key is NOT stored here -
 * it's stored securely using Electron's safeStorage.
 *
 * @example
 * ```json
 * {
 *   "enabled": true,
 *   "serverUrl": "https://sync.scribe.app",
 *   "deviceId": "d4f8a3b2-1c9e-4a7f-8b6d-2e5f3a9c1b0d",
 *   "enabledAt": 1735500000000,
 *   "lastSyncSequence": 42,
 *   "syncIntervalMs": 30000
 * }
 * ```
 *
 * @since 1.0.0
 */
export interface SyncConfig {
  /**
   * Whether sync is enabled for this vault
   *
   * When false, the sync engine will not run for this vault.
   * Can be toggled without losing other configuration.
   */
  enabled: boolean;

  /**
   * Sync server URL
   *
   * Default: 'https://sync.scribe.app' (production Scribe server)
   * Can be customized for self-hosted deployments.
   */
  serverUrl: string;

  /**
   * Unique device identifier
   *
   * Generated on first sync enable using crypto.randomUUID().
   * Used by the server to track which device made each change
   * and to avoid echoing back a device's own changes.
   */
  deviceId: string;

  /**
   * Timestamp when sync was enabled for this vault
   *
   * Used for migration tracking and debugging.
   * Stored as Unix timestamp in milliseconds.
   */
  enabledAt: number;

  /**
   * Last known server sequence number
   *
   * Used as the cursor for pulling changes from the server.
   * Updated after each successful pull operation.
   * A value of 0 means no changes have been pulled yet.
   */
  lastSyncSequence: number;

  /**
   * Sync interval in milliseconds
   *
   * How often the sync engine polls for changes.
   * Default: 30000 (30 seconds)
   * Minimum recommended: 5000 (5 seconds)
   */
  syncIntervalMs: number;
}

/**
 * Default values for new sync configurations
 *
 * Used when creating a new sync.json file. Note that `deviceId` and `enabledAt`
 * must be generated at runtime and are not included here.
 *
 * @example
 * ```typescript
 * const newConfig: SyncConfig = {
 *   ...DEFAULT_SYNC_CONFIG,
 *   enabled: true,
 *   deviceId: crypto.randomUUID(),
 *   enabledAt: Date.now(),
 * };
 * ```
 *
 * @since 1.0.0
 */
export const DEFAULT_SYNC_CONFIG = {
  serverUrl: 'https://sync.scribe.app',
  syncIntervalMs: 30000,
  lastSyncSequence: 0,
} as const satisfies Partial<SyncConfig>;

/**
 * Type for the default sync config values
 */
export type DefaultSyncConfig = typeof DEFAULT_SYNC_CONFIG;

/**
 * Sync config file path relative to vault root
 *
 * @example
 * ```typescript
 * const configPath = path.join(vaultPath, SYNC_CONFIG_PATH);
 * ```
 */
export const SYNC_CONFIG_PATH = '.scribe/sync.json' as const;

/**
 * Minimum allowed sync interval in milliseconds
 *
 * Prevents overly aggressive polling that could overload the server.
 */
export const MIN_SYNC_INTERVAL_MS = 5000;

/**
 * Maximum allowed sync interval in milliseconds
 *
 * Ensures sync happens at least once per hour for reasonable UX.
 */
export const MAX_SYNC_INTERVAL_MS = 3600000;

// =============================================================================
// Sync Metadata Types
// =============================================================================

/**
 * Sync metadata attached to each note.
 * Optional field on BaseNote - only present when sync is enabled.
 *
 * @since 1.0.0
 */
export interface SyncMetadata {
  /**
   * Per-note monotonic counter, starts at 1.
   * Incremented on each local change.
   */
  version: number;

  /**
   * SHA-256 of serialized sync-relevant fields (truncated to 16 chars).
   * Used for quick equality checks without comparing full content.
   */
  contentHash: string;

  /**
   * Last known server version (for conflict detection).
   * Set when a note is successfully pushed or pulled from server.
   */
  serverVersion?: number;

  /**
   * Timestamp of last successful sync (ms since epoch).
   * Updated after successful push or pull.
   */
  syncedAt?: number;

  /**
   * Device ID that made the last local change.
   * Used to track origin of changes across devices.
   */
  deviceId?: string;
}

// =============================================================================
// Sync Protocol Types - Push
// =============================================================================

/**
 * Request to push local changes to the sync server.
 *
 * @since 1.0.0
 */
export interface SyncPushRequest {
  /** Device making the push request */
  deviceId: string;
  /** List of changes to push */
  changes: SyncChange[];
}

/**
 * A single change to be synced (create, update, or delete).
 *
 * @since 1.0.0
 */
export interface SyncChange {
  /** ID of the note being changed */
  noteId: string;
  /** Type of operation */
  operation: 'create' | 'update' | 'delete';
  /** Current local version of the note */
  version: number;
  /** Server version this change is based on (for optimistic concurrency) */
  baseVersion?: number;
  /** Content hash for quick comparison */
  contentHash?: string;
  /** Full note data for create/update operations */
  payload?: unknown;
}

/**
 * Response from the sync server after a push request.
 *
 * @since 1.0.0
 */
export interface SyncPushResponse {
  /** Successfully accepted changes */
  accepted: {
    noteId: string;
    /** Server-assigned version number */
    serverVersion: number;
    /** Server-assigned sequence number for ordering */
    serverSequence: number;
  }[];

  /** Changes that conflicted with server state */
  conflicts: {
    noteId: string;
    /** Current server version */
    serverVersion: number;
    /** Full server note for conflict resolution */
    serverNote: unknown;
  }[];

  /** Changes that failed due to errors */
  errors: {
    noteId: string;
    /** Error message */
    error: string;
    /** Whether the client should retry this change */
    retryable: boolean;
  }[];
}

// =============================================================================
// Sync Protocol Types - Pull
// =============================================================================

/**
 * Request to pull changes from the sync server.
 *
 * @since 1.0.0
 */
export interface SyncPullRequest {
  /** Device making the pull request */
  deviceId: string;
  /** Only return changes after this sequence number */
  sinceSequence?: number;
  /** Maximum number of changes to return */
  limit?: number;
  /** Prioritize these note IDs in the response */
  priorityNoteIds?: string[];
}

/**
 * Response from the sync server with pulled changes.
 *
 * @since 1.0.0
 */
export interface SyncPullResponse {
  /** List of changes since the requested sequence */
  changes: {
    noteId: string;
    operation: 'create' | 'update' | 'delete';
    /** Server version of the note */
    version: number;
    /** Global sequence number for cursor-based pagination */
    serverSequence: number;
    /** Full note data (omitted for delete operations) */
    note?: unknown;
    /** ISO 8601 timestamp of the change */
    timestamp: string;
  }[];

  /** Whether there are more changes available */
  hasMore: boolean;
  /** Latest sequence number on the server */
  latestSequence: number;
  /** Server time as ISO 8601 string (for clock drift detection) */
  serverTime: string;
}

// =============================================================================
// Conflict Types
// =============================================================================

/**
 * A detected sync conflict between local and remote versions.
 *
 * @since 1.0.0
 */
export interface SyncConflict {
  /** ID of the conflicting note */
  noteId: string;
  /** Local version of the note */
  localNote: unknown;
  /** Remote version of the note */
  remoteNote: unknown;
  /** Local version number */
  localVersion: number;
  /** Remote version number */
  remoteVersion: number;
  /** When the conflict was detected (ms since epoch) */
  detectedAt: number;
  /**
   * Type of conflict:
   * - 'edit': Both sides edited the note
   * - 'delete-edit': Local deleted, remote edited
   * - 'edit-delete': Local edited, remote deleted
   */
  type: 'edit' | 'delete-edit' | 'edit-delete';
}

/**
 * How to resolve a sync conflict.
 *
 * @since 1.0.0
 */
export type ConflictResolution =
  | { type: 'keep_local' }
  | { type: 'keep_remote' }
  | { type: 'keep_both' };

// =============================================================================
// Sync Status Types
// =============================================================================

/**
 * Possible states of the sync engine.
 *
 * @since 1.0.0
 */
export type SyncState = 'idle' | 'syncing' | 'offline' | 'error' | 'disabled';

/**
 * Current status of the sync engine.
 *
 * @since 1.0.0
 */
export interface SyncStatus {
  /** Current sync state */
  state: SyncState;
  /** Timestamp of last successful sync (ms since epoch) */
  lastSyncAt?: number;
  /** Number of local changes waiting to be pushed */
  pendingChanges: number;
  /** Number of unresolved conflicts */
  conflictCount: number;
  /** Error message if state is 'error' */
  error?: string;
  /** Timestamp of next scheduled sync (ms since epoch) */
  nextSyncAt?: number;
}

/**
 * Result of a sync operation.
 *
 * @since 1.0.0
 */
export interface SyncResult {
  /** Number of changes pushed to server */
  pushed: number;
  /** Number of changes pulled from server */
  pulled: number;
  /** Number of conflicts detected */
  conflicts: number;
  /** Error messages from failed operations */
  errors: string[];
}
