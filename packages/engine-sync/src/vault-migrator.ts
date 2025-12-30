/**
 * Vault migration for sync initialization.
 *
 * When a user enables sync for the first time on an existing vault,
 * all existing notes need to be prepared for synchronization:
 * 1. Add SyncMetadata to each note
 * 2. Compute initial content hashes
 * 3. Queue all notes for initial upload to server
 *
 * @module vault-migrator
 * @since 1.1.0
 */

import type { BaseNote } from '@scribe/shared';
import type { SyncDatabase } from './sync-database.js';
import { computeContentHash } from './content-hash.js';

/**
 * Progress information during vault migration.
 */
export interface MigrationProgress {
  /** Total number of notes to migrate */
  total: number;
  /** Number of notes completed */
  completed: number;
  /** Current note being processed */
  currentNote?: string;
  /** Current phase of migration */
  phase: 'scanning' | 'migrating' | 'queueing' | 'complete';
}

/**
 * Result of vault migration.
 */
export interface MigrationResult {
  /** Number of notes successfully migrated */
  migrated: number;
  /** Error messages for failed notes */
  errors: string[];
}

/**
 * Configuration for VaultMigrator.
 */
export interface VaultMigratorConfig {
  /** Sync database instance */
  database: SyncDatabase;
  /** Device ID for sync metadata */
  deviceId: string;
  /** Callback to list all note IDs in the vault */
  listNoteIds: () => Promise<string[]>;
  /** Callback to read a note from the vault */
  readNote: (noteId: string) => Promise<BaseNote | null>;
  /** Callback to save a note to the vault (with sync metadata) */
  saveNote: (note: BaseNote) => Promise<void>;
  /** Progress callback */
  onProgress?: (progress: MigrationProgress) => void;
}

/**
 * Migrates an existing vault for sync by adding SyncMetadata to all notes.
 *
 * When sync is first enabled on a vault, this class handles the one-time
 * migration of all existing notes to be sync-ready. It:
 * - Adds SyncMetadata (version, contentHash, deviceId) to each note
 * - Records the sync state in the database
 * - Queues all notes for initial push to the server
 *
 * @example
 * ```typescript
 * const migrator = new VaultMigrator({
 *   database: syncDb,
 *   deviceId: 'device-uuid',
 *   listNoteIds: async () => engine.listNoteIds(),
 *   readNote: async (id) => engine.getNote(id),
 *   saveNote: async (note) => engine.saveNote(note),
 *   onProgress: (p) => console.log(`${p.completed}/${p.total}`),
 * });
 *
 * if (await migrator.needsMigration()) {
 *   const result = await migrator.migrateVault();
 *   console.log(`Migrated ${result.migrated} notes`);
 * }
 * ```
 *
 * @since 1.1.0
 */
export class VaultMigrator {
  private readonly config: VaultMigratorConfig;

  constructor(config: VaultMigratorConfig) {
    this.config = config;
  }

  /**
   * Migrate all existing notes to be sync-ready.
   * Should be called once when sync is first enabled.
   *
   * @returns Migration result with count and any errors
   */
  async migrateVault(): Promise<MigrationResult> {
    const errors: string[] = [];

    // Phase 1: Scan all notes
    this.reportProgress({ total: 0, completed: 0, phase: 'scanning' });
    const noteIds = await this.config.listNoteIds();
    const total = noteIds.length;

    if (total === 0) {
      this.reportProgress({ total: 0, completed: 0, phase: 'complete' });
      return { migrated: 0, errors: [] };
    }

    // Phase 2: Migrate each note
    let completed = 0;
    for (const noteId of noteIds) {
      try {
        this.reportProgress({
          total,
          completed,
          currentNote: noteId,
          phase: 'migrating',
        });

        await this.migrateNote(noteId);
        completed++;
      } catch (error) {
        const errorMsg = `Failed to migrate ${noteId}: ${error instanceof Error ? error.message : error}`;
        errors.push(errorMsg);
        console.error(errorMsg);
      }
    }

    // Phase 3: Queue all for initial push
    this.reportProgress({ total, completed, phase: 'queueing' });

    for (const noteId of noteIds) {
      try {
        const note = await this.config.readNote(noteId);
        if (note) {
          this.config.database.queueChange(noteId, 'create', note.sync?.version ?? 1, note);
        }
      } catch (error) {
        // Already migrated, just queuing for push failed
        console.error(`Failed to queue ${noteId} for push:`, error);
      }
    }

    this.reportProgress({ total, completed: total, phase: 'complete' });

    return { migrated: completed, errors };
  }

  /**
   * Migrate a single note by adding sync metadata.
   *
   * @param noteId - The ID of the note to migrate
   */
  private async migrateNote(noteId: string): Promise<void> {
    const note = await this.config.readNote(noteId);
    if (!note) {
      return; // Note doesn't exist, skip
    }

    // Skip if already has sync metadata
    if (note.sync?.version) {
      return;
    }

    // Add SyncMetadata
    const contentHash = computeContentHash(note);
    const migratedNote: BaseNote = {
      ...note,
      sync: {
        version: 1, // Initial version
        contentHash,
        serverVersion: undefined, // Never synced
        syncedAt: undefined, // Never synced
        deviceId: this.config.deviceId,
      },
    };

    // Save back to vault
    await this.config.saveNote(migratedNote);

    // Record in sync state table
    this.config.database.setSyncState(noteId, {
      localVersion: 1,
      serverVersion: null,
      contentHash,
      lastSyncedAt: null,
      status: 'pending',
    });
  }

  /**
   * Check if the vault needs migration.
   * Returns true if there are notes without sync metadata.
   *
   * @returns true if migration is needed
   */
  async needsMigration(): Promise<boolean> {
    const noteIds = await this.config.listNoteIds();

    for (const noteId of noteIds) {
      const note = await this.config.readNote(noteId);
      if (note && !note.sync?.version) {
        return true;
      }
    }

    return false;
  }

  /**
   * Report progress to the callback if provided.
   */
  private reportProgress(progress: MigrationProgress): void {
    this.config.onProgress?.(progress);
  }
}
