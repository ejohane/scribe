/**
 * SQLite database wrapper for sync state persistence.
 *
 * This module provides a type-safe interface for storing:
 * - Per-note sync state (local/server versions, status)
 * - Change queue (pending changes to push)
 * - Conflict storage (unresolved sync conflicts)
 * - Device registration and sync metadata
 *
 * Database location: {vault}/derived/sync.sqlite3
 *
 * @module sync-database
 * @since 1.0.0
 */

import Database from 'better-sqlite3';
import type { SyncConflict } from '@scribe/shared';

/**
 * Sync state for a single note.
 */
export interface NoteSyncState {
  noteId: string;
  localVersion: number;
  serverVersion: number | null;
  contentHash: string;
  lastSyncedAt: number | null;
  status: 'synced' | 'pending' | 'conflict';
}

/**
 * Queued change waiting to be pushed to the server.
 */
export interface QueuedChange {
  id: number;
  noteId: string;
  operation: 'create' | 'update' | 'delete';
  version: number;
  payload: string | null; // JSON serialized note
  queuedAt: number;
  attempts: number;
  lastAttemptAt: number | null;
  error: string | null;
}

/**
 * Configuration for the sync database.
 */
export interface SyncDatabaseConfig {
  /** Path to the SQLite database file */
  dbPath: string;
}

/**
 * SQLite database wrapper for sync state persistence.
 *
 * Provides methods for managing:
 * - Device identity
 * - Per-note sync state
 * - Change queue for pending pushes
 * - Conflict storage
 * - Sync metadata (last sequence number, etc.)
 *
 * @example
 * ```typescript
 * const db = new SyncDatabase({ dbPath: '/vault/derived/sync.sqlite3' });
 *
 * // Set device ID
 * db.setDeviceId('device-uuid');
 *
 * // Track note sync state
 * db.setSyncState('note-1', {
 *   localVersion: 1,
 *   serverVersion: null,
 *   contentHash: 'abc123',
 *   lastSyncedAt: null,
 *   status: 'pending',
 * });
 *
 * // Queue a change
 * db.queueChange('note-1', 'create', 1, { title: 'My Note' });
 *
 * // Clean up
 * db.close();
 * ```
 */
export class SyncDatabase {
  private db: Database.Database;

  constructor(config: SyncDatabaseConfig) {
    this.db = new Database(config.dbPath);
    this.initialize();
  }

  /**
   * Initialize the database schema.
   */
  private initialize(): void {
    // Enable WAL mode for better concurrent access
    this.db.pragma('journal_mode = WAL');

    // Create tables
    this.db.exec(`
      -- Device registration
      CREATE TABLE IF NOT EXISTS device (
        id TEXT PRIMARY KEY,
        name TEXT,
        createdAt INTEGER NOT NULL,
        lastActiveAt INTEGER NOT NULL
      );

      -- Per-note sync state
      CREATE TABLE IF NOT EXISTS sync_state (
        noteId TEXT PRIMARY KEY,
        localVersion INTEGER NOT NULL,
        serverVersion INTEGER,
        contentHash TEXT NOT NULL,
        lastSyncedAt INTEGER,
        status TEXT NOT NULL DEFAULT 'pending'
      );

      -- Change queue (pending push)
      CREATE TABLE IF NOT EXISTS change_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        noteId TEXT NOT NULL,
        operation TEXT NOT NULL,
        version INTEGER NOT NULL,
        payload TEXT,
        queuedAt INTEGER NOT NULL,
        attempts INTEGER NOT NULL DEFAULT 0,
        lastAttemptAt INTEGER,
        error TEXT
      );

      -- Conflict storage
      CREATE TABLE IF NOT EXISTS conflicts (
        noteId TEXT PRIMARY KEY,
        localNote TEXT NOT NULL,
        remoteNote TEXT NOT NULL,
        localVersion INTEGER NOT NULL,
        remoteVersion INTEGER NOT NULL,
        detectedAt INTEGER NOT NULL,
        type TEXT NOT NULL
      );

      -- Sync metadata
      CREATE TABLE IF NOT EXISTS sync_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      -- Indexes
      CREATE INDEX IF NOT EXISTS idx_change_queue_noteId ON change_queue(noteId);
      CREATE INDEX IF NOT EXISTS idx_change_queue_queuedAt ON change_queue(queuedAt);
    `);
  }

  // ===========================================================================
  // Device Methods
  // ===========================================================================

  /**
   * Get the stored device ID.
   * @returns The device ID or null if not set
   */
  getDeviceId(): string | null {
    const row = this.db.prepare('SELECT value FROM sync_metadata WHERE key = ?').get('deviceId');
    return row ? (row as { value: string }).value : null;
  }

  /**
   * Set the device ID.
   * @param deviceId - The unique device identifier
   */
  setDeviceId(deviceId: string): void {
    this.db
      .prepare('INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)')
      .run('deviceId', deviceId);
  }

  // ===========================================================================
  // Sync State Methods
  // ===========================================================================

  /**
   * Get the sync state for a specific note.
   * @param noteId - The note ID
   * @returns The sync state or null if not found
   */
  getSyncState(noteId: string): NoteSyncState | null {
    const row = this.db.prepare('SELECT * FROM sync_state WHERE noteId = ?').get(noteId);
    return (row as NoteSyncState) ?? null;
  }

  /**
   * Set or update the sync state for a note.
   * @param noteId - The note ID
   * @param state - The sync state to store
   */
  setSyncState(noteId: string, state: Omit<NoteSyncState, 'noteId'>): void {
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO sync_state (noteId, localVersion, serverVersion, contentHash, lastSyncedAt, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        noteId,
        state.localVersion,
        state.serverVersion,
        state.contentHash,
        state.lastSyncedAt,
        state.status
      );
  }

  /**
   * Get all notes with pending sync status.
   * @returns Array of pending sync states
   */
  getAllPendingStates(): NoteSyncState[] {
    return this.db
      .prepare('SELECT * FROM sync_state WHERE status = ?')
      .all('pending') as NoteSyncState[];
  }

  /**
   * Delete the sync state for a note.
   * @param noteId - The note ID
   */
  deleteSyncState(noteId: string): void {
    this.db.prepare('DELETE FROM sync_state WHERE noteId = ?').run(noteId);
  }

  // ===========================================================================
  // Change Queue Methods
  // ===========================================================================

  /**
   * Queue a change for pushing to the server.
   * @param noteId - The note ID
   * @param operation - The type of operation
   * @param version - The note version
   * @param payload - The note data (will be JSON serialized)
   * @returns The ID of the queued change
   */
  queueChange(
    noteId: string,
    operation: 'create' | 'update' | 'delete',
    version: number,
    payload: unknown
  ): number {
    const result = this.db
      .prepare(
        `
      INSERT INTO change_queue (noteId, operation, version, payload, queuedAt)
      VALUES (?, ?, ?, ?, ?)
    `
      )
      .run(noteId, operation, version, payload ? JSON.stringify(payload) : null, Date.now());
    return result.lastInsertRowid as number;
  }

  /**
   * Get queued changes, ordered by queue time.
   * @param limit - Maximum number of changes to return
   * @returns Array of queued changes
   */
  getQueuedChanges(limit: number = 100): QueuedChange[] {
    return this.db
      .prepare(
        `
      SELECT * FROM change_queue ORDER BY queuedAt ASC LIMIT ?
    `
      )
      .all(limit) as QueuedChange[];
  }

  /**
   * Remove a change from the queue.
   * @param id - The change ID
   */
  removeQueuedChange(id: number): void {
    this.db.prepare('DELETE FROM change_queue WHERE id = ?').run(id);
  }

  /**
   * Mark a change as attempted, incrementing the attempt counter.
   * @param id - The change ID
   * @param error - Optional error message from the attempt
   */
  markChangeAttempted(id: number, error?: string): void {
    this.db
      .prepare(
        `
      UPDATE change_queue SET attempts = attempts + 1, lastAttemptAt = ?, error = ?
      WHERE id = ?
    `
      )
      .run(Date.now(), error || null, id);
  }

  /**
   * Get the total number of changes in the queue.
   * @returns The queue size
   */
  getQueueSize(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM change_queue').get();
    return (row as { count: number }).count;
  }

  /**
   * Remove all queued changes for a specific note.
   * @param noteId - The note ID
   */
  removeQueuedChangesForNote(noteId: string): void {
    this.db.prepare('DELETE FROM change_queue WHERE noteId = ?').run(noteId);
  }

  // ===========================================================================
  // Conflict Methods
  // ===========================================================================

  /**
   * Store a sync conflict.
   * @param conflict - The conflict to store
   */
  storeConflict(conflict: SyncConflict): void {
    this.db
      .prepare(
        `
      INSERT OR REPLACE INTO conflicts (noteId, localNote, remoteNote, localVersion, remoteVersion, detectedAt, type)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(
        conflict.noteId,
        JSON.stringify(conflict.localNote),
        JSON.stringify(conflict.remoteNote),
        conflict.localVersion,
        conflict.remoteVersion,
        conflict.detectedAt,
        conflict.type
      );
  }

  /**
   * Get a stored conflict by note ID.
   * @param noteId - The note ID
   * @returns The conflict or null if not found
   */
  getConflict(noteId: string): SyncConflict | null {
    const row = this.db.prepare('SELECT * FROM conflicts WHERE noteId = ?').get(noteId);
    if (!row) return null;
    const r = row as {
      noteId: string;
      localNote: string;
      remoteNote: string;
      localVersion: number;
      remoteVersion: number;
      detectedAt: number;
      type: string;
    };
    return {
      noteId: r.noteId,
      localNote: JSON.parse(r.localNote),
      remoteNote: JSON.parse(r.remoteNote),
      localVersion: r.localVersion,
      remoteVersion: r.remoteVersion,
      detectedAt: r.detectedAt,
      type: r.type as 'edit' | 'delete-edit' | 'edit-delete',
    };
  }

  /**
   * Get all stored conflicts.
   * @returns Array of all conflicts
   */
  getAllConflicts(): SyncConflict[] {
    const rows = this.db.prepare('SELECT * FROM conflicts').all();
    return rows.map((row) => {
      const r = row as {
        noteId: string;
        localNote: string;
        remoteNote: string;
        localVersion: number;
        remoteVersion: number;
        detectedAt: number;
        type: string;
      };
      return {
        noteId: r.noteId,
        localNote: JSON.parse(r.localNote),
        remoteNote: JSON.parse(r.remoteNote),
        localVersion: r.localVersion,
        remoteVersion: r.remoteVersion,
        detectedAt: r.detectedAt,
        type: r.type as 'edit' | 'delete-edit' | 'edit-delete',
      };
    });
  }

  /**
   * Remove a stored conflict.
   * @param noteId - The note ID
   */
  removeConflict(noteId: string): void {
    this.db.prepare('DELETE FROM conflicts WHERE noteId = ?').run(noteId);
  }

  /**
   * Get the total number of conflicts.
   * @returns The conflict count
   */
  getConflictCount(): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM conflicts').get();
    return (row as { count: number }).count;
  }

  // ===========================================================================
  // Metadata Methods
  // ===========================================================================

  /**
   * Get the last sync sequence number.
   * @returns The sequence number, or 0 if not set
   */
  getLastSyncSequence(): number {
    const row = this.db
      .prepare('SELECT value FROM sync_metadata WHERE key = ?')
      .get('lastSyncSequence');
    return row ? parseInt((row as { value: string }).value, 10) : 0;
  }

  /**
   * Set the last sync sequence number.
   * @param sequence - The sequence number
   */
  setLastSyncSequence(sequence: number): void {
    this.db
      .prepare('INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)')
      .run('lastSyncSequence', sequence.toString());
  }

  /**
   * Get a metadata value by key.
   * @param key - The metadata key
   * @returns The value or null if not found
   */
  getMetadata(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM sync_metadata WHERE key = ?').get(key);
    return row ? (row as { value: string }).value : null;
  }

  /**
   * Set a metadata value.
   * @param key - The metadata key
   * @param value - The value to store
   */
  setMetadata(key: string, value: string): void {
    this.db
      .prepare('INSERT OR REPLACE INTO sync_metadata (key, value) VALUES (?, ?)')
      .run(key, value);
  }

  // ===========================================================================
  // Cleanup Methods
  // ===========================================================================

  /**
   * Close the database connection.
   * Should be called when the sync engine is disposed.
   */
  close(): void {
    this.db.close();
  }
}
