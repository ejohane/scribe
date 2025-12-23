/**
 * Engine Orchestrator
 *
 * Coordinates the 4 core systems (vault, graphEngine, searchEngine, taskIndex)
 * for note operations. Encapsulates the coordination logic used by IPC handlers
 * for write operations.
 *
 * ## Responsibilities
 *
 * - Coordinates save operations across all engines
 * - Coordinates delete operations across all engines
 * - Provides coordinated initialization and shutdown
 * - Emits task change events when tasks are modified
 *
 * ## Relationship to IPC Handlers
 *
 * This class provides the same coordination logic that handlers use via the
 * `withEngines` pattern. The handlers currently perform coordination inline
 * for explicitness. This class can be used as an alternative when you need:
 *
 * - Centralized coordination logic (reduces duplication)
 * - Testable coordination separate from IPC plumbing
 * - A single object to inject into services
 *
 * See handlers/notesHandlers.ts for documentation on the two handler patterns:
 * - Pattern A: Direct vault access (read-only operations)
 * - Pattern B: Coordinated engine access (write operations)
 *
 * ## Usage
 *
 * ```typescript
 * const orchestrator = new EngineOrchestrator({
 *   vault,
 *   graphEngine,
 *   searchEngine,
 *   taskIndex,
 *   onTasksChanged: (changes) => mainWindow.webContents.send('tasks:changed', changes),
 * });
 *
 * // Save a note (coordinates all engines)
 * await orchestrator.saveNote(note);
 *
 * // Delete a note (coordinates all engines)
 * await orchestrator.deleteNote(noteId);
 * ```
 *
 * @module EngineOrchestrator
 */

import type { Note, NoteId, TaskChangeEvent } from '@scribe/shared';
import type { FileSystemVault } from '@scribe/storage-fs';
import type { GraphEngine } from '@scribe/engine-graph';
import type { SearchEngine } from '@scribe/engine-search';
import type { TaskIndex } from '@scribe/engine-core/node';

/**
 * Configuration options for EngineOrchestrator
 */
export interface EngineOrchestratorConfig {
  /** Vault for note storage */
  vault: FileSystemVault;
  /** Graph engine for link/backlink tracking */
  graphEngine: GraphEngine;
  /** Search engine for full-text search */
  searchEngine: SearchEngine;
  /** Task index for task management */
  taskIndex: TaskIndex;
  /** Optional callback when tasks change */
  onTasksChanged?: (changes: TaskChangeEvent[]) => void;
}

/**
 * Result of a save operation
 */
export interface SaveResult {
  success: true;
  taskChanges: TaskChangeEvent[];
}

/**
 * Result of a delete operation
 */
export interface DeleteResult {
  success: true;
  taskChanges: TaskChangeEvent[];
}

/**
 * EngineOrchestrator coordinates the 4 core systems for note operations.
 *
 * This class centralizes the coordination logic that ensures all engines
 * stay in sync when notes are created, updated, or deleted.
 *
 * ## Engine Responsibilities
 *
 * - **Vault**: Persistence layer for notes (filesystem)
 * - **GraphEngine**: Maintains note relationships (links, backlinks, tags)
 * - **SearchEngine**: Full-text search index
 * - **TaskIndex**: Task extraction and tracking
 *
 * ## Coordination Pattern
 *
 * For save operations:
 * 1. Save to vault (source of truth)
 * 2. Update graph engine (links, backlinks, tags)
 * 3. Update search engine (full-text index)
 * 4. Update task index (task extraction)
 * 5. Emit task change events if any
 *
 * For delete operations:
 * 1. Delete from vault
 * 2. Remove from graph engine
 * 3. Remove from search engine
 * 4. Remove from task index
 * 5. Emit task change events if any
 */
export class EngineOrchestrator {
  private readonly vault: FileSystemVault;
  private readonly graphEngine: GraphEngine;
  private readonly searchEngine: SearchEngine;
  private readonly taskIndex: TaskIndex;
  private readonly onTasksChanged?: (changes: TaskChangeEvent[]) => void;

  /**
   * Create a new EngineOrchestrator.
   *
   * @param config - Configuration with all required engines and optional callbacks
   */
  constructor(config: EngineOrchestratorConfig) {
    this.vault = config.vault;
    this.graphEngine = config.graphEngine;
    this.searchEngine = config.searchEngine;
    this.taskIndex = config.taskIndex;
    this.onTasksChanged = config.onTasksChanged;
  }

  /**
   * Save a note and update all engines.
   *
   * Coordinates the save operation across all 4 systems:
   * 1. Saves to vault (disk persistence)
   * 2. Updates graph engine (links, backlinks, tags, mentions)
   * 3. Updates search engine (full-text index)
   * 4. Updates task index (task extraction)
   *
   * If tasks change, the onTasksChanged callback is invoked.
   *
   * @param note - The note to save
   * @returns SaveResult with success status and task changes
   * @throws Error if vault save fails
   */
  async saveNote(note: Note): Promise<SaveResult> {
    // 1. Save to vault (source of truth)
    await this.vault.save(note);

    // 2. Update graph with new note data
    this.graphEngine.addNote(note);

    // 3. Update search index
    this.searchEngine.indexNote(note);

    // 4. Re-index tasks for this note
    const taskChanges = this.taskIndex.indexNote(note);

    // 5. Emit task changes if any
    if (taskChanges.length > 0 && this.onTasksChanged) {
      this.onTasksChanged(taskChanges);
    }

    return { success: true, taskChanges };
  }

  /**
   * Delete a note and remove from all engines.
   *
   * Coordinates the delete operation across all 4 systems:
   * 1. Deletes from vault (disk)
   * 2. Removes from graph engine (clears links, backlinks)
   * 3. Removes from search engine (removes from index)
   * 4. Removes from task index (removes tasks)
   *
   * If tasks are removed, the onTasksChanged callback is invoked.
   *
   * @param noteId - The ID of the note to delete
   * @returns DeleteResult with success status and task changes
   * @throws Error if vault delete fails
   */
  async deleteNote(noteId: NoteId): Promise<DeleteResult> {
    // 1. Delete from vault
    await this.vault.delete(noteId);

    // 2. Remove from graph
    this.graphEngine.removeNote(noteId);

    // 3. Remove from search
    this.searchEngine.removeNote(noteId);

    // 4. Remove tasks for this note
    const taskChanges = this.taskIndex.removeNote(noteId);

    // 5. Emit task changes if any
    if (taskChanges.length > 0 && this.onTasksChanged) {
      this.onTasksChanged(taskChanges);
    }

    return { success: true, taskChanges };
  }

  /**
   * Initialize all engines with existing notes from the vault.
   *
   * Call this after vault.load() to populate all engines with
   * the loaded notes.
   *
   * ## Initialization Order
   *
   * 1. Get all notes from vault (already loaded)
   * 2. Index each note in graph engine
   * 3. Index each note in search engine
   * 4. Index each note in task index
   *
   * Note: This does NOT load the vault - call vault.load() first.
   *
   * @returns Number of notes indexed
   */
  async initialize(): Promise<number> {
    const notes = this.vault.list();

    for (const note of notes) {
      // Index in graph
      this.graphEngine.addNote(note);

      // Index in search
      this.searchEngine.indexNote(note);

      // Index tasks (ignore change events during init)
      this.taskIndex.indexNote(note);
    }

    return notes.length;
  }

  /**
   * Gracefully shutdown all engines.
   *
   * Ensures all pending operations are complete:
   * - Flushes task index to persist any pending changes
   * - Clears graph engine
   * - Clears search engine
   *
   * Call this before application exit.
   */
  async shutdown(): Promise<void> {
    // Flush task index to persist any pending changes
    await this.taskIndex.flush();

    // Clear in-memory indexes
    this.graphEngine.clear();
    this.searchEngine.clear();
  }

  /**
   * Get the underlying vault instance.
   *
   * Useful for operations that don't require coordination,
   * like listing notes or reading a single note.
   */
  getVault(): FileSystemVault {
    return this.vault;
  }

  /**
   * Get the underlying graph engine instance.
   *
   * Useful for graph-specific queries like backlinks, neighbors, etc.
   */
  getGraphEngine(): GraphEngine {
    return this.graphEngine;
  }

  /**
   * Get the underlying search engine instance.
   *
   * Useful for search operations.
   */
  getSearchEngine(): SearchEngine {
    return this.searchEngine;
  }

  /**
   * Get the underlying task index instance.
   *
   * Useful for task-specific queries and operations.
   */
  getTaskIndex(): TaskIndex {
    return this.taskIndex;
  }
}
