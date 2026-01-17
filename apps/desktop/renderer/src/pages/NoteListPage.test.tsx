/**
 * Tests for NoteListPage component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { ScribeAPI } from '@scribe/shared';
import type { NoteMetadata } from '@scribe/server-core';

// Mock notes data
const mockNotes: NoteMetadata[] = [
  {
    id: 'note-1',
    title: 'First Note',
    type: 'note',
    date: null,
    createdAt: '2025-01-01T10:00:00.000Z',
    updatedAt: '2025-01-15T10:00:00.000Z',
    wordCount: 100,
    filePath: '/notes/note-1.json',
  },
  {
    id: 'note-2',
    title: 'Second Note',
    type: 'note',
    date: null,
    createdAt: '2025-01-02T10:00:00.000Z',
    updatedAt: '2025-01-14T10:00:00.000Z',
    wordCount: 50,
    filePath: '/notes/note-2.json',
  },
];

// Create mock tRPC client
const mockTrpc = {
  notes: {
    list: { query: vi.fn().mockResolvedValue(mockNotes) },
    get: { query: vi.fn() },
    create: { mutate: vi.fn() },
    update: { mutate: vi.fn() },
    delete: { mutate: vi.fn() },
  },
  export: {
    toMarkdown: { query: vi.fn() },
  },
};

// Create a single mock ScribeAPI instance that we can track
const mockElectron = {
  ping: vi.fn().mockResolvedValue({ message: 'pong', timestamp: Date.now() }),
  shell: {
    openExternal: vi.fn().mockResolvedValue({ success: true }),
    showItemInFolder: vi.fn().mockResolvedValue({ success: true }),
  },
  app: {
    openDevTools: vi.fn().mockResolvedValue({ success: true }),
    getLastOpenedNote: vi.fn().mockResolvedValue(null),
    setLastOpenedNote: vi.fn().mockResolvedValue({ success: true }),
    getConfig: vi.fn().mockResolvedValue({}),
    setConfig: vi.fn().mockResolvedValue({ success: true }),
    relaunch: vi.fn().mockResolvedValue(undefined),
  },
  update: {
    check: vi.fn().mockResolvedValue(undefined),
    install: vi.fn(),
    onChecking: vi.fn().mockReturnValue(vi.fn()),
    onAvailable: vi.fn().mockReturnValue(vi.fn()),
    onNotAvailable: vi.fn().mockReturnValue(vi.fn()),
    onDownloaded: vi.fn().mockReturnValue(vi.fn()),
    onError: vi.fn().mockReturnValue(vi.fn()),
  },
  dialog: {
    selectFolder: vi.fn().mockResolvedValue(null),
  },
  vault: {
    getPath: vi.fn().mockResolvedValue('/test/vault'),
    setPath: vi.fn().mockResolvedValue({ success: true, path: '/test/vault' }),
    create: vi.fn().mockResolvedValue({ success: true, path: '/test/vault' }),
    validate: vi.fn().mockResolvedValue({ valid: true }),
  },
  deepLink: {
    onDeepLink: vi.fn().mockReturnValue(vi.fn()),
  },
  assets: {
    save: vi.fn().mockResolvedValue({ success: true, assetId: 'test-id', ext: 'png' }),
    load: vi.fn().mockResolvedValue(null),
    delete: vi.fn().mockResolvedValue(true),
    getPath: vi.fn().mockResolvedValue(null),
  },
  window: {
    new: vi.fn().mockResolvedValue(undefined),
    openNote: vi.fn().mockResolvedValue(undefined),
    getId: vi.fn().mockResolvedValue(1),
    close: vi.fn().mockResolvedValue(undefined),
    focus: vi.fn().mockResolvedValue(undefined),
    reportCurrentNote: vi.fn().mockResolvedValue({ success: true }),
  },
  scribe: {
    getDaemonPort: vi.fn().mockResolvedValue(47832),
  },
} as unknown as ScribeAPI;

// Mock the ElectronProvider to provide context immediately
vi.mock('../providers/ElectronProvider', () => {
  return {
    useElectron: () => ({
      electron: mockElectron,
      trpc: mockTrpc,
      isReady: true,
      daemonPort: 47832,
      error: null,
    }),
  };
});

// Import after mocks
import { NoteListPage } from './NoteListPage';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Test wrapper that provides routing context
function TestWrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('NoteListPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrpc.notes.list.query.mockResolvedValue(mockNotes);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows loading state initially', async () => {
    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    // Should show provider loading first, then page loading
    await waitFor(() => {
      expect(
        screen.getByText('Loading notes...') || screen.getByText('Loading...')
      ).toBeInTheDocument();
    });
  });

  it('displays list of notes after loading', async () => {
    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('First Note')).toBeInTheDocument();
      expect(screen.getByText('Second Note')).toBeInTheDocument();
    });
  });

  it('displays page header with title and new button', async () => {
    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Notes' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'New Note' })).toBeInTheDocument();
    });
  });

  it('creates new note when New Note button is clicked', async () => {
    const newNote = {
      id: 'note-3',
      title: 'Untitled',
      type: 'note' as const,
      date: null,
      createdAt: '2025-01-17T10:00:00.000Z',
      updatedAt: '2025-01-17T10:00:00.000Z',
      content: { root: { children: [], type: 'root' as const, version: 1 } },
      wordCount: 0,
    };

    mockTrpc.notes.create.mutate.mockResolvedValue(newNote);

    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'New Note' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'New Note' }));

    await waitFor(() => {
      expect(mockTrpc.notes.create.mutate).toHaveBeenCalledWith({
        title: 'Untitled',
        type: 'note',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/note/note-3');
    });
  });

  it('navigates to note when note is clicked', async () => {
    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('First Note')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('First Note'));

    expect(mockNavigate).toHaveBeenCalledWith('/note/note-1');
  });

  it('opens note in new window when open in new window button is clicked', async () => {
    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('First Note')).toBeInTheDocument();
    });

    // Find the open in new window button for the first note
    const noteItem = screen.getByText('First Note').closest('li');
    const openInNewWindowButton = within(noteItem!).getByTitle('Open in new window');
    fireEvent.click(openInNewWindowButton);

    await waitFor(() => {
      expect(mockElectron.window.openNote).toHaveBeenCalledWith('note-1');
    });
  });

  it('deletes note when delete button is clicked and confirmed', async () => {
    // Mock window.confirm
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);

    mockTrpc.notes.delete.mutate.mockResolvedValue({ success: true, id: 'note-1' });

    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('First Note')).toBeInTheDocument();
    });

    // Find the delete button for the first note
    const noteItem = screen.getByText('First Note').closest('li');
    const deleteButton = within(noteItem!).getByTitle('Delete note');
    fireEvent.click(deleteButton);

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Delete this note?');
      expect(mockTrpc.notes.delete.mutate).toHaveBeenCalledWith('note-1');
    });

    // Note should be removed from the list
    await waitFor(() => {
      expect(screen.queryByText('First Note')).not.toBeInTheDocument();
    });

    confirmSpy.mockRestore();
  });

  it('does not delete note when deletion is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('First Note')).toBeInTheDocument();
    });

    const noteItem = screen.getByText('First Note').closest('li');
    const deleteButton = within(noteItem!).getByTitle('Delete note');
    fireEvent.click(deleteButton);

    expect(confirmSpy).toHaveBeenCalledWith('Delete this note?');
    expect(mockTrpc.notes.delete.mutate).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('shows empty state when no notes exist', async () => {
    mockTrpc.notes.list.query.mockResolvedValue([]);

    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText('No notes yet. Create your first note!')).toBeInTheDocument();
    });
  });

  it('shows error state when loading fails', async () => {
    mockTrpc.notes.list.query.mockRejectedValue(new Error('Network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Try Again' })).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('retries loading when Try Again button is clicked', async () => {
    mockTrpc.notes.list.query
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockNotes);

    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TestWrapper>
        <NoteListPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Try Again' }));

    await waitFor(() => {
      expect(screen.getByText('First Note')).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });
});
