import { useEffect } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { TabIndentationPlugin } from '@lexical/react/LexicalTabIndentationPlugin';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import { AutoLinkNode, LinkNode } from '@lexical/link';
import { TableNode, TableRowNode, TableCellNode } from '@lexical/table';
import { MarkNode } from '@lexical/mark';
import { TRANSFORMERS, ElementTransformer } from '@lexical/markdown';
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '@lexical/react/LexicalHorizontalRuleNode';
import type { LexicalNode } from 'lexical';
import { createLogger } from '@scribe/shared';
import type { Note, NoteId, EditorContent } from '@scribe/shared';

const log = createLogger({ prefix: 'EditorRoot' });
import { InitialStatePlugin } from './plugins/InitialStatePlugin';
import { AutosavePlugin } from './plugins/AutosavePlugin';
import { ManualSavePlugin } from './plugins/ManualSavePlugin';
import { HorizontalRulePlugin } from './plugins/HorizontalRulePlugin';
import { TablePlugin } from './plugins/TablePlugin';
import { TableKeyboardPlugin } from './plugins/table';
import { TableUIPlugin } from './plugins/TableUIPlugin';
import { TableContentPlugin } from './plugins/TableContentPlugin';
import { HR_PATTERN } from './plugins/constants';
import { WikiLinkNode } from './plugins/WikiLinkNode';
import { WikiLinkPlugin } from './plugins/WikiLinkPlugin';
import { PersonMentionNode } from './plugins/PersonMentionNode';
import { PersonMentionPlugin } from './plugins/PersonMentionPlugin';
import { LinkClickPlugin } from './plugins/LinkClickPlugin';
import { AutoLinkPlugin } from './plugins/AutoLinkPlugin';
import { FocusNodePlugin } from './plugins/FocusNodePlugin';
import { CheckListShortcutPlugin } from './plugins/CheckListShortcutPlugin';
import { CollapsibleHeadingNode } from './plugins/CollapsibleHeadingNode';
import { CollapsibleHeadingPlugin } from './plugins/CollapsibleHeadingPlugin';
import { ImageNode } from './plugins/ImageNode';
import { ImagePlugin } from './plugins/ImagePlugin';
import { MarkdownRevealNode } from './plugins/MarkdownRevealNode';
import { MarkdownRevealPlugin } from './plugins/MarkdownRevealPlugin';
import { SelectionToolbarPlugin } from './SelectionToolbar';
import { SlashMenuPlugin } from './SlashMenu';
import { FindReplacePlugin } from './FindReplace';
import { useOptionalEditorCommandSetter } from './EditorCommandContext';
import * as styles from './EditorRoot.css';

/**
 * Bridge plugin that exposes the editor instance to EditorCommandContext.
 * This enables cross-component communication between Editor and ContextPanel.
 *
 * Must be placed inside LexicalComposer to access editor context.
 * Gracefully no-ops if EditorCommandProvider is not present (e.g., in tests).
 */
function EditorCommandBridge(): null {
  const [editor] = useLexicalComposerContext();
  const setter = useOptionalEditorCommandSetter();

  useEffect(() => {
    if (!setter) return; // No provider present, nothing to do
    setter.setEditor(editor);
    return () => setter.setEditor(null);
  }, [editor, setter]);

  return null;
}

// Horizontal rule transformer for markdown shortcut (---, ***, or ___)
const HR_TRANSFORMER: ElementTransformer = {
  dependencies: [HorizontalRuleNode],
  export: (node: LexicalNode) => {
    return $isHorizontalRuleNode(node) ? '---' : null;
  },
  regExp: HR_PATTERN.withTrailingSpace,
  replace: (parentNode, _1, _2, isImport) => {
    const line = $createHorizontalRuleNode();
    if (isImport || parentNode.getNextSibling() != null) {
      parentNode.replace(line);
    } else {
      parentNode.insertBefore(line);
    }
    line.selectNext();
  },
  type: 'element',
};

// Combine default transformers with our HR transformer
const EDITOR_TRANSFORMERS = [HR_TRANSFORMER, ...TRANSFORMERS];

const editorConfig = {
  namespace: 'ScribeEditor',
  theme: {
    // Theme classes for Lexical nodes - using vanilla-extract generated class names
    paragraph: styles.editorParagraph,
    text: {
      bold: styles.editorTextBold,
      italic: styles.editorTextItalic,
      underline: styles.editorTextUnderline,
      strikethrough: styles.editorTextStrikethrough,
    },
    list: {
      nested: {
        listitem: styles.nestedListItem,
      },
      ol: styles.listOl,
      ul: styles.listUl,
      listitem: styles.listItem,
      listitemChecked: styles.listItemChecked,
      listitemUnchecked: styles.listItemUnchecked,
    },
    hr: styles.hr,
    hrSelected: styles.hrSelected,
    table: styles.table,
    tableCell: styles.tableCell,
    tableCellHeader: styles.tableCellHeader,
    tableRow: styles.tableRow,
    tableSelection: styles.tableSelection,
    tableCellSelected: styles.tableCellSelected,
  },
  onError(error: Error) {
    log.error('Lexical error', { error: error.message, stack: error.stack });
  },
  nodes: [
    // HeadingNode is registered for backward compatibility - old notes may have
    // "type": "heading" in their serialized state. The transform in
    // CollapsibleHeadingPlugin automatically converts HeadingNode to CollapsibleHeadingNode.
    HeadingNode,
    CollapsibleHeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    CodeNode,
    CodeHighlightNode,
    LinkNode,
    AutoLinkNode,
    HorizontalRuleNode,
    WikiLinkNode,
    PersonMentionNode,
    TableNode,
    TableRowNode,
    TableCellNode,
    MarkNode,
    ImageNode,
    MarkdownRevealNode,
  ],
};

/**
 * Note state object passed from page components to EditorRoot.
 * This interface matches the shape returned by the old useNoteState hook,
 * enabling backward compatibility while allowing pages to construct
 * the state object directly from tRPC calls.
 */
export interface NoteState {
  /** Current note being edited (null if none loaded) */
  currentNote: Note | null;
  /** Current note ID */
  currentNoteId: NoteId | null;
  /** Whether the current note is a system note */
  isSystemNote: boolean;
  /** Whether a note is currently loading */
  isLoading: boolean;
  /** Error message if load/save failed */
  error: string | null;
  /** Save the current note with updated content */
  saveNote: (content: EditorContent) => Promise<void>;
  /** Load a note by ID */
  loadNote: (id: NoteId) => Promise<void>;
  /** Create and load a new note */
  createNote: () => Promise<void>;
  /** Delete a note by ID */
  deleteNote: (id: NoteId) => Promise<void>;
  /** Update note metadata (title, type, tags) */
  updateMetadata: () => Promise<void>;
}

interface EditorRootProps {
  noteState: NoteState;
}

export function EditorRoot({ noteState }: EditorRootProps) {
  const { currentNote, currentNoteId, isLoading, error, saveNote } = noteState;

  if (isLoading) {
    return (
      <div className={styles.editorRoot}>
        <div className={styles.editorLoading}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.editorRoot}>
        <div className={styles.editorError}>Error: {error}</div>
      </div>
    );
  }

  return (
    <div className={styles.editorRoot}>
      <LexicalComposer initialConfig={editorConfig}>
        <div className={styles.editorContainer}>
          <RichTextPlugin
            contentEditable={<ContentEditable className={styles.editorInput} />}
            placeholder={<div className={styles.editorPlaceholder}>Start writing...</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
          <CheckListPlugin />
          <CheckListShortcutPlugin />
          <TabIndentationPlugin />
          <CollapsibleHeadingPlugin />
          <MarkdownRevealPlugin />
          <MarkdownShortcutPlugin transformers={EDITOR_TRANSFORMERS} />
          <HorizontalRulePlugin />
          <TablePlugin />
          <TableKeyboardPlugin />
          <TableUIPlugin />
          <TableContentPlugin />
          {/* Load the initial note content */}
          <InitialStatePlugin initialState={currentNote?.content ?? null} noteId={currentNoteId} />
          {/* Auto-save editor changes */}
          <AutosavePlugin onSave={saveNote} debounceMs={1000} />
          {/* Manual save with cmd/ctrl+s */}
          <ManualSavePlugin onSave={saveNote} />
          {/* Wiki-link autocomplete and creation */}
          <WikiLinkPlugin currentNoteId={currentNoteId} />
          {/* Person mention autocomplete and creation */}
          <PersonMentionPlugin currentNoteId={currentNoteId} />
          {/* Handle clicks on external hyperlinks */}
          <LinkClickPlugin />
          {/* Auto-convert typed/pasted URLs to clickable links */}
          <AutoLinkPlugin />
          {/* Focus and navigate to specific nodes (used by Tasks panel) */}
          <FocusNodePlugin />
          {/* Bridge to EditorCommandContext for cross-component communication */}
          <EditorCommandBridge />
          {/* In-note search with Cmd/Ctrl+F */}
          <FindReplacePlugin />
          {/* Floating toolbar for text selection formatting */}
          <SelectionToolbarPlugin />
          {/* Slash command menu */}
          <SlashMenuPlugin />
          {/* Image paste/drop support */}
          <ImagePlugin />
        </div>
      </LexicalComposer>
    </div>
  );
}
