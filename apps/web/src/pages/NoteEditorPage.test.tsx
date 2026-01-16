/**
 * Tests for NoteEditorPage
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock the config first
vi.mock('../config', () => ({
  DAEMON_PORT: 47832,
}));

// Mock navigation
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock the editor component to avoid Lexical complexity in tests
vi.mock('@scribe/editor', () => ({
  ScribeEditor: ({
    onChange,
    initialContent,
  }: {
    onChange?: (content: unknown) => void;
    initialContent?: unknown;
  }) => (
    <div data-testid="mock-editor" data-initial-content={JSON.stringify(initialContent)}>
      <button
        data-testid="mock-editor-change"
        onClick={() => onChange?.({ root: { children: [], type: 'root', version: 1 } })}
      >
        Trigger Change
      </button>
    </div>
  ),
}));

// Mock the collab module
vi.mock('@scribe/collab', () => ({
  YjsProvider: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="mock-yjs-provider">{children}</div>
  ),
  useYjs: () => ({
    doc: null,
    isLoading: false,
    error: null,
    noteId: 'test-note',
  }),
  LexicalYjsPlugin: () => null,
}));

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

// Create mock client factory
function createMockClient(note = mockNote) {
  const client = {
    on: vi.fn(),
    off: vi.fn(),
    connect: vi.fn().mockImplementation(async () => {
      setTimeout(() => {
        const statusChangeCall = client.on.mock.calls.find(
          (call: unknown[]) => call[0] === 'status-change'
        );
        if (statusChangeCall) {
          const handler = statusChangeCall[1] as (status: string) => void;
          handler('connected');
        }
      }, 0);
    }),
    disconnect: vi.fn(),
    status: 'disconnected' as const,
    isConnected: false,
    api: {
      notes: {
        get: {
          query: vi.fn().mockResolvedValue(note),
        },
        update: {
          mutate: vi.fn().mockResolvedValue({ ...note }),
        },
        delete: {
          mutate: vi.fn().mockResolvedValue(undefined),
        },
      },
    },
    collab: {
      joinDocument: vi.fn().mockResolvedValue({
        doc: {},
        destroy: vi.fn(),
      }),
    },
  };
  return client;
}

// Global mock client reference
let mockClientInstance = createMockClient();

// Mock the client-sdk module
vi.mock('@scribe/client-sdk', () => {
  return {
    ScribeClient: vi.fn().mockImplementation(() => mockClientInstance),
  };
});

// Import after mocks
import { ScribeProvider } from '../providers/ScribeProvider';
import { ScribeClient } from '@scribe/client-sdk';
import { NoteEditorPage } from './NoteEditorPage';

// Helper to render with providers
function renderNoteEditorPage(noteId = 'test-note-123', note = mockNote) {
  mockClientInstance = createMockClient(note);
  (ScribeClient as Mock).mockImplementation(() => mockClientInstance);

  return render(
    <MemoryRouter initialEntries={[`/note/${noteId}`]}>
      <ScribeProvider>
        <Routes>
          <Route path="/note/:id" element={<NoteEditorPage />} />
        </Routes>
      </ScribeProvider>
    </MemoryRouter>
  );
}

describe('NoteEditorPage', () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    mockClientInstance = createMockClient();
    vi.clearAllMocks();
    (ScribeClient as Mock).mockImplementation(() => mockClientInstance);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.resetAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders without crashing', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
      });
    });

    it('has back link to notes list', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        const link = screen.getByTestId('back-link');
        expect(link).toBeInTheDocument();
        expect(link).toHaveAttribute('href', '/');
      });
    });
  });

  describe('Loading state', () => {
    it('shows loading state while fetching note', async () => {
      // Create a custom client with delayed response
      const customClient = createMockClient();
      customClient.api.notes.get.query = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(mockNote), 500))
        );
      (ScribeClient as Mock).mockImplementation(() => customClient);

      render(
        <MemoryRouter initialEntries={['/note/test-note-123']}>
          <ScribeProvider>
            <Routes>
              <Route path="/note/:id" element={<NoteEditorPage />} />
            </Routes>
          </ScribeProvider>
        </MemoryRouter>
      );

      // Should show loading state
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toBeInTheDocument();
        expect(screen.getByText('Loading note...')).toBeInTheDocument();
      });
    });

    it('hides loading state after note loads', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.queryByTestId('loading-state')).not.toBeInTheDocument();
      });
    });
  });

  describe('Error handling', () => {
    it('shows error state when note not found', async () => {
      const customClient = createMockClient();
      customClient.api.notes.get.query = vi.fn().mockResolvedValue(null);
      (ScribeClient as Mock).mockImplementation(() => customClient);

      render(
        <MemoryRouter initialEntries={['/note/nonexistent-note']}>
          <ScribeProvider>
            <Routes>
              <Route path="/note/:id" element={<NoteEditorPage />} />
            </Routes>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
        expect(screen.getByText('Note not found')).toBeInTheDocument();
      });
    });

    it('shows error state when API call fails', async () => {
      const customClient = createMockClient();
      customClient.api.notes.get.query = vi.fn().mockRejectedValue(new Error('Network error'));
      (ScribeClient as Mock).mockImplementation(() => customClient);

      render(
        <MemoryRouter initialEntries={['/note/test-note']}>
          <ScribeProvider>
            <Routes>
              <Route path="/note/:id" element={<NoteEditorPage />} />
            </Routes>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
        expect(screen.getByText('Network error')).toBeInTheDocument();
      });
    });

    it('has back link in error state', async () => {
      // Create a custom note that will return null
      const customMockClient = createMockClient();
      customMockClient.api.notes.get.query = vi.fn().mockResolvedValue(null);
      (ScribeClient as Mock).mockImplementation(() => customMockClient);

      render(
        <MemoryRouter initialEntries={['/note/nonexistent-note']}>
          <ScribeProvider>
            <Routes>
              <Route path="/note/:id" element={<NoteEditorPage />} />
            </Routes>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('back-link')).toBeInTheDocument();
        expect(screen.getByText('Back to notes')).toBeInTheDocument();
      });
    });
  });

  describe('Note display', () => {
    it('loads and displays note title', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        const titleInput = screen.getByTestId('note-title-input');
        expect(titleInput).toBeInTheDocument();
        expect(titleInput).toHaveValue('Test Note Title');
      });
    });

    it('displays editor component', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
      });
    });

    it('passes initial content to editor', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        const editor = screen.getByTestId('mock-editor');
        expect(editor).toHaveAttribute('data-initial-content');
      });
    });
  });

  describe('Title editing', () => {
    it('allows editing the title', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-title-input')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('note-title-input');
      fireEvent.change(titleInput, { target: { value: 'New Title' } });

      await waitFor(() => {
        expect(mockClientInstance.api.notes.update.mutate).toHaveBeenCalledWith({
          id: 'test-note-123',
          title: 'New Title',
        });
      });
    });

    it('updates local state after title change', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-title-input')).toBeInTheDocument();
      });

      const titleInput = screen.getByTestId('note-title-input');
      fireEvent.change(titleInput, { target: { value: 'Updated Title' } });

      await waitFor(() => {
        expect(titleInput).toHaveValue('Updated Title');
      });
    });
  });

  describe('Auto-save', () => {
    it('triggers auto-save on content change', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
      });

      // Trigger content change
      const changeButton = screen.getByTestId('mock-editor-change');
      fireEvent.click(changeButton);

      // Advance timers to trigger debounced save
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      await waitFor(() => {
        expect(mockClientInstance.api.notes.update.mutate).toHaveBeenCalledWith({
          id: 'test-note-123',
          content: { root: { children: [], type: 'root', version: 1 } },
        });
      });
    });

    it('debounces multiple rapid changes', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
      });

      const changeButton = screen.getByTestId('mock-editor-change');

      // Trigger multiple rapid changes
      fireEvent.click(changeButton);
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.click(changeButton);
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.click(changeButton);

      // Should not have saved yet
      expect(mockClientInstance.api.notes.update.mutate).not.toHaveBeenCalled();

      // Advance past debounce delay
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      // Should have saved once
      await waitFor(() => {
        expect(mockClientInstance.api.notes.update.mutate).toHaveBeenCalledTimes(1);
      });
    });

    it('shows save status while saving', async () => {
      // Create a controlled promise that we can resolve manually
      let resolveUpdate: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });

      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
      });

      // Override update.mutate after render to use our controlled promise
      mockClientInstance.api.notes.update.mutate = vi.fn().mockReturnValue(savePromise);

      // Trigger change
      const changeButton = screen.getByTestId('mock-editor-change');
      fireEvent.click(changeButton);

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      // Should show saving status while promise is pending
      expect(screen.getByTestId('save-status')).toHaveTextContent('Saving...');

      // Now resolve the save
      await act(async () => {
        resolveUpdate!();
      });
    });

    it('shows last saved time after save completes', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
      });

      // Trigger change
      const changeButton = screen.getByTestId('mock-editor-change');
      fireEvent.click(changeButton);

      // Advance past debounce
      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      // Wait for save to complete
      await waitFor(() => {
        expect(screen.getByTestId('save-status')).toHaveTextContent(/Saved/);
      });
    });
  });

  describe('Delete note', () => {
    it('has delete button', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('delete-btn')).toBeInTheDocument();
      });
    });

    it('shows confirmation dialog before deleting', async () => {
      const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(false);

      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('delete-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-btn'));

      expect(confirmMock).toHaveBeenCalledWith('Delete this note?');
      expect(mockClientInstance.api.notes.delete.mutate).not.toHaveBeenCalled();

      confirmMock.mockRestore();
    });

    it('deletes note and navigates home on confirm', async () => {
      const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);

      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('delete-btn')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-btn'));

      await waitFor(() => {
        expect(mockClientInstance.api.notes.delete.mutate).toHaveBeenCalledWith('test-note-123');
        expect(mockNavigate).toHaveBeenCalledWith('/');
      });

      confirmMock.mockRestore();
    });

    it('shows alert on delete error', async () => {
      const confirmMock = vi.spyOn(window, 'confirm').mockReturnValue(true);
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('delete-btn')).toBeInTheDocument();
      });

      mockClientInstance.api.notes.delete.mutate = vi
        .fn()
        .mockRejectedValue(new Error('Delete failed'));

      fireEvent.click(screen.getByTestId('delete-btn'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Delete failed: Delete failed');
      });

      confirmMock.mockRestore();
      alertMock.mockRestore();
    });
  });

  describe('Connection states', () => {
    it('shows connecting state while connecting', async () => {
      // Create a client that stays connecting
      const connectingClient = {
        on: vi.fn(),
        off: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined), // Does not trigger status change
        disconnect: vi.fn(),
        status: 'disconnected' as const,
        isConnected: false,
        api: { notes: { get: { query: vi.fn() } } },
        collab: {},
      };

      // Override to simulate connecting status
      (ScribeClient as Mock).mockImplementation(() => {
        const client = { ...connectingClient };
        client.on = vi.fn().mockImplementation((event, handler) => {
          if (event === 'status-change') {
            // Only trigger connecting, not connected
            setTimeout(() => handler('connecting'), 0);
          }
        });
        return client;
      });

      render(
        <MemoryRouter initialEntries={['/note/test-123']}>
          <ScribeProvider>
            <Routes>
              <Route path="/note/:id" element={<NoteEditorPage />} />
            </Routes>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('connecting-state')).toBeInTheDocument();
      });
    });

    it('shows disconnected state when not connected', async () => {
      const disconnectedClient = {
        on: vi.fn(),
        off: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
        status: 'disconnected' as const,
        isConnected: false,
        api: { notes: { get: { query: vi.fn() } } },
        collab: {},
      };
      (ScribeClient as Mock).mockImplementation(() => disconnectedClient);

      render(
        <MemoryRouter initialEntries={['/note/test-123']}>
          <ScribeProvider>
            <Routes>
              <Route path="/note/:id" element={<NoteEditorPage />} />
            </Routes>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('disconnected-state')).toBeInTheDocument();
      });
    });
  });

  describe('Yjs collaboration', () => {
    it('wraps editor in YjsProvider', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('mock-yjs-provider')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('title input has aria-label', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        const titleInput = screen.getByTestId('note-title-input');
        expect(titleInput).toHaveAttribute('aria-label', 'Note title');
      });
    });

    it('back link is accessible', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        const backLink = screen.getByTestId('back-link');
        expect(backLink).toBeVisible();
        expect(backLink).toHaveAttribute('href', '/');
      });
    });
  });
});
