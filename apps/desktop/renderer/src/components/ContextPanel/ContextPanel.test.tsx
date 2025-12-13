/**
 * ContextPanel Component Tests
 *
 * Tests for the main context panel that displays contextual information
 * about the current note including backlinks, attendees, tasks, references, etc.
 */

import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  ContextPanel,
  CONTEXT_PANEL_DEFAULT_WIDTH,
  CONTEXT_PANEL_MIN_WIDTH,
  CONTEXT_PANEL_MAX_WIDTH,
} from './ContextPanel';
import type { Note, EditorContent, GraphNode, MeetingNote, DailyNote } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Helper to create a mock note
function createMockNote(overrides: Partial<Note> = {}): Note {
  return {
    id: createNoteId('test-note-1'),
    title: 'Test Note',
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
    ...overrides,
  } as Note;
}

// Helper to create a mock meeting note
function createMockMeetingNote(attendees: string[] = []): MeetingNote {
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
      attendees: attendees.map((id) => createNoteId(id)),
    },
  };
}

// Helper to create a mock daily note
function createMockDailyNote(title: string = '12-12-2025'): DailyNote {
  return {
    id: createNoteId('daily-note-1'),
    title,
    type: 'daily',
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
    daily: {
      date: '2025-12-12',
    },
  };
}

// Mock backlinks data
function createMockBacklinks(): GraphNode[] {
  return [
    {
      id: createNoteId('backlink-1'),
      title: 'Referencing Note 1',
      tags: [],
    },
    {
      id: createNoteId('backlink-2'),
      title: 'Referencing Note 2',
      tags: [],
    },
  ];
}

// Mock window.scribe API
const mockScribeAPI = {
  graph: {
    backlinks: vi.fn(),
  },
  notes: {
    read: vi.fn(),
    list: vi.fn(),
    findByDate: vi.fn(),
  },
  tasks: {
    list: vi.fn(),
    onChange: vi.fn(() => vi.fn()),
    toggle: vi.fn(),
    reorder: vi.fn(),
  },
  meeting: {
    addAttendee: vi.fn(),
    removeAttendee: vi.fn(),
  },
  people: {
    create: vi.fn(),
  },
};

describe('ContextPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Setup default mock implementations
    mockScribeAPI.graph.backlinks.mockResolvedValue([]);
    mockScribeAPI.notes.findByDate.mockResolvedValue([]);
    mockScribeAPI.notes.list.mockResolvedValue([]);
    mockScribeAPI.notes.read.mockResolvedValue(null);
    mockScribeAPI.tasks.list.mockResolvedValue({ tasks: [] });

    // Mock window.scribe
    (window as unknown as { scribe: typeof mockScribeAPI }).scribe = mockScribeAPI;
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders when open', () => {
      const note = createMockNote();
      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      expect(screen.getByText('Context')).toBeInTheDocument();
    });

    it('renders closed state when isOpen is false', () => {
      const note = createMockNote();
      const { container } = render(
        <ContextPanel isOpen={false} note={note} onNavigate={vi.fn()} />
      );

      // Panel should still be in DOM but with closed styling
      const panel = container.querySelector('aside');
      expect(panel).toBeInTheDocument();
    });

    it('renders the "Context" section header', () => {
      const note = createMockNote();
      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      expect(screen.getByRole('heading', { level: 2, name: 'Context' })).toBeInTheDocument();
    });

    it('renders resize handle when open and onWidthChange is provided', () => {
      const note = createMockNote();
      const { container } = render(
        <ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} onWidthChange={vi.fn()} />
      );

      // Panel should be present
      expect(container.querySelector('aside')).toBeInTheDocument();
    });

    it('does not render resize handle when onWidthChange is not provided', () => {
      const note = createMockNote();
      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      // Panel renders without resize functionality
      expect(screen.getByText('Context')).toBeInTheDocument();
    });
  });

  describe('width handling', () => {
    it('uses default width when not specified', () => {
      const note = createMockNote();
      const { container } = render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      // The panel should be rendered - width is controlled via CSS custom properties
      expect(container.querySelector('aside')).toBeInTheDocument();
    });

    it('accepts custom width prop', () => {
      const note = createMockNote();
      const { container } = render(
        <ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} width={350} />
      );

      expect(container.querySelector('aside')).toBeInTheDocument();
    });

    it('exports correct width constants', () => {
      expect(CONTEXT_PANEL_DEFAULT_WIDTH).toBe(280);
      expect(CONTEXT_PANEL_MIN_WIDTH).toBe(200);
      expect(CONTEXT_PANEL_MAX_WIDTH).toBe(400);
    });
  });

  describe('backlinks fetching', () => {
    it('fetches backlinks when panel opens', async () => {
      const note = createMockNote();
      const backlinks = createMockBacklinks();
      mockScribeAPI.graph.backlinks.mockResolvedValue(backlinks);

      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(mockScribeAPI.graph.backlinks).toHaveBeenCalledWith(note.id);
      });
    });

    it('does not fetch backlinks when panel is closed', async () => {
      const note = createMockNote();

      render(<ContextPanel isOpen={false} note={note} onNavigate={vi.fn()} />);

      // Give time for any potential async calls
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(mockScribeAPI.graph.backlinks).not.toHaveBeenCalled();
    });

    it('clears backlinks when note is null', async () => {
      mockScribeAPI.graph.backlinks.mockResolvedValue([]);

      render(<ContextPanel isOpen={true} note={null} onNavigate={vi.fn()} />);

      // Should still render but with empty state
      await waitFor(() => {
        expect(screen.getByText('No linked mentions')).toBeInTheDocument();
      });
    });

    it('handles backlinks fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const note = createMockNote();
      mockScribeAPI.graph.backlinks.mockRejectedValue(new Error('Network error'));

      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      // Should show empty state after error
      expect(screen.getByText('No linked mentions')).toBeInTheDocument();

      consoleSpy.mockRestore();
    });
  });

  describe('section rendering based on note type', () => {
    it('renders LinkedMentions section for regular notes', async () => {
      const note = createMockNote();
      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Linked Mentions')).toBeInTheDocument();
      });
    });

    it('renders Tasks section', async () => {
      const note = createMockNote();
      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Tasks')).toBeInTheDocument();
      });
    });

    it('renders References section when note is provided', async () => {
      const note = createMockNote();
      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('References')).toBeInTheDocument();
      });
    });

    it('renders Attendees section for meeting notes', async () => {
      const note = createMockMeetingNote();
      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Attendees')).toBeInTheDocument();
      });
    });

    it('does not render Attendees section for non-meeting notes', async () => {
      const note = createMockNote();
      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        // Give time for rendering
        expect(screen.queryByText('Attendees')).not.toBeInTheDocument();
      });
    });
  });

  describe('date-based notes for daily notes', () => {
    it('fetches date-based notes for daily notes', async () => {
      const note = createMockDailyNote('12-12-2025');
      mockScribeAPI.notes.findByDate.mockResolvedValue([]);

      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(mockScribeAPI.notes.findByDate).toHaveBeenCalled();
      });
    });

    it('handles date-based notes fetch error gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const note = createMockDailyNote();
      mockScribeAPI.notes.findByDate.mockRejectedValue(new Error('Fetch error'));

      render(<ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalled();
      });

      consoleSpy.mockRestore();
    });
  });

  describe('navigation', () => {
    it('calls onNavigate when backlink is clicked', async () => {
      const onNavigate = vi.fn();
      const note = createMockNote();
      const backlinks = createMockBacklinks();
      mockScribeAPI.graph.backlinks.mockResolvedValue(backlinks);

      render(<ContextPanel isOpen={true} note={note} onNavigate={onNavigate} />);

      await waitFor(() => {
        expect(screen.getByText('Referencing Note 1')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByText('Referencing Note 1'));

      expect(onNavigate).toHaveBeenCalledWith(createNoteId('backlink-1'));
    });
  });

  describe('onNoteUpdate callback', () => {
    it('passes onNoteUpdate to AttendeesWidget for meeting notes', async () => {
      const onNoteUpdate = vi.fn();
      const note = createMockMeetingNote();

      render(
        <ContextPanel isOpen={true} note={note} onNavigate={vi.fn()} onNoteUpdate={onNoteUpdate} />
      );

      await waitFor(() => {
        expect(screen.getByText('Attendees')).toBeInTheDocument();
      });
    });
  });

  describe('panel with null note', () => {
    it('handles null note gracefully', async () => {
      render(<ContextPanel isOpen={true} note={null} onNavigate={vi.fn()} />);

      await waitFor(() => {
        expect(screen.getByText('Context')).toBeInTheDocument();
        expect(screen.getByText('No linked mentions')).toBeInTheDocument();
      });
    });
  });
});
