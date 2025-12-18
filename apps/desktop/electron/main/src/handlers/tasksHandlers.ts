/**
 * Task Management IPC Handlers
 *
 * This module provides IPC handlers for task operations:
 * - Toggle task completion state
 * - List tasks with filtering
 * - Get single task
 * - Reorder tasks by priority
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `tasks:toggle` | `{ taskId: string }` | `{ success, task?, error? }` | Toggle task completion |
 * | `tasks:list` | `filter?: TaskFilter` | `Task[]` | List tasks with optional filter |
 * | `tasks:get` | `{ taskId: string }` | `Task \| null` | Get a single task |
 * | `tasks:reorder` | `{ taskIds: string[] }` | `{ success: true }` | Reorder tasks by priority |
 *
 * ## Task Toggle Algorithm
 *
 * Tasks are identified in Lexical content using a fallback chain:
 * 1. `nodeKey` - Primary anchor (Lexical's internal node key)
 * 2. `textHash` - SHA-256 hash of task text (fallback if node key changes)
 * 3. `lineIndex` - Block ordinal in document (last resort)
 *
 * ## Events
 *
 * Task changes broadcast `tasks:changed` event to renderer with array of changes.
 *
 * @module handlers/tasksHandlers
 */

import { ipcMain } from 'electron';
import { computeTextHash } from '@scribe/engine-core';
import type { Note, EditorContent, EditorNode, TaskFilter } from '@scribe/shared';
import { traverseNodes, findNodeByKey, extractTextFromNode } from '@scribe/shared';
import { HandlerDependencies, requireTaskIndex, withEngines } from './types';
import { tasksLogger } from '../logger';

// ============================================================================
// Checklist Node Toggle Helper
// ============================================================================

/**
 * Locator for finding a checklist node in Lexical content.
 *
 * Used by {@link toggleChecklistNode} to identify which task to toggle.
 * The locator uses a fallback chain for resilience against content changes.
 */
interface ChecklistNodeLocator {
  /** Lexical node key (primary anchor) - most reliable */
  nodeKey: string;
  /** SHA-256 hash of task text (fallback) - resilient to node key changes */
  textHash: string;
  /** List item block ordinal (last resort fallback) - least reliable */
  lineIndex: number;
}

/**
 * Toggle the 'checked' property on a checklist listitem node.
 *
 * Uses fallback chain: nodeKey -> textHash -> lineIndex
 *
 * Note: Lexical serializes the checked state as 'checked' in JSON (not '__checked').
 * The '__checked' form is only used for in-memory Lexical nodes.
 *
 * @param content - The Lexical state to modify (mutates in place)
 * @param locator - Locator to find the target node
 * @returns true if toggle succeeded, false if node not found
 */
function toggleChecklistNode(content: EditorContent, locator: ChecklistNodeLocator): boolean {
  if (!content?.root?.children) {
    return false;
  }

  // Track candidates for fallback matching
  let textHashMatch: EditorNode | null = null;
  let lineIndexMatch: EditorNode | null = null;
  let currentLineIndex = 0;

  // First pass: try to find by nodeKey (most reliable)
  const nodeKeyResult = findNodeByKey(content.root.children, locator.nodeKey);
  if (nodeKeyResult) {
    return toggleNode(nodeKeyResult);
  }

  // Second pass: collect fallback candidates
  // Only match checklist items (checked is a boolean, not undefined)
  traverseNodes(content.root.children, (node) => {
    if (node.type === 'listitem' && typeof node.checked === 'boolean') {
      // Check textHash match
      const text = extractTextFromNode(node);
      const hash = computeTextHash(text);
      if (hash === locator.textHash && !textHashMatch) {
        textHashMatch = node;
      }

      // Track lineIndex
      if (currentLineIndex === locator.lineIndex && !lineIndexMatch) {
        lineIndexMatch = node;
      }
    }

    // Count all listitems for lineIndex tracking
    if (node.type === 'listitem') {
      currentLineIndex++;
    }
  });

  // Try textHash fallback
  if (textHashMatch) {
    return toggleNode(textHashMatch);
  }

  // Try lineIndex fallback (least reliable)
  if (lineIndexMatch) {
    return toggleNode(lineIndexMatch);
  }

  return false;
}

/**
 * Toggle the 'checked' property on a checklist node.
 *
 * Note: Lexical serializes the checked state as 'checked' in JSON (not '__checked').
 * Regular bullet list items have checked: undefined, so we check for boolean type.
 *
 * @param node - The listitem node to toggle
 * @returns true if toggle succeeded, false if node is not a checklist item
 */
function toggleNode(node: EditorNode): boolean {
  if (node.type === 'listitem' && typeof node.checked === 'boolean') {
    node.checked = !node.checked;
    return true;
  }
  return false;
}

/**
 * Setup IPC handlers for task operations.
 *
 * @param deps - Handler dependencies (requires vault, graphEngine, searchEngine, taskIndex)
 *
 * @example
 * ```typescript
 * // From renderer
 * const result = await window.api.invoke('tasks:toggle', { taskId: 'task-123' });
 * if (result.success) {
 *   console.log('Task toggled:', result.task);
 * }
 * ```
 */
export function setupTasksHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `tasks:toggle`
   *
   * Toggles a task's completion state in its source note.
   *
   * @param taskId - The task ID to toggle
   * @returns `{ success: true, task: Task }` on success
   * @returns `{ success: false, error: string }` on failure
   *
   * @sideeffects
   * - Mutates the note's Lexical content (toggles __checked)
   * - Saves the note to vault
   * - Updates graph and search engines
   * - Re-indexes task and broadcasts `tasks:changed` event
   *
   * @remarks
   * Write path for task completion:
   * 1. Load note from vault
   * 2. Find checklist node by nodeKey (fallback: textHash, lineIndex)
   * 3. Toggle __checked property on the Lexical listitem node
   * 4. Save note via existing persistence path
   * 5. Update TaskIndex (completedAt set/cleared)
   * 6. Handle conflicts/missing tasks with error
   */
  ipcMain.handle(
    'tasks:toggle',
    withEngines(deps, async (engines, { taskId }: { taskId: string }) => {
      try {
        // Get task from index
        const task = engines.taskIndex.get(taskId);
        if (!task) {
          return { success: false, error: 'Task not found' };
        }

        // Load note
        let note: Note;
        try {
          note = engines.vault.read(task.noteId);
        } catch {
          // Task's note was deleted - remove from index
          const changes = engines.taskIndex.removeNote(task.noteId);
          deps.mainWindow?.webContents.send('tasks:changed', changes);
          return { success: false, error: 'Note not found' };
        }

        // Find and toggle the checklist node in Lexical content
        tasksLogger.debug('Toggling task:', { taskId, noteId: task.noteId, nodeKey: task.nodeKey });
        const toggled = toggleChecklistNode(note.content, {
          nodeKey: task.nodeKey,
          textHash: task.textHash,
          lineIndex: task.lineIndex,
        });
        tasksLogger.debug('Toggle result:', { toggled, taskId });

        if (!toggled) {
          // Task no longer exists in note - remove from index and re-index
          const removeChanges = engines.taskIndex.removeNote(task.noteId);
          const addChanges = engines.taskIndex.indexNote(note);
          const allChanges = [...removeChanges, ...addChanges];
          deps.mainWindow?.webContents.send('tasks:changed', allChanges);
          return { success: false, error: 'Task no longer exists in note' };
        }

        // Save note
        await engines.vault.save(note);

        // Update graph and search (in case content affects metadata)
        engines.graphEngine.addNote(note);
        engines.searchEngine.indexNote(note);

        // Re-index to update completedAt
        const changes = engines.taskIndex.indexNote(note);
        tasksLogger.debug('Task toggle changes:', {
          taskId,
          changesCount: changes.length,
          changes,
        });

        if (changes.length > 0 && deps.mainWindow) {
          deps.mainWindow.webContents.send('tasks:changed', changes);
          tasksLogger.debug('Sent tasks:changed event');
        } else if (changes.length === 0) {
          tasksLogger.warn('No changes detected after task toggle', { taskId });
        } else if (!deps.mainWindow) {
          tasksLogger.warn('mainWindow not available for task toggle event');
        }

        const updatedTask = engines.taskIndex.get(taskId);
        return { success: true, task: updatedTask };
      } catch (error) {
        tasksLogger.error('Toggle error:', error);
        return { success: false, error: String(error) };
      }
    })
  );

  /**
   * IPC: `tasks:list`
   *
   * Lists tasks with optional filtering.
   *
   * @param filter - Optional filter criteria (status, noteId, date range, etc.)
   * @returns `Task[]` - Array of tasks matching the filter
   *
   * @remarks
   * If no filter is provided, returns all tasks.
   * See TaskFilter type for available filter options.
   */
  ipcMain.handle('tasks:list', async (_, filter?: TaskFilter) => {
    const taskIndex = requireTaskIndex(deps);
    return taskIndex.list(filter);
  });

  /**
   * IPC: `tasks:get`
   *
   * Gets a single task by its ID.
   *
   * @param taskId - The task ID to retrieve
   * @returns `Task | null` - The task, or null if not found
   */
  ipcMain.handle('tasks:get', async (_, { taskId }: { taskId: string }) => {
    const taskIndex = requireTaskIndex(deps);
    return taskIndex.get(taskId) ?? null;
  });

  /**
   * IPC: `tasks:reorder`
   *
   * Reorders tasks by setting their priority based on array position.
   *
   * @param taskIds - Array of task IDs in desired order
   * @returns `{ success: true }`
   *
   * @sideeffects
   * - Updates task priorities in TaskIndex
   * - Broadcasts `tasks:changed` event with type 'reordered'
   */
  ipcMain.handle('tasks:reorder', async (_, { taskIds }: { taskIds: string[] }) => {
    const taskIndex = requireTaskIndex(deps);
    taskIndex.reorder(taskIds);
    deps.mainWindow?.webContents.send('tasks:changed', [{ type: 'reordered', taskIds }]);
    return { success: true };
  });
}
