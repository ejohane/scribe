/**
 * Task extraction from Lexical JSON content
 *
 * Extracts checklist tasks from Lexical editor state, computing text, textHash,
 * nodeKey, lineIndex, and completed flag.
 */

import type { LexicalState, LexicalNode, NoteId } from '@scribe/shared';
import { traverseNodesWithAncestors, extractTextFromNode } from '@scribe/shared';

// DJB2 hash algorithm constants
/** Initial value for DJB2 hash algorithm */
const DJB2_HASH_INITIAL = 5381;
/** Multiplier used in DJB2 hash algorithm */
const DJB2_HASH_MULTIPLIER = 33;
/** Number of hex characters for text hash output */
const TEXT_HASH_LENGTH = 16;

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
  traverseNodesWithAncestors(note.content.root.children, (node, ancestors) => {
    // Check if this is a checklist listitem (has __checked property)
    if (node.type === 'listitem' && '__checked' in node) {
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
 * Check if any ancestor is a code block.
 */
function isInsideCodeBlock(ancestors: LexicalNode[]): boolean {
  return ancestors.some((node) => node.type === 'code' || node.type === 'code-block');
}

/**
 * Compute SHA-256 hash of text (first 16 hex characters).
 * Uses a simple hash implementation since we don't have access to crypto in all environments.
 */
export function computeTextHash(text: string): string {
  // Simple hash implementation based on DJB2 algorithm
  // For production, use SHA-256 via crypto API when available
  let hash = DJB2_HASH_INITIAL;
  for (let i = 0; i < text.length; i++) {
    hash = (hash * DJB2_HASH_MULTIPLIER) ^ text.charCodeAt(i);
  }
  // Convert to hex and pad/truncate to TEXT_HASH_LENGTH chars
  const hexHash = Math.abs(hash).toString(16).padStart(TEXT_HASH_LENGTH, '0');
  return hexHash.slice(0, TEXT_HASH_LENGTH);
}

/**
 * Get the node key from a Lexical node.
 * In serialized Lexical JSON, the key is stored as __key.
 */
function getNodeKey(node: LexicalNode, lineIndex: number): string {
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
