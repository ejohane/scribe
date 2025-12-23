/**
 * FocusNodePlugin
 *
 * Provides a command to focus/navigate to a specific node in the editor.
 * Used primarily by the Tasks panel/screen to navigate to task items in their source documents.
 *
 * The plugin implements a fallback chain for node identification:
 * 1. Primary: Find node by exact nodeKey
 * 2. Fallback: Find checklist item with matching textHash
 * 3. Last resort: Find listitem at the specified lineIndex
 */

import { useEffect } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getNodeByKey,
  $getRoot,
  $isElementNode,
  createCommand,
  COMMAND_PRIORITY_LOW,
  type LexicalCommand,
  type LexicalNode,
  type ElementNode,
  $setSelection,
  $createRangeSelection,
} from 'lexical';
import { $isListItemNode, ListItemNode } from '@lexical/list';
import { HeadingNode, $isHeadingNode } from '@lexical/rich-text';
import { createLogger } from '@scribe/shared';
import { computeTextHash } from '@scribe/engine-core';
import { $isCollapsibleHeadingNode } from './CollapsibleHeadingNode';

const log = createLogger({ prefix: 'FocusNodePlugin' });

/**
 * Payload for the FOCUS_NODE_COMMAND.
 * Contains primary key and fallback identifiers for node location.
 */
export interface FocusNodePayload {
  /** Primary identifier: Lexical node key */
  nodeKey: string;
  /** Fallback: list item block ordinal (0-based index) */
  lineIndexFallback?: number;
  /** Fallback: hash of the task text for fuzzy matching */
  textHashFallback?: string;
}

/**
 * Command to focus and scroll to a specific node in the editor.
 * Dispatched when user clicks a task in the Tasks panel/screen.
 */
export const FOCUS_NODE_COMMAND: LexicalCommand<FocusNodePayload> =
  createCommand('FOCUS_NODE_COMMAND');

/**
 * Extract text content from a node and its descendants.
 */
function getNodeTextContent(node: LexicalNode): string {
  return node.getTextContent();
}

/**
 * Find a checklist item node by textHash.
 * Traverses all nodes looking for checklist listitems that match the hash.
 */
function findNodeByTextHash(root: ElementNode, textHash: string): ListItemNode | null {
  const nodes = root.getChildren();

  for (const node of nodes) {
    // Check if this is a checklist item
    if ($isListItemNode(node)) {
      // Check if it's a checklist item (has checked value)
      const value = node.getChecked();
      if (value !== undefined) {
        // Compute hash of this node's text
        const text = getNodeTextContent(node);
        const hash = computeTextHash(text);
        if (hash === textHash) {
          return node;
        }
      }
    }

    // Recursively search children
    if ($isElementNode(node)) {
      const found = findNodeByTextHash(node, textHash);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Find a listitem node at a specific line index (0-based).
 * Counts all listitems in document order.
 */
function findNodeByLineIndex(root: ElementNode, targetIndex: number): ListItemNode | null {
  let currentIndex = 0;

  function traverse(node: LexicalNode): ListItemNode | null {
    if ($isListItemNode(node)) {
      if (currentIndex === targetIndex) {
        return node;
      }
      currentIndex++;
    }

    // Recursively search children
    if ($isElementNode(node)) {
      const children = node.getChildren();
      for (const child of children) {
        const found = traverse(child);
        if (found) return found;
      }
    }

    return null;
  }

  return traverse(root);
}

/**
 * Find a heading node by textHash.
 * Traverses all nodes looking for headings that match the hash.
 */
function findHeadingByTextHash(root: ElementNode, textHash: string): HeadingNode | null {
  const nodes = root.getChildren();

  for (const node of nodes) {
    // Check if this is a heading (either regular HeadingNode or CollapsibleHeadingNode)
    if ($isHeadingNode(node) || $isCollapsibleHeadingNode(node)) {
      // Compute hash of this node's text
      const text = getNodeTextContent(node);
      const hash = computeTextHash(text);
      if (hash === textHash) {
        return node as HeadingNode;
      }
    }

    // Recursively search children (for nested structures)
    if ($isElementNode(node)) {
      const found = findHeadingByTextHash(node, textHash);
      if (found) return found;
    }
  }

  return null;
}

/**
 * Find a heading node at a specific line index (0-based).
 * Counts top-level block elements in document order.
 */
function findHeadingByLineIndex(root: ElementNode, targetIndex: number): HeadingNode | null {
  const children = root.getChildren();

  for (let i = 0; i < children.length; i++) {
    if (i === targetIndex) {
      const node = children[i];
      if ($isHeadingNode(node) || $isCollapsibleHeadingNode(node)) {
        return node as HeadingNode;
      }
    }
  }

  return null;
}

/**
 * Scroll a node's DOM element into view, positioned about 1/3 from the top of the viewport.
 */
function scrollToElement(element: HTMLElement): void {
  // Find the scrollable container - walk up to find element with overflow-y: auto/scroll
  let scrollContainer: HTMLElement | null = element.parentElement;
  while (scrollContainer) {
    const style = window.getComputedStyle(scrollContainer);
    if (style.overflowY === 'auto' || style.overflowY === 'scroll') {
      break;
    }
    scrollContainer = scrollContainer.parentElement;
  }

  if (scrollContainer) {
    // Calculate position relative to the scroll container
    // Target: element should be ~1/3 down from top of container
    const containerRect = scrollContainer.getBoundingClientRect();
    const elementRect = element.getBoundingClientRect();
    const elementTopInContainer = elementRect.top - containerRect.top + scrollContainer.scrollTop;
    const containerTargetOffset = containerRect.height / 3;

    scrollContainer.scrollTo({
      top: Math.max(0, elementTopInContainer - containerTargetOffset),
      behavior: 'smooth',
    });
  } else {
    // Fallback: use scrollIntoView (for test environment or when no scroll container found)
    // Use block: 'center' as a reasonable approximation of the 1/3 positioning
    element.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
      inline: 'nearest',
    });
  }
}

/**
 * Scroll a node's DOM element into view and place cursor at start.
 */
function focusNode(
  node: LexicalNode,
  editor: ReturnType<typeof useLexicalComposerContext>[0]
): void {
  // Get the DOM element for this node
  const element = editor.getElementByKey(node.getKey());
  if (element) {
    // Scroll the element to ~1/3 from top of viewport
    scrollToElement(element);

    // Add a brief highlight effect for visual feedback
    element.classList.add('focus-highlight');
    setTimeout(() => {
      element.classList.remove('focus-highlight');
    }, 1500);
  }

  // Place cursor at the start of the node
  // For list items, we want to select the first text position
  const selection = $createRangeSelection();

  // For ListItemNode, use selectStart() for proper cursor placement
  if ($isListItemNode(node)) {
    node.selectStart();
  } else if ($isElementNode(node)) {
    // For other element nodes, try to select the first child
    const firstChild = node.getFirstChild();
    if (firstChild) {
      selection.anchor.set(firstChild.getKey(), 0, 'text');
      selection.focus.set(firstChild.getKey(), 0, 'text');
      $setSelection(selection);
    } else {
      selection.anchor.set(node.getKey(), 0, 'element');
      selection.focus.set(node.getKey(), 0, 'element');
      $setSelection(selection);
    }
  } else {
    // Fallback: select the node itself
    selection.anchor.set(node.getKey(), 0, 'element');
    selection.focus.set(node.getKey(), 0, 'element');
    $setSelection(selection);
  }
}

/**
 * Plugin that handles the FOCUS_NODE_COMMAND.
 * When dispatched, attempts to find and focus the target node using a fallback chain.
 */
export function FocusNodePlugin(): null {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    return editor.registerCommand(
      FOCUS_NODE_COMMAND,
      (payload: FocusNodePayload) => {
        const { nodeKey, lineIndexFallback, textHashFallback } = payload;

        log.debug('FOCUS_NODE_COMMAND received', {
          nodeKey,
          textHashFallback,
          lineIndexFallback,
        });

        // Strategy 1: Try to find node by exact nodeKey
        let targetNode = $getNodeByKey(nodeKey);

        // Strategy 2: If not found, try textHash fallback
        // First try list items (for tasks), then try headings (for outline)
        if (!targetNode && textHashFallback) {
          const root = $getRoot();
          targetNode = findNodeByTextHash(root, textHashFallback);
          if (!targetNode) {
            targetNode = findHeadingByTextHash(root, textHashFallback);
          }
        }

        // Strategy 3: If still not found, try lineIndex fallback
        // First try list items, then try headings
        if (!targetNode && lineIndexFallback !== undefined) {
          const root = $getRoot();
          targetNode = findNodeByLineIndex(root, lineIndexFallback);
          if (!targetNode) {
            targetNode = findHeadingByLineIndex(root, lineIndexFallback);
          }
        }

        // If we found a node, focus it
        if (targetNode) {
          focusNode(targetNode, editor);
          return true;
        }

        // Node not found - log for debugging
        log.warn('Could not find node', {
          nodeKey,
          textHashFallback,
          lineIndexFallback,
        });

        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor]);

  return null;
}
