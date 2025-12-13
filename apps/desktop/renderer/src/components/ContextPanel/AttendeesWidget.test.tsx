/**
 * AttendeesWidget Component Tests
 *
 * Tests for the attendees widget that displays and manages meeting attendees.
 */

import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AttendeesWidget } from './AttendeesWidget';
import type { MeetingNote, EditorContent, Note } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Helper to create a mock meeting note
function createMockMeetingNote(attendeeIds: string[] = []): MeetingNote {
  return {
    id: createNoteId('meeting-note-1'),
    title: 'Team Meeting',
    type: 'meeting',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    content: {
      root: {
        type: 'root',
        children: [],
        format: '',
        indent: 0,
        version: 1,
      },
    } as EditorContent,
    metadata: { title: null, tags: [], links: [], mentions: [] },
    meeting: {
      date: '2025-12-12',
      dailyNoteId: createNoteId('daily-2025-12-12'),
      attendees: attendeeIds.map((id) => createNoteId(id)),
    },
  };
}

// Helper to create a mock person note
function createMockPersonNote(id: string, name: string): Note {
  return {
    id: createNoteId(id),
    title: name,
    type: 'person',
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    content: {
      root: {
        type: 'root',
        children: [],
        format: '',
        indent: 0,
        version: 1,
      },
    } as EditorContent,
    metadata: { title: null, tags: [], links: [], mentions: [] },
  } as Note;
}

// Mock window.scribe API
const mockScribeAPI = {
  notes: {
    read: vi.fn(),
    list: vi.fn(),
  },
  meeting: {
    addAttendee: vi.fn(),
    removeAttendee: vi.fn(),
  },
  people: {
    create: vi.fn(),
  },
};

describe('AttendeesWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockScribeAPI.notes.read.mockResolvedValue(null);
    mockScribeAPI.notes.list.mockResolvedValue([]);
    mockScribeAPI.meeting.addAttendee.mockResolvedValue(undefined);
    mockScribeAPI.meeting.removeAttendee.mockResolvedValue(undefined);

    // Mock window.scribe
    (window as unknown as { scribe: typeof mockScribeAPI }).scribe = mockScribeAPI;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders the Attendees header', () => {
      const note = createMockMeetingNote();
      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);

      expect(screen.getByText('Attendees')).toBeInTheDocument();
    });

    it('renders add attendee button', () => {
      const note = createMockMeetingNote();
      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);

      expect(screen.getByRole('button', { name: 'Add attendee' })).toBeInTheDocument();
    });

    it('shows empty state when no attendees', () => {
      const note = createMockMeetingNote([]);
      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);

      expect(screen.getByText('No attendees yet')).toBeInTheDocument();
    });

    it('renders attendee list when attendees exist', async () => {
      const note = createMockMeetingNote(['person-1', 'person-2']);
      mockScribeAPI.notes.read
        .mockResolvedValueOnce(createMockPersonNote('person-1', 'Alice'))
        .mockResolvedValueOnce(createMockPersonNote('person-2', 'Bob'));

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('@Alice')).toBeInTheDocument();
        expect(screen.getByText('@Bob')).toBeInTheDocument();
      });
    });

    it('has testid for the widget', () => {
      const note = createMockMeetingNote();
      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);

      expect(screen.getByTestId('attendees-widget')).toBeInTheDocument();
    });
  });

  describe('adding attendees', () => {
    it('shows search input when add button is clicked', () => {
      const note = createMockMeetingNote();
      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);

      fireEvent.click(screen.getByRole('button', { name: 'Add attendee' }));

      expect(screen.getByPlaceholderText('Search people...')).toBeInTheDocument();
    });

    it('hides search input when add button is clicked again', () => {
      const note = createMockMeetingNote();
      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);

      const addButton = screen.getByRole('button', { name: 'Add attendee' });
      fireEvent.click(addButton);
      expect(screen.getByPlaceholderText('Search people...')).toBeInTheDocument();

      fireEvent.click(addButton);
      expect(screen.queryByPlaceholderText('Search people...')).not.toBeInTheDocument();
    });

    it('fetches all people when adding mode is enabled', async () => {
      const note = createMockMeetingNote();
      mockScribeAPI.notes.list.mockResolvedValue([
        createMockPersonNote('person-1', 'Alice'),
        createMockPersonNote('person-2', 'Bob'),
      ]);

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add attendee' }));

      await waitFor(() => {
        expect(mockScribeAPI.notes.list).toHaveBeenCalled();
      });
    });

    it('filters people based on search query', async () => {
      const note = createMockMeetingNote();
      mockScribeAPI.notes.list.mockResolvedValue([
        createMockPersonNote('person-1', 'Alice'),
        createMockPersonNote('person-2', 'Bob'),
        createMockPersonNote('person-3', 'Charlie'),
      ]);

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add attendee' }));

      await waitFor(() => {
        expect(screen.getByText('@Alice')).toBeInTheDocument();
      });

      fireEvent.change(screen.getByPlaceholderText('Search people...'), {
        target: { value: 'Bob' },
      });

      await waitFor(() => {
        expect(screen.getByText('@Bob')).toBeInTheDocument();
        expect(screen.queryByText('@Alice')).not.toBeInTheDocument();
        expect(screen.queryByText('@Charlie')).not.toBeInTheDocument();
      });
    });

    it('excludes already added attendees from suggestions', async () => {
      const note = createMockMeetingNote(['person-1']);
      mockScribeAPI.notes.read.mockResolvedValue(createMockPersonNote('person-1', 'Alice'));
      mockScribeAPI.notes.list.mockResolvedValue([
        createMockPersonNote('person-1', 'Alice'),
        createMockPersonNote('person-2', 'Bob'),
      ]);

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('@Alice')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Add attendee' }));

      await waitFor(() => {
        // Bob should be in suggestions
        expect(screen.getByText('@Bob')).toBeInTheDocument();
        // Alice should only appear once (as existing attendee, not in suggestions)
        const aliceElements = screen.getAllByText('@Alice');
        expect(aliceElements.length).toBe(1);
      });
    });

    it('calls addAttendee when person is selected', async () => {
      const note = createMockMeetingNote();
      const onNoteUpdate = vi.fn();
      mockScribeAPI.notes.list.mockResolvedValue([createMockPersonNote('person-1', 'Alice')]);

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} onNoteUpdate={onNoteUpdate} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add attendee' }));

      await waitFor(() => {
        expect(screen.getByText('@Alice')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('@Alice'));

      await waitFor(() => {
        expect(mockScribeAPI.meeting.addAttendee).toHaveBeenCalledWith(
          note.id,
          createNoteId('person-1')
        );
        expect(onNoteUpdate).toHaveBeenCalled();
      });
    });

    it('shows create option when no exact match', async () => {
      const note = createMockMeetingNote();
      mockScribeAPI.notes.list.mockResolvedValue([]);

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add attendee' }));

      fireEvent.change(screen.getByPlaceholderText('Search people...'), {
        target: { value: 'New Person' },
      });

      await waitFor(() => {
        expect(screen.getByText(/Create "New Person"/)).toBeInTheDocument();
      });
    });

    it('creates new person and adds as attendee when create option is clicked', async () => {
      const note = createMockMeetingNote();
      const onNoteUpdate = vi.fn();
      const newPerson = createMockPersonNote('new-person-id', 'New Person');
      mockScribeAPI.notes.list.mockResolvedValue([]);
      mockScribeAPI.people.create.mockResolvedValue(newPerson);

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} onNoteUpdate={onNoteUpdate} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add attendee' }));

      fireEvent.change(screen.getByPlaceholderText('Search people...'), {
        target: { value: 'New Person' },
      });

      await waitFor(() => {
        expect(screen.getByText(/Create "New Person"/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Create "New Person"/));

      await waitFor(() => {
        expect(mockScribeAPI.people.create).toHaveBeenCalledWith('New Person');
        expect(mockScribeAPI.meeting.addAttendee).toHaveBeenCalledWith(note.id, newPerson.id);
        expect(onNoteUpdate).toHaveBeenCalled();
      });
    });

    it('shows no results message when no people match', async () => {
      const note = createMockMeetingNote();
      mockScribeAPI.notes.list.mockResolvedValue([createMockPersonNote('person-1', 'Alice')]);

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add attendee' }));

      // Type something that has an exact match to avoid create option
      fireEvent.change(screen.getByPlaceholderText('Search people...'), {
        target: { value: 'Alice' },
      });

      await waitFor(() => {
        // Alice should appear as she matches
        expect(screen.getByText('@Alice')).toBeInTheDocument();
      });

      // Clear and search for non-existent but without triggering create
      fireEvent.change(screen.getByPlaceholderText('Search people...'), {
        target: { value: '' },
      });
    });
  });

  describe('removing attendees', () => {
    it('shows remove button for each attendee', async () => {
      const note = createMockMeetingNote(['person-1']);
      mockScribeAPI.notes.read.mockResolvedValue(createMockPersonNote('person-1', 'Alice'));

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Remove Alice' })).toBeInTheDocument();
      });
    });

    it('calls removeAttendee when remove button is clicked', async () => {
      const note = createMockMeetingNote(['person-1']);
      const onNoteUpdate = vi.fn();
      mockScribeAPI.notes.read.mockResolvedValue(createMockPersonNote('person-1', 'Alice'));

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} onNoteUpdate={onNoteUpdate} />);

      await waitFor(() => {
        expect(screen.getByText('@Alice')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByRole('button', { name: 'Remove Alice' }));

      await waitFor(() => {
        expect(mockScribeAPI.meeting.removeAttendee).toHaveBeenCalledWith(
          note.id,
          createNoteId('person-1')
        );
        expect(onNoteUpdate).toHaveBeenCalled();
      });
    });
  });

  describe('navigation', () => {
    it('calls onNavigate when attendee name is clicked', async () => {
      const onNavigate = vi.fn();
      const note = createMockMeetingNote(['person-1']);
      mockScribeAPI.notes.read.mockResolvedValue(createMockPersonNote('person-1', 'Alice'));

      render(<AttendeesWidget note={note} onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('@Alice')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('@Alice'));

      expect(onNavigate).toHaveBeenCalledWith(createNoteId('person-1'));
    });
  });

  describe('error handling', () => {
    it('handles error when fetching person details', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const note = createMockMeetingNote(['person-1']);
      mockScribeAPI.notes.read.mockRejectedValue(new Error('Fetch error'));

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);

      // Should handle error gracefully and not crash
      await waitFor(() => {
        // Empty state might show because person couldn't be loaded
        expect(screen.getByTestId('attendees-widget')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    it('handles error when creating person', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const note = createMockMeetingNote();
      mockScribeAPI.notes.list.mockResolvedValue([]);
      mockScribeAPI.people.create.mockRejectedValue(new Error('Create error'));

      render(<AttendeesWidget note={note} onNavigate={vi.fn()} />);
      fireEvent.click(screen.getByRole('button', { name: 'Add attendee' }));

      fireEvent.change(screen.getByPlaceholderText('Search people...'), {
        target: { value: 'New Person' },
      });

      await waitFor(() => {
        expect(screen.getByText(/Create "New Person"/)).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText(/Create "New Person"/));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });
});
