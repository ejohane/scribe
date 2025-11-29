import { LexicalComposer } from '@lexical/react/LexicalComposer';
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
import { LinkNode } from '@lexical/link';
import { TRANSFORMERS, ElementTransformer } from '@lexical/markdown';
import {
  $createHorizontalRuleNode,
  $isHorizontalRuleNode,
  HorizontalRuleNode,
} from '@lexical/react/LexicalHorizontalRuleNode';
import type { LexicalNode } from 'lexical';

import type { useNoteState } from '../../hooks/useNoteState';
import { InitialStatePlugin } from './plugins/InitialStatePlugin';
import { AutosavePlugin } from './plugins/AutosavePlugin';
import { ManualSavePlugin } from './plugins/ManualSavePlugin';
import { HorizontalRulePlugin } from './plugins/HorizontalRulePlugin';
import { HR_PATTERN } from './plugins/constants';
import { WikiLinkNode } from './plugins/WikiLinkNode';
import { WikiLinkPlugin } from './plugins/WikiLinkPlugin';
import { PersonMentionNode } from './plugins/PersonMentionNode';
import { PersonMentionPlugin } from './plugins/PersonMentionPlugin';
import { SelectionToolbarPlugin } from './SelectionToolbar';
import { SlashMenuPlugin } from './SlashMenu';
import * as styles from './EditorRoot.css';

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
    },
    list: {
      nested: {
        listitem: styles.nestedListItem,
      },
      ol: styles.listOl,
      ul: styles.listUl,
      listitem: styles.listItem,
    },
    hr: styles.hr,
    hrSelected: styles.hrSelected,
  },
  onError(error: Error) {
    console.error('Lexical error:', error);
  },
  nodes: [
    HeadingNode,
    QuoteNode,
    ListNode,
    ListItemNode,
    CodeNode,
    CodeHighlightNode,
    LinkNode,
    HorizontalRuleNode,
    WikiLinkNode,
    PersonMentionNode,
  ],
};

interface EditorRootProps {
  noteState: ReturnType<typeof useNoteState>;
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
          <TabIndentationPlugin />
          <MarkdownShortcutPlugin transformers={EDITOR_TRANSFORMERS} />
          <HorizontalRulePlugin />
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
          {/* Floating toolbar for text selection formatting */}
          <SelectionToolbarPlugin />
          {/* Slash command menu */}
          <SlashMenuPlugin />
        </div>
      </LexicalComposer>
    </div>
  );
}
