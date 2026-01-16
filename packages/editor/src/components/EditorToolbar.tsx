/**
 * EditorToolbar - Toolbar component for ScribeEditor formatting controls.
 *
 * Provides buttons for text formatting, headings, lists, links, and undo/redo.
 *
 * @module
 */

import { type FC, useState, useEffect, useCallback } from 'react';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import {
  FORMAT_TEXT_COMMAND,
  UNDO_COMMAND,
  REDO_COMMAND,
  $getSelection,
  $isRangeSelection,
  $createParagraphNode,
  CAN_UNDO_COMMAND,
  CAN_REDO_COMMAND,
  COMMAND_PRIORITY_CRITICAL,
} from 'lexical';
import { $setBlocksType } from '@lexical/selection';
import {
  INSERT_ORDERED_LIST_COMMAND,
  INSERT_UNORDERED_LIST_COMMAND,
  REMOVE_LIST_COMMAND,
  $isListNode,
  ListNode,
} from '@lexical/list';
import { TOGGLE_LINK_COMMAND, $isLinkNode } from '@lexical/link';
import { $createHeadingNode, $isHeadingNode, HeadingTagType } from '@lexical/rich-text';
import { $getNearestNodeOfType, mergeRegister } from '@lexical/utils';

/**
 * Text format types supported by the toolbar.
 */
type TextFormatType = 'bold' | 'italic' | 'underline' | 'code';

/**
 * Block types for the heading selector.
 */
type BlockType = 'paragraph' | 'h1' | 'h2' | 'h3' | 'bullet' | 'number';

/**
 * Props for EditorToolbar component.
 */
export interface EditorToolbarProps {
  /** Additional CSS class name */
  className?: string;
}

/**
 * EditorToolbar - Formatting toolbar for Lexical editor.
 *
 * Features:
 * - Undo/Redo buttons
 * - Bold, italic, underline formatting
 * - Heading selector (H1, H2, H3, Paragraph)
 * - Bullet and numbered list buttons
 * - Link insertion
 *
 * The toolbar automatically updates to reflect the current selection state.
 */
export const EditorToolbar: FC<EditorToolbarProps> = ({ className }) => {
  const [editor] = useLexicalComposerContext();
  const [activeFormats, setActiveFormats] = useState<Set<TextFormatType>>(new Set());
  const [blockType, setBlockType] = useState<BlockType>('paragraph');
  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);
  const [isLink, setIsLink] = useState(false);

  // Update active state based on selection
  useEffect(() => {
    return mergeRegister(
      editor.registerUpdateListener(({ editorState }) => {
        editorState.read(() => {
          const selection = $getSelection();
          if (!$isRangeSelection(selection)) {
            return;
          }

          // Update text formats
          const formats = new Set<TextFormatType>();
          if (selection.hasFormat('bold')) formats.add('bold');
          if (selection.hasFormat('italic')) formats.add('italic');
          if (selection.hasFormat('underline')) formats.add('underline');
          if (selection.hasFormat('code')) formats.add('code');
          setActiveFormats(formats);

          // Update block type
          const anchorNode = selection.anchor.getNode();
          const element =
            anchorNode.getKey() === 'root' ? anchorNode : anchorNode.getTopLevelElementOrThrow();

          const elementKey = element.getKey();
          const elementDOM = editor.getElementByKey(elementKey);

          if (elementDOM !== null) {
            // Check for list
            const listNode = $getNearestNodeOfType<ListNode>(anchorNode, ListNode);
            if (listNode !== null) {
              const listType = $isListNode(listNode) ? listNode.getListType() : null;
              if (listType === 'bullet') {
                setBlockType('bullet');
              } else if (listType === 'number') {
                setBlockType('number');
              }
            } else if ($isHeadingNode(element)) {
              const tag = element.getTag();
              setBlockType(tag as BlockType);
            } else {
              setBlockType('paragraph');
            }
          }

          // Check for link
          const parent = anchorNode.getParent();
          setIsLink($isLinkNode(parent) || $isLinkNode(anchorNode));
        });
      }),
      editor.registerCommand(
        CAN_UNDO_COMMAND,
        (payload) => {
          setCanUndo(payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      ),
      editor.registerCommand(
        CAN_REDO_COMMAND,
        (payload) => {
          setCanRedo(payload);
          return false;
        },
        COMMAND_PRIORITY_CRITICAL
      )
    );
  }, [editor]);

  // Format text (bold, italic, underline, code)
  const formatText = useCallback(
    (format: TextFormatType) => {
      editor.dispatchCommand(FORMAT_TEXT_COMMAND, format);
    },
    [editor]
  );

  // Change block type (heading or paragraph)
  const formatBlock = useCallback(
    (type: BlockType) => {
      if (type === 'bullet') {
        if (blockType === 'bullet') {
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        } else {
          editor.dispatchCommand(INSERT_UNORDERED_LIST_COMMAND, undefined);
        }
      } else if (type === 'number') {
        if (blockType === 'number') {
          editor.dispatchCommand(REMOVE_LIST_COMMAND, undefined);
        } else {
          editor.dispatchCommand(INSERT_ORDERED_LIST_COMMAND, undefined);
        }
      } else {
        editor.update(() => {
          const selection = $getSelection();
          if ($isRangeSelection(selection)) {
            if (type === 'paragraph') {
              $setBlocksType(selection, () => $createParagraphNode());
            } else {
              $setBlocksType(selection, () => $createHeadingNode(type as HeadingTagType));
            }
          }
        });
      }
    },
    [editor, blockType]
  );

  // Insert/toggle link
  const toggleLink = useCallback(() => {
    if (isLink) {
      editor.dispatchCommand(TOGGLE_LINK_COMMAND, null);
    } else {
      const url = window.prompt('Enter URL:');
      if (url !== null && url.trim() !== '') {
        editor.dispatchCommand(TOGGLE_LINK_COMMAND, url);
      }
    }
  }, [editor, isLink]);

  // Undo/Redo
  const undo = useCallback(() => {
    editor.dispatchCommand(UNDO_COMMAND, undefined);
  }, [editor]);

  const redo = useCallback(() => {
    editor.dispatchCommand(REDO_COMMAND, undefined);
  }, [editor]);

  // Handle heading select change
  const handleBlockChange = useCallback(
    (e: React.ChangeEvent<HTMLSelectElement>) => {
      formatBlock(e.target.value as BlockType);
    },
    [formatBlock]
  );

  return (
    <div
      className={`scribe-editor-toolbar ${className ?? ''}`}
      role="toolbar"
      aria-label="Editor formatting"
    >
      {/* Undo/Redo Group */}
      <div className="scribe-toolbar-group" role="group" aria-label="History">
        <ToolbarButton onClick={undo} title="Undo (Ctrl+Z)" disabled={!canUndo} aria-label="Undo">
          <UndoIcon />
        </ToolbarButton>
        <ToolbarButton onClick={redo} title="Redo (Ctrl+Y)" disabled={!canRedo} aria-label="Redo">
          <RedoIcon />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Text Format Group */}
      <div className="scribe-toolbar-group" role="group" aria-label="Text formatting">
        <ToolbarButton
          onClick={() => formatText('bold')}
          active={activeFormats.has('bold')}
          title="Bold (Ctrl+B)"
          aria-label="Bold"
          aria-pressed={activeFormats.has('bold')}
        >
          <BoldIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => formatText('italic')}
          active={activeFormats.has('italic')}
          title="Italic (Ctrl+I)"
          aria-label="Italic"
          aria-pressed={activeFormats.has('italic')}
        >
          <ItalicIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => formatText('underline')}
          active={activeFormats.has('underline')}
          title="Underline (Ctrl+U)"
          aria-label="Underline"
          aria-pressed={activeFormats.has('underline')}
        >
          <UnderlineIcon />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Block Type Group */}
      <div className="scribe-toolbar-group" role="group" aria-label="Block type">
        <select
          className="scribe-toolbar-select"
          value={blockType === 'bullet' || blockType === 'number' ? 'paragraph' : blockType}
          onChange={handleBlockChange}
          aria-label="Block type"
          title="Block type"
        >
          <option value="paragraph">Paragraph</option>
          <option value="h1">Heading 1</option>
          <option value="h2">Heading 2</option>
          <option value="h3">Heading 3</option>
        </select>
      </div>

      <ToolbarDivider />

      {/* List Group */}
      <div className="scribe-toolbar-group" role="group" aria-label="Lists">
        <ToolbarButton
          onClick={() => formatBlock('bullet')}
          active={blockType === 'bullet'}
          title="Bullet List"
          aria-label="Bullet list"
          aria-pressed={blockType === 'bullet'}
        >
          <BulletListIcon />
        </ToolbarButton>
        <ToolbarButton
          onClick={() => formatBlock('number')}
          active={blockType === 'number'}
          title="Numbered List"
          aria-label="Numbered list"
          aria-pressed={blockType === 'number'}
        >
          <NumberedListIcon />
        </ToolbarButton>
      </div>

      <ToolbarDivider />

      {/* Link Group */}
      <div className="scribe-toolbar-group" role="group" aria-label="Links">
        <ToolbarButton
          onClick={toggleLink}
          active={isLink}
          title={isLink ? 'Remove Link' : 'Insert Link'}
          aria-label={isLink ? 'Remove link' : 'Insert link'}
          aria-pressed={isLink}
        >
          <LinkIcon />
        </ToolbarButton>
      </div>
    </div>
  );
};

// ============================================================================
// Toolbar Primitives
// ============================================================================

interface ToolbarButtonProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
  'aria-label'?: string;
  'aria-pressed'?: boolean;
}

function ToolbarButton({
  onClick,
  active = false,
  disabled = false,
  title,
  children,
  'aria-label': ariaLabel,
  'aria-pressed': ariaPressed,
}: ToolbarButtonProps) {
  return (
    <button
      className={`scribe-toolbar-button ${active ? 'active' : ''}`}
      onClick={onClick}
      disabled={disabled}
      title={title}
      type="button"
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
    >
      {children}
    </button>
  );
}

function ToolbarDivider() {
  return <div className="scribe-toolbar-divider" role="separator" />;
}

// ============================================================================
// SVG Icons
// ============================================================================

function UndoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M3 7v6h6" />
      <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
    </svg>
  );
}

function RedoIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M21 7v6h-6" />
      <path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3L21 13" />
    </svg>
  );
}

function BoldIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 4h8a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
      <path d="M6 12h9a4 4 0 0 1 4 4 4 4 0 0 1-4 4H6z" />
    </svg>
  );
}

function ItalicIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="19" y1="4" x2="10" y2="4" />
      <line x1="14" y1="20" x2="5" y2="20" />
      <line x1="15" y1="4" x2="9" y2="20" />
    </svg>
  );
}

function UnderlineIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M6 4v6a6 6 0 0 0 6 6 6 6 0 0 0 6-6V4" />
      <line x1="4" y1="20" x2="20" y2="20" />
    </svg>
  );
}

function BulletListIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <circle cx="4" cy="6" r="1" fill="currentColor" />
      <circle cx="4" cy="12" r="1" fill="currentColor" />
      <circle cx="4" cy="18" r="1" fill="currentColor" />
    </svg>
  );
}

function NumberedListIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <line x1="10" y1="6" x2="21" y2="6" />
      <line x1="10" y1="12" x2="21" y2="12" />
      <line x1="10" y1="18" x2="21" y2="18" />
      <text x="3" y="7" fontSize="6" fill="currentColor" stroke="none">
        1
      </text>
      <text x="3" y="13" fontSize="6" fill="currentColor" stroke="none">
        2
      </text>
      <text x="3" y="19" fontSize="6" fill="currentColor" stroke="none">
        3
      </text>
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
