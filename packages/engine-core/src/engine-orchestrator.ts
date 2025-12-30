/**
 * Engine Orchestrator
 *
 * Coordinates note operations across storage and sync subsystems.
 * Provides a unified API for save/delete operations that automatically
 * queues changes for sync when a SyncEngine is configured.
 *
 * @module engine-orchestrator
 * @since 1.1.0
 */

import type { Note, NoteId, BaseNote } from '@scribe/shared';
import type { SyncEngine } from '@scribe/engine-sync';

/**
 * Result of a save operation
 */
export interface SaveResult {
  /** The saved note */
  note: Note;
  /** Whether this was a new note (create) or an update */
  operation: 'create' | 'update';
}

/**
 * Storage interface for note persistence.
 * This abstraction allows the orchestrator to work with different storage backends.
 */
export interface NoteStorage {
  /**
   * Read a note by ID
   * @param id - Note ID to read
   * @returns The note, or undefined if not found
   */
  read(id: NoteId): Note | undefined;

  /**
   * Save a note (create or update)
   * @param note - Note to save
   */
  save(note: Note): Promise<void>;

  /**
   * Delete a note by ID
   * @param id - Note ID to delete
   */
  delete(id: NoteId): Promise<void>;
}

/**
 * Configuration for EngineOrchestrator
 */
export interface EngineOrchestratorConfig {
  /** Storage backend for note persistence */
  storage: NoteStorage;
  /** Optional SyncEngine for multi-device sync */
  syncEngine?: SyncEngine;
}

/**
 * EngineOrchestrator coordinates note operations across storage and sync.
 *
 * This class provides a unified API for saving and deleting notes that:
 * 1. Persists changes to the storage backend
 * 2. Queues changes for sync when a SyncEngine is configured
 *
 * The sync integration is non-blocking - changes are queued but the actual
 * network sync happens asynchronously via SyncEngine's polling mechanism.
 *
 * ## Usage
 *
 * ```typescript
 * const orchestrator = new EngineOrchestrator({
 *   storage: vault,
 *   syncEngine: syncEngine, // optional
 * });
 *
 * // Save a note (automatically queued for sync)
 * const result = await orchestrator.saveNote(note);
 *
 * // Delete a note (automatically queued for sync)
 * await orchestrator.deleteNote(noteId);
 *
 * // Set sync engine later if not available at construction
 * orchestrator.setSyncEngine(syncEngine);
 * ```
 *
 * @since 1.1.0
 */
export class EngineOrchestrator {
  private readonly storage: NoteStorage;
  private syncEngine?: SyncEngine;

  /**
   * Create a new EngineOrchestrator.
   *
   * @param config - Configuration including storage and optional sync engine
   */
  constructor(config: EngineOrchestratorConfig) {
    this.storage = config.storage;
    this.syncEngine = config.syncEngine;
  }

  /**
   * Save a note to storage and queue for sync.
   *
   * This method:
   * 1. Determines if this is a create or update operation
   * 2. Adds sync metadata if a sync engine is configured
   * 3. Saves the note to storage
   * 4. Queues the change for sync (non-blocking)
   *
   * @param note - The note to save
   * @returns Result containing the saved note and operation type
   *
   * @example
   * ```typescript
   * const result = await orchestrator.saveNote(note);
   * console.log(`${result.operation}: ${result.note.id}`);
   * ```
   */
  async saveNote(note: Note): Promise<SaveResult> {
    // Check if this is a create or update
    const existingNote = this.storage.read(note.id);
    const operation = existingNote ? 'update' : 'create';

    // Add sync metadata if sync is enabled
    let noteToSave = note;
    if (this.syncEngine) {
      noteToSave = this.syncEngine.addSyncMetadata(note) as Note;
    }

    // Save to storage
    await this.storage.save(noteToSave);

    // Queue for sync if enabled (non-blocking)
    if (this.syncEngine) {
      this.syncEngine.queueChange(noteToSave as BaseNote, operation);
    }

    return {
      note: noteToSave,
      operation,
    };
  }

  /**
   * Delete a note from storage and queue deletion for sync.
   *
   * This method:
   * 1. Deletes the note from storage
   * 2. Queues the deletion for sync (non-blocking)
   *
   * @param noteId - The ID of the note to delete
   *
   * @example
   * ```typescript
   * await orchestrator.deleteNote(createNoteId('abc-123'));
   * ```
   */
  async deleteNote(noteId: NoteId): Promise<void> {
    // Delete from storage
    await this.storage.delete(noteId);

    // Queue deletion for sync if enabled (non-blocking)
    if (this.syncEngine) {
      this.syncEngine.queueDelete(noteId);
    }
  }

  /**
   * Set or update the sync engine.
   *
   * This is useful when the sync engine is initialized after the orchestrator,
   * or when sync needs to be enabled/disabled at runtime.
   *
   * @param syncEngine - The sync engine to use, or null to disable sync
   *
   * @example
   * ```typescript
   * // Enable sync after initialization
   * orchestrator.setSyncEngine(syncEngine);
   *
   * // Disable sync
   * orchestrator.setSyncEngine(null);
   * ```
   */
  setSyncEngine(syncEngine: SyncEngine | null): void {
    this.syncEngine = syncEngine ?? undefined;
  }

  /**
   * Get the current sync engine.
   *
   * @returns The current sync engine, or undefined if not configured
   */
  getSyncEngine(): SyncEngine | undefined {
    return this.syncEngine;
  }

  /**
   * Check if sync is enabled.
   *
   * @returns true if a sync engine is configured
   */
  isSyncEnabled(): boolean {
    return this.syncEngine !== undefined;
  }
}
