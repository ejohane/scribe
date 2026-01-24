/**
 * DailyHeaderPlugin editor behavior tests.
 *
 * @module
 */

import { useEffect, type FC } from 'react';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { render, screen, waitFor, act, cleanup } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import '@testing-library/jest-dom/vitest';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { HistoryPlugin } from '@lexical/react/LexicalHistoryPlugin';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { $getRoot, type LexicalEditor, type Klass, type LexicalNode } from 'lexical';
import {
  createClientPlugin,
  formatDailyHeaderDate,
  manifest,
  $isDailyHeaderNode,
} from './index.js';

const TEST_DATE = new Date('2024-01-15T12:00:00Z');
const formattedDate = formatDailyHeaderDate(TEST_DATE);

const clientPlugin = createClientPlugin({
  manifest,
  client: {
    query: async () => null,
    mutate: async () => null,
  },
});

const toArray = <T,>(value?: T[] | Record<string, T>): T[] => {
  if (!value) {
    return [];
  }

  return Array.isArray(value) ? value : Object.values(value);
};

const extensionNodes = toArray(clientPlugin.editorExtensions?.nodes) as Array<Klass<LexicalNode>>;
const extensionPlugins = toArray(clientPlugin.editorExtensions?.plugins) as FC[];

function EditorReady({ onReady }: { onReady: (editor: LexicalEditor) => void }) {
  const [editor] = useLexicalComposerContext();

  useEffect(() => {
    onReady(editor);
  }, [editor, onReady]);

  return null;
}

function DailyHeaderTestEditor({ onReady }: { onReady?: (editor: LexicalEditor) => void }) {
  const initialConfig = {
    namespace: 'DailyHeaderTest',
    nodes: extensionNodes,
    onError: (error: Error) => {
      throw error;
    },
  };

  return (
    <LexicalComposer initialConfig={initialConfig}>
      {onReady && <EditorReady onReady={onReady} />}
      <RichTextPlugin
        contentEditable={<ContentEditable data-testid="editor-input" />}
        placeholder={<div />}
        ErrorBoundary={({ children }) => <>{children}</>}
      />
      <HistoryPlugin />
      {extensionPlugins.map((Plugin, index) => (
        <Plugin key={index} />
      ))}
    </LexicalComposer>
  );
}

afterEach(() => {
  cleanup();
});

describe('DailyHeaderPlugin', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(TEST_DATE);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
  });

  it('keeps the daily header non-editable via user input', async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });

    render(<DailyHeaderTestEditor />);

    const header = await screen.findByRole('heading', { level: 1, name: formattedDate });
    expect(header).toHaveAttribute('contenteditable', 'false');

    await act(async () => {
      await user.click(header);
      await user.type(header, 'Updated');
    });

    expect(header).toHaveTextContent(formattedDate);
  });

  it('re-inserts the header when removed', async () => {
    let editor: LexicalEditor | null = null;

    render(<DailyHeaderTestEditor onReady={(nextEditor) => (editor = nextEditor)} />);

    await screen.findByRole('heading', { level: 1, name: formattedDate });

    await waitFor(() => {
      expect(editor).not.toBeNull();
    });

    await act(async () => {
      editor?.update(() => {
        const root = $getRoot();
        const firstChild = root.getFirstChild();
        if (firstChild && $isDailyHeaderNode(firstChild)) {
          firstChild.remove();
        }
      });
    });

    await waitFor(() => {
      expect(screen.getByRole('heading', { level: 1, name: formattedDate })).toBeInTheDocument();
      expect(screen.getAllByRole('heading', { level: 1, name: formattedDate })).toHaveLength(1);
    });

    await waitFor(() => {
      let isHeaderFirst = false;
      editor?.getEditorState().read(() => {
        const firstChild = $getRoot().getFirstChild();
        isHeaderFirst = !!firstChild && $isDailyHeaderNode(firstChild);
      });
      expect(isHeaderFirst).toBe(true);
    });
  });
});
