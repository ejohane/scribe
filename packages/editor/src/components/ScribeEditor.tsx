/**
 * ScribeEditor - Main Lexical-based rich text editor component.
 *
 * This component provides a fully-featured rich text editor using Lexical
 * with support for headings, lists, links, formatting, and Yjs collaboration.
 *
 * @module
 */

import { type FC, useCallback, useEffect, useMemo } from 'react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { OnChangePlugin } from '@lexical/react/LexicalOnChangePlugin';
import { AutoFocusPlugin } from '@lexical/react/LexicalAutoFocusPlugin';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { LinkPlugin } from '@lexical/react/LexicalLinkPlugin';
import { MarkdownShortcutPlugin } from '@lexical/react/LexicalMarkdownShortcutPlugin';
import { TRANSFORMERS } from '@lexical/markdown';
import { HeadingNode, QuoteNode } from '@lexical/rich-text';
import { ListNode, ListItemNode } from '@lexical/list';
import { LinkNode, AutoLinkNode } from '@lexical/link';
import { CodeNode, CodeHighlightNode } from '@lexical/code';
import type { EditorState, SerializedEditorState, Klass, LexicalNode } from 'lexical';
import type * as Y from 'yjs';

import { editorTheme } from '../theme.js';
import { EditorToolbar } from './EditorToolbar.js';
import { EditorErrorBoundary } from './EditorErrorBoundary.js';
import { MarkdownAutoFormatPlugin } from '../plugins/MarkdownAutoFormatPlugin.js';
import { MarkdownRevealPlugin } from '../plugins/MarkdownRevealPlugin.js';
import { MarkdownRevealNode } from '../plugins/MarkdownRevealNode.js';
import { CollapsibleHeadingNode } from '../plugins/CollapsibleHeadingNode.js';

/**
 * Editor content type - serialized Lexical state.
 */
export type EditorContent = SerializedEditorState;

/**
 * Entry for a Lexical node extension.
 */
export interface EditorExtensionNodeEntry {
  id: string;
  node: Klass<LexicalNode>;
}

/**
 * Entry for a React editor plugin extension.
 */
export interface EditorExtensionPluginEntry {
  id: string;
  plugin: FC;
}

/**
 * Snapshot of active editor extensions.
 */
export interface EditorExtensionSnapshot {
  nodes: Klass<LexicalNode>[];
  plugins: FC[];
}

/**
 * Guard hook for validating editor extensions.
 */
export type EditorExtensionGuard = (extensions: EditorExtensionSnapshot) => void;

/**
 * Collection of editor extensions.
 */
export interface EditorExtensions {
  nodes?: EditorExtensionNodeEntry[];
  plugins?: EditorExtensionPluginEntry[];
  guards?: EditorExtensionGuard[];
}

/**
 * Node types for rich text editing.
 */
const EDITOR_NODES: Klass<LexicalNode>[] = [
  HeadingNode,
  QuoteNode,
  ListNode,
  ListItemNode,
  LinkNode,
  AutoLinkNode,
  CodeNode,
  CodeHighlightNode,
  // Hybrid markdown editing nodes
  MarkdownRevealNode,
  CollapsibleHeadingNode,
];

/**
 * Props for the ScribeEditor component.
 */
export interface ScribeEditorProps {
  /** Initial content for the editor (serialized Lexical state) */
  initialContent?: EditorContent;
  /** Callback fired when content changes */
  onChange?: (content: EditorContent) => void;
  /** Placeholder text when editor is empty */
  placeholder?: string;
  /** Whether the editor is read-only */
  readOnly?: boolean;
  /** Whether to auto-focus the editor on mount */
  autoFocus?: boolean;
  /** Whether to show the toolbar (defaults to true) */
  showToolbar?: boolean;
  /** Additional CSS class name */
  className?: string;
  /** Yjs document for collaborative editing (optional) */
  yjsDoc?: Y.Doc;
  /** Component to render for Yjs sync (injected to avoid hard dep on collab) */
  YjsPlugin?: FC<{ doc: Y.Doc }>;
  /** Callback for editor errors */
  onError?: (error: Error) => void;
  /** Editor extensions from plugins */
  editorExtensions?: EditorExtensions;
}

/**
 * Wrapper for ContentEditable with proper error boundary support.
 */
function LexicalErrorBoundary({ children }: { children: React.ReactNode }): JSX.Element {
  return <EditorErrorBoundary>{children}</EditorErrorBoundary>;
}

/**
 * ScribeEditor - Main rich text editor component.
 *
 * This component wraps Lexical with standard plugins and theme configuration.
 * It supports rich text formatting, lists, links, and optional Yjs collaboration.
 *
 * @example
 * ```tsx
 * // Basic usage
 * <ScribeEditor onChange={(content) => console.log(content)} />
 *
 * // With initial content
 * <ScribeEditor
 *   initialContent={note.content}
 *   onChange={handleSave}
 * />
 *
 * // With Yjs collaboration
 * import { LexicalYjsPlugin } from '@scribe/collab';
 * <ScribeEditor
 *   yjsDoc={session.doc}
 *   YjsPlugin={LexicalYjsPlugin}
 * />
 *
 * // Read-only mode
 * <ScribeEditor
 *   initialContent={note.content}
 *   readOnly
 * />
 * ```
 */
export const ScribeEditor: FC<ScribeEditorProps> = ({
  initialContent,
  onChange,
  placeholder = 'Start writing...',
  readOnly = false,
  autoFocus = true,
  showToolbar = true,
  className,
  yjsDoc,
  YjsPlugin,
  onError,
  editorExtensions,
}) => {
  const handleError = useCallback(
    (error: Error) => {
      console.error('Lexical error:', error);
      onError?.(error);
    },
    [onError]
  );

  const handleChange = useCallback(
    (editorState: EditorState) => {
      if (onChange) {
        onChange(editorState.toJSON() as EditorContent);
      }
    },
    [onChange]
  );

  const extensionNodeEntries = useMemo(() => editorExtensions?.nodes ?? [], [editorExtensions]);
  const extensionPluginEntries = useMemo(() => editorExtensions?.plugins ?? [], [editorExtensions]);
  const extensionNodes = useMemo(
    () => extensionNodeEntries.map((entry) => entry.node),
    [extensionNodeEntries]
  );
  const extensionPlugins = useMemo(
    () => extensionPluginEntries.map((entry) => entry.plugin),
    [extensionPluginEntries]
  );

  const editorNodes = useMemo(() => {
    const nodeMap = new Map<string, Klass<LexicalNode>>();

    for (const node of [...EDITOR_NODES, ...extensionNodes]) {
      if (!node?.getType) {
        continue;
      }
      const type = node.getType();
      if (!nodeMap.has(type)) {
        nodeMap.set(type, node);
      }
    }

    return Array.from(nodeMap.values());
  }, [extensionNodes]);

  useEffect(() => {
    if (!editorExtensions?.guards?.length) {
      return;
    }

    const snapshot: EditorExtensionSnapshot = {
      nodes: extensionNodes,
      plugins: extensionPlugins,
    };

    editorExtensions.guards.forEach((guard) => {
      try {
        guard(snapshot);
      } catch (error) {
        console.warn('[ScribeEditor] Editor extension guard failed', error);
      }
    });
  }, [editorExtensions, extensionNodes, extensionPlugins]);

  const initialConfig = useMemo(
    () => ({
      namespace: 'ScribeEditor',
      theme: editorTheme,
      nodes: editorNodes,
      editable: !readOnly,
      onError: handleError,
      editorState: initialContent ? JSON.stringify(initialContent) : undefined,
    }),
    [editorNodes, handleError, initialContent, readOnly]
  );

  const editorClassName = [
    'scribe-editor',
    readOnly ? 'scribe-editor-readonly' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <LexicalComposer initialConfig={initialConfig}>
      <div
        className={editorClassName}
        data-testid="scribe-editor"
        role="textbox"
        aria-label="Scribe Editor"
        aria-readonly={readOnly}
        aria-multiline="true"
      >
        {showToolbar && !readOnly && <EditorToolbar />}

        <div className="scribe-editor-content">
          <RichTextPlugin
            contentEditable={
              <ContentEditable
                className="scribe-editor-input"
                aria-placeholder={placeholder}
                placeholder={<div className="scribe-editor-placeholder">{placeholder}</div>}
              />
            }
            ErrorBoundary={LexicalErrorBoundary}
          />

          <ListPlugin />
          <LinkPlugin />
          <HistoryPlugin />
          <MarkdownShortcutPlugin transformers={TRANSFORMERS} />
          <MarkdownAutoFormatPlugin />
          <MarkdownRevealPlugin />

          {extensionPluginEntries.map((entry) => {
            const ExtensionPlugin = entry.plugin;
            return <ExtensionPlugin key={entry.id} />;
          })}

          {autoFocus && !readOnly && <AutoFocusPlugin />}

          {onChange && <OnChangePlugin onChange={handleChange} ignoreSelectionChange />}

          {yjsDoc && YjsPlugin && <YjsPlugin doc={yjsDoc} />}
        </div>
      </div>
    </LexicalComposer>
  );
};
