/**
 * TaskIndex: In-memory task index with pluggable persistence
 *
 * Manages tasks extracted from notes, providing:
 * - Reconciliation rules (nodeKey first, textHash fallback)
 * - Priority assignment for new tasks
 * - completedAt handling (set when checked, clear when unchecked)
 * - Pagination support with cursor-based paging
 * - Debounced persistence through TaskPersistence interface
 */

import type { Note, NoteId, Task, TaskFilter, TaskChangeEvent } from '@scribe/shared';
import { logger as rootLogger } from '@scribe/shared';
import { type TaskPersistence, JsonlTaskPersistence } from './task-persistence.js';
import { type TaskReconciler, DefaultTaskReconciler } from './task-reconciler.js';
import { TaskQuery, fromTaskFilter } from './task-query.js';

/** Module-level logger for TaskIndex */
const logger = rootLogger.child('TaskIndex');

// ============================================================================
// Pure Helper Functions for Task Reconciliation
// ============================================================================
// These functions are pure and testable, extracted from indexNote() for clarity.
// ============================================================================

/**
 * Build a map of existing tasks for a note from the task store.
 *
 * @param tasks - The main task storage map
 * @param taskIds - Set of task IDs for the note
 * @returns Map of taskId -> Task for existing tasks
 */
export function buildExistingTaskMap(
  tasks: Map<string, Task>,
  taskIds: Set<string>
): Map<string, Task> {
  const existingTasks = new Map<string, Task>();
  for (const taskId of taskIds) {
    const task = tasks.get(taskId);
    if (task) {
      existingTasks.set(taskId, task);
    }
  }
  return existingTasks;
}

/**
 * Find the old task entry that matches a task being updated.
 *
 * When a task's ID changes (due to nodeKey or textHash change), we need to find
 * the old entry to remove it from the index. This function searches by matching
 * nodeKey or textHash.
 *
 * @param task - The updated task with potentially new ID
 * @param existingTasks - Map of existing tasks for the note
 * @returns The old task ID if found and different from the new ID, undefined otherwise
 */
export function findOldTaskId(task: Task, existingTasks: Map<string, Task>): string | undefined {
  // If the task ID exists in existingTasks, no old ID to find
  if (existingTasks.has(task.id)) {
    return undefined;
  }

  // Search for a task with matching nodeKey or textHash
  for (const [oldId, oldTask] of existingTasks.entries()) {
    if (oldTask.nodeKey === task.nodeKey || oldTask.textHash === task.textHash) {
      if (oldId !== task.id) {
        return oldId;
      }
    }
  }

  return undefined;
}

/**
 * Compute the set of orphaned task IDs (tasks that exist in the index but not in the note).
 *
 * This is a simple set difference operation.
 *
 * @param existingIds - Set of task IDs currently in the index for this note
 * @param toRemove - Array of task IDs to remove (from reconciler)
 * @returns Array of task IDs that should be removed
 */
export function findOrphanedTaskIds(existingIds: Set<string>, toRemove: string[]): string[] {
  // The reconciler already computes toRemove, so we just return it
  // This function exists for semantic clarity and potential future extension
  return toRemove;
}

/** Default debounce delay for persistence in milliseconds */
const PERSIST_DEBOUNCE_MS = 5000;

/**
 * TaskIndex maintains an in-memory index of all tasks extracted from notes.
 *
 * The index is the source of truth for task metadata (priority, createdAt, completedAt)
 * while the completion state is derived from the source document's checkbox.
 *
 * Persistence is handled through the TaskPersistence interface, allowing different
 * storage backends (JSONL, SQLite, etc.) to be used interchangeably.
 */
export class TaskIndex {
  /** Main task storage by task ID */
  private tasks: Map<string, Task> = new Map();

  /** Secondary index: noteId -> Set of task IDs */
  private byNote: Map<NoteId, Set<string>> = new Map();

  /** Persistence layer for task storage */
  private persistence: TaskPersistence;

  /** Flag indicating unsaved changes */
  private dirty = false;

  /** Timeout handle for debounced persistence */
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Debounce delay in milliseconds */
  private debounceMs: number;

  /** Task reconciler for syncing notes with index */
  private reconciler: TaskReconciler;

  /**
   * Create a new TaskIndex with a TaskPersistence instance.
   *
   * @param persistence - TaskPersistence implementation for storage
   * @param debounceMs - Debounce delay for persistence (default 5000ms)
   * @param reconciler - Optional custom TaskReconciler implementation
   */
  constructor(persistence: TaskPersistence, debounceMs?: number, reconciler?: TaskReconciler);

  /**
   * Create a new TaskIndex with a derived path (legacy constructor).
   *
   * @param derivedPath - Path to the derived data directory
   * @param debounceMs - Debounce delay for persistence (default 5000ms)
   * @deprecated Use the constructor with TaskPersistence instead
   */
  constructor(derivedPath: string, debounceMs?: number);

  constructor(
    persistenceOrPath: TaskPersistence | string,
    debounceMs = PERSIST_DEBOUNCE_MS,
    reconciler?: TaskReconciler
  ) {
    if (typeof persistenceOrPath === 'string') {
      // Legacy constructor: create JsonlTaskPersistence from path
      this.persistence = JsonlTaskPersistence.fromDerivedPath(persistenceOrPath);
    } else {
      // New constructor: use provided persistence
      this.persistence = persistenceOrPath;
    }
    this.debounceMs = debounceMs;
    this.reconciler = reconciler ?? new DefaultTaskReconciler();
  }

  /**
   * Load tasks from persistence layer.
   *
   * Populates in-memory indexes from stored tasks.
   */
  async load(): Promise<void> {
    const tasks = await this.persistence.load();

    for (const task of tasks) {
      this.tasks.set(task.id, task);

      // Update byNote index
      let noteTaskIds = this.byNote.get(task.noteId);
      if (!noteTaskIds) {
        noteTaskIds = new Set();
        this.byNote.set(task.noteId, noteTaskIds);
      }
      noteTaskIds.add(task.id);
    }
  }

  /**
   * Persist tasks to storage.
   *
   * Uses the TaskPersistence implementation for actual storage.
   */
  async persist(): Promise<void> {
    if (!this.dirty) return;

    await this.persistence.save(Array.from(this.tasks.values()));

    this.dirty = false;
  }

  /**
   * Schedule a debounced persist.
   *
   * Calling this multiple times within the debounce window
   * will reset the timer.
   */
  schedulePersist(): void {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
    }

    this.persistTimeout = setTimeout(() => {
      this.persist().catch((err) => {
        logger.error('Persist failed', { error: err });
      });
      this.persistTimeout = null;
    }, this.debounceMs);
  }

  /**
   * Cancel any pending persist and immediately persist if dirty.
   *
   * Call this before shutdown.
   */
  async flush(): Promise<void> {
    if (this.persistTimeout) {
      clearTimeout(this.persistTimeout);
      this.persistTimeout = null;
    }
    await this.persist();
  }

  /**
   * Index a note, extracting tasks and reconciling with existing index.
   *
   * Reconciliation rules:
   * 1. New tasks (no nodeKey match): Add with new priority and createdAt
   * 2. Existing tasks (same nodeKey): Update fields, preserve priority/createdAt
   * 3. Moved tasks (same nodeKey, different lineIndex): Update lineIndex
   * 4. Missing tasks (in index but not in note): Remove from index
   * 5. Edited tasks (new nodeKey but same textHash): Treat as move
   *
   * @param note - The note to index
   * @returns Array of change events
   */
  indexNote(note: Note): TaskChangeEvent[] {
    const changes: TaskChangeEvent[] = [];
    const now = Date.now();

    // Build map of existing tasks for this note using helper
    const existingTaskIds = this.byNote.get(note.id) ?? new Set<string>();
    const existingTasks = buildExistingTaskMap(this.tasks, existingTaskIds);

    // Delegate reconciliation to the reconciler
    const maxPriority = this.getMaxPriority();
    const result = this.reconciler.reconcile(note, existingTasks, maxPriority, now);

    // Apply additions
    for (const task of result.toAdd) {
      this.addTaskToIndex(note.id, task);
      changes.push({ type: 'added', task });
    }

    // Apply updates (with ID change handling)
    for (const task of result.toUpdate) {
      this.applyTaskUpdate(note.id, task, existingTasks);
      changes.push({ type: 'updated', task });
    }

    // Apply removals
    for (const taskId of findOrphanedTaskIds(existingTaskIds, result.toRemove)) {
      this.removeTaskFromIndex(note.id, taskId);
      changes.push({ type: 'removed', taskId });
    }

    // Mark dirty and schedule persist if there were changes
    if (changes.length > 0) {
      this.dirty = true;
      this.schedulePersist();
    }

    return changes;
  }

  /**
   * Add a task to the main index and byNote secondary index.
   *
   * @param noteId - The note ID the task belongs to
   * @param task - The task to add
   */
  private addTaskToIndex(noteId: NoteId, task: Task): void {
    this.tasks.set(task.id, task);

    let noteTaskIds = this.byNote.get(noteId);
    if (!noteTaskIds) {
      noteTaskIds = new Set();
      this.byNote.set(noteId, noteTaskIds);
    }
    noteTaskIds.add(task.id);
  }

  /**
   * Apply a task update, handling potential ID changes.
   *
   * When a task's nodeKey or textHash changes, its ID changes too.
   * This method finds and removes the old entry before adding the new one.
   *
   * @param noteId - The note ID the task belongs to
   * @param task - The updated task
   * @param existingTasks - Map of existing tasks for finding old entries
   */
  private applyTaskUpdate(noteId: NoteId, task: Task, existingTasks: Map<string, Task>): void {
    // Check if this is an ID change using the helper
    const oldId = findOldTaskId(task, existingTasks);
    if (oldId) {
      // Remove old entry
      this.tasks.delete(oldId);
      const noteTaskIds = this.byNote.get(noteId);
      if (noteTaskIds) {
        noteTaskIds.delete(oldId);
        noteTaskIds.add(task.id);
      }
    }

    this.tasks.set(task.id, task);
  }

  /**
   * Remove a task from the main index and byNote secondary index.
   *
   * @param noteId - The note ID the task belongs to
   * @param taskId - The task ID to remove
   */
  private removeTaskFromIndex(noteId: NoteId, taskId: string): void {
    this.tasks.delete(taskId);
    const noteTaskIds = this.byNote.get(noteId);
    if (noteTaskIds) {
      noteTaskIds.delete(taskId);
    }
  }

  /**
   * Remove all tasks for a note.
   *
   * @param noteId - The note ID to remove tasks for
   * @returns Array of change events
   */
  removeNote(noteId: NoteId): TaskChangeEvent[] {
    const changes: TaskChangeEvent[] = [];

    const taskIds = this.byNote.get(noteId);
    if (!taskIds) return changes;

    for (const taskId of taskIds) {
      this.tasks.delete(taskId);
      changes.push({ type: 'removed', taskId });
    }

    this.byNote.delete(noteId);

    // Mark dirty and schedule persist if there were changes
    if (changes.length > 0) {
      this.dirty = true;
      this.schedulePersist();
    }

    return changes;
  }

  /**
   * Query tasks with filtering, sorting, and pagination.
   *
   * @param filter - Optional filter criteria
   * @returns Object with tasks array and optional nextCursor
   */
  list(filter?: TaskFilter): { tasks: Task[]; nextCursor?: string } {
    const result = fromTaskFilter(this.tasks.values(), filter).execute();
    return { tasks: result.tasks, nextCursor: result.nextCursor };
  }

  /**
   * Create a chainable query builder for tasks.
   *
   * This provides a fluent API for building complex queries.
   *
   * @example
   * ```typescript
   * const result = index.query()
   *   .byStatus('open')
   *   .byNote(noteId)
   *   .sortBy('priority', 'asc')
   *   .limit(20)
   *   .execute();
   * ```
   *
   * @returns A new TaskQuery instance for this index
   */
  query(): TaskQuery {
    return new TaskQuery(this.tasks.values());
  }

  /**
   * Toggle a task's completion state.
   *
   * Note: This updates the index only. The caller is responsible for
   * updating the source document and re-indexing.
   *
   * @param taskId - The task ID to toggle
   * @returns The updated task, or null if not found
   */
  toggle(taskId: string): Task | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const now = Date.now();
    const newCompleted = !task.completed;

    const updated: Task = {
      ...task,
      completed: newCompleted,
      completedAt: newCompleted ? now : undefined,
      updatedAt: now,
    };

    this.tasks.set(taskId, updated);
    this.dirty = true;
    this.schedulePersist();

    return updated;
  }

  /**
   * Set a task's priority level.
   *
   * Priority is stored only in the task index, not in the Lexical content.
   * This allows priority to be a metadata property separate from the document.
   *
   * @param taskId - The task ID to update
   * @param priority - The new priority level (0-3, where 0 is highest)
   * @returns Object with updated task and previous priority, or null if not found
   */
  setPriority(taskId: string, priority: number): { task: Task; previousPriority: number } | null {
    const task = this.tasks.get(taskId);
    if (!task) return null;

    const previousPriority = task.priority ?? 2; // Default to medium (2) if not set
    const now = Date.now();

    const updated: Task = {
      ...task,
      priority,
      updatedAt: now,
    };

    this.tasks.set(taskId, updated);
    this.dirty = true;
    this.schedulePersist();

    return { task: updated, previousPriority };
  }

  /**
   * Update task priorities based on new order.
   *
   * @param taskIds - Array of task IDs in desired order
   */
  reorder(taskIds: string[]): void {
    const changes: string[] = [];

    for (let i = 0; i < taskIds.length; i++) {
      const task = this.tasks.get(taskIds[i]);
      if (task && task.priority !== i) {
        const updated: Task = {
          ...task,
          priority: i,
          updatedAt: Date.now(),
        };
        this.tasks.set(task.id, updated);
        changes.push(task.id);
      }
    }

    if (changes.length > 0) {
      this.dirty = true;
      this.schedulePersist();
    }
  }

  /**
   * Get a task by ID.
   *
   * @param taskId - The task ID
   * @returns The task, or undefined if not found
   */
  get(taskId: string): Task | undefined {
    return this.tasks.get(taskId);
  }

  /**
   * Get all task IDs for a note.
   *
   * @param noteId - The note ID
   * @returns Set of task IDs, or empty set if none
   */
  getTaskIdsForNote(noteId: NoteId): Set<string> {
    return this.byNote.get(noteId) ?? new Set();
  }

  /**
   * Get total task count.
   */
  get size(): number {
    return this.tasks.size;
  }

  /**
   * Check if index has unsaved changes.
   */
  get isDirty(): boolean {
    return this.dirty;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get the maximum priority across all tasks.
   *
   * Returns -1 if no tasks exist (so first task gets priority 0).
   */
  private getMaxPriority(): number {
    let max = -1;
    for (const task of this.tasks.values()) {
      if (task.priority > max) {
        max = task.priority;
      }
    }
    return max;
  }
}
