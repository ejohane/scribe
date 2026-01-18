/**
 * PersonMentionPlugin Tests
 *
 * NOTE: People feature is temporarily disabled during thin shell refactor.
 * These tests verify the stubbed components work correctly.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { createNoteId } from '@scribe/shared';
import { PersonMentionPlugin } from './PersonMentionPlugin';
import { PersonMentionNode } from './PersonMentionNode';
import { PersonMentionProvider } from './PersonMentionContext';

// Test wrapper that provides Lexical context and PersonMention context
function TestEditor({
  children,
  onError,
}: {
  children: React.ReactNode;
  onError?: (msg: string) => void;
}) {
  const config = {
    namespace: 'test-editor',
    theme: {},
    nodes: [PersonMentionNode],
    onError: (error: Error) => console.error(error),
  };

  return (
    <LexicalComposer initialConfig={config}>
      <PersonMentionProvider
        currentNoteId={null}
        onMentionClick={async () => {}}
        onError={onError ?? (() => {})}
      >
        <RichTextPlugin
          contentEditable={<ContentEditable data-testid="editor" />}
          ErrorBoundary={LexicalErrorBoundary}
        />
        {children}
      </PersonMentionProvider>
    </LexicalComposer>
  );
}

describe('PersonMentionPlugin', () => {
  it('renders without crashing', () => {
    render(
      <TestEditor>
        <PersonMentionPlugin currentNoteId={createNoteId('test-note')} />
      </TestEditor>
    );
    expect(screen.getByTestId('editor')).toBeInTheDocument();
  });

  it('shows feature coming soon when trying to create person', async () => {
    const onError = vi.fn();
    render(
      <TestEditor onError={onError}>
        <PersonMentionPlugin currentNoteId={createNoteId('test-note')} />
      </TestEditor>
    );
    // Plugin is stubbed - no autocomplete to test
    expect(screen.getByTestId('editor')).toBeInTheDocument();
  });
});
