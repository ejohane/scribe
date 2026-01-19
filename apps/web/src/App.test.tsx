/**
 * Tests for App component and routing with app-shell
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

// Mock the config
vi.mock('./config', () => ({
  DAEMON_PORT: 47832,
  DAEMON_HOST: '127.0.0.1',
}));

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

// Create mockTrpc as a stable reference
const mockTrpc = {
  notes: {
    list: {
      query: vi.fn(),
    },
    create: {
      mutate: vi.fn(),
    },
    get: {
      query: vi.fn(),
    },
    update: {
      mutate: vi.fn(),
    },
    delete: {
      mutate: vi.fn(),
    },
    markAccessed: {
      mutate: vi.fn(),
    },
  },
  export: {
    toMarkdown: {
      query: vi.fn(),
    },
  },
};

// Mock @trpc/client
vi.mock('@trpc/client', () => ({
  createTRPCProxyClient: () => mockTrpc,
  httpBatchLink: () => ({}),
}));

// Import pages from app-shell (they're the same ones used in App)
import { ScribeProvider, PlatformProvider, NoteListPage, NoteEditorPage } from '@scribe/web-core';

// Sample note data
const mockNotes = [
  {
    id: 'note-1',
    title: 'Test Note',
    type: 'note',
    date: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    wordCount: 100,
    filePath: '/notes/note-1.json',
  },
];

const mockNote = {
  id: 'note-1',
  title: 'Test Note',
  type: 'note',
  date: null,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  content: { root: { children: [], type: 'root', version: 1 } },
  wordCount: 100,
  filePath: '/notes/note-1.json',
};

/**
 * Helper to render with routing context.
 * Uses MemoryRouter instead of BrowserRouter for testing.
 */
function renderApp(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <PlatformProvider platform="web" capabilities={{}}>
        <ScribeProvider daemonUrl="http://127.0.0.1:47832">
          <Routes>
            <Route path="/" element={<NoteListPage />} />
            <Route path="/note/:id" element={<NoteEditorPage />} />
          </Routes>
        </ScribeProvider>
      </PlatformProvider>
    </MemoryRouter>
  );
}

describe('App Routing with app-shell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrpc.notes.list.query.mockResolvedValue(mockNotes);
    mockTrpc.notes.get.query.mockResolvedValue(mockNote);
    mockTrpc.notes.create.mutate.mockResolvedValue({
      id: 'new-note',
      title: 'Untitled',
      type: 'note',
    });
    mockTrpc.notes.delete.mutate.mockResolvedValue({ success: true });
    mockTrpc.notes.markAccessed.mutate.mockResolvedValue({ success: true });
    mockTrpc.export.toMarkdown.query.mockResolvedValue({ markdown: '# Test' });
    mockInvalidateQueries.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders NoteListPage at root route', async () => {
    renderApp('/');

    await waitFor(() => {
      expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
    });
  });

  it('displays notes from tRPC', async () => {
    renderApp('/');

    await waitFor(() => {
      expect(screen.getByText('Test Note')).toBeInTheDocument();
    });
  });

  it('renders NoteEditorPage at /note/:id route', async () => {
    renderApp('/note/note-1');

    await waitFor(() => {
      expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
    });
  });

  it('has create note button', async () => {
    renderApp('/');

    await waitFor(() => {
      expect(screen.getByTestId('create-note-button')).toBeInTheDocument();
    });
  });

  it('creates note on button click', async () => {
    renderApp('/');

    await waitFor(() => {
      expect(screen.getByTestId('create-note-button')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByTestId('create-note-button'));

    await waitFor(() => {
      expect(mockTrpc.notes.create.mutate).toHaveBeenCalledWith({
        title: 'Untitled',
        type: 'note',
      });
    });
  });
});
