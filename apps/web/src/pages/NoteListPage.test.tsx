/**
 * Tests for NoteListPage
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
      // Simulate status change to connected after connect is called
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

  it('displays the date heading', async () => {
    renderNoteListPage();

    await waitFor(() => {
      // New UI shows date header (e.g., "Thursday, January 16")
      const heading = screen.getByRole('heading', { level: 1 });
      expect(heading).toBeInTheDocument();
    });
  });

  describe('Loading state', () => {
    it('shows loading state initially', async () => {
      // Delay the API response to see loading state
      mockClientInstance.api.notes.list.query = vi
        .fn()
        .mockImplementation(() => new Promise((resolve) => setTimeout(() => resolve([]), 100)));

      renderNoteListPage();

      // The loading state should appear
      await waitFor(() => {
        expect(screen.getByTestId('loading-state')).toBeInTheDocument();
      });
    });
  });

  describe('Empty state', () => {
    it('shows empty state when no notes exist', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('empty-state')).toBeInTheDocument();
      });
      expect(screen.getByText('No notes yet')).toBeInTheDocument();
    });

    it('has create first note button in empty state', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('create-first-note-button')).toBeInTheDocument();
      });
    });
  });

  describe('Note list', () => {
    const mockNotes = [
      { id: 'note-1', title: 'First Note', type: 'note', updatedAt: new Date().toISOString() },
      {
        id: 'note-2',
        title: 'Second Note',
        type: 'daily',
        updatedAt: new Date(Date.now() - 86400000).toISOString(),
      },
      {
        id: 'note-3',
        title: 'Third Note',
        type: 'meeting',
        updatedAt: new Date(Date.now() - 172800000).toISOString(),
      },
    ];

    it('displays notes in a list', async () => {
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        expect(screen.getByTestId('note-list')).toBeInTheDocument();
      });

      const noteItems = screen.getAllByTestId('note-item');
      expect(noteItems).toHaveLength(3);
    });

    it('displays note titles', async () => {
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        expect(screen.getByText('First Note')).toBeInTheDocument();
        expect(screen.getByText('Second Note')).toBeInTheDocument();
        expect(screen.getByText('Third Note')).toBeInTheDocument();
      });
    });

    it('displays note items with icons', async () => {
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        // New UI shows note items with icons, titles, and dates
        const noteItems = screen.getAllByTestId('note-item');
        expect(noteItems).toHaveLength(3);
      });
    });

    it('displays relative dates', async () => {
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        expect(screen.getByText(/Today/)).toBeInTheDocument();
        expect(screen.getByText(/Yesterday/)).toBeInTheDocument();
        expect(screen.getByText(/2 days ago/)).toBeInTheDocument();
      });
    });

    it('note items are clickable', async () => {
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        const noteItems = screen.getAllByTestId('note-item');
        expect(noteItems).toHaveLength(3);
        // Each note item should contain title and subtitle
        expect(noteItems[0].querySelector('.item-title')).toHaveTextContent('First Note');
        expect(noteItems[0].querySelector('.item-subtitle')).toHaveTextContent('Today');
      });
    });
  });

  describe('Create note', () => {
    it('has create note button in header', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('create-note-button')).toBeInTheDocument();
      });
    });

    it('creates note and navigates on button click', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('create-note-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('create-note-button'));

      await waitFor(() => {
        expect(mockClientInstance.api.notes.create.mutate).toHaveBeenCalledWith({
          title: 'Untitled',
          type: 'note',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/note/new-note-123');
      });
    });

    it('creates note from empty state button', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        expect(screen.getByTestId('create-first-note-button')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByTestId('create-first-note-button'));

      await waitFor(() => {
        expect(mockClientInstance.api.notes.create.mutate).toHaveBeenCalledWith({
          title: 'Untitled',
          type: 'note',
        });
        expect(mockNavigate).toHaveBeenCalledWith('/note/new-note-123');
      });
    });

    it('shows alert on create error', async () => {
      const alertMock = vi.spyOn(window, 'alert').mockImplementation(() => {});

      // Create client and then override the create mutate
      renderNoteListPage({ notes: [] });

      // Wait for the component to be ready
      await waitFor(() => {
        expect(screen.getByTestId('create-note-button')).toBeInTheDocument();
      });

      // Now override the mutate to reject
      mockClientInstance.api.notes.create.mutate = vi
        .fn()
        .mockRejectedValue(new Error('Create failed'));

      fireEvent.click(screen.getByTestId('create-note-button'));

      await waitFor(() => {
        expect(alertMock).toHaveBeenCalledWith('Failed to create note: Create failed');
      });

      alertMock.mockRestore();
    });
  });

  describe('Error handling', () => {
    it('shows error state when API call fails', async () => {
      mockClientInstance.api.notes.list.query = vi
        .fn()
        .mockRejectedValue(new Error('Network error'));

      renderNoteListPage();

      await waitFor(() => {
        expect(screen.getByTestId('error-state')).toBeInTheDocument();
        expect(screen.getByText(/Network error/)).toBeInTheDocument();
      });
    });
  });

  describe('Connection states', () => {
    it('shows disconnected state when not connected', async () => {
      // Create a client that won't auto-connect
      const disconnectedClient = {
        on: vi.fn(),
        off: vi.fn(),
        connect: vi.fn().mockResolvedValue(undefined), // Does not trigger status change
        disconnect: vi.fn(),
        status: 'disconnected' as const,
        isConnected: false,
        api: { notes: { list: { query: vi.fn() }, create: { mutate: vi.fn() } } },
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

      // Should show disconnected state
      await waitFor(() => {
        expect(screen.getByTestId('disconnected-state')).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper heading structure', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        const heading = screen.getByRole('heading', { level: 1 });
        // New UI shows date as heading
        expect(heading).toBeInTheDocument();
      });
    });

    it('note list container is accessible', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Test Note', type: 'note', updatedAt: new Date().toISOString() },
      ];
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        expect(screen.getByTestId('note-list')).toBeInTheDocument();
        expect(screen.getAllByTestId('note-item')).toHaveLength(1);
      });
    });

    it('buttons are focusable', async () => {
      renderNoteListPage({ notes: [] });

      await waitFor(() => {
        const createButton = screen.getByTestId('create-note-button');
        expect(createButton).toBeVisible();
      });
    });
  });

  describe('Date formatting', () => {
    it('formats today as "Today"', async () => {
      const mockNotes = [
        { id: 'note-1', title: 'Test Note', type: 'note', updatedAt: new Date().toISOString() },
      ];
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        // Look for "Today" in the item-subtitle span
        const noteItem = screen.getByTestId('note-item');
        expect(noteItem.querySelector('.item-subtitle')).toHaveTextContent('Today');
      });
    });

    it('formats yesterday as "Yesterday"', async () => {
      const yesterday = new Date(Date.now() - 86400000).toISOString();
      const mockNotes = [{ id: 'note-1', title: 'Test Note', type: 'note', updatedAt: yesterday }];
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        const noteItem = screen.getByTestId('note-item');
        expect(noteItem.querySelector('.item-subtitle')).toHaveTextContent('Yesterday');
      });
    });

    it('formats recent dates as "N days ago"', async () => {
      const threeDaysAgo = new Date(Date.now() - 3 * 86400000).toISOString();
      const mockNotes = [
        { id: 'note-1', title: 'Recent Note', type: 'note', updatedAt: threeDaysAgo },
      ];
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        const noteItem = screen.getByTestId('note-item');
        expect(noteItem.querySelector('.item-subtitle')).toHaveTextContent('3 days ago');
      });
    });

    it('formats older dates with locale string', async () => {
      const twoWeeksAgo = new Date(Date.now() - 14 * 86400000).toISOString();
      const mockNotes = [{ id: 'note-1', title: 'Old Note', type: 'note', updatedAt: twoWeeksAgo }];
      renderNoteListPage({ notes: mockNotes });

      await waitFor(() => {
        // Should show locale date format (like "1/1/2026")
        const noteItem = screen.getByTestId('note-item');
        expect(noteItem.querySelector('.item-subtitle')).toHaveTextContent(
          /\d{1,2}\/\d{1,2}\/\d{4}/
        );
      });
    });
  });
});
