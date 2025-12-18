/**
 * Task-related type definitions for Scribe
 *
 * This module contains types for tasks extracted from notes, their identifiers,
 * filtering options, and change events for real-time sync.
 */

import { createNoteId, type NoteId } from './note-types.js';

/**
 * Composite identifier for a task
 *
 * Tasks are identified by a combination of:
 * - noteId: The source document containing the task
 * - nodeKey: Lexical node key for the checklist item (primary anchor)
 * - textHash: SHA-256 hash of task text (first 16 chars) for fallback matching
 *
 * Serialized as: "{noteId}:{nodeKey}:{textHash}"
 * Example: "abc123:node_1a2b:a1b2c3d4e5f6a7b8"
 */
export interface TaskId {
  noteId: NoteId;
  nodeKey: string;
  textHash: string;
}

/**
 * Serialize a TaskId to its string representation
 *
 * Converts a structured TaskId object into a colon-separated string
 * suitable for storage, IPC, and use as a unique key.
 *
 * @param taskId - The TaskId object to serialize
 * @returns A string in the format "{noteId}:{nodeKey}:{textHash}"
 *
 * @example
 * ```typescript
 * const taskId: TaskId = {
 *   noteId: createNoteId('abc123'),
 *   nodeKey: 'node_1a2b',
 *   textHash: 'a1b2c3d4e5f6a7b8'
 * };
 * const serialized = serializeTaskId(taskId);
 * // Result: "abc123:node_1a2b:a1b2c3d4e5f6a7b8"
 * ```
 *
 * @see parseTaskId for the inverse operation
 * @since 1.0.0
 */
export function serializeTaskId(taskId: TaskId): string {
  return `${taskId.noteId}:${taskId.nodeKey}:${taskId.textHash}`;
}

/**
 * Parse a serialized TaskId string back to a TaskId object
 *
 * Converts a colon-separated string back into a structured TaskId object.
 * Validates the format but does not validate the individual components.
 *
 * @param id - The serialized TaskId string to parse
 * @returns A TaskId object if the format is valid, or `null` if invalid
 *
 * @example
 * ```typescript
 * const taskId = parseTaskId('abc123:node_1a2b:a1b2c3d4e5f6a7b8');
 * if (taskId) {
 *   console.log(taskId.noteId);   // 'abc123' as NoteId
 *   console.log(taskId.nodeKey);  // 'node_1a2b'
 *   console.log(taskId.textHash); // 'a1b2c3d4e5f6a7b8'
 * }
 *
 * parseTaskId('invalid');  // Returns null
 * parseTaskId('a:b');      // Returns null (wrong number of parts)
 * ```
 *
 * @see serializeTaskId for the inverse operation
 * @since 1.0.0
 */
export function parseTaskId(id: string): TaskId | null {
  const parts = id.split(':');
  if (parts.length !== 3) {
    return null;
  }
  const [noteIdStr, nodeKey, textHash] = parts;
  if (!noteIdStr || !nodeKey || !textHash) {
    return null;
  }
  return { noteId: createNoteId(noteIdStr), nodeKey, textHash };
}

/**
 * A task extracted from a note's checklist items
 *
 * Tasks use a hybrid storage model:
 * - Source of truth: Markdown checkboxes in Lexical content
 * - Index for fast queries: TaskIndex stored in-memory and persisted to JSONL
 */
export interface Task {
  /**
   * Serialized TaskId: "{noteId}:{nodeKey}:{textHash}"
   */
  id: string;

  /**
   * Source document ID containing this task
   */
  noteId: NoteId;

  /**
   * Source document title (denormalized for display)
   */
  noteTitle: string;

  /**
   * Lexical node key for the checklist item (primary anchor for navigation)
   */
  nodeKey: string;

  /**
   * List item block ordinal (best-effort, recomputed on extraction)
   * Used for fallback navigation when nodeKey cannot be found
   */
  lineIndex: number;

  /**
   * Task text content (without checkbox syntax)
   */
  text: string;

  /**
   * SHA-256 hash of task text (first 16 hex chars)
   * Used for identity matching when nodeKey changes (e.g., after paste/import)
   */
  textHash: string;

  /**
   * Current completion state (derived from source checkbox)
   */
  completed: boolean;

  /**
   * Timestamp when task was last completed (undefined if never completed or unchecked)
   */
  completedAt?: number;

  /**
   * User-defined priority (0 = highest)
   * Managed via drag-and-drop reordering
   */
  priority: number;

  /**
   * Timestamp when task was first indexed
   */
  createdAt: number;

  /**
   * Timestamp when task was last reconciled with source
   */
  updatedAt: number;
}

/**
 * Filter options for querying tasks
 */
export interface TaskFilter {
  /**
   * Filter by completion status
   * - true: only completed tasks
   * - false: only incomplete tasks
   * - undefined: all tasks
   */
  completed?: boolean;

  /**
   * Filter by source note ID
   */
  noteId?: NoteId;

  /**
   * Filter by creation date (inclusive lower bound)
   */
  createdAfter?: number;

  /**
   * Filter by creation date (inclusive upper bound)
   */
  createdBefore?: number;

  /**
   * Filter by completion date (inclusive lower bound)
   * Only applies to completed tasks
   */
  completedAfter?: number;

  /**
   * Filter by completion date (inclusive upper bound)
   * Only applies to completed tasks
   */
  completedBefore?: number;

  /**
   * Sort field
   * - 'priority': User-defined priority order
   * - 'createdAt': Creation timestamp
   */
  sortBy?: 'priority' | 'createdAt';

  /**
   * Sort direction
   */
  sortOrder?: 'asc' | 'desc';

  /**
   * Maximum number of tasks to return
   * Default: 100 for Tasks screen, 20 for panel
   */
  limit?: number;

  /**
   * Opaque cursor for pagination
   * Returned from previous query when more results are available
   */
  cursor?: string;
}

/**
 * Event emitted when tasks change
 *
 * Used for real-time sync between main process and renderer.
 * The Panel and Tasks Screen subscribe to the 'tasks:changed' IPC channel
 * and receive batched arrays of these events.
 *
 * Event types:
 * - `added`: A new task was extracted from a note's checklist
 * - `updated`: An existing task's content or completion state changed
 * - `removed`: A task was deleted (checkbox removed from source note)
 * - `reordered`: Task priorities were changed via drag-and-drop
 *
 * @example
 * ```typescript
 * // Handle task events in renderer
 * ipcRenderer.on('tasks:changed', (events: TaskChangeEvent[]) => {
 *   for (const event of events) {
 *     switch (event.type) {
 *       case 'added':
 *         addTaskToList(event.task);
 *         break;
 *       case 'updated':
 *         updateTaskInList(event.task);
 *         break;
 *       case 'removed':
 *         removeTaskFromList(event.taskId);
 *         break;
 *       case 'reordered':
 *         reorderTasks(event.taskIds);
 *         break;
 *     }
 *   }
 * });
 * ```
 *
 * @since 1.0.0
 */
export type TaskChangeEvent =
  | { type: 'added'; task: Task }
  | { type: 'updated'; task: Task }
  | { type: 'removed'; taskId: string }
  | { type: 'reordered'; taskIds: string[] };
