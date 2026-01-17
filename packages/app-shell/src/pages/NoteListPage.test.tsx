/**
 * Tests for NoteListPage component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
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
    list: {
      query: vi.fn(),
    },
    create: {
      mutate: vi.fn(),
    },
    delete: {
      mutate: vi.fn(),
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
import { NoteListPage } from './NoteListPage';
import { ScribeProvider } from '../providers/ScribeProvider';
import { PlatformProvider } from '../providers/PlatformProvider';

// Sample note data
const mockNotes = [
  {
    id: 'note-1',
    title: 'First Note',
    type: 'note',
    date: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    wordCount: 100,
    filePath: '/notes/note-1.json',
  },
  {
    id: 'note-2',
    title: 'Second Note',
    type: 'note',
    date: null,
    createdAt: new Date(Date.now() - 86400000).toISOString(), // Yesterday
    updatedAt: new Date(Date.now() - 86400000).toISOString(),
    wordCount: 50,
    filePath: '/notes/note-2.json',
  },
];

// Helper to render with providers
function renderNoteListPage(options?: {
  notes?: typeof mockNotes;
  platform?: 'web' | 'electron';
  capabilities?: PlatformCapabilities;
  skipMockSetup?: boolean;
}) {
  const {
    notes = mockNotes,
    platform = 'web',
    capabilities = {},
    skipMockSetup = false,
  } = options ?? {};

  // Only set up mock if not skipped (allows tests to set up their own mock behavior)
  if (!skipMockSetup) {
    mockTrpc.notes.list.query.mockResolvedValue(notes);
  }

  return render(
    <MemoryRouter>
      <ScribeProvider daemonUrl="http://localhost:3000">
        <PlatformProvider platform={platform} capabilities={capabilities}>
          <NoteListPage />
        </PlatformProvider>
      </ScribeProvider>
    </MemoryRouter>
  );
}

describe('NoteListPage', () => {
  beforeEach(() => {
    // Reset mock function calls but keep mock implementations
    mockNavigate.mockClear();
    mockTrpc.notes.list.query.mockClear();
    mockTrpc.notes.create.mutate.mockClear();
    mockTrpc.notes.delete.mutate.mockClear();

    // Set default mock implementations
    mockTrpc.notes.list.query.mockResolvedValue(mockNotes);
    mockTrpc.notes.create.mutate.mockResolvedValue({
      id: 'new-note-123',
      title: 'Untitled',
      type: 'note',
    });
    mockTrpc.notes.delete.mutate.mockResolvedValue({ success: true, id: 'note-1' });
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders without crashing', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
      });
    });

    it('displays loading state initially', () => {
      renderNoteListPage();
      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });

    it('displays notes list after loading', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-list')).toBeInTheDocument();
        expect(screen.getByTestId('note-item-note-1')).toBeInTheDocument();
        expect(screen.getByTestId('note-item-note-2')).toBeInTheDocument();
      });
    });

    it('displays note titles', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByText('First Note')).toBeInTheDocument();
        expect(screen.getByText('Second Note')).toBeInTheDocument();
      });
    });

    it('displays relative dates', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-date-note-1')).toHaveTextContent('Today');
        expect(screen.getByTestId('note-date-note-2')).toHaveTextContent('Yesterday');
      });
    });
  });

  describe('Empty state', () => {
    it('displays empty state when no notes', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
        expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
      });
    });
  });

  describe('Error state', () => {
    it('displays error state on fetch failure', async () => {
      mockTrpc.notes.list.query.mockRejectedValue(new Error('Network error'));
      renderNoteListPage({ skipMockSetup: true });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });

    it('has retry button in error state', async () => {
      mockTrpc.notes.list.query.mockRejectedValue(new Error('Network error'));
      renderNoteListPage({ skipMockSetup: true });

      await waitFor(() => {
        expect(screen.getByTestId('retry-button')).toBeInTheDocument();
      });
    });

    it('retries fetch on retry button click', async () => {
      mockTrpc.notes.list.query.mockRejectedValueOnce(new Error('Network error'));
      mockTrpc.notes.list.query.mockResolvedValueOnce(mockNotes);
      renderNoteListPage({ skipMockSetup: true });

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('retry-button'));

      await waitFor(() => {
        expect(screen.getByTestId('note-list')).toBeInTheDocument();
      });
    });
  });

  describe('Create note', () => {
    it('has create note button', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('create-note-button')).toBeInTheDocument();
      });
    });

    it('creates note and navigates on button click', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('create-note-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('create-note-button'));

      await waitFor(() => {
        expect(mockTrpc.notes.create.mutate).toHaveBeenCalledWith({
          title: 'Untitled',
          type: 'note',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/note/new-note-123');
      });
    });

    it('shows creating state while creating', async () => {
      let resolveCreate: (value: unknown) => void;
      mockTrpc.notes.create.mutate.mockReturnValue(
        new Promise((resolve) => {
          resolveCreate = resolve;
        })
      );

      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('create-note-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('create-note-button'));

      expect(screen.getByTestId('create-note-button')).toHaveTextContent('Creating...');
      expect(screen.getByTestId('create-note-button')).toBeDisabled();

      resolveCreate!({ id: 'new-note-123', title: 'Untitled', type: 'note' });

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalled();
      });
    });
  });

  describe('Open note', () => {
    it('navigates to note on click', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-button-note-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('note-button-note-1'));

      expect(mockNavigate).toHaveBeenCalledWith('/note/note-1');
    });
  });

  describe('Delete note', () => {
    it('has delete button for each note', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('delete-button-note-1')).toBeInTheDocument();
        expect(screen.getByTestId('delete-button-note-2')).toBeInTheDocument();
      });
    });

    it('shows confirmation dialog before delete', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('delete-button-note-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button-note-1'));

      expect(confirmSpy).toHaveBeenCalledWith('Delete this note?');
      expect(mockTrpc.notes.delete.mutate).not.toHaveBeenCalled();

      confirmSpy.mockRestore();
    });

    it('deletes note on confirmation', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('delete-button-note-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button-note-1'));

      await waitFor(() => {
        expect(mockTrpc.notes.delete.mutate).toHaveBeenCalledWith('note-1');
      });

      confirmSpy.mockRestore();
    });

    it('removes note from list after delete', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-item-note-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button-note-1'));

      await waitFor(() => {
        expect(screen.queryByTestId('note-item-note-1')).not.toBeInTheDocument();
      });

      confirmSpy.mockRestore();
    });
  });

  describe('Platform-specific features', () => {
    it('does not show new window button on web platform', async () => {
      renderNoteListPage({ platform: 'web' });

      await waitFor(() => {
        expect(screen.getByTestId('note-list-header')).toBeInTheDocument();
      });

      expect(screen.queryByTestId('new-window-button')).not.toBeInTheDocument();
    });

    it('shows new window button on electron platform with capability', async () => {
      const capabilities: PlatformCapabilities = {
        window: {
          openNewWindow: vi.fn(),
          openNoteInWindow: vi.fn(),
          close: vi.fn(),
        },
      };
      renderNoteListPage({ platform: 'electron', capabilities });

      await waitFor(() => {
        expect(screen.getByTestId('new-window-button')).toBeInTheDocument();
      });
    });

    it('calls openNewWindow on new window button click', async () => {
      const openNewWindowMock = vi.fn();
      const capabilities: PlatformCapabilities = {
        window: {
          openNewWindow: openNewWindowMock,
          openNoteInWindow: vi.fn(),
          close: vi.fn(),
        },
      };
      renderNoteListPage({ platform: 'electron', capabilities });

      await waitFor(() => {
        expect(screen.getByTestId('new-window-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('new-window-button'));

      expect(openNewWindowMock).toHaveBeenCalled();
    });

    it('shows open in window button only on electron', async () => {
      const capabilities: PlatformCapabilities = {
        window: {
          openNewWindow: vi.fn(),
          openNoteInWindow: vi.fn(),
          close: vi.fn(),
        },
      };
      renderNoteListPage({ platform: 'electron', capabilities });

      await waitFor(() => {
        expect(screen.getByTestId('open-in-window-button-note-1')).toBeInTheDocument();
      });
    });

    it('calls openNoteInWindow on button click', async () => {
      const openNoteInWindowMock = vi.fn();
      const capabilities: PlatformCapabilities = {
        window: {
          openNewWindow: vi.fn(),
          openNoteInWindow: openNoteInWindowMock,
          close: vi.fn(),
        },
      };
      renderNoteListPage({ platform: 'electron', capabilities });

      await waitFor(() => {
        expect(screen.getByTestId('open-in-window-button-note-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('open-in-window-button-note-1'));

      expect(openNoteInWindowMock).toHaveBeenCalledWith('note-1');
    });
  });

  describe('Custom render props', () => {
    it('uses custom loading render prop', () => {
      render(
        <MemoryRouter>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <NoteListPage
                renderLoading={() => <div data-testid="custom-loading">Loading custom...</div>}
              />
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      expect(screen.getByTestId('custom-loading')).toBeInTheDocument();
    });

    it('uses custom error render prop', async () => {
      mockTrpc.notes.list.query.mockRejectedValue(new Error('Test error'));

      render(
        <MemoryRouter>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <NoteListPage
                renderError={(error, retry) => (
                  <div data-testid="custom-error">
                    <span>{error}</span>
                    <button onClick={retry}>Custom retry</button>
                  </div>
                )}
              />
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('custom-error')).toBeInTheDocument();
        expect(screen.getByText('Test error')).toBeInTheDocument();
      });
    });

    it('uses custom empty render prop', async () => {
      mockTrpc.notes.list.query.mockResolvedValue([]);

      render(
        <MemoryRouter>
          <ScribeProvider daemonUrl="http://localhost:3000">
            <PlatformProvider platform="web" capabilities={{}}>
              <NoteListPage
                renderEmpty={(onCreate) => (
                  <div data-testid="custom-empty">
                    <button onClick={onCreate}>Custom create</button>
                  </div>
                )}
              />
            </PlatformProvider>
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('custom-empty')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has accessible button labels', async () => {
      renderNoteListPage();

      await waitFor(() => {
        const deleteButton = screen.getByTestId('delete-button-note-1');
        expect(deleteButton).toHaveAttribute('title', 'Delete note');
      });
    });
  });
});
