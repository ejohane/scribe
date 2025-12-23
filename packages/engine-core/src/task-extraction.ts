/**
 * Task extraction from Lexical JSON content
 *
 * Extracts checklist tasks from Lexical editor state, computing text, textHash,
 * nodeKey, lineIndex, and completed flag.
 */

import type { EditorContent, EditorNode, NoteId } from '@scribe/shared';
import { traverseNodesWithAncestors, extractTextFromNode, computeTextHash } from '@scribe/shared';

/**
 * Raw task data extracted from a note's content.
 * This is the intermediate representation before reconciliation with the TaskIndex.
 */
export interface ExtractedTask {
  /** Source document ID */
  noteId: NoteId;
  /** Source document title (denormalized for display) */
  noteTitle: string;
  /** Lexical node key for the checklist item (primary anchor) */
  nodeKey: string;
  /** List item block ordinal (best-effort, recomputed on extraction) */
  lineIndex: number;
  /** Task text content (without checkbox syntax) */
  text: string;
  /** DJB2 hash of task text (16 hex chars) - used for content identity tracking */
  textHash: string;
  /** Current completion state from checkbox */
  completed: boolean;
}

/**
 * Minimal note interface for task extraction
 */
export interface NoteForExtraction {
  id: NoteId;
  title: string;
  content: EditorContent;
}

/**
 * Extract all tasks from a note's Lexical content.
 *
 * Traverses the Lexical state to find checklist listitem nodes with __checked property.
 * Skips tasks inside code blocks.
 *
 * @param note - The note to extract tasks from
 * @returns Array of extracted tasks
 */
export function extractTasksFromNote(note: NoteForExtraction): ExtractedTask[] {
  const tasks: ExtractedTask[] = [];

  if (!note.content?.root?.children) {
    return tasks;
  }

  let listItemIndex = 0;

  // Traverse content looking for checklist items
  traverseNodesWithAncestors(note.content.root.children, (node, ancestors) => {
    // Check if this is a checklist listitem (has 'checked' property set to a boolean)
    // Note: Lexical exports this as 'checked' in JSON, not '__checked'
    // Regular bullet list items have checked: undefined, so we check for boolean type
    if (node.type === 'listitem' && typeof node.checked === 'boolean') {
      // Skip if inside a code block
      if (isInsideCodeBlock(ancestors)) {
        return;
      }

      const text = extractTextFromNode(node);
      const textHash = computeTextHash(text);
      const nodeKey = getNodeKey(node, listItemIndex);

      tasks.push({
        noteId: note.id,
        noteTitle: note.title,
        nodeKey,
        lineIndex: listItemIndex,
        text,
        textHash,
        completed: node.checked === true,
      });
    }

    // Count all listitems for lineIndex tracking
    // (including non-checklist ones to maintain consistent block ordinal)
    if (node.type === 'listitem') {
      listItemIndex += 1;
    }
  });

  return tasks;
}

/**
 * Check if any ancestor is a code block.
 */
function isInsideCodeBlock(ancestors: EditorNode[]): boolean {
  return ancestors.some((node) => node.type === 'code' || node.type === 'code-block');
}

/**
 * Extract the unique key identifier from a Lexical node.
 *
 * In serialized Lexical JSON, each node has a `__key` property that serves as
 * its unique identifier within the editor state. This function retrieves that
 * key, with a fallback mechanism for edge cases.
 *
 * ## Primary Key Source
 *
 * Lexical assigns a unique string key to every node during editor initialization.
 * When the editor state is serialized to JSON (e.g., for persistence), this key
 * is preserved in the `__key` property. The key remains stable across:
 * - Save/load cycles
 * - Editor re-initialization with the same state
 * - Copy/paste within the same editor instance
 *
 * ## Fallback Key Generation
 *
 * The fallback is triggered when `node.__key` is missing or not a string. This
 * can occur in these scenarios:
 *
 * 1. **Corrupted state**: The Lexical JSON was modified externally and the
 *    `__key` property was removed or set to an invalid value
 * 2. **Version mismatch**: An older Lexical version serialized the state
 *    differently, or a future version changes the key format
 * 3. **Manual construction**: Test fixtures or programmatically constructed
 *    nodes that weren't created through Lexical's normal APIs
 * 4. **Import from external source**: Content converted from Markdown or
 *    another format that doesn't have Lexical keys
 *
 * ## Fallback Format
 *
 * When the fallback is used, the key is generated as:
 * ```
 * fallback_${textHash}_${lineIndex}
 * ```
 *
 * Where:
 * - `textHash`: 16-char DJB2 hash of the node's text content (see {@link computeTextHash})
 * - `lineIndex`: The 0-based ordinal position of this list item in the document
 *
 * ## Consequences of Fallback
 *
 * When a fallback key is used instead of the original Lexical key:
 *
 * - **Task reconciliation may fail**: If the same task had a real key before,
 *   it will be treated as a new task (old task orphaned, new task created)
 * - **Position-sensitive**: Moving the task to a different position changes
 *   the fallback key (due to `lineIndex`), causing identity loss
 * - **Text-sensitive**: Editing the task text changes the hash, causing identity loss
 * - **Completion state may reset**: Task completion tracking relies on stable
 *   keys; a key change means the task appears as new/incomplete
 *
 * In practice, fallback keys should be rare. If they occur frequently, it
 * indicates a problem with Lexical state serialization or data corruption.
 *
 * @param node - The Lexical node to extract the key from
 * @param lineIndex - The list item ordinal, used in fallback key generation
 * @returns The node's `__key` property, or a fallback key if unavailable
 *
 * @see computeTextHash for the hash algorithm used in fallback keys
 */
function getNodeKey(node: EditorNode, lineIndex: number): string {
  // Lexical serialized JSON stores the key as __key
  if (typeof node.__key === 'string') {
    return node.__key;
  }
  // Fallback: generate a deterministic key from text content and position
  // This shouldn't happen in practice with real Lexical data, but ensures
  // stable IDs for task reconciliation if it does
  const text = extractTextFromNode(node);
  const textHash = computeTextHash(text);
  return `fallback_${textHash}_${lineIndex}`;
}
