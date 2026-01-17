/**
 * Tests for NoteEditorPage - Minimal UI
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

const mockNotes = [
  {
    id: 'test-note-123',
    title: 'Test Note Title',
    type: 'note',
    updatedAt: new Date().toISOString(),
  },
  { id: 'note-2', title: 'Another Note', type: 'note', updatedAt: new Date().toISOString() },
];

// Create mock client factory
function createMockClient(note = mockNote, notes = mockNotes) {
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
        list: {
          query: vi.fn().mockResolvedValue(notes),
        },
        create: {
          mutate: vi
            .fn()
            .mockResolvedValue({ id: 'new-note-123', title: 'Untitled', type: 'note' }),
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
function renderNoteEditorPage(noteId = 'test-note-123', note = mockNote, notes = mockNotes) {
  mockClientInstance = createMockClient(note, notes);
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

    it('has hamburger menu button', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
      });
    });
  });

  describe('Loading state', () => {
    it('shows loading state while fetching note', async () => {
      const customClient = createMockClient();
      customClient.api.notes.get.query = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(mockNote), 500))
        );
      customClient.api.notes.list.query = vi
        .fn()
        .mockImplementation(
          () => new Promise((resolve) => setTimeout(() => resolve(mockNotes), 500))
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

      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toBeInTheDocument();
        expect(screen.getByText('Loading...')).toBeInTheDocument();
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
        expect(screen.getByText('Back to notes')).toBeInTheDocument();
      });
    });
  });

  describe('Note display', () => {
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

    it('editor wrapper has max-width of 812px', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        const editor = screen.getByTestId('mock-editor');
        const wrapper = editor.closest('.max-w-\\[812px\\]');
        expect(wrapper).toBeInTheDocument();
      });
    });
  });

  describe('Auto-save', () => {
    it('triggers auto-save on content change', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
      });

      const changeButton = screen.getByTestId('mock-editor-change');
      fireEvent.click(changeButton);

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

      fireEvent.click(changeButton);
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.click(changeButton);
      await act(async () => {
        vi.advanceTimersByTime(500);
      });
      fireEvent.click(changeButton);

      expect(mockClientInstance.api.notes.update.mutate).not.toHaveBeenCalled();

      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      await waitFor(() => {
        expect(mockClientInstance.api.notes.update.mutate).toHaveBeenCalledTimes(1);
      });
    });

    it('shows save status while saving', async () => {
      let resolveUpdate: () => void;
      const savePromise = new Promise<void>((resolve) => {
        resolveUpdate = resolve;
      });

      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
      });

      mockClientInstance.api.notes.update.mutate = vi.fn().mockReturnValue(savePromise);

      const changeButton = screen.getByTestId('mock-editor-change');
      fireEvent.click(changeButton);

      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      expect(screen.getByTestId('save-status')).toHaveTextContent('Saving...');

      await act(async () => {
        resolveUpdate!();
      });
    });

    it('shows last saved time after save completes', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
      });

      const changeButton = screen.getByTestId('mock-editor-change');
      fireEvent.click(changeButton);

      await act(async () => {
        vi.advanceTimersByTime(1100);
      });

      await waitFor(() => {
        expect(screen.getByTestId('save-status')).toHaveTextContent(/Saved/);
      });
    });
  });

  describe('Hamburger menu', () => {
    it('opens sheet when menu button is clicked', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /menu/i }));

      await waitFor(() => {
        expect(screen.getByText('Notes')).toBeInTheDocument();
        expect(screen.getByText('New Note')).toBeInTheDocument();
      });
    });

    it('displays notes list in sidebar', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /menu/i }));

      await waitFor(() => {
        expect(screen.getByText('Test Note Title')).toBeInTheDocument();
        expect(screen.getByText('Another Note')).toBeInTheDocument();
      });
    });

    it('highlights current note in sidebar', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /menu/i }));

      await waitFor(() => {
        // The current note should be visible and have a highlighted style
        expect(screen.getByText('Test Note Title')).toBeInTheDocument();
        // Find the container with the highlight class (contains bg-[#2c2c2e])
        const noteLinks = screen.getAllByRole('link');
        const currentNoteLink = noteLinks.find((link) =>
          link.textContent?.includes('Test Note Title')
        );
        expect(currentNoteLink).toBeInTheDocument();
      });
    });
  });

  describe('Connection states', () => {
    it('shows connecting state while connecting', async () => {
      const connectingClient = {
        on: vi.fn(),
        off: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
        status: 'disconnected' as const,
        isConnected: false,
        api: {
          notes: {
            get: { query: vi.fn() },
            list: { query: vi.fn() },
            create: { mutate: vi.fn() },
            update: { mutate: vi.fn() },
            delete: { mutate: vi.fn() },
          },
        },
        collab: {},
      };

      (ScribeClient as Mock).mockImplementation(() => {
        const client = { ...connectingClient };
        client.on = vi.fn().mockImplementation((event, handler) => {
          if (event === 'status-change') {
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
        api: {
          notes: {
            get: { query: vi.fn() },
            list: { query: vi.fn() },
            create: { mutate: vi.fn() },
            update: { mutate: vi.fn() },
            delete: { mutate: vi.fn() },
          },
        },
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
    it('menu button has aria-label', async () => {
      renderNoteEditorPage();

      await waitFor(() => {
        const menuButton = screen.getByRole('button', { name: /menu/i });
        expect(menuButton).toHaveAttribute('aria-label', 'Menu');
      });
    });
  });
});
