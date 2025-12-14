/**
 * Sidebar and HistoryListItem Component Tests
 */

import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createNoteId } from '@scribe/shared';
import { Sidebar, SIDEBAR_DEFAULT_WIDTH, SIDEBAR_MIN_WIDTH, SIDEBAR_MAX_WIDTH } from './Sidebar';
import { HistoryListItem } from './HistoryListItem';
import * as historyListItemStyles from './HistoryListItem.css';
import * as sidebarStyles from './Sidebar.css';
import type { HistoryEntry, SidebarProps } from './Sidebar';

// Mock the useUpdateStatus hook used by VersionIndicator
vi.mock('../../hooks/useUpdateStatus', () => ({
  useUpdateStatus: vi.fn(() => ({
    status: 'idle',
    version: undefined,
    error: undefined,
    dismissed: false,
    hasUpdate: false,
    installUpdate: vi.fn(),
    dismiss: vi.fn(),
  })),
}));

// Mock __APP_VERSION__ global used by VersionIndicator
vi.stubGlobal('__APP_VERSION__', '1.0.0');

// Helper to create default Sidebar props
function createSidebarProps(overrides?: Partial<SidebarProps>): SidebarProps {
  return {
    isOpen: true,
    historyEntries: [],
    currentHistoryIndex: 0,
    onSelectHistoryEntry: vi.fn(),
    onClearHistory: vi.fn(),
    onThemeToggle: vi.fn(),
    currentTheme: 'light',
    onClose: vi.fn(),
    onOpenSearch: vi.fn(),
    canGoBack: false,
    canGoForward: false,
    onBack: vi.fn(),
    onForward: vi.fn(),
    ...overrides,
  };
}

// Sample history entries for tests
const sampleHistoryEntries: HistoryEntry[] = [
  { id: createNoteId('note-1'), title: 'First Note' },
  { id: createNoteId('note-2'), title: 'Second Note' },
  { id: createNoteId('note-3'), title: 'Third Note' },
];

describe('Sidebar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('open/close toggle', () => {
    it('renders with open state classes when isOpen is true', () => {
      const { container } = render(<Sidebar {...createSidebarProps({ isOpen: true })} />);
      const aside = container.querySelector('aside');
      expect(aside).toBeInTheDocument();
      // When open, the sidebar should have the open class
      expect(aside?.className).toContain(sidebarStyles.sidebarOpen);
    });

    it('renders with closed state classes when isOpen is false', () => {
      const { container } = render(<Sidebar {...createSidebarProps({ isOpen: false })} />);
      const aside = container.querySelector('aside');
      expect(aside).toBeInTheDocument();
      expect(aside?.className).toContain(sidebarStyles.sidebarClosed);
    });

    it('does not show resize handle when sidebar is closed', () => {
      const onWidthChange = vi.fn();
      render(
        <Sidebar
          {...createSidebarProps({
            isOpen: false,
            onWidthChange,
          })}
        />
      );
      // ResizeHandle shouldn't render when closed
      const resizeHandle = document.querySelector('[class*="resizeHandle"]');
      expect(resizeHandle).not.toBeInTheDocument();
    });

    it('shows resize handle when sidebar is open and onWidthChange is provided', () => {
      const onWidthChange = vi.fn();
      render(
        <Sidebar
          {...createSidebarProps({
            isOpen: true,
            onWidthChange,
          })}
        />
      );
      const resizeHandle = document.querySelector('[class*="resizeHandle"]');
      expect(resizeHandle).toBeInTheDocument();
    });

    it('does not show resize handle when onWidthChange is not provided', () => {
      render(
        <Sidebar
          {...createSidebarProps({
            isOpen: true,
            onWidthChange: undefined,
          })}
        />
      );
      const resizeHandle = document.querySelector('[class*="resizeHandle"]');
      expect(resizeHandle).not.toBeInTheDocument();
    });
  });

  describe('empty state rendering', () => {
    it('displays empty state message when no history entries', () => {
      render(<Sidebar {...createSidebarProps({ historyEntries: [] })} />);

      expect(screen.getByText('No history yet')).toBeInTheDocument();
      expect(screen.getByText('Navigate between notes to build your history')).toBeInTheDocument();
    });

    it('does not display clear history button when history is empty', () => {
      render(<Sidebar {...createSidebarProps({ historyEntries: [] })} />);

      expect(screen.queryByText('Clear History')).not.toBeInTheDocument();
    });
  });

  describe('history list rendering', () => {
    it('renders all history entries', () => {
      render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: sampleHistoryEntries,
            currentHistoryIndex: 0,
          })}
        />
      );

      expect(screen.getByText('First Note')).toBeInTheDocument();
      expect(screen.getByText('Second Note')).toBeInTheDocument();
      expect(screen.getByText('Third Note')).toBeInTheDocument();
    });

    it('displays entries in reverse order (most recent at top)', () => {
      const { container } = render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: sampleHistoryEntries,
            currentHistoryIndex: 0,
          })}
        />
      );

      // Get all history item titles
      const items = container.querySelectorAll('[class*="historyItem"]');
      expect(items).toHaveLength(3);

      // Most recent (Third Note) should be at top (first in DOM)
      expect(items[0]).toHaveTextContent('Third Note');
      expect(items[1]).toHaveTextContent('Second Note');
      expect(items[2]).toHaveTextContent('First Note');
    });

    it('displays Clear History button when history has entries', () => {
      render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: sampleHistoryEntries,
          })}
        />
      );

      expect(screen.getByText('Clear History')).toBeInTheDocument();
    });

    it('displays position indicators for history entries', () => {
      render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: sampleHistoryEntries,
            currentHistoryIndex: 1,
          })}
        />
      );

      // Position numbers should be 1-indexed
      expect(screen.getByText('1')).toBeInTheDocument();
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('3')).toBeInTheDocument();
    });

    it('handles entries without titles by showing "Untitled"', () => {
      const entriesWithUntitled: HistoryEntry[] = [
        { id: createNoteId('note-1'), title: undefined },
        { id: createNoteId('note-2'), title: '' },
      ];

      render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: entriesWithUntitled,
            currentHistoryIndex: 0,
          })}
        />
      );

      // Should show "Untitled" for entries without titles
      const untitledElements = screen.getAllByText('Untitled');
      expect(untitledElements.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe('note selection from history', () => {
    it('calls onSelectHistoryEntry with correct index when entry is clicked', () => {
      const onSelectHistoryEntry = vi.fn();

      render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: sampleHistoryEntries,
            currentHistoryIndex: 0,
            onSelectHistoryEntry,
          })}
        />
      );

      // Click on "Second Note" - it's at original index 1
      fireEvent.click(screen.getByText('Second Note'));

      expect(onSelectHistoryEntry).toHaveBeenCalledWith(1);
    });

    it('calls onSelectHistoryEntry with first entry index', () => {
      const onSelectHistoryEntry = vi.fn();

      render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: sampleHistoryEntries,
            currentHistoryIndex: 2,
            onSelectHistoryEntry,
          })}
        />
      );

      // Click on "First Note" - it's at original index 0
      fireEvent.click(screen.getByText('First Note'));

      expect(onSelectHistoryEntry).toHaveBeenCalledWith(0);
    });

    it('calls onSelectHistoryEntry with last entry index', () => {
      const onSelectHistoryEntry = vi.fn();

      render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: sampleHistoryEntries,
            currentHistoryIndex: 0,
            onSelectHistoryEntry,
          })}
        />
      );

      // Click on "Third Note" - it's at original index 2
      fireEvent.click(screen.getByText('Third Note'));

      expect(onSelectHistoryEntry).toHaveBeenCalledWith(2);
    });
  });

  describe('clear history', () => {
    it('calls onClearHistory when clear button is clicked', () => {
      const onClearHistory = vi.fn();

      render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: sampleHistoryEntries,
            onClearHistory,
          })}
        />
      );

      fireEvent.click(screen.getByText('Clear History'));

      expect(onClearHistory).toHaveBeenCalledTimes(1);
    });
  });

  describe('theme toggle', () => {
    it('displays sun icon in dark mode', () => {
      render(
        <Sidebar
          {...createSidebarProps({
            currentTheme: 'dark',
          })}
        />
      );

      // In dark mode, button should offer to switch to light mode
      const themeButton = screen.getByTitle('Switch to Light Mode');
      expect(themeButton).toBeInTheDocument();
    });

    it('displays moon icon in light mode', () => {
      render(
        <Sidebar
          {...createSidebarProps({
            currentTheme: 'light',
          })}
        />
      );

      // In light mode, button should offer to switch to dark mode
      const themeButton = screen.getByTitle('Switch to Dark Mode');
      expect(themeButton).toBeInTheDocument();
    });

    it('calls onThemeToggle when theme button is clicked', () => {
      const onThemeToggle = vi.fn();

      render(
        <Sidebar
          {...createSidebarProps({
            currentTheme: 'light',
            onThemeToggle,
          })}
        />
      );

      const themeButton = screen.getByTitle('Switch to Dark Mode');
      fireEvent.click(themeButton);

      expect(onThemeToggle).toHaveBeenCalledTimes(1);
    });
  });

  describe('resize handle behavior', () => {
    it('calls onWidthChange with clamped width when resizing', () => {
      const onWidthChange = vi.fn();
      const initialWidth = 280;

      render(
        <Sidebar
          {...createSidebarProps({
            isOpen: true,
            width: initialWidth,
            onWidthChange,
          })}
        />
      );

      const resizeHandle = document.querySelector('[class*="resizeHandle"]');
      expect(resizeHandle).toBeInTheDocument();

      // Start dragging
      fireEvent.mouseDown(resizeHandle!, { clientX: 280 });

      // Move mouse (drag)
      fireEvent.mouseMove(document, { clientX: 300 });

      // The width change should be the delta (300 - 280 = 20)
      expect(onWidthChange).toHaveBeenCalledWith(300);
    });

    it('respects minimum width constraint', () => {
      const onWidthChange = vi.fn();

      render(
        <Sidebar
          {...createSidebarProps({
            isOpen: true,
            width: SIDEBAR_MIN_WIDTH,
            onWidthChange,
          })}
        />
      );

      const resizeHandle = document.querySelector('[class*="resizeHandle"]');

      // Start dragging
      fireEvent.mouseDown(resizeHandle!, { clientX: 200 });

      // Move mouse to try to make it smaller than min
      fireEvent.mouseMove(document, { clientX: 100 });

      // Width should be clamped to min
      expect(onWidthChange).toHaveBeenCalledWith(SIDEBAR_MIN_WIDTH);
    });

    it('respects maximum width constraint', () => {
      const onWidthChange = vi.fn();

      render(
        <Sidebar
          {...createSidebarProps({
            isOpen: true,
            width: SIDEBAR_MAX_WIDTH,
            onWidthChange,
          })}
        />
      );

      const resizeHandle = document.querySelector('[class*="resizeHandle"]');

      // Start dragging
      fireEvent.mouseDown(resizeHandle!, { clientX: 400 });

      // Move mouse to try to make it larger than max
      fireEvent.mouseMove(document, { clientX: 500 });

      // Width should be clamped to max
      expect(onWidthChange).toHaveBeenCalledWith(SIDEBAR_MAX_WIDTH);
    });

    it('uses default width when width prop is not provided', () => {
      const { container } = render(<Sidebar {...createSidebarProps({ isOpen: true })} />);

      const aside = container.querySelector('aside');
      // The sidebar should use default width (280px) in its inline style
      expect(aside).toBeInTheDocument();
      // When open, the inline style should contain the default width value
      // The CSS variable name is generated by vanilla-extract, so we check the style attribute directly
      const styleAttr = aside?.getAttribute('style') || '';
      expect(styleAttr).toContain(`${SIDEBAR_DEFAULT_WIDTH}px`);
    });
  });

  describe('header and branding', () => {
    it('displays Scribe branding', () => {
      render(<Sidebar {...createSidebarProps()} />);

      expect(screen.getByText('Scribe')).toBeInTheDocument();
      expect(screen.getByText('HISTORY')).toBeInTheDocument();
    });

    it('displays Guest User in footer', () => {
      render(<Sidebar {...createSidebarProps()} />);

      expect(screen.getByText('Guest User')).toBeInTheDocument();
    });
  });

  describe('current history position', () => {
    it('highlights the current history entry', () => {
      const { container } = render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: sampleHistoryEntries,
            currentHistoryIndex: 1, // Second Note is current
          })}
        />
      );

      // The items are displayed in reverse order, so index 1 in data is at position 1 in display
      // (Third Note at 0, Second Note at 1, First Note at 2)
      const items = container.querySelectorAll('[class*="historyItem"]');
      // Second Note (originalIndex=1) should have the active class - displayed at position 1
      expect(items[1]?.className).toContain(historyListItemStyles.historyItemActive);
    });

    it('displays "Current" label on the current entry', () => {
      render(
        <Sidebar
          {...createSidebarProps({
            historyEntries: sampleHistoryEntries,
            currentHistoryIndex: 1,
          })}
        />
      );

      // Should have exactly one "Current" label
      expect(screen.getByText('Current')).toBeInTheDocument();
    });
  });
});

describe('HistoryListItem', () => {
  describe('rendering', () => {
    it('displays the title', () => {
      render(
        <HistoryListItem title="Test Note" position={1} isCurrent={false} onSelect={vi.fn()} />
      );

      expect(screen.getByText('Test Note')).toBeInTheDocument();
    });

    it('displays the position number', () => {
      render(
        <HistoryListItem title="Test Note" position={5} isCurrent={false} onSelect={vi.fn()} />
      );

      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('displays "Untitled" for empty title', () => {
      render(<HistoryListItem title="" position={1} isCurrent={false} onSelect={vi.fn()} />);

      expect(screen.getByText('Untitled')).toBeInTheDocument();
    });

    it('displays "Current" subtitle when isCurrent is true', () => {
      render(
        <HistoryListItem title="Test Note" position={1} isCurrent={true} onSelect={vi.fn()} />
      );

      expect(screen.getByText('Current')).toBeInTheDocument();
    });

    it('does not display "Current" subtitle when isCurrent is false', () => {
      render(
        <HistoryListItem title="Test Note" position={1} isCurrent={false} onSelect={vi.fn()} />
      );

      expect(screen.queryByText('Current')).not.toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onSelect when clicked', () => {
      const onSelect = vi.fn();

      render(
        <HistoryListItem title="Test Note" position={1} isCurrent={false} onSelect={onSelect} />
      );

      fireEvent.click(screen.getByText('Test Note'));

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('has role="button" for accessibility', () => {
      render(
        <HistoryListItem title="Test Note" position={1} isCurrent={false} onSelect={vi.fn()} />
      );

      expect(screen.getByRole('button')).toBeInTheDocument();
    });

    it('is focusable via tabIndex', () => {
      render(
        <HistoryListItem title="Test Note" position={1} isCurrent={false} onSelect={vi.fn()} />
      );

      const item = screen.getByRole('button');
      expect(item).toHaveAttribute('tabIndex', '0');
    });
  });

  describe('keyboard navigation', () => {
    it('calls onSelect when Enter key is pressed', () => {
      const onSelect = vi.fn();

      render(
        <HistoryListItem title="Test Note" position={1} isCurrent={false} onSelect={onSelect} />
      );

      const item = screen.getByRole('button');
      fireEvent.keyDown(item, { key: 'Enter' });

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('calls onSelect when Space key is pressed', () => {
      const onSelect = vi.fn();

      render(
        <HistoryListItem title="Test Note" position={1} isCurrent={false} onSelect={onSelect} />
      );

      const item = screen.getByRole('button');
      fireEvent.keyDown(item, { key: ' ' });

      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it('does not call onSelect for other keys', () => {
      const onSelect = vi.fn();

      render(
        <HistoryListItem title="Test Note" position={1} isCurrent={false} onSelect={onSelect} />
      );

      const item = screen.getByRole('button');
      fireEvent.keyDown(item, { key: 'Tab' });
      fireEvent.keyDown(item, { key: 'Escape' });
      fireEvent.keyDown(item, { key: 'a' });

      expect(onSelect).not.toHaveBeenCalled();
    });
  });

  describe('styling', () => {
    it('applies active styling when isCurrent is true', () => {
      const { container } = render(
        <HistoryListItem title="Test Note" position={1} isCurrent={true} onSelect={vi.fn()} />
      );

      const item = container.firstChild as HTMLElement;
      expect(item.className).toContain(historyListItemStyles.historyItemActive);
    });

    it('applies inactive styling when isCurrent is false', () => {
      const { container } = render(
        <HistoryListItem title="Test Note" position={1} isCurrent={false} onSelect={vi.fn()} />
      );

      const item = container.firstChild as HTMLElement;
      expect(item.className).toContain(historyListItemStyles.historyItemInactive);
    });

    it('applies current styling to position indicator when isCurrent is true', () => {
      const { container } = render(
        <HistoryListItem title="Test Note" position={1} isCurrent={true} onSelect={vi.fn()} />
      );

      const indicator = container.querySelector('[class*="positionIndicator"]');
      expect(indicator?.className).toContain(historyListItemStyles.positionIndicatorCurrent);
    });
  });
});
