/**
 * AttendeesWidget Component Tests
 *
 * NOTE: People/Meeting feature is temporarily disabled during thin shell refactor.
 * These tests verify the component renders correctly with stubbed API calls.
 */

import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { AttendeesWidget } from './AttendeesWidget';
import type { MeetingNote, EditorContent } from '@scribe/shared';
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

describe('AttendeesWidget', () => {
  it('renders the attendees header', () => {
    const mockNote = createMockMeetingNote();
    render(<AttendeesWidget note={mockNote} onNavigate={vi.fn()} />);
    expect(screen.getByText('Attendees')).toBeInTheDocument();
  });

  it('shows empty state when no attendees', () => {
    const mockNote = createMockMeetingNote();
    render(<AttendeesWidget note={mockNote} onNavigate={vi.fn()} />);
    expect(screen.getByText('No attendees yet')).toBeInTheDocument();
  });
});
