/**
 * @scribe/engine-sync
 *
 * Sync engine for Scribe, enabling multi-device synchronization with offline-first support.
 */

// Re-export shared sync types for convenience
export type {
  SyncConfig,
  DefaultSyncConfig,
  SyncStatus,
  SyncResult,
  SyncMetadata,
  SyncConflict,
  ConflictResolution,
  SyncState,
} from '@scribe/shared';
export {
  DEFAULT_SYNC_CONFIG,
  SYNC_CONFIG_PATH,
  MIN_SYNC_INTERVAL_MS,
  MAX_SYNC_INTERVAL_MS,
} from '@scribe/shared';

// Content hash utilities
export { computeContentHash, hasContentChanged, matchesHash } from './content-hash.js';

// Sync database
export { SyncDatabase } from './sync-database.js';
export type { NoteSyncState, QueuedChange, SyncDatabaseConfig } from './sync-database.js';

// Network monitor
export type { INetworkMonitor } from './network-monitor.js';
export { DisabledNetworkMonitor, SimpleNetworkMonitor } from './network-monitor.js';

// Change tracker
export { ChangeTracker } from './change-tracker.js';
export type { ChangeTrackerConfig, ChangeType } from './change-tracker.js';

// Sync transport (HTTP client)
export { SyncTransport } from './sync-transport.js';
export type { SyncTransportConfig, RetryConfig, ServerStatusResponse } from './sync-transport.js';

// Conflict resolution
export { ConflictResolver } from './conflict-resolver.js';
export type { ConflictResolverConfig, ResolvedConflict } from './conflict-resolver.js';

// Sync coordinator
export { SyncCoordinator } from './sync-coordinator.js';
export type { SyncCoordinatorConfig, SyncPhase, SyncProgress } from './sync-coordinator.js';

// Main SyncEngine
export { SyncEngine, createSyncEngine } from './sync-engine.js';
export type { SyncEngineConfig } from './sync-engine.js';

// Sync config loading/saving
export {
  loadSyncConfig,
  isSyncEnabled,
  saveSyncConfig,
  createDefaultSyncConfig,
} from './sync-config.js';
export type { LoadSyncConfigResult } from './sync-config.js';

// Vault migration
export { VaultMigrator } from './vault-migrator.js';
export type { VaultMigratorConfig, MigrationProgress, MigrationResult } from './vault-migrator.js';
