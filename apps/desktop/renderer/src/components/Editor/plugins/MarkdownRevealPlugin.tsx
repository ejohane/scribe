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
 * - Heading prefix reveal (# prefix) when cursor is on heading line
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
 * For headings, it uses DOM manipulation to show the prefix (e.g., "## ") at
 * the start of the heading line when the cursor is anywhere on that line.
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
import {
  IS_BOLD,
  IS_ITALIC,
  IS_STRIKETHROUGH,
  IS_CODE,
  BLOCK_PREFIXES,
} from './markdownReconstruction';
import { $isCollapsibleHeadingNode } from './CollapsibleHeadingNode';
import { $isQuoteNode } from '@lexical/rich-text';
import { $isListItemNode, $isListNode } from '@lexical/list';
import { $isCodeNode, $isCodeHighlightNode } from '@lexical/code';
import type { HeadingTagType } from '@lexical/rich-text';
import type { ListType } from '@lexical/list';
import type { CodeNode } from '@lexical/code';

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
 * 16ms corresponds to one frame at 60fps, providing responsive feel without excessive processing.
 * For high-frequency operations like typing and arrow key navigation, this is the sweet spot
 * between responsiveness and performance.
 */
const CURSOR_DEBOUNCE_MS = 16;

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
 * Tracks the currently focused heading for prefix reveal.
 * When the cursor is on a heading line, we show the markdown prefix (e.g., "## ").
 */
interface FocusedHeading {
  /** The Lexical node key of the heading */
  nodeKey: string;
  /** The heading tag (h1, h2, ..., h6) */
  tag: HeadingTagType;
}

/**
 * Tracks the currently focused blockquote for prefix reveal.
 * When the cursor is on a blockquote line, we show the markdown prefix (e.g., "> ").
 * For nested blockquotes, we show multiple prefixes (e.g., ">> ").
 */
interface FocusedBlockquote {
  /** The Lexical node key of the blockquote (the innermost QuoteNode containing cursor) */
  nodeKey: string;
  /** The nesting level (1 for single quote, 2 for nested, etc.) */
  nestingLevel: number;
}

/**
 * Tracks the currently focused list item for prefix reveal.
 * When the cursor is on a list item, we show the markdown prefix (e.g., "- " or "1. ").
 */
interface FocusedListItem {
  /** The Lexical node key of the ListItemNode containing the cursor */
  nodeKey: string;
  /** The type of list (bullet, number, or check) */
  listType: ListType;
  /** The 1-based index of the item in the list (only used for numbered lists) */
  itemIndex: number;
  /** The nesting level (1 for top-level, 2 for nested, etc.) */
  nestingLevel: number;
  /** Whether the item is checked (only for checklist items) */
  isChecked: boolean;
}

/**
 * Tracks the currently focused code block for fence reveal.
 * When the cursor is on the first line of a code block, we show the opening fence (```lang).
 * When the cursor is on the last line, we show the closing fence (```).
 */
interface FocusedCodeBlock {
  /** The Lexical node key of the CodeNode containing the cursor */
  nodeKey: string;
  /** The programming language (e.g., "typescript", "python", or empty string) */
  language: string;
  /** Which fence to show: 'open', 'close', or 'both' (for empty/single-line code blocks) */
  fenceType: 'open' | 'close' | 'both';
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
   * Currently focused heading for prefix reveal, or null if cursor is not on a heading.
   * When set, the heading prefix (e.g., "## ") should be visible.
   */
  const [focusedHeading, setFocusedHeading] = useState<FocusedHeading | null>(null);

  /**
   * Currently focused blockquote for prefix reveal, or null if cursor is not in a blockquote.
   * When set, the blockquote prefix (e.g., "> ") should be visible.
   */
  const [focusedBlockquote, setFocusedBlockquote] = useState<FocusedBlockquote | null>(null);

  /**
   * Currently focused list item for prefix reveal, or null if cursor is not on a list item.
   * When set, the list prefix (e.g., "- " or "1. ") should be visible.
   */
  const [focusedListItem, setFocusedListItem] = useState<FocusedListItem | null>(null);

  /**
   * Currently focused code block for fence reveal, or null if cursor is not in a code block.
   * When set, the appropriate fence(s) should be visible.
   */
  const [focusedCodeBlock, setFocusedCodeBlock] = useState<FocusedCodeBlock | null>(null);

  /**
   * Tracks the currently revealed MarkdownRevealNode and its original state.
   * Used to restore the original TextNode when the cursor exits.
   * Using a ref to avoid triggering re-renders on every state change.
   */
  const revealedNodeStateRef = useRef<RevealedNodeState | null>(null);

  /**
   * Ref to track the DOM element of the currently revealed heading prefix.
   * Used to clean up the prefix element when cursor exits the heading.
   */
  const headingPrefixRef = useRef<HTMLSpanElement | null>(null);

  /**
   * Ref to track the DOM element of the currently revealed blockquote prefix.
   * Used to clean up the prefix element when cursor exits the blockquote.
   */
  const blockquotePrefixRef = useRef<HTMLSpanElement | null>(null);

  /**
   * Ref to track the DOM element of the currently revealed list item prefix.
   * Used to clean up the prefix element when cursor exits the list item.
   */
  const listItemPrefixRef = useRef<HTMLSpanElement | null>(null);

  /**
   * Ref to track the DOM element of the currently revealed code block opening fence.
   * Used to clean up the fence element when cursor exits the code block.
   */
  const codeBlockOpenFenceRef = useRef<HTMLSpanElement | null>(null);

  /**
   * Ref to track the DOM element of the currently revealed code block closing fence.
   * Used to clean up the fence element when cursor exits the code block.
   */
  const codeBlockCloseFenceRef = useRef<HTMLSpanElement | null>(null);

  /**
   * Ref for debouncing cursor movement updates.
   * Stores the timeout ID so we can cancel pending updates.
   */
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /**
   * Ref to track the previous cursor position for optimization.
   * Used to skip processing when the cursor position hasn't actually changed.
   * Tracks the anchor node key and offset to detect actual movement.
   */
  const prevCursorRef = useRef<{ nodeKey: string; offset: number } | null>(null);

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

    const textLength = anchorNode.getTextContentSize();

    // Per spec: cursor anywhere INSIDE a formatted TextNode triggers reveal.
    // The formatting markers (**bold**) are NOT stored in the TextNode - only the
    // text content exists. So any position within the TextNode (including offset 0
    // and textLength) is "inside" the formatted region.
    //
    // The "boundary" where we don't reveal is BEFORE or AFTER the TextNode entirely,
    // not at the edges of its text content. This is handled automatically because:
    // - Position before the TextNode = cursor is in a different node (previous sibling or element)
    // - Position after the TextNode = cursor is in a different node (next sibling or element)
    //
    // Edge case: empty formatted text (textLength === 0) should still reveal
    // so the user can see and edit the delimiters.

    // Cursor is inside a formatted region
    return {
      nodeKey: anchorNode.getKey(),
      format,
      startOffset: 0,
      endOffset: textLength,
    };
  }, []);

  /**
   * Detects if the current selection is inside a heading line.
   * Returns the heading details if found, or null if not on a heading.
   *
   * Unlike inline formats where cursor must be strictly inside,
   * for headings we reveal when cursor is ANYWHERE on that line.
   *
   * @returns FocusedHeading if cursor is on a heading line, null otherwise
   */
  const detectHeadingFocus = useCallback((): FocusedHeading | null => {
    const selection = $getSelection();

    // Only handle collapsed selections (cursor position, not text selection)
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      return null;
    }

    const anchor = selection.anchor;
    const anchorNode = anchor.getNode();

    // Check if the anchor node's parent is a CollapsibleHeadingNode
    const parent = anchorNode.getParent();
    if ($isCollapsibleHeadingNode(parent)) {
      return {
        nodeKey: parent.getKey(),
        tag: parent.getTag(),
      };
    }

    // Check if the anchor node itself is a CollapsibleHeadingNode (empty heading case)
    if ($isCollapsibleHeadingNode(anchorNode)) {
      return {
        nodeKey: anchorNode.getKey(),
        tag: anchorNode.getTag(),
      };
    }

    return null;
  }, []);

  /**
   * Detects if the current selection is inside a blockquote.
   * Returns the blockquote details if found, or null if not in a blockquote.
   *
   * Unlike inline formats where cursor must be strictly inside,
   * for blockquotes we reveal when cursor is ANYWHERE on that line.
   * Also calculates the nesting level for nested blockquotes (>> prefix).
   *
   * @returns FocusedBlockquote if cursor is in a blockquote, null otherwise
   */
  const detectBlockquoteFocus = useCallback((): FocusedBlockquote | null => {
    const selection = $getSelection();

    // Only handle collapsed selections (cursor position, not text selection)
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      return null;
    }

    const anchor = selection.anchor;
    const anchorNode = anchor.getNode();

    // Walk up the tree to find the innermost QuoteNode and count nesting levels
    let currentNode = anchorNode.getParent();
    let quoteNode = null;
    let nestingLevel = 0;

    while (currentNode) {
      if ($isQuoteNode(currentNode)) {
        // Track the innermost quote node (first one we encounter)
        if (!quoteNode) {
          quoteNode = currentNode;
        }
        nestingLevel++;
      }
      currentNode = currentNode.getParent();
    }

    // Also check if the anchor node itself is a QuoteNode (empty blockquote case)
    if ($isQuoteNode(anchorNode)) {
      return {
        nodeKey: anchorNode.getKey(),
        nestingLevel: 1,
      };
    }

    if (quoteNode) {
      return {
        nodeKey: quoteNode.getKey(),
        nestingLevel,
      };
    }

    return null;
  }, []);

  /**
   * Detects if the current selection is inside a list item.
   * Returns the list item details if found, or null if not in a list item.
   *
   * Unlike inline formats where cursor must be strictly inside,
   * for list items we reveal when cursor is ANYWHERE on that line.
   * Also calculates the nesting level and item index for proper prefix generation.
   *
   * @returns FocusedListItem if cursor is on a list item, null otherwise
   */
  const detectListItemFocus = useCallback((): FocusedListItem | null => {
    const selection = $getSelection();

    // Only handle collapsed selections (cursor position, not text selection)
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      return null;
    }

    const anchor = selection.anchor;
    const anchorNode = anchor.getNode();

    // Walk up the tree to find the ListItemNode
    let currentNode = anchorNode.getParent();
    let listItemNode = null;

    while (currentNode) {
      if ($isListItemNode(currentNode)) {
        listItemNode = currentNode;
        break;
      }
      currentNode = currentNode.getParent();
    }

    // Also check if the anchor node itself is a ListItemNode (empty list item case)
    if (!listItemNode && $isListItemNode(anchorNode)) {
      listItemNode = anchorNode;
    }

    if (!listItemNode) {
      return null;
    }

    // Get the parent list to determine type and item index
    const listNode = listItemNode.getParent();
    if (!$isListNode(listNode)) {
      return null;
    }

    const listType = listNode.getListType();
    const itemIndex = listItemNode.getIndexWithinParent() + 1; // 1-based index
    const isChecked = listType === 'check' ? Boolean(listItemNode.getChecked()) : false;

    // Calculate nesting level by counting ancestor ListNodes
    let nestingLevel = 1;
    let parent = listNode.getParent();
    while (parent) {
      if ($isListItemNode(parent)) {
        const parentList = parent.getParent();
        if ($isListNode(parentList)) {
          nestingLevel++;
        }
      }
      parent = parent.getParent();
    }

    return {
      nodeKey: listItemNode.getKey(),
      listType,
      itemIndex,
      nestingLevel,
      isChecked,
    };
  }, []);

  /**
   * Detects if the current selection is inside a code block.
   * Returns the code block details if found, including which fence(s) to show.
   *
   * Code blocks have unique reveal rules:
   * - First line focused: show opening fence ```language
   * - Last line focused: show closing fence ```
   * - Empty code block (single line): show both fences
   * - Middle lines: no additional reveal needed
   *
   * @returns FocusedCodeBlock if cursor is in a code block on first/last line, null otherwise
   */
  const detectCodeBlockFocus = useCallback((): FocusedCodeBlock | null => {
    const selection = $getSelection();

    // Only handle collapsed selections (cursor position, not text selection)
    if (!$isRangeSelection(selection) || !selection.isCollapsed()) {
      return null;
    }

    const anchor = selection.anchor;
    const anchorNode = anchor.getNode();

    // Find the CodeNode parent
    let codeNode: CodeNode | null = null;

    // Check if the anchor node is directly a CodeNode (empty code block case)
    if ($isCodeNode(anchorNode)) {
      codeNode = anchorNode;
    }
    // Check if the anchor node's parent is a CodeNode
    else if ($isCodeHighlightNode(anchorNode) || $isTextNode(anchorNode)) {
      const parent = anchorNode.getParent();
      if ($isCodeNode(parent)) {
        codeNode = parent;
      }
    }
    // Check grandparent for nested structure
    else {
      const parent = anchorNode.getParent();
      if (parent && $isCodeNode(parent)) {
        codeNode = parent;
      }
    }

    if (!codeNode) {
      return null;
    }

    // Get the language for the opening fence
    const language = codeNode.getLanguage() || '';

    // Get the text content to determine line information
    const textContent = codeNode.getTextContent();
    const lines = textContent.split('\n');
    const totalLines = lines.length;

    // Calculate which line the cursor is on
    // We need to find the cursor's position within the code block
    let cursorLine = 0;

    if ($isCodeNode(anchorNode)) {
      // Cursor is directly in the CodeNode (empty or element selection)
      // This typically means an empty code block
      cursorLine = 0;
    } else {
      // Find the cursor position by examining children
      const children = codeNode.getChildren();
      let charCount = 0;
      let foundNode = false;

      for (const child of children) {
        if (child.getKey() === anchorNode.getKey()) {
          // Found our node, add the offset within this node
          charCount += anchor.offset;
          foundNode = true;
          break;
        }
        charCount += child.getTextContentSize();
      }

      if (foundNode) {
        // Count newlines up to cursor position
        let newlineCount = 0;
        let pos = 0;
        for (let i = 0; i < textContent.length && pos < charCount; i++) {
          if (textContent[i] === '\n') {
            newlineCount++;
          }
          pos++;
        }
        cursorLine = newlineCount;
      }
    }

    // Determine which fence to show
    let fenceType: 'open' | 'close' | 'both';

    if (totalLines <= 1) {
      // Empty or single-line code block - show both fences
      fenceType = 'both';
    } else if (cursorLine === 0) {
      // First line - show opening fence
      fenceType = 'open';
    } else if (cursorLine === totalLines - 1) {
      // Last line - show closing fence
      fenceType = 'close';
    } else {
      // Middle line - no fence reveal needed
      return null;
    }

    return {
      nodeKey: codeNode.getKey(),
      language,
      fenceType,
    };
  }, []);

  /**
   * Handles cursor position changes with debouncing and performance optimizations.
   * Updates the revealed region state based on current cursor position.
   *
   * Performance optimizations:
   * - Early exit if cursor position hasn't actually changed (same node and offset)
   * - Debounced processing to batch rapid cursor movements
   * - Batched state updates to reduce React reconciliation cycles
   *
   * This function coordinates multiple scenarios:
   * 1. Cursor enters a new formatted region → reveal inline markdown
   * 2. Cursor stays adjacent to current reveal → keep revealed
   * 3. Cursor moves away from reveal → hide markdown
   * 4. Cursor enters/exits a heading → show/hide heading prefix
   * 5. Cursor enters/exits a blockquote → show/hide blockquote prefix
   * 6. Cursor enters/exits a list item → show/hide list item prefix
   * 7. Cursor enters/exits a code block first/last line → show/hide fence
   */
  const handleSelectionChange = useCallback(() => {
    // Clear any pending debounce timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }

    // Debounce the detection to prevent excessive updates
    debounceTimeoutRef.current = setTimeout(() => {
      editor.getEditorState().read(() => {
        // PERFORMANCE OPTIMIZATION: Early exit if cursor hasn't moved
        const selection = $getSelection();
        if ($isRangeSelection(selection) && selection.isCollapsed()) {
          const anchor = selection.anchor;
          const anchorNode = anchor.getNode();
          const currentCursor = {
            nodeKey: anchorNode.getKey(),
            offset: anchor.offset,
          };

          // Check if cursor position is exactly the same as before
          const prev = prevCursorRef.current;
          if (
            prev &&
            prev.nodeKey === currentCursor.nodeKey &&
            prev.offset === currentCursor.offset
          ) {
            // Cursor hasn't moved, skip all processing
            return;
          }

          // Update the previous cursor position
          prevCursorRef.current = currentCursor;
        }

        const newRegion = detectFormattedRegion();
        const newHeadingFocus = detectHeadingFocus();
        const newBlockquoteFocus = detectBlockquoteFocus();
        const newListItemFocus = detectListItemFocus();
        const newCodeBlockFocus = detectCodeBlockFocus();
        const currentRevealState = revealedNodeStateRef.current;

        // If we have a currently revealed node, check if we're still adjacent to it
        if (currentRevealState) {
          const adjacentRevealKey = getAdjacentRevealNodeKey();

          // If cursor is adjacent to our current reveal node, keep it revealed
          if (adjacentRevealKey === currentRevealState.revealNodeKey) {
            log.debug('Cursor adjacent to reveal, keeping visible');
            // Still update heading and blockquote focus even if keeping inline reveal
            setFocusedHeading((prevHeading) => {
              if (!prevHeading && !newHeadingFocus) return null;
              if (!prevHeading || !newHeadingFocus) return newHeadingFocus;
              if (prevHeading.nodeKey !== newHeadingFocus.nodeKey) return newHeadingFocus;
              return prevHeading;
            });
            setFocusedBlockquote((prevBlockquote) => {
              if (!prevBlockquote && !newBlockquoteFocus) return null;
              if (!prevBlockquote || !newBlockquoteFocus) return newBlockquoteFocus;
              if (prevBlockquote.nodeKey !== newBlockquoteFocus.nodeKey) return newBlockquoteFocus;
              return prevBlockquote;
            });
            setFocusedListItem((prevListItem) => {
              if (!prevListItem && !newListItemFocus) return null;
              if (!prevListItem || !newListItemFocus) return newListItemFocus;
              if (prevListItem.nodeKey !== newListItemFocus.nodeKey) return newListItemFocus;
              return prevListItem;
            });
            setFocusedCodeBlock((prevCodeBlock) => {
              if (!prevCodeBlock && !newCodeBlockFocus) return null;
              if (!prevCodeBlock || !newCodeBlockFocus) return newCodeBlockFocus;
              if (
                prevCodeBlock.nodeKey !== newCodeBlockFocus.nodeKey ||
                prevCodeBlock.fenceType !== newCodeBlockFocus.fenceType
              )
                return newCodeBlockFocus;
              return prevCodeBlock;
            });
            return; // Don't change inline reveal state
          }
        }

        // Update heading focus state
        setFocusedHeading((prevHeading) => {
          // Both null - no change
          if (!prevHeading && !newHeadingFocus) {
            return null;
          }

          // Heading changed from null to something, or vice versa
          if (!prevHeading || !newHeadingFocus) {
            if (newHeadingFocus) {
              log.debug('Focusing heading', {
                nodeKey: newHeadingFocus.nodeKey,
                tag: newHeadingFocus.tag,
              });
            } else {
              log.debug('Unfocusing heading');
            }
            return newHeadingFocus;
          }

          // Check if the heading actually changed
          if (prevHeading.nodeKey !== newHeadingFocus.nodeKey) {
            log.debug('Heading focus changed', {
              from: prevHeading.nodeKey,
              to: newHeadingFocus.nodeKey,
            });
            return newHeadingFocus;
          }

          // No change
          return prevHeading;
        });

        // Update blockquote focus state
        setFocusedBlockquote((prevBlockquote) => {
          // Both null - no change
          if (!prevBlockquote && !newBlockquoteFocus) {
            return null;
          }

          // Blockquote changed from null to something, or vice versa
          if (!prevBlockquote || !newBlockquoteFocus) {
            if (newBlockquoteFocus) {
              log.debug('Focusing blockquote', {
                nodeKey: newBlockquoteFocus.nodeKey,
                nestingLevel: newBlockquoteFocus.nestingLevel,
              });
            } else {
              log.debug('Unfocusing blockquote');
            }
            return newBlockquoteFocus;
          }

          // Check if the blockquote actually changed
          if (
            prevBlockquote.nodeKey !== newBlockquoteFocus.nodeKey ||
            prevBlockquote.nestingLevel !== newBlockquoteFocus.nestingLevel
          ) {
            log.debug('Blockquote focus changed', {
              from: prevBlockquote.nodeKey,
              to: newBlockquoteFocus.nodeKey,
            });
            return newBlockquoteFocus;
          }

          // No change
          return prevBlockquote;
        });

        // Update list item focus state
        setFocusedListItem((prevListItem) => {
          // Both null - no change
          if (!prevListItem && !newListItemFocus) {
            return null;
          }

          // List item changed from null to something, or vice versa
          if (!prevListItem || !newListItemFocus) {
            if (newListItemFocus) {
              log.debug('Focusing list item', {
                nodeKey: newListItemFocus.nodeKey,
                listType: newListItemFocus.listType,
                itemIndex: newListItemFocus.itemIndex,
              });
            } else {
              log.debug('Unfocusing list item');
            }
            return newListItemFocus;
          }

          // Check if the list item actually changed
          if (
            prevListItem.nodeKey !== newListItemFocus.nodeKey ||
            prevListItem.listType !== newListItemFocus.listType ||
            prevListItem.itemIndex !== newListItemFocus.itemIndex ||
            prevListItem.nestingLevel !== newListItemFocus.nestingLevel ||
            prevListItem.isChecked !== newListItemFocus.isChecked
          ) {
            log.debug('List item focus changed', {
              from: prevListItem.nodeKey,
              to: newListItemFocus.nodeKey,
            });
            return newListItemFocus;
          }

          // No change
          return prevListItem;
        });

        // Update code block focus state
        setFocusedCodeBlock((prevCodeBlock) => {
          // Both null - no change
          if (!prevCodeBlock && !newCodeBlockFocus) {
            return null;
          }

          // Code block changed from null to something, or vice versa
          if (!prevCodeBlock || !newCodeBlockFocus) {
            if (newCodeBlockFocus) {
              log.debug('Focusing code block', {
                nodeKey: newCodeBlockFocus.nodeKey,
                language: newCodeBlockFocus.language,
                fenceType: newCodeBlockFocus.fenceType,
              });
            } else {
              log.debug('Unfocusing code block');
            }
            return newCodeBlockFocus;
          }

          // Check if the code block actually changed
          if (
            prevCodeBlock.nodeKey !== newCodeBlockFocus.nodeKey ||
            prevCodeBlock.fenceType !== newCodeBlockFocus.fenceType ||
            prevCodeBlock.language !== newCodeBlockFocus.language
          ) {
            log.debug('Code block focus changed', {
              from: prevCodeBlock.nodeKey,
              to: newCodeBlockFocus.nodeKey,
              fenceType: newCodeBlockFocus.fenceType,
            });
            return newCodeBlockFocus;
          }

          // No change
          return prevCodeBlock;
        });

        // Only update inline region state if the region has changed
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
  }, [
    editor,
    detectFormattedRegion,
    detectHeadingFocus,
    detectBlockquoteFocus,
    detectListItemFocus,
    detectCodeBlockFocus,
    getAdjacentRevealNodeKey,
  ]);

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
      // Reset cursor tracking
      prevCursorRef.current = null;
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

  /**
   * Gets the markdown prefix for a heading tag.
   * @param tag - The heading tag (h1-h6)
   * @returns The markdown prefix (e.g., "## " for h2)
   */
  const getHeadingPrefix = useCallback((tag: HeadingTagType): string => {
    const level = parseInt(tag.replace('h', ''), 10) as 1 | 2 | 3 | 4 | 5 | 6;
    return BLOCK_PREFIXES[`h${level}`];
  }, []);

  /**
   * Effect that manages the heading prefix reveal via DOM manipulation.
   * When cursor is on a heading line, shows the markdown prefix (e.g., "## ").
   * When cursor exits the heading, removes the prefix.
   *
   * Uses requestAnimationFrame to schedule DOM updates for optimal performance.
   */
  useEffect(() => {
    // Remove any existing prefix first (synchronous for cleanup)
    if (headingPrefixRef.current) {
      headingPrefixRef.current.remove();
      headingPrefixRef.current = null;
    }

    // If no heading is focused, we're done
    if (!focusedHeading) {
      return;
    }

    // Schedule DOM update in next animation frame for optimal performance
    const rafId = requestAnimationFrame(() => {
      // Get the DOM element for the heading
      const headingElement = editor.getElementByKey(focusedHeading.nodeKey);
      if (!headingElement) {
        log.debug('Could not find heading element', { nodeKey: focusedHeading.nodeKey });
        return;
      }

      // Create the prefix span element
      const prefix = getHeadingPrefix(focusedHeading.tag);
      const prefixSpan = document.createElement('span');
      prefixSpan.className = 'heading-reveal-prefix';
      prefixSpan.textContent = prefix;
      // Note: contentEditable is NOT set to avoid conflicts with Lexical's DOM management.
      // The prefix is read-only for now. Users can change heading level via:
      // - The formatting toolbar
      // - Markdown shortcuts (e.g., typing "## " at the start of a new line)
      // Future enhancement: implement editable prefix that updates heading level.

      // Insert at the start of the heading
      headingElement.insertBefore(prefixSpan, headingElement.firstChild);
      headingPrefixRef.current = prefixSpan;

      log.debug('Revealed heading prefix', {
        nodeKey: focusedHeading.nodeKey,
        tag: focusedHeading.tag,
        prefix,
      });
    });

    // Cleanup function: cancel pending RAF and remove the prefix
    return () => {
      cancelAnimationFrame(rafId);
      if (headingPrefixRef.current) {
        headingPrefixRef.current.remove();
        headingPrefixRef.current = null;
      }
    };
  }, [editor, focusedHeading, getHeadingPrefix]);

  /**
   * Gets the markdown prefix for a blockquote based on nesting level.
   * @param nestingLevel - The nesting level (1 for single quote, 2 for nested, etc.)
   * @returns The markdown prefix (e.g., "> " for level 1, ">> " for level 2)
   */
  const getBlockquotePrefix = useCallback((nestingLevel: number): string => {
    // Generate the prefix based on nesting level
    // Level 1: "> ", Level 2: ">> ", etc.
    return '>'.repeat(nestingLevel) + ' ';
  }, []);

  /**
   * Effect that manages the blockquote prefix reveal via DOM manipulation.
   * When cursor is in a blockquote, shows the markdown prefix (e.g., "> ").
   * For nested blockquotes, shows multiple prefixes (e.g., ">> ").
   * When cursor exits the blockquote, removes the prefix.
   *
   * Uses requestAnimationFrame to schedule DOM updates for optimal performance.
   */
  useEffect(() => {
    // Remove any existing prefix first (synchronous for cleanup)
    if (blockquotePrefixRef.current) {
      blockquotePrefixRef.current.remove();
      blockquotePrefixRef.current = null;
    }

    // If no blockquote is focused, we're done
    if (!focusedBlockquote) {
      return;
    }

    // Schedule DOM update in next animation frame for optimal performance
    const rafId = requestAnimationFrame(() => {
      // Get the DOM element for the blockquote
      const blockquoteElement = editor.getElementByKey(focusedBlockquote.nodeKey);
      if (!blockquoteElement) {
        log.debug('Could not find blockquote element', { nodeKey: focusedBlockquote.nodeKey });
        return;
      }

      // Create the prefix span element
      const prefix = getBlockquotePrefix(focusedBlockquote.nestingLevel);
      const prefixSpan = document.createElement('span');
      prefixSpan.className = 'blockquote-reveal-prefix';
      prefixSpan.textContent = prefix;
      // Note: contentEditable is NOT set to avoid conflicts with Lexical's DOM management.
      // The prefix is read-only. Users can create blockquotes via:
      // - The formatting toolbar
      // - Markdown shortcuts (e.g., typing "> " at the start of a new line)

      // Insert at the start of the blockquote
      blockquoteElement.insertBefore(prefixSpan, blockquoteElement.firstChild);
      blockquotePrefixRef.current = prefixSpan;

      log.debug('Revealed blockquote prefix', {
        nodeKey: focusedBlockquote.nodeKey,
        nestingLevel: focusedBlockquote.nestingLevel,
        prefix,
      });
    });

    // Cleanup function: cancel pending RAF and remove the prefix
    return () => {
      cancelAnimationFrame(rafId);
      if (blockquotePrefixRef.current) {
        blockquotePrefixRef.current.remove();
        blockquotePrefixRef.current = null;
      }
    };
  }, [editor, focusedBlockquote, getBlockquotePrefix]);

  /**
   * Gets the markdown prefix for a list item based on type and position.
   * @param listType - The type of list (bullet, number, or check)
   * @param itemIndex - The 1-based index of the item in the list
   * @param nestingLevel - The nesting level (1 for top-level, 2 for nested, etc.)
   * @param isChecked - Whether the item is checked (only for checklist items)
   * @returns The markdown prefix (e.g., "- ", "1. ", "- [ ] ", "  - " for nested)
   */
  const getListItemPrefix = useCallback(
    (listType: ListType, itemIndex: number, nestingLevel: number, isChecked: boolean): string => {
      // Generate indentation for nested items (2 spaces per level)
      const indent = '  '.repeat(nestingLevel - 1);

      switch (listType) {
        case 'number':
          return `${indent}${itemIndex}. `;
        case 'check':
          return `${indent}- [${isChecked ? 'x' : ' '}] `;
        case 'bullet':
        default:
          return `${indent}- `;
      }
    },
    []
  );

  /**
   * Effect that manages the list item prefix reveal via DOM manipulation.
   * When cursor is on a list item, shows the markdown prefix (e.g., "- " or "1. ").
   * For nested list items, shows indentation prefix.
   * When cursor exits the list item, removes the prefix.
   *
   * Uses requestAnimationFrame to schedule DOM updates for optimal performance.
   */
  useEffect(() => {
    // Remove any existing prefix first (synchronous for cleanup)
    if (listItemPrefixRef.current) {
      listItemPrefixRef.current.remove();
      listItemPrefixRef.current = null;
    }

    // If no list item is focused, we're done
    if (!focusedListItem) {
      return;
    }

    // Schedule DOM update in next animation frame for optimal performance
    const rafId = requestAnimationFrame(() => {
      // Get the DOM element for the list item
      const listItemElement = editor.getElementByKey(focusedListItem.nodeKey);
      if (!listItemElement) {
        log.debug('Could not find list item element', { nodeKey: focusedListItem.nodeKey });
        return;
      }

      // Create the prefix span element
      const prefix = getListItemPrefix(
        focusedListItem.listType,
        focusedListItem.itemIndex,
        focusedListItem.nestingLevel,
        focusedListItem.isChecked
      );
      const prefixSpan = document.createElement('span');
      prefixSpan.className = 'listitem-reveal-prefix';
      prefixSpan.textContent = prefix;
      // Note: contentEditable is NOT set to avoid conflicts with Lexical's DOM management.
      // The prefix is read-only. Users can create/modify lists via:
      // - The formatting toolbar
      // - Markdown shortcuts (e.g., typing "- " at the start of a new line)

      // Insert at the start of the list item
      listItemElement.insertBefore(prefixSpan, listItemElement.firstChild);
      listItemPrefixRef.current = prefixSpan;

      log.debug('Revealed list item prefix', {
        nodeKey: focusedListItem.nodeKey,
        listType: focusedListItem.listType,
        itemIndex: focusedListItem.itemIndex,
        prefix,
      });
    });

    // Cleanup function: cancel pending RAF and remove the prefix
    return () => {
      cancelAnimationFrame(rafId);
      if (listItemPrefixRef.current) {
        listItemPrefixRef.current.remove();
        listItemPrefixRef.current = null;
      }
    };
  }, [editor, focusedListItem, getListItemPrefix]);

  /**
   * Gets the opening fence for a code block with optional language.
   * @param language - The programming language (e.g., "typescript", "python")
   * @returns The opening fence (e.g., "```typescript" or "```")
   */
  const getCodeBlockOpenFence = useCallback((language: string): string => {
    return '```' + language;
  }, []);

  /**
   * Gets the closing fence for a code block.
   * @returns The closing fence "```"
   */
  const getCodeBlockCloseFence = useCallback((): string => {
    return '```';
  }, []);

  /**
   * Effect that manages the code block fence reveal via DOM manipulation.
   * When cursor is on the first line of a code block, shows the opening fence (```lang).
   * When cursor is on the last line, shows the closing fence (```).
   * For empty/single-line code blocks, shows both fences.
   * When cursor exits the code block first/last line, removes the fence(s).
   *
   * Uses requestAnimationFrame to schedule DOM updates for optimal performance.
   */
  useEffect(() => {
    // Remove any existing fences first (synchronous for cleanup)
    if (codeBlockOpenFenceRef.current) {
      codeBlockOpenFenceRef.current.remove();
      codeBlockOpenFenceRef.current = null;
    }
    if (codeBlockCloseFenceRef.current) {
      codeBlockCloseFenceRef.current.remove();
      codeBlockCloseFenceRef.current = null;
    }

    // If no code block is focused, we're done
    if (!focusedCodeBlock) {
      return;
    }

    // Schedule DOM update in next animation frame for optimal performance
    const rafId = requestAnimationFrame(() => {
      // Get the DOM element for the code block (it's rendered as a <code> inside <pre>)
      const codeElement = editor.getElementByKey(focusedCodeBlock.nodeKey);
      if (!codeElement) {
        log.debug('Could not find code block element', { nodeKey: focusedCodeBlock.nodeKey });
        return;
      }

      // Show opening fence if needed
      if (focusedCodeBlock.fenceType === 'open' || focusedCodeBlock.fenceType === 'both') {
        const openFence = getCodeBlockOpenFence(focusedCodeBlock.language);
        const openFenceSpan = document.createElement('span');
        openFenceSpan.className = 'codeblock-reveal-fence codeblock-reveal-fence-open';
        openFenceSpan.textContent = openFence;
        // Insert at the start of the code block
        codeElement.insertBefore(openFenceSpan, codeElement.firstChild);
        codeBlockOpenFenceRef.current = openFenceSpan;

        log.debug('Revealed code block opening fence', {
          nodeKey: focusedCodeBlock.nodeKey,
          language: focusedCodeBlock.language,
          fence: openFence,
        });
      }

      // Show closing fence if needed
      if (focusedCodeBlock.fenceType === 'close' || focusedCodeBlock.fenceType === 'both') {
        const closeFence = getCodeBlockCloseFence();
        const closeFenceSpan = document.createElement('span');
        closeFenceSpan.className = 'codeblock-reveal-fence codeblock-reveal-fence-close';
        closeFenceSpan.textContent = closeFence;
        // Append at the end of the code block
        codeElement.appendChild(closeFenceSpan);
        codeBlockCloseFenceRef.current = closeFenceSpan;

        log.debug('Revealed code block closing fence', {
          nodeKey: focusedCodeBlock.nodeKey,
          fence: closeFence,
        });
      }
    });

    // Cleanup function: cancel pending RAF and remove the fences
    return () => {
      cancelAnimationFrame(rafId);
      if (codeBlockOpenFenceRef.current) {
        codeBlockOpenFenceRef.current.remove();
        codeBlockOpenFenceRef.current = null;
      }
      if (codeBlockCloseFenceRef.current) {
        codeBlockCloseFenceRef.current.remove();
        codeBlockCloseFenceRef.current = null;
      }
    };
  }, [editor, focusedCodeBlock, getCodeBlockOpenFence, getCodeBlockCloseFence]);

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
