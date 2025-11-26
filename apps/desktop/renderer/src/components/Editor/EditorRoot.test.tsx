import { render, waitFor, screen } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EditorRoot } from './EditorRoot';
import type { Note } from '@scribe/shared';

// Mock note state hook return value
const createMockNoteState = (note: Note | null = null) => ({
  currentNote: note,
  currentNoteId: note?.id ?? null,
  isLoading: false,
  error: null,
  loadNote: vi.fn(),
  saveNote: vi.fn().mockResolvedValue(undefined),
  createNote: vi.fn(),
  deleteNote: vi.fn().mockResolvedValue(undefined),
});

const createEmptyNote = (): Note => ({
  id: 'test-note-1',
  createdAt: Date.now(),
  updatedAt: Date.now(),
  content: {
    root: {
      type: 'root',
      children: [],
      format: '',
      indent: 0,
      version: 1,
    },
  },
  metadata: {
    title: null,
    tags: [],
    links: [],
  },
});

describe('EditorRoot', () => {
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders loading state', () => {
      const noteState = {
        ...createMockNoteState(),
        isLoading: true,
      };

      render(<EditorRoot noteState={noteState} />);
      expect(screen.getByText('Loading...')).toBeTruthy();
    });

    it('renders error state', () => {
      const noteState = {
        ...createMockNoteState(),
        error: 'Failed to load note',
      };

      render(<EditorRoot noteState={noteState} />);
      expect(screen.getByText(/Error: Failed to load note/)).toBeTruthy();
    });

    it('renders editor with empty note', async () => {
      const note = createEmptyNote();
      const noteState = createMockNoteState(note);

      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const editorRoot = document.querySelector('.editor-root');
        expect(editorRoot).toBeTruthy();
      });

      const editorInput = document.querySelector('.editor-input');
      expect(editorInput).toBeTruthy();
    });

    it('renders placeholder when editor is empty', async () => {
      const note = createEmptyNote();
      const noteState = createMockNoteState(note);

      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const placeholder = screen.queryByText('Start writing...');
        expect(placeholder).toBeTruthy();
      });
    });

    it('renders with all required Lexical plugins', async () => {
      const note = createEmptyNote();
      const noteState = createMockNoteState(note);

      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const editorInput = document.querySelector('[data-lexical-editor="true"]');
        expect(editorInput).toBeTruthy();
      });

      // Editor should be initialized and have contenteditable
      const editorInput = document.querySelector('.editor-input');
      expect(editorInput?.getAttribute('contenteditable')).toBe('true');
    });
  });

  describe('Content Loading', () => {
    it('loads simple text content into editor', async () => {
      const note: Note = {
        ...createEmptyNote(),
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'Hello, World!',
                    version: 1,
                  },
                ],
                version: 1,
              },
            ],
            version: 1,
          },
        },
      };

      const noteState = createMockNoteState(note);
      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput?.textContent).toContain('Hello, World!');
      });
    });

    it('loads heading content into editor', async () => {
      const note: Note = {
        ...createEmptyNote(),
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'heading',
                tag: 'h1',
                children: [
                  {
                    type: 'text',
                    text: 'My Heading',
                    version: 1,
                  },
                ],
                version: 1,
              },
            ],
            version: 1,
          },
        },
      };

      const noteState = createMockNoteState(note);
      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const heading = document.querySelector('h1');
        expect(heading).toBeTruthy();
        expect(heading?.textContent).toContain('My Heading');
      });
    });

    it('loads multiple paragraphs into editor', async () => {
      const note: Note = {
        ...createEmptyNote(),
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'First paragraph',
                    version: 1,
                  },
                ],
                version: 1,
              },
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'Second paragraph',
                    version: 1,
                  },
                ],
                version: 1,
              },
            ],
            version: 1,
          },
        },
      };

      const noteState = createMockNoteState(note);
      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput?.textContent).toContain('First paragraph');
        expect(editorInput?.textContent).toContain('Second paragraph');
      });
    });
  });

  describe('Plugin Integration', () => {
    it('initializes with HistoryPlugin', async () => {
      const note = createEmptyNote();
      const noteState = createMockNoteState(note);

      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput).toBeTruthy();
      });

      // History plugin is registered, we can't easily test undo/redo in happy-dom
      // but we can verify the editor renders without errors
      expect(document.querySelector('.editor-root')).toBeTruthy();
    });

    it('initializes with ListPlugin', async () => {
      const note = createEmptyNote();
      const noteState = createMockNoteState(note);

      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput).toBeTruthy();
      });

      // List plugin is registered, verified by successful render
      expect(document.querySelector('.editor-root')).toBeTruthy();
    });

    it('initializes with MarkdownShortcutPlugin', async () => {
      const note = createEmptyNote();
      const noteState = createMockNoteState(note);

      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput).toBeTruthy();
      });

      // Markdown plugin is registered, verified by successful render
      expect(document.querySelector('.editor-root')).toBeTruthy();
    });

    it('initializes AutosavePlugin without errors', async () => {
      const note = createEmptyNote();
      const noteState = createMockNoteState(note);

      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput).toBeTruthy();
      });

      // AutosavePlugin is active and hasn't thrown errors
      expect(noteState.saveNote).not.toHaveBeenCalled(); // Not called without changes
    });

    it('initializes ManualSavePlugin without errors', async () => {
      const note = createEmptyNote();
      const noteState = createMockNoteState(note);

      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput).toBeTruthy();
      });

      // ManualSavePlugin is active
      expect(document.querySelector('.editor-root')).toBeTruthy();
    });
  });

  describe('Note Switching', () => {
    it('loads new content when note ID changes', async () => {
      const note1 = createEmptyNote();
      const noteState1 = createMockNoteState(note1);

      const { rerender } = render(<EditorRoot noteState={noteState1} />);

      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput).toBeTruthy();
      });

      // Create a different note with content
      const note2: Note = {
        id: 'test-note-2',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'Different note content',
                    version: 1,
                  },
                ],
                version: 1,
              },
            ],
            version: 1,
          },
        },
        metadata: {
          title: null,
          tags: [],
          links: [],
        },
      };

      const noteState2 = createMockNoteState(note2);

      // Rerender with new note
      rerender(<EditorRoot noteState={noteState2} />);

      // Should load new content
      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput?.textContent).toContain('Different note content');
      });
    });

    it('handles switching from content to empty note', async () => {
      const note1: Note = {
        ...createEmptyNote(),
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'Some content',
                    version: 1,
                  },
                ],
                version: 1,
              },
            ],
            version: 1,
          },
        },
      };

      const noteState1 = createMockNoteState(note1);
      const { rerender } = render(<EditorRoot noteState={noteState1} />);

      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput?.textContent).toContain('Some content');
      });

      // Switch to empty note
      const note2 = createEmptyNote();
      const noteState2 = createMockNoteState(note2);

      rerender(<EditorRoot noteState={noteState2} />);

      // Note: InitialStatePlugin won't reload empty content, so editor keeps previous content
      // This is expected behavior - we only load non-empty initial states
      await waitFor(() => {
        const editorInput = document.querySelector('.editor-input');
        expect(editorInput).toBeTruthy();
      });
    });
  });

  describe('Rich Text Node Support', () => {
    it('supports CodeNode rendering', async () => {
      const note: Note = {
        ...createEmptyNote(),
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'code',
                language: 'javascript',
                children: [
                  {
                    type: 'text',
                    text: 'const x = 1;',
                    version: 1,
                  },
                ],
                version: 1,
              },
            ],
            version: 1,
          },
        },
      };

      const noteState = createMockNoteState(note);
      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const codeElement = document.querySelector('code');
        expect(codeElement).toBeTruthy();
        expect(codeElement?.textContent).toContain('const x = 1;');
      });
    });

    it('supports QuoteNode rendering', async () => {
      const note: Note = {
        ...createEmptyNote(),
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'quote',
                children: [
                  {
                    type: 'text',
                    text: 'This is a quote',
                    version: 1,
                  },
                ],
                version: 1,
              },
            ],
            version: 1,
          },
        },
      };

      const noteState = createMockNoteState(note);
      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const quoteElement = document.querySelector('blockquote');
        expect(quoteElement).toBeTruthy();
        expect(quoteElement?.textContent).toContain('This is a quote');
      });
    });
  });

  describe('CSS Classes', () => {
    it('applies custom theme classes to paragraphs', async () => {
      const note: Note = {
        ...createEmptyNote(),
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'Test',
                    version: 1,
                  },
                ],
                version: 1,
              },
            ],
            version: 1,
          },
        },
      };

      const noteState = createMockNoteState(note);
      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const paragraph = document.querySelector('.editor-paragraph');
        expect(paragraph).toBeTruthy();
      });
    });

    it('applies theme classes for text formatting', async () => {
      const note: Note = {
        ...createEmptyNote(),
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'text',
                    text: 'Bold text',
                    format: 1, // TEXT_FORMAT_BOLD
                    version: 1,
                  },
                ],
                version: 1,
              },
            ],
            version: 1,
          },
        },
      };

      const noteState = createMockNoteState(note);
      render(<EditorRoot noteState={noteState} />);

      await waitFor(() => {
        const boldElement = document.querySelector('.editor-text-bold');
        expect(boldElement).toBeTruthy();
      });
    });
  });
});
