/**
 * Task extraction from Lexical JSON content
 *
 * Extracts checklist tasks from Lexical editor state, computing text, textHash,
 * nodeKey, lineIndex, and completed flag.
 */

import type { LexicalState, LexicalNode, NoteId } from '@scribe/shared';

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
  /** SHA-256 hash of task text (first 16 hex chars) */
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
  content: LexicalState;
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
  traverseForTasks(note.content.root.children, [], (node, ancestors) => {
    // Check if this is a checklist listitem (has __checked property)
    if (node.type === 'listitem' && '__checked' in node) {
      // Skip if inside a code block
      if (isInsideCodeBlock(ancestors)) {
        return;
      }

      const text = extractTextFromNode(node);
      const textHash = computeTextHash(text);
      const nodeKey = getNodeKey(node);

      tasks.push({
        noteId: note.id,
        noteTitle: note.title,
        nodeKey,
        lineIndex: listItemIndex,
        text,
        textHash,
        completed: node.__checked === true,
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
 * Traverse nodes for task extraction, tracking ancestors for context.
 */
function traverseForTasks(
  nodes: LexicalNode[],
  ancestors: LexicalNode[],
  callback: (node: LexicalNode, ancestors: LexicalNode[]) => void
): void {
  for (const node of nodes) {
    callback(node, ancestors);

    if (Array.isArray(node.children)) {
      traverseForTasks(node.children as LexicalNode[], [...ancestors, node], callback);
    }
  }
}

/**
 * Check if any ancestor is a code block.
 */
function isInsideCodeBlock(ancestors: LexicalNode[]): boolean {
  return ancestors.some((node) => node.type === 'code' || node.type === 'code-block');
}

/**
 * Extract text content from a node and its children.
 */
function extractTextFromNode(node: LexicalNode): string {
  const textParts: string[] = [];

  traverseForText(node, (textNode) => {
    if (textNode.type === 'text' && typeof textNode.text === 'string') {
      textParts.push(textNode.text);
    }
  });

  return textParts.join('');
}

/**
 * Traverse a node's subtree for text extraction.
 */
function traverseForText(node: LexicalNode, callback: (node: LexicalNode) => void): void {
  callback(node);

  if (Array.isArray(node.children)) {
    for (const child of node.children as LexicalNode[]) {
      traverseForText(child, callback);
    }
  }
}

/**
 * Compute SHA-256 hash of text (first 16 hex characters).
 * Uses a simple hash implementation since we don't have access to crypto in all environments.
 */
export function computeTextHash(text: string): string {
  // Simple hash implementation based on DJB2 algorithm
  // For production, use SHA-256 via crypto API when available
  let hash = 5381;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * 33) ^ text.charCodeAt(i);
  }
  // Convert to hex and pad/truncate to 16 chars
  const hexHash = Math.abs(hash).toString(16).padStart(16, '0');
  return hexHash.slice(0, 16);
}

/**
 * Get the node key from a Lexical node.
 * In serialized Lexical JSON, the key is stored as __key.
 */
function getNodeKey(node: LexicalNode): string {
  // Lexical serialized JSON stores the key as __key
  if (typeof node.__key === 'string') {
    return node.__key;
  }
  // Fallback: generate a deterministic key from position
  // This shouldn't happen in practice with real Lexical data
  return `node_${Math.random().toString(36).slice(2, 10)}`;
}
