/**
 * Tests for NoteListPage component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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
  onNoteSelect?: (id: string) => void;
  selectedNoteId?: string;
  skipMockSetup?: boolean;
}) {
  const { notes = mockNotes, onNoteSelect, selectedNoteId, skipMockSetup = false } = options ?? {};

  // Only set up mock if not skipped (allows tests to set up their own mock behavior)
  if (!skipMockSetup) {
    mockTrpc.notes.list.query.mockResolvedValue(notes);
  }

  return render(
    <MemoryRouter>
      <ScribeProvider daemonUrl="http://localhost:3000">
        <PlatformProvider platform="web" capabilities={{}}>
          <NoteListPage onNoteSelect={onNoteSelect} selectedNoteId={selectedNoteId} />
        </PlatformProvider>
      </ScribeProvider>
    </MemoryRouter>
  );
}

describe('NoteListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrpc.notes.create.mutate.mockResolvedValue({
      id: 'new-note-123',
      title: 'Untitled',
      type: 'note',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Basic rendering', () => {
    it('renders without crashing', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
      });
    });

    it('displays loading state initially', () => {
      mockTrpc.notes.list.query.mockImplementation(() => new Promise(() => {}));
      renderNoteListPage({ skipMockSetup: true });

      expect(screen.getByTestId('loading-state')).toBeInTheDocument();
    });

    it('displays notes list after loading', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-list')).toBeInTheDocument();
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
        expect(screen.getByText('Today')).toBeInTheDocument();
        expect(screen.getByText('Yesterday')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    it('displays empty state when no notes', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
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

    it('creates note and calls onNoteSelect', async () => {
      const onNoteSelect = vi.fn();
      renderNoteListPage({ onNoteSelect });

      await waitFor(() => {
        expect(screen.getByTestId('create-note-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('create-note-button'));

      await waitFor(() => {
        expect(mockTrpc.notes.create.mutate).toHaveBeenCalledWith({
          title: 'Untitled',
          type: 'note',
        });
        expect(onNoteSelect).toHaveBeenCalledWith('new-note-123');
      });
    });

    it('navigates to new note when onNoteSelect not provided', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('create-note-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('create-note-button'));

      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith('/note/new-note-123');
      });
    });
  });

  describe('Open note', () => {
    it('calls onNoteSelect on click', async () => {
      const onNoteSelect = vi.fn();
      renderNoteListPage({ onNoteSelect });

      await waitFor(() => {
        expect(screen.getByTestId('note-button-note-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('note-button-note-1'));

      expect(onNoteSelect).toHaveBeenCalledWith('note-1');
    });

    it('navigates to note when onNoteSelect not provided', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-button-note-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('note-button-note-1'));

      expect(mockNavigate).toHaveBeenCalledWith('/note/note-1');
    });

    it('highlights selected note', async () => {
      renderNoteListPage({ selectedNoteId: 'note-1' });

      await waitFor(() => {
        const button = screen.getByTestId('note-button-note-1');
        expect(button.className).toContain('bg-accent');
      });
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
      mockTrpc.notes.delete.mutate.mockResolvedValue(undefined);
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('note-item-note-1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('delete-button-note-1'));

      await waitFor(() => {
        expect(mockTrpc.notes.delete.mutate).toHaveBeenCalledWith('note-1');
      });

      confirmSpy.mockRestore();
    });

    it('removes note from list after delete', async () => {
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      mockTrpc.notes.delete.mutate.mockResolvedValue(undefined);
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
});
