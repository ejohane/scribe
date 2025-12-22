import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { LexicalComposer } from '@lexical/react/LexicalComposer';
import { useLexicalComposerContext } from '@lexical/react/LexicalComposerContext';
import { RichTextPlugin } from '@lexical/react/LexicalRichTextPlugin';
import { ContentEditable } from '@lexical/react/LexicalContentEditable';
import { LexicalErrorBoundary } from '@lexical/react/LexicalErrorBoundary';
import { $createParagraphNode, $createTextNode, $getRoot, LexicalEditor } from 'lexical';
import type { ReactNode } from 'react';
import { useEffect } from 'react';
import { AutosavePlugin } from './AutosavePlugin';

// Component to capture editor reference
function EditorCapture({ editorRef }: { editorRef: React.MutableRefObject<LexicalEditor | null> }) {
  const [editor] = useLexicalComposerContext();
  useEffect(() => {
    editorRef.current = editor;
  }, [editor, editorRef]);
  return null;
}

// Test wrapper that provides Lexical context
function TestEditor({
  children,
  editorRef,
}: {
  children: ReactNode;
  editorRef: React.MutableRefObject<LexicalEditor | null>;
}) {
  return (
    <LexicalComposer
      initialConfig={{
        namespace: 'test',
        nodes: [],
        onError: (error) => {
          throw error;
        },
      }}
    >
      <RichTextPlugin
        contentEditable={<ContentEditable />}
        placeholder={null}
        ErrorBoundary={LexicalErrorBoundary}
      />
      <EditorCapture editorRef={editorRef} />
      {children}
    </LexicalComposer>
  );
}

/**
 * Helper to wait for editor to be ready
 */
async function waitForEditor(editorRef: React.MutableRefObject<LexicalEditor | null>) {
  for (let i = 0; i < 100; i++) {
    if (editorRef.current) return;
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  throw new Error('Editor not ready');
}

/**
 * Helper to flush all pending promises
 */
async function flushPromises() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

describe('AutosavePlugin', () => {
  let editorRef: React.MutableRefObject<LexicalEditor | null>;
  let mockOnSave: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    editorRef = { current: null };
    mockOnSave = vi.fn().mockResolvedValue(undefined);
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('triggers on change', () => {
    it('calls onSave after debounce when user types', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <AutosavePlugin onSave={mockOnSave} debounceMs={1000} />
        </TestEditor>
      );

      await waitForEditor(editorRef);
      const editor = editorRef.current!;

      // Simulate typing
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Hello world');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // onSave should not be called immediately
      expect(mockOnSave).not.toHaveBeenCalled();

      // Advance timer past debounce delay
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await flushPromises();

      // Now onSave should be called
      expect(mockOnSave).toHaveBeenCalledTimes(1);
      expect(mockOnSave).toHaveBeenCalledWith(
        expect.objectContaining({
          root: expect.any(Object),
        })
      );
    });
  });

  describe('debounces rapid changes', () => {
    it('only saves once after multiple rapid changes', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <AutosavePlugin onSave={mockOnSave} debounceMs={1000} />
        </TestEditor>
      );

      await waitForEditor(editorRef);
      const editor = editorRef.current!;

      // Simulate multiple rapid changes
      for (let i = 0; i < 5; i++) {
        await act(async () => {
          editor.update(() => {
            const root = $getRoot();
            root.clear();
            const paragraph = $createParagraphNode();
            const textNode = $createTextNode(`Change ${i + 1}`);
            paragraph.append(textNode);
            root.append(paragraph);
          });
        });

        // Small delay between changes (less than debounce)
        await act(async () => {
          vi.advanceTimersByTime(200);
        });
      }

      // Still should not have been called
      expect(mockOnSave).not.toHaveBeenCalled();

      // Advance past the debounce from the last change
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await flushPromises();

      // Should only be called once
      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('respects debounce timing', () => {
    it('uses custom debounce delay', async () => {
      const customDebounceMs = 500;

      render(
        <TestEditor editorRef={editorRef}>
          <AutosavePlugin onSave={mockOnSave} debounceMs={customDebounceMs} />
        </TestEditor>
      );

      await waitForEditor(editorRef);
      const editor = editorRef.current!;

      // Make a change
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Custom debounce test');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // Advance to just before debounce expires
      await act(async () => {
        vi.advanceTimersByTime(400);
      });

      expect(mockOnSave).not.toHaveBeenCalled();

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await flushPromises();

      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });

    it('uses default debounce of 1000ms when not specified', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <AutosavePlugin onSave={mockOnSave} />
        </TestEditor>
      );

      await waitForEditor(editorRef);
      const editor = editorRef.current!;

      // Make a change
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Default debounce test');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // Advance to just before default debounce expires
      await act(async () => {
        vi.advanceTimersByTime(900);
      });

      expect(mockOnSave).not.toHaveBeenCalled();

      // Advance past default debounce
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await flushPromises();

      expect(mockOnSave).toHaveBeenCalledTimes(1);
    });
  });

  describe('handles save errors', () => {
    it('logs error when save fails but does not crash', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const saveError = new Error('Save failed');
      mockOnSave.mockRejectedValueOnce(saveError);

      render(
        <TestEditor editorRef={editorRef}>
          <AutosavePlugin onSave={mockOnSave} debounceMs={100} />
        </TestEditor>
      );

      await waitForEditor(editorRef);
      const editor = editorRef.current!;

      // Make a change
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Error test');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await flushPromises();

      // Error should be logged (logger outputs structured format)
      expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
      const logOutput = consoleErrorSpy.mock.calls[0][0] as string;
      expect(logOutput).toContain('ERROR');
      expect(logOutput).toContain('[AutosavePlugin]');
      expect(logOutput).toContain('Autosave failed');

      consoleErrorSpy.mockRestore();
    });

    it('allows subsequent saves after an error', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      mockOnSave
        .mockRejectedValueOnce(new Error('First save failed'))
        .mockResolvedValueOnce(undefined);

      render(
        <TestEditor editorRef={editorRef}>
          <AutosavePlugin onSave={mockOnSave} debounceMs={100} />
        </TestEditor>
      );

      await waitForEditor(editorRef);
      const editor = editorRef.current!;

      // First change (will fail)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('First change');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await flushPromises();

      expect(mockOnSave).toHaveBeenCalledTimes(1);

      // Second change (should succeed)
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Second change');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      await flushPromises();

      expect(mockOnSave).toHaveBeenCalledTimes(2);
    });
  });

  describe('cancels on unmount', () => {
    it('does not call save after component unmounts during debounce', async () => {
      const { unmount } = render(
        <TestEditor editorRef={editorRef}>
          <AutosavePlugin onSave={mockOnSave} debounceMs={1000} />
        </TestEditor>
      );

      await waitForEditor(editorRef);
      const editor = editorRef.current!;

      // Make a change
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Unmount test');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // Unmount before debounce completes
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      unmount();

      // Advance past when debounce would have triggered
      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      await flushPromises();

      // onSave should not have been called
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('only saves on dirty changes', () => {
    it('does not save when no dirty elements or leaves', async () => {
      render(
        <TestEditor editorRef={editorRef}>
          <AutosavePlugin onSave={mockOnSave} debounceMs={100} />
        </TestEditor>
      );

      await waitForEditor(editorRef);

      // Advance timer without any changes
      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      await flushPromises();

      // onSave should not be called
      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });

  describe('prevents concurrent saves', () => {
    it('does not start a new save while one is in progress', async () => {
      let resolveFirstSave: () => void;
      const firstSavePromise = new Promise<void>((resolve) => {
        resolveFirstSave = resolve;
      });

      mockOnSave.mockImplementationOnce(() => firstSavePromise);

      render(
        <TestEditor editorRef={editorRef}>
          <AutosavePlugin onSave={mockOnSave} debounceMs={100} />
        </TestEditor>
      );

      await waitForEditor(editorRef);
      const editor = editorRef.current!;

      // First change
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('First change');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // Trigger first save
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // First save should be in progress
      expect(mockOnSave).toHaveBeenCalledTimes(1);

      // Second change while first save is in progress
      await act(async () => {
        editor.update(() => {
          const root = $getRoot();
          root.clear();
          const paragraph = $createParagraphNode();
          const textNode = $createTextNode('Second change');
          paragraph.append(textNode);
          root.append(paragraph);
        });
      });

      // Advance timer - this would normally trigger another save
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      // The save callback should still only have been called once
      // because the first save is still in progress (isSavingRef is true)
      // Note: The second update will schedule a timeout, but when it fires,
      // isSavingRef.current is true so it won't call onSave
      expect(mockOnSave).toHaveBeenCalledTimes(1);

      // Complete the first save
      await act(async () => {
        resolveFirstSave!();
      });

      await flushPromises();
    });
  });
});
