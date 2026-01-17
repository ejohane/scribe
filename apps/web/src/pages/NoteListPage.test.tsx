/**
 * Tests for NoteListPage - Minimal UI
 */

import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

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

// Create mock client factory with working API
function createMockClient(
  notes: Array<{
    id: string;
    title: string;
    type: string;
    updatedAt: string;
  }> = []
) {
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
          query: vi.fn().mockResolvedValue(notes),
        },
        create: {
          mutate: vi
            .fn()
            .mockResolvedValue({ id: 'new-note-123', title: 'Untitled', type: 'note' }),
        },
        delete: {
          mutate: vi.fn().mockResolvedValue(undefined),
        },
      },
    },
    collab: {},
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
import { NoteListPage } from './NoteListPage';

// Helper to render with providers
function renderNoteListPage(options?: {
  notes?: Array<{ id: string; title: string; type: string; updatedAt: string }>;
}) {
  if (options?.notes) {
    mockClientInstance = createMockClient(options.notes);
    (ScribeClient as Mock).mockImplementation(() => mockClientInstance);
  }

  return render(
    <MemoryRouter>
      <ScribeProvider>
        <NoteListPage />
      </ScribeProvider>
    </MemoryRouter>
  );
}

describe('NoteListPage', () => {
  beforeEach(() => {
    mockClientInstance = createMockClient();
    vi.clearAllMocks();
    (ScribeClient as Mock).mockImplementation(() => mockClientInstance);
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('renders without crashing', async () => {
    renderNoteListPage();

    await waitFor(() => {
      expect(screen.getByTestId('note-list-page')).toBeInTheDocument();
    });
  });

  it('displays the textarea for creating notes', async () => {
    renderNoteListPage();

    await waitFor(() => {
      expect(screen.getByTestId('create-note-input')).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows connecting state initially', async () => {
      // Create a client that triggers connecting status
      const connectingClient = {
        on: vi.fn(),
        off: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined),
        disconnect: vi.fn(),
        status: 'disconnected' as const,
        isConnected: false,
        api: {
          notes: {
            list: { query: vi.fn() },
            create: { mutate: vi.fn() },
            delete: { mutate: vi.fn() },
          },
        },
        collab: {},
      };

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
        <MemoryRouter>
          <ScribeProvider>
            <NoteListPage />
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('connecting-state')).toBeInTheDocument();
      });
    });
  });

  describe('Create note', () => {
    it('has create note textarea', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('create-note-input')).toBeInTheDocument();
      });
    });

    it('creates note and navigates when typing and pressing Cmd+Enter', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('create-note-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('create-note-input');
      fireEvent.change(input, { target: { value: 'My New Note' } });
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

      await waitFor(() => {
        expect(mockClientInstance.api.notes.create.mutate).toHaveBeenCalledWith({
          title: 'My New Note',
          type: 'note',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/note/new-note-123');
      });
    });

    it('creates note with Ctrl+Enter', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('create-note-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('create-note-input');
      fireEvent.change(input, { target: { value: 'My New Note' } });
      fireEvent.keyDown(input, { key: 'Enter', ctrlKey: true });

      await waitFor(() => {
        expect(mockClientInstance.api.notes.create.mutate).toHaveBeenCalled();
      });
    });

    it('does not create note with just Enter (allows multi-line)', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('create-note-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('create-note-input');
      fireEvent.change(input, { target: { value: 'My New Note' } });
      fireEvent.keyDown(input, { key: 'Enter' });

      await waitFor(() => {
        expect(mockClientInstance.api.notes.create.mutate).not.toHaveBeenCalled();
      });
    });

    it('does not create empty notes', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('create-note-input')).toBeInTheDocument();
      });

      const input = screen.getByTestId('create-note-input');
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

      await waitFor(() => {
        expect(mockClientInstance.api.notes.create.mutate).not.toHaveBeenCalled();
      });
    });

    it('uses first line as title (truncated to 50 chars)', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('create-note-input')).toBeInTheDocument();
      });

      const longTitle = 'A'.repeat(60);
      const input = screen.getByTestId('create-note-input');
      fireEvent.change(input, { target: { value: `${longTitle}\nMore content` } });
      fireEvent.keyDown(input, { key: 'Enter', metaKey: true });

      await waitFor(() => {
        expect(mockClientInstance.api.notes.create.mutate).toHaveBeenCalledWith({
          title: 'A'.repeat(50),
          type: 'note',
        });
      });
    });
  });

  describe('Hamburger menu', () => {
    it('has menu button', async () => {
      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
      });
    });

    it('opens sheet when menu button is clicked', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Test Note', type: 'note', updatedAt: new Date().toISOString() },
      ];
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /menu/i }));

      await waitFor(() => {
        expect(screen.getByText('Notes')).toBeInTheDocument();
        expect(screen.getByText('New Note')).toBeInTheDocument();
      });
    });

    it('displays notes in sidebar', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'First Note', type: 'note', updatedAt: new Date().toISOString() },
        { id: 'note-2', title: 'Second Note', type: 'note', updatedAt: new Date().toISOString() },
      ];
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /menu/i })).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: /menu/i }));

      await waitFor(() => {
        expect(screen.getByText('First Note')).toBeInTheDocument();
        expect(screen.getByText('Second Note')).toBeInTheDocument();
      });
    });
  });

  describe('Connection states', () => {
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
            list: { query: vi.fn() },
            create: { mutate: vi.fn() },
            delete: { mutate: vi.fn() },
          },
        },
        collab: {},
      };
      (ScribeClient as Mock).mockImplementation(() => disconnectedClient);

      render(
        <MemoryRouter>
          <ScribeProvider>
            <NoteListPage />
          </ScribeProvider>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('disconnected-state')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('textarea is focusable and has placeholder', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        const textarea = screen.getByTestId('create-note-input');
        expect(textarea).toBeVisible();
        expect(textarea).toHaveAttribute('placeholder', 'Start typing...');
      });
    });

    it('menu button is accessible', async () => {
      renderNoteListPage();

      await waitFor(() => {
        const menuButton = screen.getByRole('button', { name: /menu/i });
        expect(menuButton).toBeInTheDocument();
        expect(menuButton).toHaveAttribute('aria-label', 'Menu');
      });
    });
  });

  describe('Responsive design', () => {
    it('main content area has max-width of 812px', async () => {
      renderNoteListPage();

      await waitFor(() => {
        const textarea = screen.getByTestId('create-note-input');
        const container = textarea.parentElement;
        expect(container).toHaveClass('max-w-[812px]');
      });
    });
  });
});
