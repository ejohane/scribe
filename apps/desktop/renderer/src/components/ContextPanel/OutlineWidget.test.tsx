/**
 * OutlineWidget Component Tests
 *
 * Tests for the Outline panel widget that displays document headings
 * and provides click-to-navigate functionality.
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { OutlineWidget } from './OutlineWidget';
import type { Note, EditorContent } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Mock the EditorCommandContext
const mockFocusNode = vi.fn();
vi.mock('../Editor/EditorCommandContext', () => ({
  useEditorCommand: () => ({
    focusNode: mockFocusNode,
    hasEditor: true,
  }),
}));

/**
 * Helper to create a mock note with specific headings
 */
function createMockNote(headings: Array<{ tag: string; text: string; key: string }>): Note {
  const children = headings.map((h) => ({
    type: 'heading',
    tag: h.tag,
    __key: h.key,
    children: [{ type: 'text', text: h.text }],
  }));

  const content: EditorContent = {
    root: {
      type: 'root',
      children,
      direction: null,
      format: '',
      indent: 0,
      version: 1,
    },
  };

  return {
    id: createNoteId('test-note'),
    title: 'Test Note',
    content,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    metadata: {
      title: 'Test Note',
      tags: [],
      links: [],
      mentions: [],
    },
  };
}

describe('OutlineWidget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with data-testid', () => {
      const note = createMockNote([]);
      render(<OutlineWidget note={note} />);

      expect(screen.getByTestId('outline-widget')).toBeInTheDocument();
    });

    it('shows "No headings" when note has no headings', () => {
      const note = createMockNote([]);
      render(<OutlineWidget note={note} />);

      expect(screen.getByText('No headings')).toBeInTheDocument();
    });

    it('shows "No headings" when note is null', () => {
      render(<OutlineWidget note={null} />);

      expect(screen.getByText('No headings')).toBeInTheDocument();
    });

    it('shows "No headings" when note is undefined', () => {
      render(<OutlineWidget note={undefined} />);

      expect(screen.getByText('No headings')).toBeInTheDocument();
    });

    it('renders heading list when note has headings', () => {
      const note = createMockNote([
        { tag: 'h1', text: 'Introduction', key: 'key-1' },
        { tag: 'h2', text: 'Getting Started', key: 'key-2' },
        { tag: 'h3', text: 'Prerequisites', key: 'key-3' },
      ]);
      render(<OutlineWidget note={note} />);

      expect(screen.getByText('Introduction')).toBeInTheDocument();
      expect(screen.getByText('Getting Started')).toBeInTheDocument();
      expect(screen.getByText('Prerequisites')).toBeInTheDocument();
    });

    it('shows "(empty heading)" for headings with no text', () => {
      const note = createMockNote([
        { tag: 'h1', text: '', key: 'key-1' },
        { tag: 'h2', text: '   ', key: 'key-2' },
      ]);
      render(<OutlineWidget note={note} />);

      const emptyHeadings = screen.getAllByText('(empty heading)');
      expect(emptyHeadings).toHaveLength(2);
    });

    it('renders with proper aria-label for document outline', () => {
      const note = createMockNote([{ tag: 'h1', text: 'Title', key: 'key-1' }]);
      render(<OutlineWidget note={note} />);

      expect(screen.getByRole('navigation', { name: 'Document outline' })).toBeInTheDocument();
    });

    it('applies correct indentation via CSS custom property', () => {
      const note = createMockNote([
        { tag: 'h2', text: 'Level 2', key: 'key-1' },
        { tag: 'h3', text: 'Level 3', key: 'key-2' },
        { tag: 'h4', text: 'Level 4', key: 'key-3' },
      ]);
      render(<OutlineWidget note={note} />);

      // First heading (h2) should have depth 0 (min level)
      const level2 = screen.getByText('Level 2');
      expect(level2).toHaveStyle({ '--outline-depth': '0' });

      // Second heading (h3) should have depth 1
      const level3 = screen.getByText('Level 3');
      expect(level3).toHaveStyle({ '--outline-depth': '1' });

      // Third heading (h4) should have depth 2
      const level4 = screen.getByText('Level 4');
      expect(level4).toHaveStyle({ '--outline-depth': '2' });
    });
  });

  describe('navigation', () => {
    it('calls focusNode with correct nodeKey on click', () => {
      const note = createMockNote([{ tag: 'h1', text: 'Click Me', key: 'node-key-123' }]);
      render(<OutlineWidget note={note} />);

      const heading = screen.getByText('Click Me');
      fireEvent.click(heading);

      expect(mockFocusNode).toHaveBeenCalledTimes(1);
      expect(mockFocusNode).toHaveBeenCalledWith(
        'node-key-123',
        expect.objectContaining({
          lineIndexFallback: expect.any(Number),
          textHashFallback: expect.any(String),
        })
      );
    });

    it('calls focusNode on Enter key press', () => {
      const note = createMockNote([{ tag: 'h1', text: 'Press Enter', key: 'key-enter' }]);
      render(<OutlineWidget note={note} />);

      const heading = screen.getByText('Press Enter');
      fireEvent.keyDown(heading, { key: 'Enter' });

      expect(mockFocusNode).toHaveBeenCalledTimes(1);
      expect(mockFocusNode).toHaveBeenCalledWith('key-enter', expect.any(Object));
    });

    it('calls focusNode on Space key press', () => {
      const note = createMockNote([{ tag: 'h1', text: 'Press Space', key: 'key-space' }]);
      render(<OutlineWidget note={note} />);

      const heading = screen.getByText('Press Space');
      fireEvent.keyDown(heading, { key: ' ' });

      expect(mockFocusNode).toHaveBeenCalledTimes(1);
      expect(mockFocusNode).toHaveBeenCalledWith('key-space', expect.any(Object));
    });

    it('does not call focusNode on other key presses', () => {
      const note = createMockNote([{ tag: 'h1', text: 'Other Keys', key: 'key-other' }]);
      render(<OutlineWidget note={note} />);

      const heading = screen.getByText('Other Keys');
      fireEvent.keyDown(heading, { key: 'Tab' });
      fireEvent.keyDown(heading, { key: 'Escape' });
      fireEvent.keyDown(heading, { key: 'a' });

      expect(mockFocusNode).not.toHaveBeenCalled();
    });
  });

  describe('accessibility', () => {
    it('has role="button" on heading items', () => {
      const note = createMockNote([{ tag: 'h1', text: 'Title', key: 'key-1' }]);
      render(<OutlineWidget note={note} />);

      const heading = screen.getByRole('button', { name: /Heading level 1: Title/ });
      expect(heading).toBeInTheDocument();
    });

    it('has tabIndex={0} for keyboard navigation', () => {
      const note = createMockNote([{ tag: 'h1', text: 'Title', key: 'key-1' }]);
      render(<OutlineWidget note={note} />);

      const heading = screen.getByText('Title');
      expect(heading).toHaveAttribute('tabIndex', '0');
    });

    it('includes heading level in aria-label', () => {
      const note = createMockNote([
        { tag: 'h1', text: 'Level 1', key: 'key-1' },
        { tag: 'h2', text: 'Level 2', key: 'key-2' },
        { tag: 'h3', text: 'Level 3', key: 'key-3' },
      ]);
      render(<OutlineWidget note={note} />);

      expect(screen.getByRole('button', { name: 'Heading level 1: Level 1' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Heading level 2: Level 2' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Heading level 3: Level 3' })).toBeInTheDocument();
    });

    it('handles empty heading text in aria-label', () => {
      const note = createMockNote([{ tag: 'h1', text: '', key: 'key-1' }]);
      render(<OutlineWidget note={note} />);

      expect(
        screen.getByRole('button', { name: 'Heading level 1: (empty heading)' })
      ).toBeInTheDocument();
    });
  });

  describe('expand/collapse', () => {
    it('shows only COLLAPSED_LIMIT (5) headings initially', () => {
      const headings = Array.from({ length: 8 }, (_, i) => ({
        tag: 'h2',
        text: `Heading ${i + 1}`,
        key: `key-${i + 1}`,
      }));
      const note = createMockNote(headings);
      render(<OutlineWidget note={note} />);

      // Should show first 5
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Heading 5')).toBeInTheDocument();

      // Should not show 6+
      expect(screen.queryByText('Heading 6')).not.toBeInTheDocument();
      expect(screen.queryByText('Heading 8')).not.toBeInTheDocument();
    });

    it('shows expand button when more than 5 headings', () => {
      const headings = Array.from({ length: 8 }, (_, i) => ({
        tag: 'h2',
        text: `Heading ${i + 1}`,
        key: `key-${i + 1}`,
      }));
      const note = createMockNote(headings);
      render(<OutlineWidget note={note} />);

      expect(screen.getByRole('button', { name: 'Show 3 more headings' })).toBeInTheDocument();
    });

    it('does not show expand button when 5 or fewer headings', () => {
      const headings = Array.from({ length: 5 }, (_, i) => ({
        tag: 'h2',
        text: `Heading ${i + 1}`,
        key: `key-${i + 1}`,
      }));
      const note = createMockNote(headings);
      render(<OutlineWidget note={note} />);

      expect(screen.queryByRole('button', { name: /Show.*more/ })).not.toBeInTheDocument();
    });

    it('expands to show up to EXPANDED_LIMIT (10) headings on click', () => {
      const headings = Array.from({ length: 12 }, (_, i) => ({
        tag: 'h2',
        text: `Heading ${i + 1}`,
        key: `key-${i + 1}`,
      }));
      const note = createMockNote(headings);
      render(<OutlineWidget note={note} />);

      const expandButton = screen.getByRole('button', { name: 'Show 5 more headings' });
      fireEvent.click(expandButton);

      // Should now show up to 10
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Heading 10')).toBeInTheDocument();

      // Still should not show 11+
      expect(screen.queryByText('Heading 11')).not.toBeInTheDocument();
    });

    it('collapses back to 5 headings when clicking "Show less"', () => {
      const headings = Array.from({ length: 8 }, (_, i) => ({
        tag: 'h2',
        text: `Heading ${i + 1}`,
        key: `key-${i + 1}`,
      }));
      const note = createMockNote(headings);
      render(<OutlineWidget note={note} />);

      // Expand
      fireEvent.click(screen.getByRole('button', { name: 'Show 3 more headings' }));
      expect(screen.getByText('Heading 8')).toBeInTheDocument();

      // Collapse
      fireEvent.click(screen.getByRole('button', { name: 'Show fewer headings' }));
      expect(screen.queryByText('Heading 6')).not.toBeInTheDocument();
      expect(screen.getByText('Heading 5')).toBeInTheDocument();
    });

    it('has correct aria-expanded state', () => {
      const headings = Array.from({ length: 8 }, (_, i) => ({
        tag: 'h2',
        text: `Heading ${i + 1}`,
        key: `key-${i + 1}`,
      }));
      const note = createMockNote(headings);
      render(<OutlineWidget note={note} />);

      const expandButton = screen.getByRole('button', { name: 'Show 3 more headings' });
      expect(expandButton).toHaveAttribute('aria-expanded', 'false');

      fireEvent.click(expandButton);
      expect(screen.getByRole('button', { name: 'Show fewer headings' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
    });
  });

  describe('card structure', () => {
    it('renders card header with icon and title', () => {
      const note = createMockNote([]);
      render(<OutlineWidget note={note} />);

      expect(screen.getByText('Outline')).toBeInTheDocument();
    });
  });
});
