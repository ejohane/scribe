/**
 * MarkdownRevealPlugin
 *
 * Orchestrates hybrid markdown reveal/hide behavior for Typora-style editing.
 * This plugin is the central nervous system for the reveal-on-focus feature,
 * enabling users to see raw markdown syntax only when the cursor is inside
 * a formatted region.
 *
 * Features:
 * - Cursor position tracking via SELECTION_CHANGE_COMMAND
 * - Formatted region detection (bold, italic, code, links, etc.)
 * - Coordination with DecoratorNodes to show/hide raw markdown
 * - Smooth state transitions with debouncing
 * - Boundary-aware reveal logic (only reveals when strictly inside)
 *
 * Architecture:
 * The plugin listens to cursor position changes and determines which formatted
 * region (if any) contains the cursor. It then coordinates with custom nodes
 * to reveal the raw markdown syntax for that region while keeping other
 * formatted text rendered normally.
 *
 * @see CollapsibleHeadingPlugin for similar plugin patterns
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  $getSelection,
  $isRangeSelection,
  $isTextNode,
  $getNodeByKey,
  $createTextNode,
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
} from 'lexical';
import { createLogger } from '@scribe/shared';
import { $createMarkdownRevealNode, $isMarkdownRevealNode } from './MarkdownRevealNode';
import { IS_BOLD, IS_ITALIC, IS_STRIKETHROUGH, IS_CODE } from './markdownReconstruction';

const log = createLogger({ prefix: 'MarkdownRevealPlugin' });

/**
 * Bitmask of formats we handle for markdown reveal.
 * Only these formats will trigger reveal behavior.
 */
const HANDLED_FORMATS = IS_BOLD | IS_ITALIC | IS_STRIKETHROUGH | IS_CODE;

/**
 * Tracks which formatted region (if any) the cursor is currently inside.
 * This drives the reveal/hide behavior for hybrid markdown editing.
 *
 * @property nodeKey - The Lexical node key of the text node containing the formatted region
 * @property format - Lexical format bitmask indicating the type of formatting (bold, italic, etc.)
 * @property startOffset - Character offset where the formatted region begins within the node
 * @property endOffset - Character offset where the formatted region ends within the node
 */
export interface RevealedRegion {
  /** The Lexical node key of the text node containing the formatted region */
  nodeKey: string;
  /** Lexical format bitmask (e.g., IS_BOLD = 1, IS_ITALIC = 2, IS_CODE = 16) */
  format: number;
  /** Character offset where the formatted region begins within the node */
  startOffset: number;
  /** Character offset where the formatted region ends within the node */
  endOffset: number;
}

/**
 * Debounce delay in milliseconds for cursor movement handling.
 * This prevents excessive updates during rapid cursor movement (e.g., holding arrow keys).
 * A small delay improves performance without noticeable lag in the UI.
 */
const CURSOR_DEBOUNCE_MS = 50;

/**
 * Tracks the state of a currently revealed node for restoration.
 * When a TextNode is replaced with a MarkdownRevealNode, we store the
 * original text and format so we can restore it when the cursor exits.
 */
interface RevealedNodeState {
  /** The key of the MarkdownRevealNode that replaced the original TextNode */
  revealNodeKey: string;
  /** The original text content */
  text: string;
  /** The original Lexical format bitmask */
  format: number;
}

/**
 * MarkdownRevealPlugin - Main plugin component for hybrid markdown editing.
 *
 * This plugin orchestrates the reveal/hide behavior for markdown syntax.
 * When the cursor enters a formatted region (bold, italic, code, etc.),
 * the raw markdown syntax is revealed. When the cursor exits, the
 * formatted rendering is restored.
 *
 * Responsibilities:
 * 1. **Cursor Tracking**: Register SELECTION_CHANGE_COMMAND handler to detect cursor movement
 * 2. **Format Detection**: Check if cursor is inside a formatted TextNode
 * 3. **Boundary Logic**: Only reveal when cursor is strictly inside (not at edges)
 * 4. **State Management**: Track currently revealed region via React state
 * 5. **Debouncing**: Prevent flickering during rapid cursor movement
 *
 * Future enhancements (to be implemented in subsequent tasks):
 * - Coordinate with MarkdownRevealNode for actual reveal/hide rendering
 * - Support for block-level markdown (headings, lists, code blocks)
 * - Link URL reveal on focus
 *
 * @returns null - This plugin has no visual output; it only manages state
 *
 * @example
 * ```tsx
 * // In EditorRoot.tsx
 * <LexicalComposer initialConfig={config}>
 *   <MarkdownRevealPlugin />
 *   {// ... other plugins }
 * </LexicalComposer>
 * ```
 */
export function MarkdownRevealPlugin(): JSX.Element | null {
  const [editor] = useLexicalComposerContext();

  /**
   * Currently revealed region, or null if no region is being revealed.
   * When set, the corresponding markdown syntax should be visible.
   */
  const [revealedRegion, setRevealedRegion] = useState<RevealedRegion | null>(null);

  /**
   * Tracks the currently revealed MarkdownRevealNode and its original state.
   * Used to restore the original TextNode when the cursor exits.
   * Using a ref to avoid triggering re-renders on every state change.
   */
  const revealedNodeStateRef = useRef<RevealedNodeState | null>(null);

  /**
   * Ref for debouncing cursor movement updates.
   * Stores the timeout ID so we can cancel pending updates.
   */
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Checks if the cursor is adjacent to (immediately before or after) a MarkdownRevealNode.
   * This is used to determine if we should keep the reveal visible when the cursor
   * moves to the boundary of the revealed region.
   *
   * @returns The key of the adjacent MarkdownRevealNode, or null if not adjacent
   */
  const getAdjacentRevealNodeKey = useCallback((): string | null => {
    const selection = $getSelection();
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      return null;
    }

    const anchor = selection.anchor;
    const anchorNode = anchor.getNode();

    // If we're directly in a MarkdownRevealNode (shouldn't happen but check)
    if ($isMarkdownRevealNode(anchorNode)) {
      return anchorNode.getKey();
    }

    // Check if we're in an element and adjacent to a MarkdownRevealNode
    if ($isTextNode(anchorNode)) {
      const offset = anchor.offset;
      const textLength = anchorNode.getTextContentSize();

      // At the end of a text node, check the next sibling
      if (offset === textLength) {
        const nextSibling = anchorNode.getNextSibling();
        if ($isMarkdownRevealNode(nextSibling)) {
          return nextSibling.getKey();
        }
      }

      // At the start of a text node, check the previous sibling
      if (offset === 0) {
        const prevSibling = anchorNode.getPreviousSibling();
        if ($isMarkdownRevealNode(prevSibling)) {
          return prevSibling.getKey();
        }
      }
    }

    // Check siblings at the element level
    const parent = anchorNode.getParent();
    if (parent) {
      // If anchor is at start of its node, check previous sibling
      if (anchor.offset === 0) {
        const prevSibling = anchorNode.getPreviousSibling();
        if ($isMarkdownRevealNode(prevSibling)) {
          return prevSibling.getKey();
        }
      }

      // Check if the anchor node itself is a MarkdownRevealNode
      if ($isMarkdownRevealNode(anchorNode)) {
        return anchorNode.getKey();
      }
    }

    return null;
  }, []);

  /**
   * Detects if the current selection is inside a formatted region.
   * Returns the region details if found, or null if not in a formatted region.
   *
   * This function examines the current selection and determines:
   * 1. If the selection is collapsed (cursor, not a range)
   * 2. If the cursor is inside a text node
   * 3. If that text node has formatting applied
   * 4. The boundaries of the formatted region
   *
   * @returns RevealedRegion if cursor is in a formatted region, null otherwise
   */
  const detectFormattedRegion = useCallback((): RevealedRegion | null => {
    const selection = $getSelection();

    // Only handle collapsed selections (cursor position, not text selection)
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      return null;
    }

    const anchor = selection.anchor;
    const anchorNode = anchor.getNode();

    // Only handle text nodes
    if (!$isTextNode(anchorNode)) {
      return null;
    }

    const format = anchorNode.getFormat();

    // No formatting applied to this text node, or format is not one we handle
    if (format === 0 || !(format & HANDLED_FORMATS)) {
      return null;
    }

    const offset = anchor.offset;
    const textLength = anchorNode.getTextContentSize();

    // Boundary check: don't reveal at the very start or end of the formatted text
    // This allows users to easily exit the formatted region
    if (offset === 0 || offset === textLength) {
      return null;
    }

    // Cursor is inside a formatted region
    return {
      nodeKey: anchorNode.getKey(),
      format,
      startOffset: 0,
      endOffset: textLength,
    };
  }, []);

  /**
   * Handles cursor position changes with debouncing.
   * Updates the revealed region state based on current cursor position.
   *
   * This function coordinates three scenarios:
   * 1. Cursor enters a new formatted region → reveal markdown
   * 2. Cursor stays adjacent to current reveal → keep revealed
   * 3. Cursor moves away from reveal → hide markdown
   */
  const handleSelectionChange = useCallback(() => {
    // Clear any pending debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce the detection to prevent excessive updates
    debounceTimeoutRef.current = setTimeout(() => {
      editor.getEditorState().read(() => {
        const newRegion = detectFormattedRegion();
        const currentRevealState = revealedNodeStateRef.current;

        // If we have a currently revealed node, check if we're still adjacent to it
        if (currentRevealState) {
          const adjacentRevealKey = getAdjacentRevealNodeKey();

          // If cursor is adjacent to our current reveal node, keep it revealed
          if (adjacentRevealKey === currentRevealState.revealNodeKey) {
            log.debug('Cursor adjacent to reveal, keeping visible');
            return; // Don't change state, keep current reveal
          }
        }

        // Only update state if the region has changed
        setRevealedRegion((prevRegion) => {
          // Both null - no change
          if (!prevRegion && !newRegion) {
            return null;
          }

          // Region changed from null to something, or vice versa
          if (!prevRegion || !newRegion) {
            if (newRegion) {
              log.debug('Revealing region', {
                nodeKey: newRegion.nodeKey,
                format: newRegion.format,
              });
            } else {
              log.debug('Hiding region');
            }
            return newRegion;
          }

          // Check if the region actually changed
          if (
            prevRegion.nodeKey !== newRegion.nodeKey ||
            prevRegion.format !== newRegion.format ||
            prevRegion.startOffset !== newRegion.startOffset ||
            prevRegion.endOffset !== newRegion.endOffset
          ) {
            log.debug('Region changed', {
              from: prevRegion.nodeKey,
              to: newRegion.nodeKey,
            });
            return newRegion;
          }

          // No change
          return prevRegion;
        });
      });
    }, CURSOR_DEBOUNCE_MS);
  }, [editor, detectFormattedRegion, getAdjacentRevealNodeKey]);

  /**
   * Register SELECTION_CHANGE_COMMAND handler to track cursor position.
   * This is the primary mechanism for detecting when to reveal/hide markdown.
   */
  useEffect(() => {
    return editor.registerCommand(
      SELECTION_CHANGE_COMMAND,
      () => {
        handleSelectionChange();
        // Return false to allow other handlers to also process this command
        return false;
      },
      COMMAND_PRIORITY_LOW
    );
  }, [editor, handleSelectionChange]);

  /**
   * Also listen to editor updates for cases where selection changes
   * happen as part of larger editor state changes.
   */
  useEffect(() => {
    return editor.registerUpdateListener(({ tags }) => {
      // Skip history-related updates to avoid unnecessary processing
      if (tags.has('history-merge') || tags.has('historic')) {
        return;
      }
      handleSelectionChange();
    });
  }, [editor, handleSelectionChange]);

  /**
   * Cleanup debounce timeout on unmount.
   */
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  /**
   * Reveals markdown syntax for a formatted text node.
   * Replaces the TextNode with a MarkdownRevealNode showing raw markdown.
   *
   * @param nodeKey - The key of the TextNode to reveal
   */
  const revealFormattedText = useCallback(
    (nodeKey: string) => {
      editor.update(
        () => {
          const textNode = $getNodeByKey(nodeKey);

          // Verify it's still a TextNode (might have changed)
          if (!$isTextNode(textNode)) {
            log.debug('Node is no longer a TextNode, skipping reveal', { nodeKey });
            return;
          }

          const text = textNode.getTextContent();
          const format = textNode.getFormat();

          // Double-check this is a format we handle
          if (!(format & HANDLED_FORMATS)) {
            log.debug('Node format not handled, skipping reveal', { nodeKey, format });
            return;
          }

          // Create the reveal node
          const revealNode = $createMarkdownRevealNode(text, format);

          // Replace the text node with reveal node
          textNode.replace(revealNode);

          // Store state for restoration
          revealedNodeStateRef.current = {
            revealNodeKey: revealNode.getKey(),
            text,
            format,
          };

          log.debug('Revealed markdown', {
            nodeKey: revealNode.getKey(),
            text,
            format,
          });
        },
        {
          // Use discrete to prevent this from being added to undo history
          discrete: true,
        }
      );
    },
    [editor]
  );

  /**
   * Hides the revealed markdown and restores the original TextNode.
   * Called when cursor exits the revealed region.
   */
  const hideRevealedMarkdown = useCallback(() => {
    const state = revealedNodeStateRef.current;
    if (!state) {
      return;
    }

    editor.update(
      () => {
        const revealNode = $getNodeByKey(state.revealNodeKey);

        // Verify it's still a MarkdownRevealNode
        if (!$isMarkdownRevealNode(revealNode)) {
          log.debug('Node is no longer a MarkdownRevealNode, skipping hide', {
            nodeKey: state.revealNodeKey,
          });
          revealedNodeStateRef.current = null;
          return;
        }

        // Create a new TextNode with the original text and format
        const textNode = $createTextNode(state.text);
        textNode.setFormat(state.format);

        // Replace the reveal node with the text node
        revealNode.replace(textNode);

        log.debug('Hid markdown', {
          nodeKey: textNode.getKey(),
          text: state.text,
          format: state.format,
        });

        // Clear the stored state
        revealedNodeStateRef.current = null;
      },
      {
        // Use discrete to prevent this from being added to undo history
        discrete: true,
      }
    );
  }, [editor]);

  /**
   * Effect that triggers reveal/hide based on revealedRegion changes.
   * This is the main coordination point between cursor tracking and node replacement.
   *
   * Handles three scenarios:
   * 1. revealedRegion goes from null to a region → reveal that region
   * 2. revealedRegion goes from a region to null → hide current reveal
   * 3. revealedRegion changes to a different region → hide current, reveal new
   */
  useEffect(() => {
    const currentState = revealedNodeStateRef.current;

    // Case 1 & 3: If revealedRegion is null, hide any current reveal
    if (!revealedRegion) {
      if (currentState) {
        hideRevealedMarkdown();
      }
      return;
    }

    // Case 2: revealedRegion is set, check if we need to reveal
    // If we already have a reveal for a different node, hide it first
    if (currentState) {
      // We already have a reveal - this might be a transition to a new region
      // The handleSelectionChange logic should prevent this from running
      // when we're still adjacent to the current reveal, but just in case:
      hideRevealedMarkdown();
    }

    // Now reveal the new region
    revealFormattedText(revealedRegion.nodeKey);
  }, [revealedRegion, hideRevealedMarkdown, revealFormattedText]);

  /**
   * Cleanup: ensure we restore any revealed nodes when the plugin unmounts.
   */
  useEffect(() => {
    return () => {
      // On unmount, restore any revealed markdown
      if (revealedNodeStateRef.current) {
        hideRevealedMarkdown();
      }
    };
  }, [hideRevealedMarkdown]);

  // This plugin has no visual output
  return null;
}

/**
 * Hook to get the currently revealed region.
 * This will be useful when other components need to know about reveal state.
 *
 * Note: This is a placeholder for future implementation.
 * The actual implementation may use React Context for better encapsulation.
 *
 * @returns The currently revealed region, or null if nothing is revealed
 */
// export function useRevealedRegion(): RevealedRegion | null {
//   // TODO: Implement using React Context in a future task
//   return null;
// }
