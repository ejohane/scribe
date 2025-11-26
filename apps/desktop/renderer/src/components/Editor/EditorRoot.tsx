import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
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
import './EditorRoot.css';

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
    // We'll add minimal theme classes
    paragraph: 'editor-paragraph',
    text: {
      bold: 'editor-text-bold',
      italic: 'editor-text-italic',
      underline: 'editor-text-underline',
    },
    list: {
      nested: {
        listitem: 'editor-nested-listitem',
      },
      ol: 'editor-list-ol',
      ul: 'editor-list-ul',
      listitem: 'editor-listitem',
    },
    hr: 'editor-hr',
    hrSelected: 'editor-hr-selected',
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
  ],
};

interface EditorRootProps {
  noteState: ReturnType<typeof useNoteState>;
}

export function EditorRoot({ noteState }: EditorRootProps) {
  const { currentNote, currentNoteId, isLoading, error, saveNote } = noteState;

  if (isLoading) {
    return (
      <div className="editor-root">
        <div className="editor-loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="editor-root">
        <div className="editor-error">Error: {error}</div>
      </div>
    );
  }

  return (
    <div className="editor-root">
      <LexicalComposer initialConfig={editorConfig}>
        <div className="editor-container">
          <RichTextPlugin
            contentEditable={<ContentEditable className="editor-input" />}
            placeholder={<div className="editor-placeholder">Start writing...</div>}
            ErrorBoundary={LexicalErrorBoundary}
          />
          <HistoryPlugin />
          <ListPlugin />
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
        </div>
      </LexicalComposer>
    </div>
  );
}
