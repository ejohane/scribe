/**
 * Internal sync-specific types for engine-sync package.
 *
 * NOTE: SyncStatus and SyncResult have been moved to @scribe/shared.
 * This file is kept for backward compatibility but new types should
 * be added to @scribe/shared/src/sync-types.ts instead.
 *
 * @deprecated Import from '@scribe/shared' or from the package index instead.
 */

// Re-export for backward compatibility
export type { SyncStatus, SyncResult } from '@scribe/shared';
