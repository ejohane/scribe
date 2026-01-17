/**
 * Tests for NoteEditorPage component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { PlatformCapabilities } from '../providers/PlatformProvider';

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
    delete: {
      mutate: vi.fn(),
    },
  },
  export: {
    toMarkdown: {
      query: vi.fn(),
    },
  },
};

// Mock @tanstack/react-query
vi.mock('@tanstack/react-query', () => ({
  QueryClient: vi.fn().mockImplementation(() => ({})),
  QueryClientProvider: ({ children }: { children: React.ReactNode }) => children,
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
  platform?: 'web' | 'electron';
  capabilities?: PlatformCapabilities;
  skipMockSetup?: boolean;
}) {
  const {
    noteId = 'test-note-123',
    note = mockNote,
    platform = 'web',
    capabilities = {},
    skipMockSetup = false,
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
        <PlatformProvider platform={platform} capabilities={capabilities}>
          <Routes>
            <Route path="/note/:id" element={<NoteEditorPage />} />
          </Routes>
        </PlatformProvider>
      </ScribeProvider>
    </MemoryRouter>
  );
}

describe('NoteEditorPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Reset mock function calls but keep mock implementations
    mockNavigate.mockClear();
    mockTrpc.notes.get.query.mockClear();
    mockTrpc.notes.update.mutate.mockClear();
    mockTrpc.notes.delete.mutate.mockClear();
    mockTrpc.export.toMarkdown.query.mockClear();

    // Set default mock implementations
    mockTrpc.notes.get.query.mockResolvedValue(mockNote);
    mockTrpc.notes.update.mutate.mockResolvedValue(mockNote);
    mockTrpc.notes.delete.mutate.mockResolvedValue({ success: true, id: 'test-note-123' });
    mockTrpc.export.toMarkdown.query.mockResolvedValue({ markdown: '# Test Note\n\nContent here' });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders without crashing', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
      });
    });

    it('displays loading state initially', () => {
      renderNoteEditorPage();
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });

    it('displays note title after loading', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('title-input')).toHaveValue('Test Note Title');
      });
    });

    it('has back button', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });
    });
  });

  describe('Error state', () => {
    it('displays error when note not found', async () => {
      renderNoteEditorPage({ note: null });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
        expect(screen.getByText('Note not found')).toBeInTheDocument();
      });
    });

    it('displays error on fetch failure', async () => {
      mockTrpc.notes.get.query.mockRejectedValue(new Error('Network error'));
      renderNoteEditorPage({ skipMockSetup: true });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
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

  describe('Navigation', () => {
    it('navigates back on back button click', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('back-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('back-button'));

      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  describe('Title editing', () => {
    it('updates title on input change', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('title-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('title-input'), {
        target: { value: 'New Title' },
      });

      await waitFor(() => {
        expect(mockTrpc.notes.update.mutate).toHaveBeenCalledWith({
          id: 'test-note-123',
          title: 'New Title',
        });
      });
    });

    it('performs optimistic update on title change', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('title-input')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByTestId('title-input'), {
        target: { value: 'New Title' },
      });

      // Optimistic update should show immediately
      expect(screen.getByTestId('title-input')).toHaveValue('New Title');
    });
  });

  describe('Delete note', () => {
    it('shows confirmation dialog before delete', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('delete-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button'));

      expect(confirmSpy).toHaveBeenCalledWith('Delete this note?');
      expect(mockTrpc.notes.delete.mutate).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('deletes note and navigates on confirmation', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('delete-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button'));

      await waitFor(() => {
        expect(mockTrpc.notes.delete.mutate).toHaveBeenCalledWith('test-note-123');
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });

      confirmSpy.mockRestore();
    });

    it('shows deleting state while deleting', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      let resolveDelete: (value?: unknown) => void;
      mockTrpc.notes.delete.mutate.mockReturnValue(
        new Promise((resolve) => {
          resolveDelete = resolve;
        })
      );

      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('delete-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button'));

      expect(screen.getByTestId('delete-button')).toHaveTextContent('Deleting...');
      expect(screen.getByTestId('delete-button')).toBeDisabled();

      await act(async () => {
        resolveDelete!();
      });

      confirmSpy.mockRestore();
    });
  });

  describe('Export note', () => {
    it('copies to clipboard on web platform', async () => {
      const clipboardSpy = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue();
      renderNoteEditorPage({ platform: 'web' });

      await waitFor(() => {
        expect(screen.getByTestId('export-button')).toBeInTheDocument();
      });

      expect(screen.getByTestId('export-button')).toHaveTextContent('Copy as Markdown');

      fireEvent.click(screen.getByTestId('export-button'));

      await waitFor(() => {
        expect(mockTrpc.export.toMarkdown.query).toHaveBeenCalledWith({ noteId: 'test-note-123' });
        expect(clipboardSpy).toHaveBeenCalledWith('# Test Note\n\nContent here');
      });

      clipboardSpy.mockRestore();
    });

    it('uses native dialog on electron platform', async () => {
      const saveFileMock = vi.fn().mockResolvedValue(true);
      const capabilities: PlatformCapabilities = {
        dialog: {
          selectFolder: vi.fn(),
          saveFile: saveFileMock,
        },
      };

      renderNoteEditorPage({ platform: 'electron', capabilities });

      await waitFor(() => {
        expect(screen.getByTestId('export-button')).toBeInTheDocument();
      });

      expect(screen.getByTestId('export-button')).toHaveTextContent('Export');

      fireEvent.click(screen.getByTestId('export-button'));

      await waitFor(() => {
        expect(saveFileMock).toHaveBeenCalledWith(
          '# Test Note\n\nContent here',
          'Test Note Title.md'
        );
      });
    });
  });

  describe('Auto-save', () => {
    it('saves content after debounce delay', async () => {
      render(
        <MemoryRouter initialEntries={['/note/test-note-123']}>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <Routes>
                <Route
                  path="/note/:id"
                  element={
                    <NoteEditorPage
                      renderEditor={(_content, onChange) => (
                        <button
                          data-testid="trigger-change"
                          onClick={() =>
                            onChange({ root: { children: [], type: 'root', version: 1 } })
                          }
                        >
                          Change
                        </button>
                      )}
                    />
                  }
                />
              </Routes>
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('trigger-change')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('trigger-change'));

      // Should not have saved yet (debouncing)
      expect(mockTrpc.notes.update.mutate).not.toHaveBeenCalledWith(
        expect.objectContaining({ content: expect.anything() })
      );

      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      await waitFor(() => {
        expect(mockTrpc.notes.update.mutate).toHaveBeenCalledWith({
          id: 'test-note-123',
          content: { root: { children: [], type: 'root', version: 1 } },
        });
      });
    });

    it('shows saving indicator while saving', async () => {
      let resolveSave: (value?: unknown) => void;
      mockTrpc.notes.update.mutate.mockImplementation((data) => {
        if (data.content) {
          return new Promise((resolve) => {
            resolveSave = resolve;
          });
        }
        return Promise.resolve(mockNote);
      });

      render(
        <MemoryRouter initialEntries={['/note/test-note-123']}>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <Routes>
                <Route
                  path="/note/:id"
                  element={
                    <NoteEditorPage
                      renderEditor={(_content, onChange) => (
                        <button
                          data-testid="trigger-change"
                          onClick={() =>
                            onChange({ root: { children: [], type: 'root', version: 1 } })
                          }
                        >
                          Change
                        </button>
                      )}
                    />
                  }
                />
              </Routes>
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('trigger-change')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('trigger-change'));

      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      expect(screen.getByTestId('saving-indicator')).toBeInTheDocument();

      await act(async () => {
        resolveSave!();
      });
    });

    it('shows last saved time after save completes', async () => {
      render(
        <MemoryRouter initialEntries={['/note/test-note-123']}>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <Routes>
                <Route
                  path="/note/:id"
                  element={
                    <NoteEditorPage
                      renderEditor={(_content, onChange) => (
                        <button
                          data-testid="trigger-change"
                          onClick={() =>
                            onChange({ root: { children: [], type: 'root', version: 1 } })
                          }
                        >
                          Change
                        </button>
                      )}
                    />
                  }
                />
              </Routes>
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('trigger-change')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('trigger-change'));

      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      await waitFor(() => {
        expect(screen.getByTestId('last-saved')).toBeInTheDocument();
        expect(screen.getByTestId('last-saved')).toHaveTextContent(/Saved/);
      });
    });
  });

  describe('Custom render props', () => {
    it('uses custom loading render prop', () => {
      render(
        <MemoryRouter initialEntries={['/note/test-note-123']}>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <Routes>
                <Route
                  path="/note/:id"
                  element={
                    <NoteEditorPage
                      renderLoading={() => (
                        <div data-testid="custom-loading">Loading custom...</div>
                      )}
                    />
                  }
                />
              </Routes>
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
    });

    it('uses custom error render prop', async () => {
      mockTrpc.notes.get.query.mockRejectedValue(new Error('Test error'));

      render(
        <MemoryRouter initialEntries={['/note/test-note-123']}>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <Routes>
                <Route
                  path="/note/:id"
                  element={
                    <NoteEditorPage
                      renderError={(error, onBack) => (
                        <div data-testid="custom-error">
                          <span>{error}</span>
                          <button onClick={onBack}>Custom back</button>
                        </div>
                      )}
                    />
                  }
                />
              </Routes>
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('custom-error')).toBeInTheDocument();
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });
    });

    it('shows fallback when no editor provided', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('no-editor-provided')).toBeInTheDocument();
      });
    });

    it('renders custom editor', async () => {
      render(
        <MemoryRouter initialEntries={['/note/test-note-123']}>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <Routes>
                <Route
                  path="/note/:id"
                  element={
                    <NoteEditorPage
                      renderEditor={(content) => (
                        <div data-testid="custom-editor">
                          Custom editor with content: {JSON.stringify(content.root.type)}
                        </div>
                      )}
                    />
                  }
                />
              </Routes>
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('custom-editor')).toBeInTheDocument();
        expect(screen.getByTestId('custom-editor')).toHaveTextContent('root');
      });
    });
  });

  describe('Callbacks', () => {
    it('calls onSave callback when note is saved', async () => {
      const onSaveMock = vi.fn();

      render(
        <MemoryRouter initialEntries={['/note/test-note-123']}>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <Routes>
                <Route
                  path="/note/:id"
                  element={
                    <NoteEditorPage
                      onSave={onSaveMock}
                      renderEditor={(_content, onChange) => (
                        <button
                          data-testid="trigger-change"
                          onClick={() =>
                            onChange({ root: { children: [], type: 'root', version: 1 } })
                          }
                        >
                          Change
                        </button>
                      )}
                    />
                  }
                />
              </Routes>
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('trigger-change')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('trigger-change'));

      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      await waitFor(() => {
        expect(onSaveMock).toHaveBeenCalledWith('test-note-123', {
          root: { children: [], type: 'root', version: 1 },
        });
      });
    });

    it('calls onError callback when error occurs', async () => {
      const onErrorMock = vi.fn();
      mockTrpc.notes.get.query.mockRejectedValue(new Error('Test error'));

      render(
        <MemoryRouter initialEntries={['/note/test-note-123']}>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <Routes>
                <Route path="/note/:id" element={<NoteEditorPage onError={onErrorMock} />} />
              </Routes>
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(onErrorMock).toHaveBeenCalledWith(expect.any(Error));
      });
    });
  });
});
