/**
 * Tests for NoteEditorPage component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Create mockTrpc as a stable reference that the factory will return
const mockTrpc = {
  notes: {
    get: {
      query: vi.fn(),
    },
    update: {
      mutate: vi.fn(),
    },
    markAccessed: {
      mutate: vi.fn(),
    },
  },
};

// Mock query client for cache invalidation
const mockInvalidateQueries = vi.fn();
const mockQueryClient = {
  invalidateQueries: mockInvalidateQueries,
};

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn().mockImplementation(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
  useQueryClient: () => mockQueryClient,
}));

// Mock @trpc/client - the factory function captures mockTrpc
vi.mock('@trpc/client', () => ({
  createTRPCProxyClient: () => mockTrpc,
  httpBatchLink: () => ({}),
}));

// Import after mocks
import { NoteEditorPage } from './NoteEditorPage';
import { ScribeProvider } from '../providers/ScribeProvider';
import { PlatformProvider } from '../providers/PlatformProvider';
import type { EditorContent } from '@scribe/client-sdk';

// Sample note data
const mockNote = {
  id: 'test-note-123',
  title: 'Test Note Title',
  type: 'note' as const,
  date: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  content: { root: { children: [], type: 'root' as const, version: 1 } },
  wordCount: 0,
};

// Helper to render with providers
function renderNoteEditorPage(options?: {
  noteId?: string;
  note?: typeof mockNote | null;
  renderEditor?: (
    content: EditorContent,
    onChange: (content: EditorContent) => void
  ) => React.ReactNode;
  renderMenuButton?: () => React.ReactNode;
  onSave?: (noteId: string, content: EditorContent) => void;
  onError?: (error: Error) => void;
  skipMockSetup?: boolean;
  collaborative?: boolean;
}) {
  const {
    noteId = 'test-note-123',
    note = mockNote,
    renderEditor,
    renderMenuButton,
    onSave,
    onError,
    skipMockSetup = false,
    collaborative = false, // Disable collaborative mode in tests by default
  } = options ?? {};

  // Only set up mock if not skipped (allows tests to set up their own mock behavior)
  if (!skipMockSetup) {
    if (note === null) {
      mockTrpc.notes.get.query.mockResolvedValue(null);
    } else {
      mockTrpc.notes.get.query.mockResolvedValue(note);
    }
  }

  return render(
    <MemoryRouter initialEntries={[`/note/${noteId}`]}>
      <ScribeProvider daemonUrl="http://localhost:3000">
        <PlatformProvider platform="web" capabilities={{}}>
          <Routes>
            <Route
              path="/note/:id"
              element={
                <NoteEditorPage
                  collaborative={collaborative}
                  renderEditor={renderEditor}
                  renderMenuButton={renderMenuButton}
                  onSave={onSave}
                  onError={onError}
                />
              }
            />
          </Routes>
        </PlatformProvider>
      </ScribeProvider>
    </MemoryRouter>
  );
}

describe('NoteEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockTrpc.notes.update.mutate.mockResolvedValue(undefined);
    mockTrpc.notes.markAccessed.mutate.mockResolvedValue({ success: true });
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  describe('Basic rendering', () => {
    it('renders without crashing', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
      });
    });

    it('displays loading state initially', () => {
      mockTrpc.notes.get.query.mockImplementation(() => new Promise(() => {}));
      renderNoteEditorPage({ skipMockSetup: true });

      // Loading state is minimal - just the container without content
      expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
      expect(screen.queryByTestId('note-editor-content')).not.toBeInTheDocument();
    });

    it('shows no editor message when renderEditor not provided', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('no-editor-provided')).toBeInTheDocument();
      });
    });
  });

  describe('Error state', () => {
    it('displays error when note not found', async () => {
      renderNoteEditorPage({ note: null });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });
    });

    it('displays error on fetch failure', async () => {
      mockTrpc.notes.get.query.mockRejectedValue(new Error('Test error'));
      renderNoteEditorPage({ skipMockSetup: true });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });
    });

    it('has back button in error state', async () => {
      renderNoteEditorPage({ note: null });

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });

    it('navigates back on back button click in error state', async () => {
      renderNoteEditorPage({ note: null });

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Menu button', () => {
    it('renders menu button when provided', async () => {
      renderNoteEditorPage({
        renderMenuButton: () => <button data-testid="custom-menu">Menu</button>,
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-menu')).toBeInTheDocument();
      });
    });

    it('renders menu button in loading state', () => {
      mockTrpc.notes.get.query.mockImplementation(() => new Promise(() => {}));
      renderNoteEditorPage({
        skipMockSetup: true,
        renderMenuButton: () => <button data-testid="custom-menu">Menu</button>,
      });

      expect(screen.getByTestId('custom-menu')).toBeInTheDocument();
    });

    it('renders menu button in error state', async () => {
      renderNoteEditorPage({
        note: null,
        renderMenuButton: () => <button data-testid="custom-menu">Menu</button>,
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-menu')).toBeInTheDocument();
      });
    });
  });

  describe('Custom editor', () => {
    it('renders custom editor with content', async () => {
      renderNoteEditorPage({
        renderEditor: (content) => <div data-testid="custom-editor">{JSON.stringify(content)}</div>,
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-editor')).toBeInTheDocument();
      });
    });

    it('receives onChange handler', async () => {
      const onChangeCalls: unknown[] = [];
      renderNoteEditorPage({
        renderEditor: (content, onChange) => (
          <button
            data-testid="custom-editor"
            onClick={() => {
              const newContent = { root: { children: [], type: 'root' as const, version: 1 } };
              onChangeCalls.push(newContent);
              onChange(newContent);
            }}
          >
            Change
          </button>
        ),
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-editor')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('custom-editor'));

      expect(onChangeCalls).toHaveLength(1);
    });
  });

  describe('Auto-save', () => {
    it('saves content after debounce delay when user interacts', async () => {
      renderNoteEditorPage({
        renderEditor: (content, onChange) => (
          <button
            data-testid="custom-editor"
            onClick={() =>
              onChange({
                root: { children: [{ type: 'text', text: 'new' }], type: 'root', version: 1 },
              })
            }
          >
            Change
          </button>
        ),
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-editor')).toBeInTheDocument();
      });

      // Simulate user interaction (keyDown) to enable auto-save
      fireEvent.keyDown(screen.getByTestId('note-editor-content'), { key: 'a' });

      fireEvent.click(screen.getByTestId('custom-editor'));

      // Not yet saved
      expect(mockTrpc.notes.update.mutate).not.toHaveBeenCalled();

      // Advance timer past debounce delay
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      expect(mockTrpc.notes.update.mutate).toHaveBeenCalledWith({
        id: 'test-note-123',
        content: { root: { children: [{ type: 'text', text: 'new' }], type: 'root', version: 1 } },
      });
    });

    it('does not save when no user interaction (e.g., Yjs sync)', async () => {
      renderNoteEditorPage({
        renderEditor: (content, onChange) => (
          <button
            data-testid="custom-editor"
            onClick={() =>
              onChange({
                root: { children: [{ type: 'text', text: 'new' }], type: 'root', version: 1 },
              })
            }
          >
            Change
          </button>
        ),
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-editor')).toBeInTheDocument();
      });

      // No user interaction before clicking - simulates Yjs sync triggering onChange

      fireEvent.click(screen.getByTestId('custom-editor'));

      // Advance timer past debounce delay
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      // Should NOT save because no user interaction occurred
      expect(mockTrpc.notes.update.mutate).not.toHaveBeenCalled();
    });

    it('shows saving indicator while saving', async () => {
      let resolveUpdate: () => void = () => {};
      mockTrpc.notes.update.mutate.mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveUpdate = resolve as () => void;
          })
      );

      renderNoteEditorPage({
        renderEditor: (content, onChange) => (
          <button
            data-testid="custom-editor"
            onClick={() => onChange({ root: { children: [], type: 'root', version: 1 } })}
          >
            Change
          </button>
        ),
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-editor')).toBeInTheDocument();
      });

      // Simulate user interaction to enable auto-save
      fireEvent.keyDown(screen.getByTestId('note-editor-content'), { key: 'a' });

      fireEvent.click(screen.getByTestId('custom-editor'));

      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      expect(screen.getByTestId('saving-indicator')).toBeInTheDocument();

      await act(async () => {
        resolveUpdate();
      });

      await waitFor(() => {
        expect(screen.queryByTestId('saving-indicator')).not.toBeInTheDocument();
      });
    });
  });

  describe('Callbacks', () => {
    it('calls onSave callback when note is saved', async () => {
      const onSave = vi.fn();
      renderNoteEditorPage({
        onSave,
        renderEditor: (content, onChange) => (
          <button
            data-testid="custom-editor"
            onClick={() => onChange({ root: { children: [], type: 'root', version: 1 } })}
          >
            Change
          </button>
        ),
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-editor')).toBeInTheDocument();
      });

      // Simulate user interaction to enable auto-save
      fireEvent.keyDown(screen.getByTestId('note-editor-content'), { key: 'a' });

      fireEvent.click(screen.getByTestId('custom-editor'));

      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      await waitFor(() => {
        expect(onSave).toHaveBeenCalledWith('test-note-123', {
          root: { children: [], type: 'root', version: 1 },
        });
      });
    });

    it('calls onError callback when save fails', async () => {
      const onError = vi.fn();
      mockTrpc.notes.update.mutate.mockRejectedValue(new Error('Save failed'));

      renderNoteEditorPage({
        onError,
        renderEditor: (content, onChange) => (
          <button
            data-testid="custom-editor"
            onClick={() => onChange({ root: { children: [], type: 'root', version: 1 } })}
          >
            Change
          </button>
        ),
      });

      await waitFor(() => {
        expect(screen.getByTestId('custom-editor')).toBeInTheDocument();
      });

      // Simulate user interaction to enable auto-save
      fireEvent.keyDown(screen.getByTestId('note-editor-content'), { key: 'a' });

      fireEvent.click(screen.getByTestId('custom-editor'));

      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
        expect(onError.mock.calls[0][0].message).toBe('Save failed');
      });
    });

    it('calls onError callback when fetch fails', async () => {
      const onError = vi.fn();
      mockTrpc.notes.get.query.mockRejectedValue(new Error('Fetch failed'));

      renderNoteEditorPage({
        onError,
        skipMockSetup: true,
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
        expect(onError.mock.calls[0][0].message).toBe('Fetch failed');
      });
    });
  });

  describe('Note ID prop', () => {
    it('uses noteId prop over URL param', async () => {
      render(
        <MemoryRouter initialEntries={['/note/url-id']}>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <Routes>
                <Route
                  path="/note/:id"
                  element={<NoteEditorPage noteId="prop-id" collaborative={false} />}
                />
              </Routes>
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockTrpc.notes.get.query).toHaveBeenCalledWith('prop-id');
      });
    });
  });

  describe('Mark accessed tracking', () => {
    it('marks note as accessed when page mounts', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(mockTrpc.notes.markAccessed.mutate).toHaveBeenCalledWith({
          noteId: 'test-note-123',
        });
      });
    });

    it('invalidates recentlyAccessed cache after marking accessed', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(mockInvalidateQueries).toHaveBeenCalledWith({
          queryKey: ['notes', 'recentlyAccessed'],
        });
      });
    });

    it('does not mark accessed when note not found', async () => {
      renderNoteEditorPage({ note: null });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      expect(mockTrpc.notes.markAccessed.mutate).not.toHaveBeenCalled();
    });

    it('handles markAccessed failure gracefully', async () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockTrpc.notes.markAccessed.mutate.mockRejectedValue(new Error('Network error'));

      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
      });

      // Should still render the page despite markAccessed failure
      await waitFor(() => {
        expect(screen.getByTestId('note-editor-content')).toBeInTheDocument();
      });

      // Should log warning
      await waitFor(() => {
        expect(consoleWarnSpy).toHaveBeenCalledWith(
          'Failed to mark note as accessed:',
          expect.any(Error)
        );
      });

      consoleWarnSpy.mockRestore();
    });

    it('does not invalidate cache when markAccessed fails', async () => {
      mockTrpc.notes.markAccessed.mutate.mockRejectedValue(new Error('Network error'));
      vi.spyOn(console, 'warn').mockImplementation(() => {});

      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-editor-content')).toBeInTheDocument();
      });

      // Wait a bit to ensure all promises have resolved
      await act(async () => {
        vi.advanceTimersByTime(100);
      });

      expect(mockInvalidateQueries).not.toHaveBeenCalled();
    });
  });
});
