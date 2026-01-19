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
  SELECTION_CHANGE_COMMAND,
  COMMAND_PRIORITY_LOW,
} from 'lexical';
import { createLogger } from '@scribe/shared';

const log = createLogger({ prefix: 'MarkdownRevealPlugin' });

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
   *
   * Note: This state is currently tracked but not yet consumed by other components.
   * Future tasks will use this state to coordinate with MarkdownRevealNode for
   * actual reveal/hide rendering.
   */
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [revealedRegion, setRevealedRegion] = useState<RevealedRegion | null>(null);

  /**
   * Ref for debouncing cursor movement updates.
   * Stores the timeout ID so we can cancel pending updates.
   */
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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

    // No formatting applied to this text node
    if (format === 0) {
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
  }, [editor, detectFormattedRegion]);

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

  // TODO: In future tasks, this plugin will coordinate with MarkdownRevealNode
  // to actually reveal/hide the markdown syntax. For now, it only tracks state.
  //
  // The revealedRegion state can be consumed by:
  // 1. A context provider to share with child components
  // 2. Direct coordination with custom DecoratorNodes
  // 3. CSS class manipulation similar to CollapsibleHeadingPlugin

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
