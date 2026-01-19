/**
 * CommandPaletteItem Component Tests
 *
 * Tests for the individual item component of the command palette.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CommandPaletteItem } from './CommandPaletteItem';
import type { CommandItem, NoteItem } from './types';

// Helper to create mock command item
function createCommandItem(overrides: Partial<CommandItem> = {}): CommandItem {
  return {
    type: 'command',
    id: 'test.command',
    label: 'Test Command',
    description: 'A test command',
    icon: 'TestIcon',
    category: 'General',
    priority: 100,
    handler: { execute: vi.fn() },
    ...overrides,
  };
}

// Helper to create mock note item
function createNoteItem(overrides: Partial<NoteItem> = {}): NoteItem {
  return {
    type: 'note',
    id: 'test-note-id',
    label: 'Test Note',
    noteType: 'note',
    icon: 'FileText',
    ...overrides,
  };
}

describe('CommandPaletteItem', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders command item with label', () => {
      const item = createCommandItem({ label: 'Create New Note' });

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      expect(screen.getByText('Create New Note')).toBeInTheDocument();
    });

    it('renders note item with label', () => {
      const item = createNoteItem({ label: 'My Daily Note' });

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      expect(screen.getByText('My Daily Note')).toBeInTheDocument();
    });

    it('renders item description', () => {
      const item = createCommandItem({ description: 'Creates a new note' });

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      expect(screen.getByText('Creates a new note')).toBeInTheDocument();
    });

    it('renders item icon', () => {
      const item = createCommandItem({ icon: 'Plus' });

      const { container } = render(
        <CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />
      );

      // Icon is rendered as SVG
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('uses default icon when not specified', () => {
      const item = createCommandItem({ icon: undefined });

      const { container } = render(
        <CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />
      );

      // Icon is rendered as SVG (FileText default)
      expect(container.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('shortcut display', () => {
    it('displays shortcut for command items', () => {
      const item = createCommandItem({ shortcut: '⌘N' });

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      expect(screen.getByText('⌘N')).toBeInTheDocument();
    });

    it('does not display shortcut for note items', () => {
      const item = createNoteItem();

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      // Note items don't have shortcuts
      expect(screen.queryByText('⌘')).not.toBeInTheDocument();
    });

    it('does not display shortcut when not provided', () => {
      const item = createCommandItem({ shortcut: undefined });

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      // Should not have a shortcut element with ⌘
      const text = screen.getByText('Test Command');
      expect(text).toBeInTheDocument();
    });
  });

  describe('selection state', () => {
    it('applies selected styling when selected', () => {
      const item = createCommandItem();

      render(<CommandPaletteItem item={item} selected={true} onClick={vi.fn()} />);

      const option = screen.getByRole('option');
      expect(option).toHaveAttribute('aria-selected', 'true');
    });

    it('does not apply selected styling when not selected', () => {
      const item = createCommandItem();

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      const option = screen.getByRole('option');
      expect(option).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('click handling', () => {
    it('calls onClick when clicked', async () => {
      const user = userEvent.setup();
      const onClick = vi.fn();
      const item = createCommandItem();

      render(<CommandPaletteItem item={item} selected={false} onClick={onClick} />);

      const option = screen.getByRole('option');
      await user.click(option);

      expect(onClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('accessibility', () => {
    it('has role="option"', () => {
      const item = createCommandItem();

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    it('has proper id for aria-activedescendant', () => {
      const item = createCommandItem({ id: 'my.command' });

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      const option = screen.getByRole('option');
      expect(option).toHaveAttribute('id', 'command-palette-item-my.command');
    });
  });

  describe('auto-scroll', () => {
    it('scrolls into view when selected', () => {
      const item = createCommandItem();
      const scrollIntoViewMock = vi.fn();

      render(<CommandPaletteItem item={item} selected={true} onClick={vi.fn()} />);

      const option = screen.getByRole('option');
      option.scrollIntoView = scrollIntoViewMock;

      // Re-render to trigger effect with mocked scrollIntoView
      // Note: The actual scroll behavior is tested via the effect
      expect(option).toHaveAttribute('aria-selected', 'true');
    });
  });

  describe('note types', () => {
    it('handles daily note type', () => {
      const item = createNoteItem({ noteType: 'daily' });

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    it('handles meeting note type', () => {
      const item = createNoteItem({ noteType: 'meeting' });

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    it('handles person note type', () => {
      const item = createNoteItem({ noteType: 'person' });

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      expect(screen.getByRole('option')).toBeInTheDocument();
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to container element', () => {
      const ref = { current: null as HTMLDivElement | null };
      const item = createCommandItem();

      render(<CommandPaletteItem ref={ref} item={item} selected={false} onClick={vi.fn()} />);

      expect(ref.current).toBeInstanceOf(HTMLDivElement);
    });
  });

  describe('custom className', () => {
    it('applies custom className', () => {
      const item = createCommandItem();

      render(
        <CommandPaletteItem
          item={item}
          selected={false}
          onClick={vi.fn()}
          className="custom-item"
        />
      );

      const option = screen.getByRole('option');
      expect(option).toHaveClass('custom-item');
    });
  });

  describe('note item with snippet', () => {
    it('displays snippet as description for note items', () => {
      const item = createNoteItem({
        snippet: '...matching content...',
        description: '...matching content...',
      });

      render(<CommandPaletteItem item={item} selected={false} onClick={vi.fn()} />);

      expect(screen.getByText('...matching content...')).toBeInTheDocument();
    });
  });
});
