/**
 * SelectionToolbarPlugin - Lexical plugin for selection-based formatting toolbar
 *
 * Responsibilities:
 * 1. Listen for text selection changes in the editor
 * 2. Calculate toolbar position based on selection bounds
 * 3. Track which formats are currently active in the selection
 * 4. Apply formatting commands when toolbar buttons are clicked
 * 5. Handle heading conversions for block-level formatting
 */

import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { useCallback, useEffect, useState } from 'react';
import {
  $getSelection,
  $isRangeSelection,
  FORMAT_TEXT_COMMAND,
  $createParagraphNode,
  $isRootOrShadowRoot,
} from 'lexical';
import { $isHeadingNode, $createHeadingNode, HeadingTagType } from '@lexical/rich-text';
import { $findMatchingParent, $getNearestBlockElementAncestorOrThrow } from '@lexical/utils';
import { SelectionToolbar, type FormatType } from './SelectionToolbar';

interface Position {
  top: number;
  left: number;
}

/** Toolbar dimensions for positioning calculations */
const TOOLBAR_HEIGHT = 48; // 32px buttons + 16px padding (top+bottom)
const TOOLBAR_OFFSET = 8; // Gap between selection and toolbar
const TOOLBAR_MIN_WIDTH = 320; // Approximate minimum toolbar width for horizontal clamping

interface ActiveFormats {
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  h1: boolean;
  h2: boolean;
  highlight: boolean;
  link: boolean;
}

const DEFAULT_ACTIVE_FORMATS: ActiveFormats = {
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  h1: false,
  h2: false,
  highlight: false,
  link: false,
};

export function SelectionToolbarPlugin() {
  const [editor] = useLexicalComposerContext();
  const [position, setPosition] = useState<Position | null>(null);
  const [activeFormats, setActiveFormats] = useState<ActiveFormats>(DEFAULT_ACTIVE_FORMATS);
  const [isMouseDown, setIsMouseDown] = useState(false);

  // Calculate position based on browser selection with viewport boundary handling
  const updatePosition = useCallback(() => {
    const nativeSelection = window.getSelection();
    if (!nativeSelection || nativeSelection.rangeCount === 0) {
      setPosition(null);
      return;
    }

    const range = nativeSelection.getRangeAt(0);
    if (range.collapsed) {
      setPosition(null);
      return;
    }

    const rect = range.getBoundingClientRect();
    const viewportWidth = window.innerWidth;

    // Calculate ideal position (above selection, centered)
    const idealTop = rect.top - TOOLBAR_HEIGHT - TOOLBAR_OFFSET;
    let centerX = rect.left + rect.width / 2;

    // Determine vertical position: above if there's room, below otherwise
    let top: number;
    if (idealTop < 0) {
      // Not enough room above - position below the selection
      top = rect.bottom + TOOLBAR_OFFSET;
    } else {
      top = idealTop;
    }

    // Clamp horizontal position to keep toolbar within viewport
    // The toolbar uses transform: translateX(-50%), so centerX is the center point
    const halfToolbarWidth = TOOLBAR_MIN_WIDTH / 2;
    const minCenterX = halfToolbarWidth + 8; // 8px margin from edge
    const maxCenterX = viewportWidth - halfToolbarWidth - 8;
    centerX = Math.max(minCenterX, Math.min(maxCenterX, centerX));

    setPosition({
      top,
      left: centerX,
    });
  }, []);

  // Update active formats based on selection
  const updateActiveFormats = useCallback(() => {
    editor.getEditorState().read(() => {
      const selection = $getSelection();

      if (!$isRangeSelection(selection)) {
        setActiveFormats(DEFAULT_ACTIVE_FORMATS);
        return;
      }

      // Get text format states
      const bold = selection.hasFormat('bold');
      const italic = selection.hasFormat('italic');
      const underline = selection.hasFormat('underline');
      const strikethrough = selection.hasFormat('strikethrough');
      const highlight = selection.hasFormat('highlight');

      // Check for headings - look at anchor node's parent
      let h1 = false;
      let h2 = false;

      const anchorNode = selection.anchor.getNode();
      const element =
        anchorNode.getKey() === 'root'
          ? anchorNode
          : $findMatchingParent(anchorNode, (node) => {
              const parent = node.getParent();
              return parent !== null && $isRootOrShadowRoot(parent);
            });

      if ($isHeadingNode(element)) {
        const tag = element.getTag();
        h1 = tag === 'h1';
        h2 = tag === 'h2';
      }

      // Check for links
      // For now, we don't have link detection - placeholder
      const link = false;

      setActiveFormats({
        bold,
        italic,
        underline,
        strikethrough,
        h1,
        h2,
        highlight,
        link,
      });
    });
  }, [editor]);

  // Track mouse down/up to prevent toolbar from appearing while dragging
  useEffect(() => {
    const rootElement = editor.getRootElement();
    if (!rootElement) return;

    const handleMouseDown = () => {
      setIsMouseDown(true);
      // Hide toolbar when starting a new selection
      setPosition(null);
    };

    const handleMouseUp = () => {
      setIsMouseDown(false);
      // After mouse release, check if there's a valid selection and show toolbar
      setTimeout(() => {
        editor.getEditorState().read(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection) && !selection.isCollapsed()) {
            const text = selection.getTextContent();
            if (text.trim()) {
              updatePosition();
              updateActiveFormats();
            }
          }
        });
      }, 0);
    };

    rootElement.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      rootElement.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [editor, updatePosition, updateActiveFormats]);

  // Listen for selection changes (only update if mouse is not down)
  useEffect(() => {
    return editor.registerUpdateListener(({ editorState }) => {
      editorState.read(() => {
        const selection = $getSelection();

        if (!$isRangeSelection(selection) || selection.isCollapsed()) {
          setPosition(null);
          return;
        }

        // Don't show toolbar while mouse is down (dragging)
        if (isMouseDown) {
          return;
        }

        // Check if selection contains text (not just whitespace)
        const text = selection.getTextContent();
        if (!text.trim()) {
          setPosition(null);
          return;
        }

        // Update position and formats
        // Use setTimeout to ensure DOM has updated
        setTimeout(() => {
          updatePosition();
          updateActiveFormats();
        }, 0);
      });
    });
  }, [editor, updatePosition, updateActiveFormats, isMouseDown]);

  // Also listen for native selection changes (for better position updates, only when mouse is up)
  useEffect(() => {
    const handleSelectionChange = () => {
      // Don't update position while dragging
      if (isMouseDown) return;

      editor.getEditorState().read(() => {
        const selection = $getSelection();
        if ($isRangeSelection(selection) && !selection.isCollapsed()) {
          updatePosition();
        }
      });
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => document.removeEventListener('selectionchange', handleSelectionChange);
  }, [editor, updatePosition, isMouseDown]);

  // Apply format when button is clicked
  const handleFormat = useCallback(
    (format: FormatType) => {
      editor.focus();

      switch (format) {
        case 'bold':
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'bold');
          break;
        case 'italic':
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'italic');
          break;
        case 'underline':
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'underline');
          break;
        case 'strikethrough':
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'strikethrough');
          break;
        case 'highlight':
          editor.dispatchCommand(FORMAT_TEXT_COMMAND, 'highlight');
          break;
        case 'h1':
          formatHeading('h1');
          break;
        case 'h2':
          formatHeading('h2');
          break;
      }

      // Update active formats after applying
      setTimeout(updateActiveFormats, 0);
    },
    [editor, updateActiveFormats]
  );

  // Format as heading or toggle back to paragraph
  const formatHeading = useCallback(
    (tag: HeadingTagType) => {
      editor.update(() => {
        const selection = $getSelection();
        if (!$isRangeSelection(selection)) return;

        const anchorNode = selection.anchor.getNode();
        const element = $getNearestBlockElementAncestorOrThrow(anchorNode);

        // If already this heading type, convert back to paragraph
        if ($isHeadingNode(element) && element.getTag() === tag) {
          const paragraph = $createParagraphNode();
          element.getChildren().forEach((child) => {
            paragraph.append(child);
          });
          element.replace(paragraph);
          paragraph.select();
        } else {
          // Convert to heading
          const heading = $createHeadingNode(tag);
          element.getChildren().forEach((child) => {
            heading.append(child);
          });
          element.replace(heading);
          heading.select();
        }
      });
    },
    [editor]
  );

  return (
    <SelectionToolbar position={position} activeFormats={activeFormats} onFormat={handleFormat} />
  );
}
