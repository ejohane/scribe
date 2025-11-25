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
import { TRANSFORMERS } from '@lexical/markdown';

import type { useNoteState } from '../../hooks/useNoteState';
import { InitialStatePlugin } from './plugins/InitialStatePlugin';
import { AutosavePlugin } from './plugins/AutosavePlugin';
import { ManualSavePlugin } from './plugins/ManualSavePlugin';
import './EditorRoot.css';

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
  },
  onError(error: Error) {
    console.error('Lexical error:', error);
  },
  nodes: [HeadingNode, QuoteNode, ListNode, ListItemNode, CodeNode, CodeHighlightNode, LinkNode],
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
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          {/* Load the initial note content */}
          <InitialStatePlugin initialState={currentNote?.content ?? null} noteId={currentNoteId} />
          {/* Auto-save editor changes */}
          <AutosavePlugin onSave={saveNote} debounceMs={1000} />
          {/* Manual save with cmd/ctrl+s */}
          <ManualSavePlugin onSave={saveNote} />
        </div>
      </LexicalComposer>
    </div>
  );
}
