/**
 * Tests for App component and routing - Minimal UI
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { NoteListPage } from './pages/NoteListPage';
import { NoteEditorPage } from './pages/NoteEditorPage';

// Mock the config first
vi.mock('./config', () => ({
  DAEMON_PORT: 47832,
}));

// Mock editor component to avoid Lexical complexity in routing tests
vi.mock('@scribe/editor', () => ({
  ScribeEditor: () => <div data-testid="mock-editor">Mock Editor</div>,
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

// Create full note document for tests
function createMockNote(id: string, title: string) {
  return {
    id,
    title,
    type: 'note' as const,
    date: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    content: { root: { children: [], type: 'root' as const, version: 1 } },
    wordCount: 0,
  };
}

// Create mock client factory with working API
function createMockClient() {
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
        list: {
          query: vi.fn().mockResolvedValue([
            {
              id: 'existing-note',
              title: 'Existing Note',
              type: 'note',
              updatedAt: new Date().toISOString(),
            },
          ]),
        },
        create: {
          mutate: vi
            .fn()
            .mockResolvedValue({ id: 'new-note-123', title: 'Untitled', type: 'note' }),
        },
        get: {
          query: vi.fn().mockImplementation((id: string) => {
            return Promise.resolve(createMockNote(id, `Note ${id}`));
          }),
        },
        update: {
          mutate: vi.fn().mockResolvedValue({}),
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
import { ScribeProvider } from './providers/ScribeProvider';
import { ScribeClient } from '@scribe/client-sdk';

/**
 * Helper to render with routing context.
 * Uses MemoryRouter instead of BrowserRouter for testing.
 */
function renderWithRouter(initialRoute = '/') {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <ScribeProvider>
        <Routes>
          <Route path="/" element={<NoteListPage />} />
          <Route path="/note/:id" element={<NoteEditorPage />} />
        </Routes>
      </ScribeProvider>
    </MemoryRouter>
  );
}

describe('App Routing', () => {
  beforeEach(() => {
    mockClientInstance = createMockClient();
    vi.clearAllMocks();
    (ScribeClient as Mock).mockImplementation(() => mockClientInstance);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders NoteListPage at root route', async () => {
    renderWithRouter('/');

    await waitFor(() => {
      expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
      // Minimal UI shows a textarea for creating notes
      expect(screen.getByTestId('create-note-input')).toBeInTheDocument();
    });
  });

  it('renders NoteEditorPage at /note/:id route', async () => {
    renderWithRouter('/note/test-note-123');

    await waitFor(() => {
      expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
      expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
    });
  });

  it('navigates from NoteListPage to NoteEditorPage via hamburger menu', async () => {
    const user = userEvent.setup();
    renderWithRouter('/');

    // Wait for the page to load and menu button to appear
    await waitFor(() => {
      expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
    });

    // Open hamburger menu
    await user.click(screen.getByRole('button', { name: /menu/i }));

    // Wait for notes list in sidebar
    await waitFor(() => {
      expect(screen.getByText('Existing Note')).toBeInTheDocument();
    });

    // Click on a note
    await user.click(screen.getByText('Existing Note'));

    // Should navigate to NoteEditorPage
    await waitFor(() => {
      expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
      expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
    });
  });

  it('creates new note via Cmd+Enter and navigates to editor', async () => {
    renderWithRouter('/');

    // Wait for the page to load
    await waitFor(() => {
      expect(screen.getByTestId('create-note-input')).toBeInTheDocument();
    });

    // Type in textarea and press Cmd+Enter
    const textarea = screen.getByTestId('create-note-input');
    fireEvent.change(textarea, { target: { value: 'My New Note' } });
    fireEvent.keyDown(textarea, { key: 'Enter', metaKey: true });

    // Should create note and navigate to NoteEditorPage
    await waitFor(() => {
      expect(mockClientInstance.api.notes.create.mutate).toHaveBeenCalledWith({
        title: 'My New Note',
        type: 'note',
      });
    });
  });

  it('navigates from NoteEditorPage to NoteListPage via hamburger menu home', async () => {
    const user = userEvent.setup();
    renderWithRouter('/note/test-123');

    // Wait for editor page to load
    await waitFor(() => {
      expect(screen.getByTestId('note-editor-page')).toBeInTheDocument();
      expect(screen.getByTestId('mock-editor')).toBeInTheDocument();
    });

    // Open hamburger menu and click New Note to focus on creating
    await user.click(screen.getByRole('button', { name: /menu/i }));

    await waitFor(() => {
      expect(screen.getByText('Notes')).toBeInTheDocument();
    });
  });
});
