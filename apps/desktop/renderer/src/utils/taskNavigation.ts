/**
 * Task Navigation Utility
 *
 * Provides a function to navigate from the Tasks panel/screen to the source
 * location of a task within a note. Handles the two-step process of:
 * 1. Navigating to the note containing the task
 * 2. Focusing the specific task node within the editor
 *
 * The focus step uses FOCUS_NODE_COMMAND with fallback identifiers:
 * - Primary: nodeKey (exact Lexical node identifier)
 * - Fallback 1: textHash (matches by task text content)
 * - Fallback 2: lineIndex (matches by position)
 */

import type { Task } from '@scribe/shared';
import type { LexicalEditor } from 'lexical';
import { FOCUS_NODE_COMMAND } from '../components/Editor/plugins/FocusNodePlugin';

/**
 * Time to wait for editor content to load after navigation.
 * This gives Lexical time to parse and render the note content
 * before we attempt to find and focus the task node.
 */
const EDITOR_LOAD_DELAY_MS = 150;

/**
 * Result of a task navigation attempt
 */
export interface NavigateToTaskResult {
  success: boolean;
  error?: string;
}

/**
 * Options for navigating to a task
 */
export interface NavigateToTaskOptions {
  /** The task to navigate to */
  task: Task;
  /** Function to navigate to a note by ID (from useNavigationHistory) */
  navigateToNote: (noteId: string) => void;
  /** Function to get the current Lexical editor instance (null if not available) */
  getEditor: () => LexicalEditor | null;
  /** Callback for error handling (e.g., showing toast) */
  onError?: (message: string) => void;
  /** Callback when task is not found in the note (may indicate stale index) */
  onTaskNotFound?: (task: Task) => void;
  /** Custom delay for editor load (default: 150ms) */
  editorLoadDelay?: number;
}

/**
 * Navigate to a task's location in its source note.
 *
 * This function orchestrates the navigation process:
 * 1. Navigates to the note containing the task
 * 2. Waits for the editor to load the note content
 * 3. Dispatches FOCUS_NODE_COMMAND to scroll to and highlight the task
 *
 * The focus command uses a fallback chain:
 * - Primary: Find by exact nodeKey
 * - Fallback: Find checklist item matching textHash
 * - Last resort: Find list item at lineIndex position
 *
 * @example
 * ```typescript
 * await navigateToTask({
 *   task: selectedTask,
 *   navigateToNote: (id) => noteState.loadNote(id),
 *   getEditor: () => editorRef.current,
 *   onError: (msg) => showToast(msg, 'error'),
 *   onTaskNotFound: (task) => {
 *     // Task not in note - might need to remove from index
 *     removeTaskFromIndex(task.id);
 *   },
 * });
 * ```
 */
export async function navigateToTask({
  task,
  navigateToNote,
  getEditor,
  onError,
  onTaskNotFound,
  editorLoadDelay = EDITOR_LOAD_DELAY_MS,
}: NavigateToTaskOptions): Promise<NavigateToTaskResult> {
  // Step 1: Navigate to the note containing the task
  try {
    navigateToNote(task.noteId);
  } catch (error) {
    const message = `Failed to navigate to note: ${error instanceof Error ? error.message : 'Unknown error'}`;
    onError?.(message);
    return { success: false, error: message };
  }

  // Step 2: Wait for the editor to load the note content
  // This delay allows Lexical to parse and render the document
  await new Promise((resolve) => setTimeout(resolve, editorLoadDelay));

  // Step 3: Get the editor instance and dispatch focus command
  const editor = getEditor();
  if (!editor) {
    // Editor not available - this might happen if we're on a system note
    // or the editor hasn't mounted yet. This is a soft failure.
    const message = 'Editor not available for task focus';
    console.warn(message, { taskId: task.id, noteId: task.noteId });
    // Don't call onError for this case - navigation succeeded, just focus failed
    return { success: true }; // Navigation succeeded, focus is best-effort
  }

  // Dispatch the focus command with fallback identifiers
  const commandHandled = editor.dispatchCommand(FOCUS_NODE_COMMAND, {
    nodeKey: task.nodeKey,
    textHashFallback: task.textHash,
    lineIndexFallback: task.lineIndex,
  });

  // If the command wasn't handled (no node found), the task might be stale
  if (!commandHandled) {
    console.warn('Task node not found in note', {
      taskId: task.id,
      noteId: task.noteId,
      nodeKey: task.nodeKey,
      textHash: task.textHash,
      lineIndex: task.lineIndex,
    });
    onTaskNotFound?.(task);
    return { success: true }; // Navigation succeeded, but task wasn't found
  }

  return { success: true };
}

/**
 * Creates a task click handler for use in task list components.
 *
 * This is a convenience wrapper around navigateToTask that captures
 * the navigation context and returns a handler suitable for onClick.
 *
 * @example
 * ```typescript
 * const handleTaskClick = createTaskClickHandler({
 *   navigateToNote,
 *   getEditor,
 *   onError: (msg) => showToast(msg, 'error'),
 * });
 *
 * // In JSX:
 * <TaskItem onClick={() => handleTaskClick(task)} />
 * ```
 */
export function createTaskClickHandler(
  options: Omit<NavigateToTaskOptions, 'task'>
): (task: Task) => Promise<NavigateToTaskResult> {
  return (task: Task) => navigateToTask({ ...options, task });
}
