/**
 * LinkedMentions Component Tests
 *
 * Tests for the linked mentions widget that displays backlinks and date-based notes.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LinkedMentions, type LinkedMention } from './LinkedMentions';
import type { GraphNode } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Helper to create mock backlinks
function createMockBacklinks(count: number): GraphNode[] {
  return Array.from({ length: count }, (_, i) => ({
    id: createNoteId(`backlink-${i + 1}`),
    title: `Backlink Note ${i + 1}`,
    tags: [],
  }));
}

// Helper to create mock date-based notes
function createMockDateNotes(count: number): LinkedMention[] {
  return Array.from({ length: count }, (_, i) => ({
    id: createNoteId(`date-note-${i + 1}`),
    title: `Date Note ${i + 1}`,
    createdOnDate: i % 2 === 0,
    modifiedOnDate: i % 2 === 1,
  }));
}

describe('LinkedMentions', () => {
  describe('rendering', () => {
    it('renders the Linked Mentions header', () => {
      render(<LinkedMentions backlinks={[]} onSelectBacklink={vi.fn()} />);

      expect(screen.getByText('Linked Mentions')).toBeInTheDocument();
    });

    it('shows empty state when no backlinks', () => {
      render(<LinkedMentions backlinks={[]} onSelectBacklink={vi.fn()} />);

      expect(screen.getByText('No linked mentions')).toBeInTheDocument();
    });

    it('renders backlinks list when backlinks exist', () => {
      const backlinks = createMockBacklinks(3);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={vi.fn()} />);

      expect(screen.getByText('Backlink Note 1')).toBeInTheDocument();
      expect(screen.getByText('Backlink Note 2')).toBeInTheDocument();
      expect(screen.getByText('Backlink Note 3')).toBeInTheDocument();
    });

    it('shows "Untitled" for backlinks without title', () => {
      const backlinks: GraphNode[] = [{ id: createNoteId('backlink-1'), title: null, tags: [] }];

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={vi.fn()} />);

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });
  });

  describe('date-based notes', () => {
    it('renders date-based notes when provided', () => {
      const dateNotes = createMockDateNotes(2);

      render(
        <LinkedMentions backlinks={[]} dateBasedNotes={dateNotes} onSelectBacklink={vi.fn()} />
      );

      expect(screen.getByText('Date Note 1')).toBeInTheDocument();
      expect(screen.getByText('Date Note 2')).toBeInTheDocument();
    });

    it('merges backlinks and date-based notes by ID', () => {
      const backlinks: GraphNode[] = [
        { id: createNoteId('shared-id'), title: 'Shared Note', tags: [] },
      ];
      const dateNotes: LinkedMention[] = [
        { id: createNoteId('shared-id'), title: 'Shared Note', createdOnDate: true },
      ];

      render(
        <LinkedMentions
          backlinks={backlinks}
          dateBasedNotes={dateNotes}
          onSelectBacklink={vi.fn()}
        />
      );

      // Should only appear once despite being in both arrays
      const sharedNotes = screen.getAllByText('Shared Note');
      expect(sharedNotes).toHaveLength(1);
    });
  });

  describe('navigation', () => {
    it('calls onSelectBacklink when backlink is clicked', () => {
      const onSelectBacklink = vi.fn();
      const backlinks = createMockBacklinks(1);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={onSelectBacklink} />);

      fireEvent.click(screen.getByText('Backlink Note 1'));

      expect(onSelectBacklink).toHaveBeenCalledWith(createNoteId('backlink-1'));
    });

    it('calls onSelectBacklink when date note is clicked', () => {
      const onSelectBacklink = vi.fn();
      const dateNotes = createMockDateNotes(1);

      render(
        <LinkedMentions
          backlinks={[]}
          dateBasedNotes={dateNotes}
          onSelectBacklink={onSelectBacklink}
        />
      );

      fireEvent.click(screen.getByText('Date Note 1'));

      expect(onSelectBacklink).toHaveBeenCalledWith(createNoteId('date-note-1'));
    });

    it('supports keyboard navigation with Enter key', () => {
      const onSelectBacklink = vi.fn();
      const backlinks = createMockBacklinks(1);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={onSelectBacklink} />);

      const backlinkItem = screen.getByText('Backlink Note 1').closest('[role="button"]');
      if (backlinkItem) {
        fireEvent.keyDown(backlinkItem, { key: 'Enter' });
        expect(onSelectBacklink).toHaveBeenCalledWith(createNoteId('backlink-1'));
      }
    });

    it('supports keyboard navigation with Space key', () => {
      const onSelectBacklink = vi.fn();
      const backlinks = createMockBacklinks(1);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={onSelectBacklink} />);

      const backlinkItem = screen.getByText('Backlink Note 1').closest('[role="button"]');
      if (backlinkItem) {
        fireEvent.keyDown(backlinkItem, { key: ' ' });
        expect(onSelectBacklink).toHaveBeenCalledWith(createNoteId('backlink-1'));
      }
    });
  });

  describe('expand/collapse behavior', () => {
    it('shows expand button when more than 4 items', () => {
      const backlinks = createMockBacklinks(6);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={vi.fn()} />);

      expect(screen.getByText('2 more')).toBeInTheDocument();
    });

    it('does not show expand button when 4 or fewer items', () => {
      const backlinks = createMockBacklinks(4);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={vi.fn()} />);

      expect(screen.queryByText(/more/)).not.toBeInTheDocument();
    });

    it('only shows first 4 items when collapsed', () => {
      const backlinks = createMockBacklinks(6);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={vi.fn()} />);

      expect(screen.getByText('Backlink Note 1')).toBeInTheDocument();
      expect(screen.getByText('Backlink Note 2')).toBeInTheDocument();
      expect(screen.getByText('Backlink Note 3')).toBeInTheDocument();
      expect(screen.getByText('Backlink Note 4')).toBeInTheDocument();
      expect(screen.queryByText('Backlink Note 5')).not.toBeInTheDocument();
      expect(screen.queryByText('Backlink Note 6')).not.toBeInTheDocument();
    });

    it('shows all items when expanded', () => {
      const backlinks = createMockBacklinks(6);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={vi.fn()} />);

      fireEvent.click(screen.getByText('2 more'));

      expect(screen.getByText('Backlink Note 5')).toBeInTheDocument();
      expect(screen.getByText('Backlink Note 6')).toBeInTheDocument();
    });

    it('shows "Show less" when expanded', () => {
      const backlinks = createMockBacklinks(6);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={vi.fn()} />);

      fireEvent.click(screen.getByText('2 more'));

      expect(screen.getByText('Show less')).toBeInTheDocument();
    });

    it('collapses back to 4 items when clicking "Show less"', () => {
      const backlinks = createMockBacklinks(6);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={vi.fn()} />);

      // Expand
      fireEvent.click(screen.getByText('2 more'));
      expect(screen.getByText('Backlink Note 5')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByText('Show less'));
      expect(screen.queryByText('Backlink Note 5')).not.toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has role="button" on backlink items', () => {
      const backlinks = createMockBacklinks(1);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={vi.fn()} />);

      const backlinkItem = screen.getByText('Backlink Note 1').closest('[role="button"]');
      expect(backlinkItem).toBeInTheDocument();
    });

    it('has tabIndex on backlink items', () => {
      const backlinks = createMockBacklinks(1);

      render(<LinkedMentions backlinks={backlinks} onSelectBacklink={vi.fn()} />);

      const backlinkItem = screen.getByText('Backlink Note 1').closest('[role="button"]');
      expect(backlinkItem).toHaveAttribute('tabIndex', '0');
    });
  });
});
