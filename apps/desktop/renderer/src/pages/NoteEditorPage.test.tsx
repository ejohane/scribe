/**
 * Tests for NoteEditorPage component.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { ReactNode } from 'react';
import type { ScribeAPI } from '@scribe/shared';
import type { NoteDocument } from '@scribe/server-core';

// Mock note data
const mockNote: NoteDocument = {
  id: 'note-1',
  title: 'Test Note',
  type: 'note',
  date: null,
  createdAt: '2025-01-01T10:00:00.000Z',
  updatedAt: '2025-01-15T10:00:00.000Z',
  content: {
    root: {
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: 'Hello world' }],
        },
      ],
      type: 'root',
      version: 1,
    },
  },
  wordCount: 2,
};

// Create mock tRPC client
const mockTrpc = {
  notes: {
    list: { query: vi.fn().mockResolvedValue([]) },
    get: { query: vi.fn().mockResolvedValue(mockNote) },
    create: { mutate: vi.fn() },
    update: { mutate: vi.fn() },
    delete: { mutate: vi.fn() },
  },
  export: {
    toMarkdown: { query: vi.fn().mockResolvedValue({ markdown: '# Test Note\n\nHello world' }) },
  },
};

// Create a single mock ScribeAPI instance
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

// Mock EditorRoot since it's complex and has many dependencies
vi.mock('../components/Editor/EditorRoot', () => ({
  EditorRoot: ({ noteState }: { noteState: { currentNote: { title: string } | null } }) => (
    <div data-testid="editor-root">
      {noteState.currentNote ? `Editor: ${noteState.currentNote.title}` : 'No note'}
    </div>
  ),
}));

// Mock EditorCommandContext
vi.mock('../components/Editor/EditorCommandContext', () => ({
  EditorCommandProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Mock WikiLinkProvider
vi.mock('../components/Editor/plugins/WikiLinkContext', () => ({
  WikiLinkProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Mock PersonMentionProvider
vi.mock('../components/Editor/plugins/PersonMentionContext', () => ({
  PersonMentionProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Import after mocks
import { NoteEditorPage } from './NoteEditorPage';

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
function TestWrapper({
  children,
  initialRoute = '/note/note-1',
}: {
  children: ReactNode;
  initialRoute?: string;
}) {
  return (
    <MemoryRouter initialEntries={[initialRoute]}>
      <Routes>
        <Route path="/note/:id" element={children} />
        <Route path="/" element={<div>Home</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('NoteEditorPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrpc.notes.get.query.mockResolvedValue(mockNote);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('shows loading state initially', async () => {
    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    // Should show loading state
    await waitFor(() => {
      expect(
        screen.getByText('Loading note...') || screen.getByText('Loading...')
      ).toBeInTheDocument();
    });
  });

  it('displays note after loading', async () => {
    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Note')).toBeInTheDocument();
      expect(screen.getByTestId('editor-root')).toBeInTheDocument();
    });
  });

  it('displays header with back button and title input', async () => {
    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
      expect(screen.getByDisplayValue('Test Note')).toBeInTheDocument();
    });
  });

  it('navigates back when Back button is clicked', async () => {
    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /back/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /back/i }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('updates title when input changes', async () => {
    mockTrpc.notes.update.mutate.mockResolvedValue({ ...mockNote, title: 'New Title' });

    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByDisplayValue('Test Note')).toBeInTheDocument();
    });

    const titleInput = screen.getByDisplayValue('Test Note');
    fireEvent.change(titleInput, { target: { value: 'New Title' } });

    await waitFor(() => {
      expect(mockTrpc.notes.update.mutate).toHaveBeenCalledWith({
        id: 'note-1',
        title: 'New Title',
      });
    });
  });

  it('exports note to markdown when Export button is clicked', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Export' }));

    // Verify the export query is called - clipboard write is handled by the component
    await waitFor(() => {
      expect(mockTrpc.export.toMarkdown.query).toHaveBeenCalledWith({ noteId: 'note-1' });
    });

    consoleSpy.mockRestore();
  });

  it('deletes note when Delete button is clicked and confirmed', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
    mockTrpc.notes.delete.mutate.mockResolvedValue({ success: true, id: 'note-1' });

    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(confirmSpy).toHaveBeenCalledWith('Delete this note?');
      expect(mockTrpc.notes.delete.mutate).toHaveBeenCalledWith('note-1');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });

    confirmSpy.mockRestore();
  });

  it('does not delete note when deletion is cancelled', async () => {
    const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    expect(confirmSpy).toHaveBeenCalledWith('Delete this note?');
    expect(mockTrpc.notes.delete.mutate).not.toHaveBeenCalled();

    confirmSpy.mockRestore();
  });

  it('shows error state when note is not found', async () => {
    mockTrpc.notes.get.query.mockResolvedValue(null);

    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      // Text is split between 'Error: ' and 'Note not found' so use regex
      expect(screen.getByText(/Note not found/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Back to Notes' })).toBeInTheDocument();
    });
  });

  it('shows error state when loading fails', async () => {
    mockTrpc.notes.get.query.mockRejectedValue(new Error('Network error'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Error: Network error/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Back to Notes' })).toBeInTheDocument();
    });

    consoleSpy.mockRestore();
  });

  it('navigates back from error state', async () => {
    mockTrpc.notes.get.query.mockResolvedValue(null);

    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByText(/Note not found/)).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: 'Back to Notes' }));

    expect(mockNavigate).toHaveBeenCalledWith('/');
  });

  it('renders editor with correct noteState', async () => {
    render(
      <TestWrapper>
        <NoteEditorPage />
      </TestWrapper>
    );

    await waitFor(() => {
      expect(screen.getByTestId('editor-root')).toBeInTheDocument();
      expect(screen.getByText('Editor: Test Note')).toBeInTheDocument();
    });
  });
});
