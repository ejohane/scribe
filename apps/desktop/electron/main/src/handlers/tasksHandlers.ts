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
import type { Note, LexicalState, LexicalNode, TaskFilter } from '@scribe/shared';
import {
  HandlerDependencies,
  requireVault,
  requireGraphEngine,
  requireSearchEngine,
  requireTaskIndex,
} from './types';
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
 * Toggle the __checked property on a checklist listitem node.
 *
 * Uses fallback chain: nodeKey -> textHash -> lineIndex
 *
 * @param content - The Lexical state to modify (mutates in place)
 * @param locator - Locator to find the target node
 * @returns true if toggle succeeded, false if node not found
 */
function toggleChecklistNode(content: LexicalState, locator: ChecklistNodeLocator): boolean {
  if (!content?.root?.children) {
    return false;
  }

  // Track candidates for fallback matching
  let textHashMatch: LexicalNode | null = null;
  let lineIndexMatch: LexicalNode | null = null;
  let currentLineIndex = 0;

  // First pass: try to find by nodeKey (most reliable)
  const nodeKeyResult = findNodeByKey(content.root.children, locator.nodeKey);
  if (nodeKeyResult) {
    return toggleNode(nodeKeyResult);
  }

  // Second pass: collect fallback candidates
  traverseNodes(content.root.children, (node) => {
    if (node.type === 'listitem' && '__checked' in node) {
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
 * Find a node by its __key property (Lexical's internal node identifier).
 *
 * @param nodes - Array of nodes to search through
 * @param nodeKey - The node key to find
 * @returns The matching node, or null if not found
 */
function findNodeByKey(nodes: LexicalNode[], nodeKey: string): LexicalNode | null {
  for (const node of nodes) {
    if (node.__key === nodeKey) {
      return node;
    }
    if (Array.isArray(node.children)) {
      const found = findNodeByKey(node.children as LexicalNode[], nodeKey);
      if (found) return found;
    }
  }
  return null;
}

/**
 * Traverse all nodes in a Lexical tree (depth-first).
 *
 * @param nodes - Array of root nodes to traverse
 * @param callback - Function called for each node
 */
function traverseNodes(nodes: LexicalNode[], callback: (node: LexicalNode) => void): void {
  for (const node of nodes) {
    callback(node);
    if (Array.isArray(node.children)) {
      traverseNodes(node.children as LexicalNode[], callback);
    }
  }
}

/**
 * Extract text content from a node and its children.
 *
 * @param node - The root node to extract text from
 * @returns Concatenated text content of all text nodes
 */
function extractTextFromNode(node: LexicalNode): string {
  const textParts: string[] = [];
  traverseNodes([node], (n) => {
    if (n.type === 'text' && typeof n.text === 'string') {
      textParts.push(n.text as string);
    }
  });
  return textParts.join('');
}

/**
 * Toggle the __checked property on a checklist node.
 *
 * @param node - The listitem node to toggle
 * @returns true if toggle succeeded, false if node is not a checklist item
 */
function toggleNode(node: LexicalNode): boolean {
  if (node.type === 'listitem' && '__checked' in node) {
    node.__checked = !node.__checked;
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
  ipcMain.handle('tasks:toggle', async (_, { taskId }: { taskId: string }) => {
    try {
      const vault = requireVault(deps);
      const graphEngine = requireGraphEngine(deps);
      const searchEngine = requireSearchEngine(deps);
      const taskIndex = requireTaskIndex(deps);

      // Get task from index
      const task = taskIndex.get(taskId);
      if (!task) {
        return { success: false, error: 'Task not found' };
      }

      // Load note
      let note: Note;
      try {
        note = vault.read(task.noteId);
      } catch {
        // Task's note was deleted - remove from index
        const changes = taskIndex.removeNote(task.noteId);
        deps.mainWindow?.webContents.send('tasks:changed', changes);
        return { success: false, error: 'Note not found' };
      }

      // Find and toggle the checklist node in Lexical content
      const toggled = toggleChecklistNode(note.content, {
        nodeKey: task.nodeKey,
        textHash: task.textHash,
        lineIndex: task.lineIndex,
      });

      if (!toggled) {
        // Task no longer exists in note - remove from index and re-index
        const removeChanges = taskIndex.removeNote(task.noteId);
        const addChanges = taskIndex.indexNote(note);
        const allChanges = [...removeChanges, ...addChanges];
        deps.mainWindow?.webContents.send('tasks:changed', allChanges);
        return { success: false, error: 'Task no longer exists in note' };
      }

      // Save note
      await vault.save(note);

      // Update graph and search (in case content affects metadata)
      graphEngine.addNote(note);
      searchEngine.indexNote(note);

      // Re-index to update completedAt
      const changes = taskIndex.indexNote(note);
      deps.mainWindow?.webContents.send('tasks:changed', changes);

      const updatedTask = taskIndex.get(taskId);
      return { success: true, task: updatedTask };
    } catch (error) {
      tasksLogger.error('Toggle error:', error);
      return { success: false, error: String(error) };
    }
  });

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
