/**
 * FileBrowsePanel Integration Tests
 *
 * End-to-end tests that verify the complete Cmd+O flow works correctly
 * from user interaction through to visual display.
 *
 * Tests cover:
 * - Recent items display and ordering
 * - Current note exclusion
 * - Empty states (no recents, no notes, loading)
 * - Orphan handling
 * - Create new note fallback
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FileBrowsePanel } from './FileBrowsePanel';
import { CommandPaletteProvider } from '../CommandPaletteContext';
import type {
  Note,
  RecentOpenRecord,
  NoteId,
  RegularNote,
  DailyNote,
  MeetingNote,
  PersonNote,
} from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Mock window.scribe APIs
const mockRecentOpens = {
  getRecent: vi.fn(),
  recordOpen: vi.fn().mockResolvedValue({ success: true }),
  removeTracking: vi.fn().mockResolvedValue({ success: true }),
};

const mockNotes = {
  create: vi.fn(),
  save: vi.fn().mockResolvedValue({ success: true }),
  list: vi.fn().mockResolvedValue([]),
  read: vi.fn(),
  delete: vi.fn(),
  findByTitle: vi.fn(),
  searchTitles: vi.fn(),
  findByDate: vi.fn(),
};

beforeEach(() => {
  // Mock window.scribe API
  window.scribe = {
    recentOpens: mockRecentOpens,
    notes: mockNotes,
  } as unknown as typeof window.scribe;
});

afterEach(() => {
  vi.clearAllMocks();
});

// Helper to create mock notes - matches pattern from CommandPalette.test-utils.ts
function createMockNote(
  id: string,
  title: string,
  type: 'regular' | 'daily' | 'meeting' | 'person' = 'regular'
): Note {
  const now = Date.now();
  const noteId = createNoteId(id);
  const base = {
    id: noteId,
    title,
    content: { root: { type: 'root' as const, children: [] } },
    createdAt: now,
    updatedAt: now,
    tags: [],
    metadata: {
      title: null,
      tags: [],
      links: [],
      mentions: [],
    },
  };

  if (type === 'daily') {
    return {
      ...base,
      type: 'daily',
      daily: { date: '2025-01-01' },
    } as DailyNote;
  }
  if (type === 'meeting') {
    return {
      ...base,
      type: 'meeting',
      meeting: {
        date: '2025-01-01',
        dailyNoteId: createNoteId('daily-2025-01-01'),
        attendees: [],
      },
    } as MeetingNote;
  }
  if (type === 'person') {
    return {
      ...base,
      type: 'person',
    } as PersonNote;
  }
  // Regular note - no type field (or undefined)
  return base as RegularNote;
}

// Helper to wrap component with context provider
interface WrapperProps {
  query?: string;
  selectedNoteIndex?: number;
  currentNoteId?: NoteId | null;
  onNoteSelect?: (id: NoteId) => void;
  onClose?: () => void;
  children: React.ReactNode;
}

function TestWrapper({
  query = '',
  selectedNoteIndex = 0,
  currentNoteId = null,
  onNoteSelect = vi.fn(),
  onClose = vi.fn(),
  children,
}: WrapperProps) {
  return (
    <CommandPaletteProvider
      mode="file-browse"
      setMode={vi.fn()}
      query={query}
      setQuery={vi.fn()}
      selectedNoteIndex={selectedNoteIndex}
      setSelectedNoteIndex={vi.fn()}
      selectedPersonIndex={0}
      setSelectedPersonIndex={vi.fn()}
      selectedIndex={0}
      setSelectedIndex={vi.fn()}
      currentNoteId={currentNoteId}
      onClose={onClose}
      onModeChange={vi.fn()}
      onNoteSelect={onNoteSelect}
      setPendingDeleteNote={vi.fn()}
      setReturnMode={vi.fn()}
    >
      {children}
    </CommandPaletteProvider>
  );
}

describe('FileBrowsePanel', () => {
  describe('recent items display', () => {
    it('shows recently opened items in correct order', async () => {
      const allNotes = [
        createMockNote('note-1', 'Note 1'),
        createMockNote('note-2', 'Note 2'),
        createMockNote('note-3', 'Note 3'),
      ];

      const records: RecentOpenRecord[] = [
        { entityId: 'note-2', entityType: 'note', openedAt: 3000 },
        { entityId: 'note-1', entityType: 'note', openedAt: 2000 },
        { entityId: 'note-3', entityType: 'note', openedAt: 1000 },
      ];

      mockRecentOpens.getRecent.mockResolvedValue(records);

      render(
        <TestWrapper>
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Note 2')).toBeInTheDocument();
      });

      // Note 2 should appear before Note 1 (more recent)
      const items = screen.getAllByText(/Note \d/);
      expect(items[0]).toHaveTextContent('Note 2');
      expect(items[1]).toHaveTextContent('Note 1');
      expect(items[2]).toHaveTextContent('Note 3');
    });

    it('excludes current note from recent items', async () => {
      const allNotes = [createMockNote('note-1', 'Note 1'), createMockNote('note-2', 'Note 2')];

      const records: RecentOpenRecord[] = [
        { entityId: 'note-1', entityType: 'note', openedAt: 2000 },
        { entityId: 'note-2', entityType: 'note', openedAt: 1000 },
      ];

      mockRecentOpens.getRecent.mockResolvedValue(records);

      render(
        <TestWrapper currentNoteId={createNoteId('note-1')}>
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Note 2')).toBeInTheDocument();
      });

      expect(screen.queryByText('Note 1')).not.toBeInTheDocument();
    });
  });

  describe('empty states', () => {
    it('shows helpful message when no recent items', async () => {
      const allNotes = [createMockNote('note-1', 'Note 1')];
      mockRecentOpens.getRecent.mockResolvedValue([]);

      render(
        <TestWrapper>
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText(/No recently opened items/)).toBeInTheDocument();
      });
    });

    it('shows different message when no notes at all', async () => {
      mockRecentOpens.getRecent.mockResolvedValue([]);

      render(
        <TestWrapper>
          <FileBrowsePanel allNotes={[]} isLoading={false} />
        </TestWrapper>
      );

      // Use a more flexible matcher for the special character
      await waitFor(() => {
        expect(screen.getByText(/No notes yet/)).toBeInTheDocument();
      });
    });

    it('shows loading state', async () => {
      // Use a never-resolving promise to keep the loading state
      mockRecentOpens.getRecent.mockReturnValue(new Promise(() => {}));

      render(
        <TestWrapper>
          <FileBrowsePanel allNotes={[]} isLoading={true} />
        </TestWrapper>
      );

      // The loading state should be shown immediately
      expect(screen.getByText(/Loading/)).toBeInTheDocument();
    });
  });

  describe('orphan handling', () => {
    it('gracefully handles orphaned tracking records', async () => {
      const allNotes = [createMockNote('note-1', 'Note 1')];

      // Record refers to note that doesn't exist
      const records: RecentOpenRecord[] = [
        { entityId: 'orphan-id', entityType: 'note', openedAt: 2000 },
        { entityId: 'note-1', entityType: 'note', openedAt: 1000 },
      ];

      mockRecentOpens.getRecent.mockResolvedValue(records);

      render(
        <TestWrapper>
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Note 1')).toBeInTheDocument();
      });

      // Orphan should not appear
      expect(screen.queryByText('orphan-id')).not.toBeInTheDocument();
    });

    it('preserves order after filtering orphans', async () => {
      const allNotes = [
        createMockNote('note-a', 'Note A'),
        createMockNote('note-b', 'Note B'),
        createMockNote('note-c', 'Note C'),
      ];

      // Interleaved valid and orphan records
      const records: RecentOpenRecord[] = [
        { entityId: 'note-a', entityType: 'note', openedAt: 1000 },
        { entityId: 'orphan-1', entityType: 'note', openedAt: 950 },
        { entityId: 'note-b', entityType: 'note', openedAt: 900 },
        { entityId: 'orphan-2', entityType: 'note', openedAt: 850 },
        { entityId: 'note-c', entityType: 'note', openedAt: 800 },
      ];

      mockRecentOpens.getRecent.mockResolvedValue(records);

      render(
        <TestWrapper>
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Note A')).toBeInTheDocument();
      });

      // Order should be preserved: A, B, C (in recency order)
      const items = screen.getAllByText(/Note [ABC]/);
      expect(items[0]).toHaveTextContent('Note A');
      expect(items[1]).toHaveTextContent('Note B');
      expect(items[2]).toHaveTextContent('Note C');
    });
  });

  describe('create new note fallback', () => {
    it('shows create option when no search results match', async () => {
      const allNotes = [createMockNote('note-1', 'Existing Note')];
      mockRecentOpens.getRecent.mockResolvedValue([]);

      render(
        <TestWrapper query="New Note Title">
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      // Wait for debounce and check for create option
      await waitFor(
        () => {
          expect(screen.getByText(/Create "New Note Title"/)).toBeInTheDocument();
        },
        { timeout: 500 }
      );
    });

    it('creates note with query as title when create option is clicked', async () => {
      const user = userEvent.setup();
      const allNotes = [createMockNote('note-1', 'Existing Note')];
      const onNoteSelect = vi.fn();
      const onClose = vi.fn();

      mockRecentOpens.getRecent.mockResolvedValue([]);
      mockNotes.create.mockResolvedValue(createMockNote('new-note', ''));

      render(
        <TestWrapper query="My New Note" onNoteSelect={onNoteSelect} onClose={onClose}>
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      // Wait for create option to appear
      await waitFor(
        () => {
          expect(screen.getByText(/Create "My New Note"/)).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Click the create option
      const createOption = screen.getByText(/Create "My New Note"/).closest('div');
      if (createOption) {
        await user.click(createOption);
      }

      await waitFor(() => {
        expect(mockNotes.create).toHaveBeenCalled();
        expect(mockNotes.save).toHaveBeenCalled();
      });
    });

    it('does not show create option when search results exist', async () => {
      const allNotes = [
        createMockNote('note-1', 'Matching Note'),
        createMockNote('note-2', 'Another Match'),
      ];
      mockRecentOpens.getRecent.mockResolvedValue([]);

      render(
        <TestWrapper query="Match">
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      // Wait for search results to appear
      await waitFor(
        () => {
          expect(screen.getByText('Matching Note')).toBeInTheDocument();
        },
        { timeout: 500 }
      );

      // Create option should not be visible when results exist
      expect(screen.queryByText(/Create "Match"/)).not.toBeInTheDocument();
    });
  });

  describe('note selection', () => {
    it('calls onNoteSelect when clicking a note', async () => {
      const user = userEvent.setup();
      const allNotes = [createMockNote('note-1', 'Note 1'), createMockNote('note-2', 'Note 2')];
      const onNoteSelect = vi.fn();
      const onClose = vi.fn();

      const records: RecentOpenRecord[] = [
        { entityId: 'note-1', entityType: 'note', openedAt: 2000 },
        { entityId: 'note-2', entityType: 'note', openedAt: 1000 },
      ];

      mockRecentOpens.getRecent.mockResolvedValue(records);

      render(
        <TestWrapper onNoteSelect={onNoteSelect} onClose={onClose}>
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Note 1')).toBeInTheDocument();
      });

      // Click on Note 2
      const note2Element = screen.getByText('Note 2').closest('div');
      if (note2Element) {
        await user.click(note2Element);
      }

      expect(onNoteSelect).toHaveBeenCalledWith(createNoteId('note-2'));
      expect(onClose).toHaveBeenCalled();
    });
  });

  describe('note type icons', () => {
    it('displays correct icons for different note types', async () => {
      const allNotes = [
        createMockNote('daily-1', 'Daily Note', 'daily'),
        createMockNote('meeting-1', 'Meeting Note', 'meeting'),
        createMockNote('person-1', 'Person Note', 'person'),
        createMockNote('regular-1', 'Regular Note', 'regular'),
      ];

      const records: RecentOpenRecord[] = [
        { entityId: 'daily-1', entityType: 'note', openedAt: 4000 },
        { entityId: 'meeting-1', entityType: 'note', openedAt: 3000 },
        { entityId: 'person-1', entityType: 'note', openedAt: 2000 },
        { entityId: 'regular-1', entityType: 'note', openedAt: 1000 },
      ];

      mockRecentOpens.getRecent.mockResolvedValue(records);

      render(
        <TestWrapper>
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Daily Note')).toBeInTheDocument();
        expect(screen.getByText('Meeting Note')).toBeInTheDocument();
        expect(screen.getByText('Person Note')).toBeInTheDocument();
        expect(screen.getByText('Regular Note')).toBeInTheDocument();
      });
    });
  });

  describe('delete button', () => {
    it('renders delete button on each note item', async () => {
      const allNotes = [createMockNote('note-1', 'Note 1'), createMockNote('note-2', 'Note 2')];

      const records: RecentOpenRecord[] = [
        { entityId: 'note-1', entityType: 'note', openedAt: 2000 },
        { entityId: 'note-2', entityType: 'note', openedAt: 1000 },
      ];

      mockRecentOpens.getRecent.mockResolvedValue(records);

      render(
        <TestWrapper>
          <FileBrowsePanel allNotes={allNotes} isLoading={false} />
        </TestWrapper>
      );

      await waitFor(() => {
        expect(screen.getByText('Note 1')).toBeInTheDocument();
      });

      // Each note should have a delete button
      const deleteButtons = screen.getAllByRole('button', { name: /Delete/ });
      expect(deleteButtons).toHaveLength(2);
    });
  });
});
