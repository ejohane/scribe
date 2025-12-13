/**
 * TaskReconciler: Pure reconciliation logic for task index syncing
 *
 * Extracts the reconciliation logic from TaskIndex, providing a clean separation
 * between determining what changes need to be made (reconciliation) and
 * applying those changes (TaskIndex storage operations).
 *
 * Reconciliation rules:
 * 1. Match by nodeKey first (primary anchor)
 * 2. Fallback to textHash when nodeKey doesn't match
 * 3. Preserve priority and createdAt on matches
 * 4. Set completedAt on completion state transitions
 * 5. Generate stable task IDs from noteId:nodeKey:textHash
 */

import type { Note, Task } from '@scribe/shared';
import { serializeTaskId } from '@scribe/shared';
import { extractTasksFromNote, type ExtractedTask } from './task-extraction.js';

/**
 * Result of task reconciliation
 */
export interface ReconciliationResult {
  /** New tasks to add to the index */
  toAdd: Task[];
  /** Existing tasks that need updates */
  toUpdate: Task[];
  /** Task IDs to remove from the index */
  toRemove: string[];
}

/**
 * Interface for task reconciliation logic.
 *
 * Implementations determine how extracted tasks from a note are matched
 * against existing tasks in the index, and what changes need to be made.
 */
export interface TaskReconciler {
  /**
   * Reconcile extracted tasks with existing indexed tasks.
   *
   * @param note - The note being indexed
   * @param existingTasks - Map of existing tasks for this note (taskId -> Task)
   * @param maxPriority - Current maximum priority in the index (for new task assignment)
   * @param now - Current timestamp for createdAt/updatedAt/completedAt
   * @returns Reconciliation result with tasks to add, update, and remove
   */
  reconcile(
    note: Note,
    existingTasks: Map<string, Task>,
    maxPriority: number,
    now: number
  ): ReconciliationResult;
}

/**
 * Default implementation of TaskReconciler.
 *
 * Uses a two-phase matching strategy:
 * 1. Primary: Match by Lexical nodeKey (stable across edits)
 * 2. Fallback: Match by textHash (handles copy/paste/import scenarios)
 */
export class DefaultTaskReconciler implements TaskReconciler {
  /**
   * Reconcile a note's tasks with the existing index.
   */
  reconcile(
    note: Note,
    existingTasks: Map<string, Task>,
    maxPriority: number,
    now: number
  ): ReconciliationResult {
    const toAdd: Task[] = [];
    const toUpdate: Task[] = [];
    const toRemove: string[] = [];

    // Extract tasks from note content
    const extracted = extractTasksFromNote({
      id: note.id,
      title: note.title,
      content: note.content,
    });

    // Build lookup maps for existing tasks
    const existingByNodeKey = new Map<string, Task>();
    const existingByTextHash = new Map<string, Task>();
    for (const task of existingTasks.values()) {
      existingByNodeKey.set(task.nodeKey, task);
      // Only use textHash as fallback if nodeKey lookup fails
      if (!existingByTextHash.has(task.textHash)) {
        existingByTextHash.set(task.textHash, task);
      }
    }

    // Track which existing tasks we've matched (by their original IDs)
    const matchedExistingIds = new Set<string>();

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
          toUpdate.push(updated);
        }
      } else {
        // New task
        const newTask = this.createTask(ext, maxPriority + 1 + newTaskCount, now);
        newTaskCount++;
        toAdd.push(newTask);
      }
    }

    // Find tasks that no longer exist in the note
    for (const taskId of existingTasks.keys()) {
      if (!matchedExistingIds.has(taskId)) {
        toRemove.push(taskId);
      }
    }

    return { toAdd, toUpdate, toRemove };
  }

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
      // false -> true: set completedAt
      completedAt = now;
    } else if (!ext.completed && existing.completed) {
      // true -> false: clear completedAt
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
}
