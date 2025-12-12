/**
 * TaskIndex: In-memory task index with JSONL persistence
 *
 * Manages tasks extracted from notes, providing:
 * - Reconciliation rules (nodeKey first, textHash fallback)
 * - Priority assignment for new tasks
 * - completedAt handling (set when checked, clear when unchecked)
 * - Pagination support with cursor-based paging
 * - JSONL persistence (atomic temp+rename, debounced writes)
 */

import { join } from 'path';
import { promises as fs } from 'fs';
import type { Note, NoteId, Task, TaskFilter, TaskChangeEvent } from '@scribe/shared';
import { serializeTaskId } from '@scribe/shared';
import { extractTasksFromNote, type ExtractedTask } from './task-extraction.js';

/** Default debounce delay for persistence in milliseconds */
const PERSIST_DEBOUNCE_MS = 5000;

/**
 * TaskIndex maintains an in-memory index of all tasks extracted from notes.
 *
 * The index is the source of truth for task metadata (priority, createdAt, completedAt)
 * while the completion state is derived from the source document's checkbox.
 */
export class TaskIndex {
  /** Main task storage by task ID */
  private tasks: Map<string, Task> = new Map();

  /** Secondary index: noteId -> Set of task IDs */
  private byNote: Map<NoteId, Set<string>> = new Map();

  /** Path to JSONL persistence file */
  private persistPath: string;

  /** Flag indicating unsaved changes */
  private dirty = false;

  /** Timeout handle for debounced persistence */
  private persistTimeout: ReturnType<typeof setTimeout> | null = null;

  /** Debounce delay in milliseconds */
  private debounceMs: number;

  /**
   * Create a new TaskIndex.
   *
   * @param derivedPath - Path to the derived data directory
   * @param debounceMs - Debounce delay for persistence (default 5000ms)
   */
  constructor(derivedPath: string, debounceMs = PERSIST_DEBOUNCE_MS) {
    this.persistPath = join(derivedPath, 'tasks.jsonl');
    this.debounceMs = debounceMs;
  }

  /**
   * Load tasks from JSONL file.
   *
   * Silently handles missing file (fresh start).
   */
  async load(): Promise<void> {
    try {
      const content = await fs.readFile(this.persistPath, 'utf-8');
      const lines = content.trim().split('\n').filter(Boolean);

      for (const line of lines) {
        try {
          const task = JSON.parse(line) as Task;
          this.tasks.set(task.id, task);

          // Update byNote index
          let noteTaskIds = this.byNote.get(task.noteId);
          if (!noteTaskIds) {
            noteTaskIds = new Set();
            this.byNote.set(task.noteId, noteTaskIds);
          }
          noteTaskIds.add(task.id);
        } catch {
          // Skip malformed lines
          console.warn('[TaskIndex] Skipping malformed line:', line);
        }
      }
    } catch (error) {
      // File doesn't exist yet - fresh start
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
    }
  }

  /**
   * Persist tasks to JSONL file atomically.
   *
   * Uses temp file + rename for atomic writes.
   */
  async persist(): Promise<void> {
    if (!this.dirty) return;

    const tempPath = this.persistPath + '.tmp';
    const lines = Array.from(this.tasks.values())
      .map((task) => JSON.stringify(task))
      .join('\n');

    // Ensure directory exists
    await fs.mkdir(join(this.persistPath, '..'), { recursive: true });

    // Write to temp file
    await fs.writeFile(tempPath, lines + '\n', 'utf-8');

    // Atomic rename
    await fs.rename(tempPath, this.persistPath);

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
        console.error('[TaskIndex] Persist failed:', err);
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

    // Extract tasks from note content
    const extracted = extractTasksFromNote({
      id: note.id,
      title: note.title,
      content: note.content,
    });

    // Get existing tasks for this note (make a copy to avoid mutation issues during iteration)
    const existingTaskIdsSnapshot = new Set(this.byNote.get(note.id) ?? []);

    // Build lookup maps for existing tasks
    const existingByNodeKey = new Map<string, Task>();
    const existingByTextHash = new Map<string, Task>();
    for (const taskId of existingTaskIdsSnapshot) {
      const task = this.tasks.get(taskId);
      if (task) {
        existingByNodeKey.set(task.nodeKey, task);
        // Only use textHash as fallback if nodeKey lookup fails
        if (!existingByTextHash.has(task.textHash)) {
          existingByTextHash.set(task.textHash, task);
        }
      }
    }

    // Track which existing tasks we've matched (by their original IDs)
    const matchedExistingIds = new Set<string>();

    // Get max priority for new task assignment
    const maxPriority = this.getMaxPriority();

    // Track how many new tasks we create (for priority assignment)
    let newTaskCount = 0;

    // Process extracted tasks
    for (const ext of extracted) {
      // Try to find existing task by nodeKey first
      let existing = existingByNodeKey.get(ext.nodeKey);

      // If not found by nodeKey, try textHash as fallback
      if (!existing) {
        existing = existingByTextHash.get(ext.textHash);
      }

      if (existing) {
        // Found existing task - reconcile
        matchedExistingIds.add(existing.id);

        const updated = this.reconcileTask(existing, ext, now);
        if (updated) {
          this.tasks.set(updated.id, updated);
          changes.push({ type: 'updated', task: updated });
        }
      } else {
        // New task
        const newTask = this.createTask(ext, maxPriority + 1 + newTaskCount, now);
        newTaskCount++;

        this.tasks.set(newTask.id, newTask);

        // Update byNote index
        let noteTaskIds = this.byNote.get(note.id);
        if (!noteTaskIds) {
          noteTaskIds = new Set();
          this.byNote.set(note.id, noteTaskIds);
        }
        noteTaskIds.add(newTask.id);

        changes.push({ type: 'added', task: newTask });
      }
    }

    // Remove tasks that no longer exist in the note
    // Use the snapshot to avoid issues with byNote being modified during reconciliation
    for (const taskId of existingTaskIdsSnapshot) {
      if (!matchedExistingIds.has(taskId)) {
        this.tasks.delete(taskId);
        // Also remove from byNote
        const noteTaskIds = this.byNote.get(note.id);
        if (noteTaskIds) {
          noteTaskIds.delete(taskId);
        }
        changes.push({ type: 'removed', taskId });
      }
    }

    // Mark dirty and schedule persist if there were changes
    if (changes.length > 0) {
      this.dirty = true;
      this.schedulePersist();
    }

    return changes;
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
    let tasks = Array.from(this.tasks.values());

    // Apply filters
    if (filter?.completed !== undefined) {
      tasks = tasks.filter((t) => t.completed === filter.completed);
    }

    if (filter?.noteId) {
      tasks = tasks.filter((t) => t.noteId === filter.noteId);
    }

    if (filter?.createdAfter !== undefined) {
      tasks = tasks.filter((t) => t.createdAt >= filter.createdAfter!);
    }

    if (filter?.createdBefore !== undefined) {
      tasks = tasks.filter((t) => t.createdAt <= filter.createdBefore!);
    }

    if (filter?.completedAfter !== undefined) {
      tasks = tasks.filter(
        (t) => t.completed && t.completedAt !== undefined && t.completedAt >= filter.completedAfter!
      );
    }

    if (filter?.completedBefore !== undefined) {
      tasks = tasks.filter(
        (t) =>
          t.completed && t.completedAt !== undefined && t.completedAt <= filter.completedBefore!
      );
    }

    // Sort
    const sortBy = filter?.sortBy ?? 'priority';
    const sortOrder = filter?.sortOrder ?? 'asc';
    const multiplier = sortOrder === 'asc' ? 1 : -1;

    tasks.sort((a, b) => {
      if (sortBy === 'priority') {
        // Primary: completed tasks sort after incomplete
        if (a.completed !== b.completed) {
          return a.completed ? 1 : -1;
        }
        // Secondary: priority
        const priorityDiff = (a.priority - b.priority) * multiplier;
        if (priorityDiff !== 0) return priorityDiff;
        // Tertiary: createdAt (newest first within same priority)
        return (b.createdAt - a.createdAt) * multiplier;
      } else {
        // sortBy === 'createdAt'
        return (a.createdAt - b.createdAt) * multiplier;
      }
    });

    // Apply cursor-based pagination
    const limit = filter?.limit ?? 100;
    let startIndex = 0;

    if (filter?.cursor) {
      const cursorIndex = this.decodeCursor(filter.cursor);
      if (cursorIndex !== null) {
        startIndex = cursorIndex;
      }
    }

    const endIndex = startIndex + limit;
    const paginatedTasks = tasks.slice(startIndex, endIndex);

    // Determine if there are more results
    const hasMore = endIndex < tasks.length;
    const nextCursor = hasMore ? this.encodeCursor(endIndex) : undefined;

    return { tasks: paginatedTasks, nextCursor };
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
   * Create a new Task from extracted data.
   */
  private createTask(ext: ExtractedTask, priority: number, now: number): Task {
    const id = serializeTaskId({
      noteId: ext.noteId,
      nodeKey: ext.nodeKey,
      textHash: ext.textHash,
    });

    return {
      id,
      noteId: ext.noteId,
      noteTitle: ext.noteTitle,
      nodeKey: ext.nodeKey,
      lineIndex: ext.lineIndex,
      text: ext.text,
      textHash: ext.textHash,
      completed: ext.completed,
      completedAt: ext.completed ? now : undefined,
      priority,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Reconcile an existing task with newly extracted data.
   *
   * Returns updated task if changes were made, null otherwise.
   */
  private reconcileTask(existing: Task, ext: ExtractedTask, now: number): Task | null {
    // Determine completedAt based on state transition
    let completedAt = existing.completedAt;
    if (ext.completed && !existing.completed) {
      // false → true: set completedAt
      completedAt = now;
    } else if (!ext.completed && existing.completed) {
      // true → false: clear completedAt
      completedAt = undefined;
    }

    // Generate new ID (may have changed if nodeKey or textHash changed)
    const newId = serializeTaskId({
      noteId: ext.noteId,
      nodeKey: ext.nodeKey,
      textHash: ext.textHash,
    });

    // Check if anything changed
    const hasChanges =
      existing.id !== newId ||
      existing.completed !== ext.completed ||
      existing.text !== ext.text ||
      existing.lineIndex !== ext.lineIndex ||
      existing.noteTitle !== ext.noteTitle ||
      existing.textHash !== ext.textHash ||
      existing.nodeKey !== ext.nodeKey ||
      existing.completedAt !== completedAt;

    if (!hasChanges) return null;

    // If ID changed, remove old entry
    if (existing.id !== newId) {
      this.tasks.delete(existing.id);
      const noteTaskIds = this.byNote.get(existing.noteId);
      if (noteTaskIds) {
        noteTaskIds.delete(existing.id);
        noteTaskIds.add(newId);
      }
    }

    return {
      id: newId,
      noteId: ext.noteId,
      noteTitle: ext.noteTitle,
      nodeKey: ext.nodeKey,
      lineIndex: ext.lineIndex,
      text: ext.text,
      textHash: ext.textHash,
      completed: ext.completed,
      completedAt,
      priority: existing.priority, // Preserve priority
      createdAt: existing.createdAt, // Preserve createdAt
      updatedAt: now,
    };
  }

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

  /**
   * Encode a cursor (just the index for now).
   */
  private encodeCursor(index: number): string {
    return Buffer.from(String(index)).toString('base64');
  }

  /**
   * Decode a cursor back to an index.
   */
  private decodeCursor(cursor: string): number | null {
    try {
      const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
      const index = parseInt(decoded, 10);
      return isNaN(index) ? null : index;
    } catch {
      return null;
    }
  }
}
