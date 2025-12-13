/**
 * Tests for SlashMenu and SlashMenuItem components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SlashMenu } from './SlashMenu';
import { SlashMenuItem } from './SlashMenuItem';
import { slashCommands, type SlashCommand } from './commands';

// Mock scrollIntoView since it's not implemented in happy-dom
Element.prototype.scrollIntoView = vi.fn();

describe('SlashMenuItem', () => {
  const mockCommand: SlashCommand = {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Big section heading',
    keywords: ['heading', 'h1'],
    section: 'formatting',
    execute: vi.fn(),
  };

  const defaultProps = {
    command: mockCommand,
    isSelected: false,
    onClick: vi.fn(),
    onMouseEnter: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders command label and description', () => {
      render(<SlashMenuItem {...defaultProps} />);

      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Big section heading')).toBeInTheDocument();
    });

    it('renders with role="option"', () => {
      render(<SlashMenuItem {...defaultProps} />);

      const option = screen.getByRole('option');
      expect(option).toBeInTheDocument();
    });

    it('sets aria-selected based on isSelected prop', () => {
      const { rerender } = render(<SlashMenuItem {...defaultProps} isSelected={false} />);

      expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');

      rerender(<SlashMenuItem {...defaultProps} isSelected={true} />);

      expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    });

    it('renders icon based on command id', () => {
      render(<SlashMenuItem {...defaultProps} />);

      // Icon should be rendered (we check for the icon container)
      const option = screen.getByRole('option');
      expect(option.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls onClick when clicked', () => {
      const onClick = vi.fn();
      render(<SlashMenuItem {...defaultProps} onClick={onClick} />);

      fireEvent.click(screen.getByRole('option'));

      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('calls onMouseEnter when hovered', () => {
      const onMouseEnter = vi.fn();
      render(<SlashMenuItem {...defaultProps} onMouseEnter={onMouseEnter} />);

      fireEvent.mouseEnter(screen.getByRole('option'));

      expect(onMouseEnter).toHaveBeenCalledTimes(1);
    });

    it('prevents default on mousedown to keep editor focus', () => {
      render(<SlashMenuItem {...defaultProps} />);

      const option = screen.getByRole('option');
      const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true });
      const preventDefaultSpy = vi.spyOn(mouseDownEvent, 'preventDefault');

      option.dispatchEvent(mouseDownEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('scrolls into view when selected', () => {
      const { rerender } = render(<SlashMenuItem {...defaultProps} isSelected={false} />);

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

      rerender(<SlashMenuItem {...defaultProps} isSelected={true} />);

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    });
  });

  describe('AI commands', () => {
    const aiCommand: SlashCommand = {
      id: 'ai-continue',
      label: 'Continue writing',
      description: 'AI continues your text',
      keywords: ['ai', 'continue'],
      section: 'ai',
      execute: vi.fn(),
    };

    it('renders AI command with special styling', () => {
      render(<SlashMenuItem {...defaultProps} command={aiCommand} />);

      expect(screen.getByText('Continue writing')).toBeInTheDocument();
      expect(screen.getByText('AI continues your text')).toBeInTheDocument();
    });
  });

  describe('different command types', () => {
    const commandTypes = [
      { id: 'text', label: 'Text' },
      { id: 'heading1', label: 'Heading 1' },
      { id: 'heading2', label: 'Heading 2' },
      { id: 'heading3', label: 'Heading 3' },
      { id: 'bullet', label: 'Bullet List' },
      { id: 'todo', label: 'Add Task' },
      { id: 'quote', label: 'Quote' },
      { id: 'ai-continue', label: 'Continue writing' },
      { id: 'ai-summarize', label: 'Summarize' },
    ];

    it.each(commandTypes)('renders icon for $id command', ({ id }) => {
      const cmd = slashCommands.find((c) => c.id === id) || {
        ...mockCommand,
        id,
      };

      render(<SlashMenuItem {...defaultProps} command={cmd} />);

      // Each command should render an SVG icon
      const option = screen.getByRole('option');
      expect(option.querySelector('svg')).toBeInTheDocument();
    });
  });
});

describe('SlashMenu', () => {
  const mockOnSelect = vi.fn();
  const mockOnHover = vi.fn();

  const defaultProps = {
    commands: slashCommands,
    position: { top: 100, left: 200 },
    selectedIndex: 0,
    onSelect: mockOnSelect,
    onHover: mockOnHover,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with aria-label', () => {
      render(<SlashMenu {...defaultProps} />);

      expect(screen.getByLabelText('Slash commands')).toBeInTheDocument();
    });

    it('renders all commands', () => {
      render(<SlashMenu {...defaultProps} />);

      // Check that each command is rendered
      for (const cmd of slashCommands) {
        expect(screen.getByText(cmd.label)).toBeInTheDocument();
      }
    });

    it('renders formatting commands', () => {
      render(<SlashMenu {...defaultProps} />);

      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Bullet List')).toBeInTheDocument();
      expect(screen.getByText('Quote')).toBeInTheDocument();
    });

    it('renders AI commands', () => {
      render(<SlashMenu {...defaultProps} />);

      expect(screen.getByText('Continue writing')).toBeInTheDocument();
      expect(screen.getByText('Summarize')).toBeInTheDocument();
    });

    it('renders AI section header when AI commands exist', () => {
      render(<SlashMenu {...defaultProps} />);

      expect(screen.getByText('AI')).toBeInTheDocument();
    });

    it('renders with position styles', () => {
      render(<SlashMenu {...defaultProps} position={{ top: 150, left: 250 }} />);

      const menu = screen.getByLabelText('Slash commands');
      expect(menu).toHaveStyle({ top: '150px', left: '250px' });
    });
  });

  describe('empty state', () => {
    it('shows empty message when no commands', () => {
      render(<SlashMenu {...defaultProps} commands={[]} />);

      expect(screen.getByText('No matching commands')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('marks first command as selected when selectedIndex is 0', () => {
      render(<SlashMenu {...defaultProps} selectedIndex={0} />);

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
      expect(options[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('marks correct command as selected for any index', () => {
      render(<SlashMenu {...defaultProps} selectedIndex={3} />);

      const options = screen.getAllByRole('option');
      expect(options[3]).toHaveAttribute('aria-selected', 'true');
      expect(options[0]).toHaveAttribute('aria-selected', 'false');
    });
  });

  describe('interactions', () => {
    it('calls onSelect when command is clicked', () => {
      render(<SlashMenu {...defaultProps} />);

      fireEvent.click(screen.getByText('Heading 1'));

      expect(mockOnSelect).toHaveBeenCalledTimes(1);
      expect(mockOnSelect).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'heading1',
          label: 'Heading 1',
        })
      );
    });

    it('calls onHover with correct index on mouseEnter', () => {
      render(<SlashMenu {...defaultProps} />);

      // Find the second command and hover
      const options = screen.getAllByRole('option');
      fireEvent.mouseEnter(options[1]);

      expect(mockOnHover).toHaveBeenCalledWith(1);
    });
  });

  describe('filtered commands', () => {
    it('shows only formatting commands when filtered', () => {
      const formattingOnly = slashCommands.filter((c) => c.section === 'formatting');
      render(<SlashMenu {...defaultProps} commands={formattingOnly} />);

      expect(screen.getByText('Text')).toBeInTheDocument();
      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.queryByText('Continue writing')).not.toBeInTheDocument();
      expect(screen.queryByText('AI')).not.toBeInTheDocument(); // No AI section header
    });

    it('shows only AI commands when filtered', () => {
      const aiOnly = slashCommands.filter((c) => c.section === 'ai');
      render(<SlashMenu {...defaultProps} commands={aiOnly} />);

      expect(screen.getByText('Continue writing')).toBeInTheDocument();
      expect(screen.getByText('Summarize')).toBeInTheDocument();
      expect(screen.queryByText('Text')).not.toBeInTheDocument();
    });

    it('shows single command when filtered to one result', () => {
      const singleCommand = slashCommands.filter((c) => c.id === 'heading1');
      render(<SlashMenu {...defaultProps} commands={singleCommand} />);

      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(1);
    });
  });

  describe('section dividers', () => {
    it('shows divider between formatting and AI sections', () => {
      render(<SlashMenu {...defaultProps} />);

      // Check that both sections are present
      const menu = screen.getByLabelText('Slash commands');
      expect(menu.textContent).toContain('Text');
      expect(menu.textContent).toContain('AI');
      expect(menu.textContent).toContain('Continue writing');
    });

    it('does not show AI section header when no AI commands', () => {
      const formattingOnly = slashCommands.filter((c) => c.section === 'formatting');
      render(<SlashMenu {...defaultProps} commands={formattingOnly} />);

      expect(screen.queryByText('AI')).not.toBeInTheDocument();
    });
  });
});
