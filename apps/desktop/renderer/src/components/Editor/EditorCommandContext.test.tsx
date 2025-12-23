/**
 * EditorCommandContext Tests
 *
 * Unit tests for the EditorCommandContext which provides cross-component
 * command dispatch to the Lexical editor.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { ListPlugin } from '@lexical/react/LexicalListPlugin';
import { CheckListPlugin } from '@lexical/react/LexicalCheckListPlugin';
import { $createParagraphNode, $createTextNode, $getRoot, type LexicalEditor } from 'lexical';
import { ListNode, ListItemNode } from '@lexical/list';
import { useEffect } from 'react';
import type { ReactNode } from 'react';

import {
  EditorCommandProvider,
  useEditorCommand,
  useEditorCommandSetter,
} from './EditorCommandContext';
import { FocusNodePlugin, FOCUS_NODE_COMMAND } from './plugins/FocusNodePlugin';

// Component to capture editor reference
function EditorCapture({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

// Bridge component that registers the editor with the context
function EditorCommandBridge() {
  const [editor] = useLexicalComposerContext();
  const { setEditor } = useEditorCommandSetter();

  useEffect(() => {
    setEditor(editor);
    return () => setEditor(null);
  }, [editor, setEditor]);

  return null;
}

// Test wrapper with full Lexical setup
function TestEditorWithContext({
  children,
  editorRef,
}: {
  children?: ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  return (
    <EditorCommandProvider>
      <LexicalComposer
        initialConfig={{
          namespace: 'editor-command-test',
          nodes: [ListNode, ListItemNode],
          onError: (error) => {
            throw error;
          },
        }}
      >
        <RichTextPlugin
          contentEditable={<ContentEditable data-testid="editor" />}
          placeholder={null}
          ErrorBoundary={LexicalErrorBoundary}
        />
        <EditorCapture editorRef={editorRef} />
        <EditorCommandBridge />
        <ListPlugin />
        <CheckListPlugin />
        <FocusNodePlugin />
        {children}
      </LexicalComposer>
    </EditorCommandProvider>
  );
}

// Component that uses the editor command context
function CommandConsumer({
  onCommand,
}: {
  onCommand: (value: ReturnType<typeof useEditorCommand>) => void;
}) {
  const commandContext = useEditorCommand();
  useEffect(() => {
    onCommand(commandContext);
  }, [commandContext, onCommand]);
  return null;
}

// Mock scrollIntoView
const mockScrollIntoView = vi.fn();

describe('EditorCommandContext', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;

  beforeEach(() => {
    editorRef = { current: null };
    vi.clearAllMocks();
    Element.prototype.scrollIntoView = mockScrollIntoView;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('EditorCommandProvider', () => {
    it('renders children', () => {
      render(
        <EditorCommandProvider>
          <div data-testid="child">Child content</div>
        </EditorCommandProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });
  });

  describe('useEditorCommand', () => {
    it('throws when used outside of EditorCommandProvider', () => {
      // Suppress React error boundary console errors
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function ConsumerOutsideProvider() {
        useEditorCommand();
        return null;
      }

      expect(() => {
        render(<ConsumerOutsideProvider />);
      }).toThrow('useEditorCommand must be used within an EditorCommandProvider');

      consoleSpy.mockRestore();
    });

    it('returns focusNode function and hasEditor state', async () => {
      let capturedContext: ReturnType<typeof useEditorCommand> | null = null;

      render(
        <TestEditorWithContext editorRef={editorRef}>
          <CommandConsumer
            onCommand={(ctx) => {
              capturedContext = ctx;
            }}
          />
        </TestEditorWithContext>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(capturedContext).not.toBeNull());

      expect(capturedContext!.focusNode).toBeInstanceOf(Function);
      expect(capturedContext!.hasEditor).toBe(true);
    });

    it('hasEditor is false when no editor is registered', async () => {
      let capturedContext: ReturnType<typeof useEditorCommand> | null = null;

      // Provider without editor registration
      render(
        <EditorCommandProvider>
          <CommandConsumer
            onCommand={(ctx) => {
              capturedContext = ctx;
            }}
          />
        </EditorCommandProvider>
      );

      await waitFor(() => expect(capturedContext).not.toBeNull());
      expect(capturedContext!.hasEditor).toBe(false);
    });
  });

  describe('useEditorCommandSetter', () => {
    it('throws when used outside of EditorCommandProvider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      function SetterOutsideProvider() {
        useEditorCommandSetter();
        return null;
      }

      expect(() => {
        render(<SetterOutsideProvider />);
      }).toThrow('useEditorCommandSetter must be used within an EditorCommandProvider');

      consoleSpy.mockRestore();
    });

    it('returns setEditor function', async () => {
      let capturedSetter: ReturnType<typeof useEditorCommandSetter> | null = null;

      function SetterConsumer() {
        capturedSetter = useEditorCommandSetter();
        return null;
      }

      render(
        <EditorCommandProvider>
          <SetterConsumer />
        </EditorCommandProvider>
      );

      expect(capturedSetter).not.toBeNull();
      expect(capturedSetter!.setEditor).toBeInstanceOf(Function);
    });
  });

  describe('focusNode', () => {
    it('dispatches FOCUS_NODE_COMMAND when editor is set', async () => {
      let capturedContext: ReturnType<typeof useEditorCommand> | null = null;

      render(
        <TestEditorWithContext editorRef={editorRef}>
          <CommandConsumer
            onCommand={(ctx) => {
              capturedContext = ctx;
            }}
          />
        </TestEditorWithContext>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(capturedContext?.hasEditor).toBe(true));

      const editor = editorRef.current!;
      let targetNodeKey: string = '';

      // Create a paragraph to focus
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Target text'));
          root.append(paragraph);
          targetNodeKey = paragraph.getKey();
        });
      });

      // Dispatch focus command via context
      await act(async () => {
        capturedContext!.focusNode(targetNodeKey);
      });

      // Verify the node was focused (scrollIntoView called)
      expect(mockScrollIntoView).toHaveBeenCalled();
    });

    it('logs warning when editor is not available', async () => {
      let capturedContext: ReturnType<typeof useEditorCommand> | null = null;

      // Provider without editor
      render(
        <EditorCommandProvider>
          <CommandConsumer
            onCommand={(ctx) => {
              capturedContext = ctx;
            }}
          />
        </EditorCommandProvider>
      );

      await waitFor(() => expect(capturedContext).not.toBeNull());

      // Try to focus a node
      capturedContext!.focusNode('some-node-key');

      // Should warn about no editor
      const warnCalls = (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const logCall = warnCalls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('[EditorCommandContext]') &&
          call[0].includes('no editor is available')
      );
      expect(logCall).toBeDefined();
    });

    it('passes fallback options to FOCUS_NODE_COMMAND', async () => {
      let capturedContext: ReturnType<typeof useEditorCommand> | null = null;
      const dispatchSpy = vi.fn();

      render(
        <TestEditorWithContext editorRef={editorRef}>
          <CommandConsumer
            onCommand={(ctx) => {
              capturedContext = ctx;
            }}
          />
        </TestEditorWithContext>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());
      await waitFor(() => expect(capturedContext?.hasEditor).toBe(true));

      const editor = editorRef.current!;

      // Spy on dispatchCommand
      const originalDispatch = editor.dispatchCommand.bind(editor);
      editor.dispatchCommand = vi.fn((command, payload) => {
        dispatchSpy(command, payload);
        return originalDispatch(command, payload);
      });

      // Create a paragraph
      let targetNodeKey: string = '';
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          paragraph.append($createTextNode('Target'));
          root.append(paragraph);
          targetNodeKey = paragraph.getKey();
        });
      });

      // Call focusNode with fallback options
      await act(async () => {
        capturedContext!.focusNode(targetNodeKey, {
          lineIndexFallback: 5,
          textHashFallback: 'abc123',
        });
      });

      // Verify dispatch was called with correct payload
      expect(dispatchSpy).toHaveBeenCalledWith(FOCUS_NODE_COMMAND, {
        nodeKey: targetNodeKey,
        lineIndexFallback: 5,
        textHashFallback: 'abc123',
      });
    });
  });

  describe('Context value stability', () => {
    it('context values are memoized across re-renders', async () => {
      const commandContextValues: ReturnType<typeof useEditorCommand>[] = [];
      const setterContextValues: ReturnType<typeof useEditorCommandSetter>[] = [];

      function ContextCapture() {
        const commandCtx = useEditorCommand();
        const setterCtx = useEditorCommandSetter();

        useEffect(() => {
          commandContextValues.push(commandCtx);
          setterContextValues.push(setterCtx);
        });

        return null;
      }

      const { rerender } = render(
        <TestEditorWithContext editorRef={editorRef}>
          <ContextCapture />
        </TestEditorWithContext>
      );

      await waitFor(() => expect(editorRef.current).not.toBeNull());

      // Force a re-render
      rerender(
        <TestEditorWithContext editorRef={editorRef}>
          <ContextCapture />
        </TestEditorWithContext>
      );

      // Wait for re-render to settle
      await waitFor(() => expect(commandContextValues.length).toBeGreaterThan(1));

      // Check that focusNode function reference is stable (same object)
      // The hasEditor may change, so we compare the function references
      const firstFocusNode = commandContextValues[0]?.focusNode;
      const lastFocusNode = commandContextValues[commandContextValues.length - 1]?.focusNode;

      // When editor hasn't changed, focusNode should be stable
      if (
        commandContextValues[0]?.hasEditor ===
        commandContextValues[commandContextValues.length - 1]?.hasEditor
      ) {
        expect(firstFocusNode).toBe(lastFocusNode);
      }

      // setEditor should always be stable
      const firstSetEditor = setterContextValues[0]?.setEditor;
      const lastSetEditor = setterContextValues[setterContextValues.length - 1]?.setEditor;
      expect(firstSetEditor).toBe(lastSetEditor);
    });
  });

  describe('Editor cleanup', () => {
    it('handles editor being set to null', async () => {
      let capturedContext: ReturnType<typeof useEditorCommand> | null = null;
      let capturedSetter: ReturnType<typeof useEditorCommandSetter> | null = null;

      function CaptureContexts() {
        capturedContext = useEditorCommand();
        capturedSetter = useEditorCommandSetter();
        return null;
      }

      render(
        <TestEditorWithContext editorRef={editorRef}>
          <CaptureContexts />
        </TestEditorWithContext>
      );

      await waitFor(() => expect(capturedContext?.hasEditor).toBe(true));

      // Simulate editor cleanup
      act(() => {
        capturedSetter!.setEditor(null);
      });

      await waitFor(() => expect(capturedContext?.hasEditor).toBe(false));

      // Try to focus - should warn, not crash
      capturedContext!.focusNode('some-key');

      const warnCalls = (console.warn as unknown as { mock: { calls: unknown[][] } }).mock.calls;
      const logCall = warnCalls.find(
        (call) =>
          typeof call[0] === 'string' &&
          call[0].includes('[EditorCommandContext]') &&
          call[0].includes('no editor is available')
      );
      expect(logCall).toBeDefined();
    });
  });
});
