/**
 * Tests for SlashMenu and PluginCommandItem components
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import {
  SlashMenu,
  getFilteredCommandCount,
  getCommandByIndex,
  type CoreSlashCommand,
} from './SlashMenu';
import { PluginCommandItem } from './PluginCommandItem';
import { SlashCommandProvider } from './SlashCommandContext';
import type { SlashCommandEntry } from '@scribe/plugin-core';
import type { LexicalEditor } from 'lexical';

// Mock scrollIntoView since it's not implemented in happy-dom
Element.prototype.scrollIntoView = vi.fn();

// Mock editor
const mockEditor = {
  update: vi.fn((fn) => fn()),
  getEditorState: vi.fn(),
  registerUpdateListener: vi.fn(),
} as unknown as LexicalEditor;

// Mock core commands
const mockCoreCommands: CoreSlashCommand[] = [
  {
    id: 'heading1',
    label: 'Heading 1',
    description: 'Big section heading',
    keywords: ['heading', 'h1'],
    section: 'formatting',
    execute: vi.fn(),
    icon: <span data-testid="icon-h1">H1</span>,
  },
  {
    id: 'bullet',
    label: 'Bullet List',
    description: 'Create a bulleted list',
    keywords: ['bullet', 'list'],
    section: 'formatting',
    execute: vi.fn(),
    icon: <span data-testid="icon-bullet">-</span>,
  },
  {
    id: 'ai-continue',
    label: 'Continue writing',
    description: 'AI continues your text',
    keywords: ['ai', 'continue'],
    section: 'ai',
    execute: vi.fn(),
    icon: <span data-testid="icon-ai">AI</span>,
  },
];

// Mock plugin commands
const mockPluginCommands: SlashCommandEntry[] = [
  {
    pluginId: '@scribe/plugin-mentions',
    command: 'mention',
    label: 'Mention Person',
    description: 'Insert a person mention',
    icon: 'user',
    handler: {
      execute: vi.fn(),
    },
  },
  {
    pluginId: '@scribe/plugin-calendar',
    command: 'event',
    label: 'Add Event',
    description: 'Create a calendar event',
    icon: 'calendar',
    handler: {
      execute: vi.fn(),
    },
  },
];

// Wrapper with SlashCommandProvider
function TestWrapper({ children }: { children: React.ReactNode }) {
  return (
    <SlashCommandProvider
      config={{
        editor: mockEditor,
        showToast: vi.fn(),
        closeMenu: vi.fn(),
        noteId: 'test-note-id',
      }}
    >
      {children}
    </SlashCommandProvider>
  );
}

describe('SlashMenu', () => {
  const defaultProps = {
    coreCommands: mockCoreCommands,
    pluginCommands: mockPluginCommands,
    position: { top: 100, left: 200 },
    selectedIndex: 0,
    query: '',
    onSelectCore: vi.fn(),
    onSelectPlugin: vi.fn(),
    onHover: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders with aria-label', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByLabelText('Slash commands')).toBeInTheDocument();
    });

    it('renders all core commands', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.getByText('Bullet List')).toBeInTheDocument();
      expect(screen.getByText('Continue writing')).toBeInTheDocument();
    });

    it('renders all plugin commands', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Mention Person')).toBeInTheDocument();
      expect(screen.getByText('Add Event')).toBeInTheDocument();
    });

    it('renders with position styles', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} position={{ top: 150, left: 250 }} />
        </TestWrapper>
      );

      const menu = screen.getByLabelText('Slash commands');
      expect(menu).toHaveStyle({ top: '150px', left: '250px' });
    });

    it('shows Plugins section label when plugin commands exist', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Plugins')).toBeInTheDocument();
    });

    it('shows AI section label for AI commands', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} />
        </TestWrapper>
      );

      // Look for the AI section label specifically - it appears multiple times
      // (in section label and in description), so we check all instances
      expect(screen.getAllByText(/AI/i).length).toBeGreaterThan(0);
    });

    it('shows loading indicator when plugins are loading', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} isLoadingPlugins={true} />
        </TestWrapper>
      );

      expect(screen.getByText('Loading plugins...')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty message when no commands match query', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} query="xyz123nonexistent" />
        </TestWrapper>
      );

      expect(screen.getByText('No matching commands')).toBeInTheDocument();
    });

    it('shows empty message when no commands provided', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} coreCommands={[]} pluginCommands={[]} />
        </TestWrapper>
      );

      expect(screen.getByText('No matching commands')).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    it('filters commands by label', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} query="heading" />
        </TestWrapper>
      );

      expect(screen.getByText('Heading 1')).toBeInTheDocument();
      expect(screen.queryByText('Bullet List')).not.toBeInTheDocument();
    });

    it('filters commands by description', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} query="bulleted" />
        </TestWrapper>
      );

      expect(screen.getByText('Bullet List')).toBeInTheDocument();
      expect(screen.queryByText('Heading 1')).not.toBeInTheDocument();
    });

    it('filters commands by keywords', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} query="h1" />
        </TestWrapper>
      );

      expect(screen.getByText('Heading 1')).toBeInTheDocument();
    });

    it('filters plugin commands by label', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} query="mention" />
        </TestWrapper>
      );

      expect(screen.getByText('Mention Person')).toBeInTheDocument();
      expect(screen.queryByText('Add Event')).not.toBeInTheDocument();
    });

    it('filters plugin commands by command name', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} query="event" />
        </TestWrapper>
      );

      expect(screen.getByText('Add Event')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('marks first command as selected when selectedIndex is 0', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} selectedIndex={0} />
        </TestWrapper>
      );

      const options = screen.getAllByRole('option');
      expect(options[0]).toHaveAttribute('aria-selected', 'true');
      expect(options[1]).toHaveAttribute('aria-selected', 'false');
    });

    it('marks correct command as selected for any index', () => {
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} selectedIndex={3} />
        </TestWrapper>
      );

      const options = screen.getAllByRole('option');
      expect(options[3]).toHaveAttribute('aria-selected', 'true');
      expect(options[0]).toHaveAttribute('aria-selected', 'false');
    });

    it('can select plugin commands by index', () => {
      // Plugin commands start after core commands (3 core commands)
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} selectedIndex={3} />
        </TestWrapper>
      );

      // The 4th item (index 3) is the first plugin command
      const options = screen.getAllByRole('option');
      expect(options[3]).toHaveAttribute('aria-selected', 'true');
      expect(options[3]).toHaveTextContent('Mention Person');
    });
  });

  describe('interactions', () => {
    it('calls onSelectCore when core command is clicked', () => {
      const onSelectCore = vi.fn();
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} onSelectCore={onSelectCore} />
        </TestWrapper>
      );

      fireEvent.click(screen.getByText('Heading 1'));

      expect(onSelectCore).toHaveBeenCalledTimes(1);
      expect(onSelectCore).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'heading1',
          label: 'Heading 1',
        })
      );
    });

    it('calls onHover with correct index on mouseEnter', () => {
      const onHover = vi.fn();
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} onHover={onHover} />
        </TestWrapper>
      );

      const options = screen.getAllByRole('option');
      fireEvent.mouseEnter(options[1]);

      expect(onHover).toHaveBeenCalledWith(1);
    });

    it('calls onHover with plugin command index', () => {
      const onHover = vi.fn();
      render(
        <TestWrapper>
          <SlashMenu {...defaultProps} onHover={onHover} />
        </TestWrapper>
      );

      // Hover over first plugin command (index 3)
      fireEvent.mouseEnter(screen.getByText('Mention Person').closest('[role="option"]')!);

      expect(onHover).toHaveBeenCalledWith(3);
    });
  });
});

describe('PluginCommandItem', () => {
  const mockCommand: SlashCommandEntry = {
    pluginId: '@scribe/plugin-mentions',
    command: 'mention',
    label: 'Mention Person',
    description: 'Insert a person mention',
    icon: 'user',
    handler: {
      execute: vi.fn(),
    },
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
      render(
        <TestWrapper>
          <PluginCommandItem {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByText('Mention Person')).toBeInTheDocument();
      expect(screen.getByText('Insert a person mention')).toBeInTheDocument();
    });

    it('renders with role="option"', () => {
      render(
        <TestWrapper>
          <PluginCommandItem {...defaultProps} />
        </TestWrapper>
      );

      expect(screen.getByRole('option')).toBeInTheDocument();
    });

    it('sets aria-selected based on isSelected prop', () => {
      const { rerender } = render(
        <TestWrapper>
          <PluginCommandItem {...defaultProps} isSelected={false} />
        </TestWrapper>
      );

      expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'false');

      rerender(
        <TestWrapper>
          <PluginCommandItem {...defaultProps} isSelected={true} />
        </TestWrapper>
      );

      expect(screen.getByRole('option')).toHaveAttribute('aria-selected', 'true');
    });

    it('renders icon based on icon name', () => {
      render(
        <TestWrapper>
          <PluginCommandItem {...defaultProps} />
        </TestWrapper>
      );

      const option = screen.getByRole('option');
      expect(option.querySelector('svg')).toBeInTheDocument();
    });
  });

  describe('interactions', () => {
    it('calls handler and onClick when clicked', async () => {
      const handler = { execute: vi.fn().mockResolvedValue(undefined) };
      const onClick = vi.fn();

      render(
        <TestWrapper>
          <PluginCommandItem
            {...defaultProps}
            command={{ ...mockCommand, handler }}
            onClick={onClick}
          />
        </TestWrapper>
      );

      fireEvent.click(screen.getByRole('option'));

      // Wait for async execution
      await vi.waitFor(() => {
        expect(handler.execute).toHaveBeenCalled();
      });
    });

    it('calls onMouseEnter when hovered', () => {
      const onMouseEnter = vi.fn();
      render(
        <TestWrapper>
          <PluginCommandItem {...defaultProps} onMouseEnter={onMouseEnter} />
        </TestWrapper>
      );

      fireEvent.mouseEnter(screen.getByRole('option'));

      expect(onMouseEnter).toHaveBeenCalledTimes(1);
    });

    it('prevents default on mousedown to keep editor focus', () => {
      render(
        <TestWrapper>
          <PluginCommandItem {...defaultProps} />
        </TestWrapper>
      );

      const option = screen.getByRole('option');
      const mouseDownEvent = new MouseEvent('mousedown', { bubbles: true });
      const preventDefaultSpy = vi.spyOn(mouseDownEvent, 'preventDefault');

      option.dispatchEvent(mouseDownEvent);

      expect(preventDefaultSpy).toHaveBeenCalled();
    });

    it('scrolls into view when selected', () => {
      const { rerender } = render(
        <TestWrapper>
          <PluginCommandItem {...defaultProps} isSelected={false} />
        </TestWrapper>
      );

      expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();

      rerender(
        <TestWrapper>
          <PluginCommandItem {...defaultProps} isSelected={true} />
        </TestWrapper>
      );

      expect(Element.prototype.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest' });
    });
  });

  describe('error handling', () => {
    it('shows toast on handler error', async () => {
      const showToast = vi.fn();
      const handler = { execute: vi.fn().mockRejectedValue(new Error('Test error')) };

      render(
        <SlashCommandProvider
          config={{
            editor: mockEditor,
            showToast,
            closeMenu: vi.fn(),
            noteId: 'test-note-id',
          }}
        >
          <PluginCommandItem {...defaultProps} command={{ ...mockCommand, handler }} />
        </SlashCommandProvider>
      );

      fireEvent.click(screen.getByRole('option'));

      await vi.waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Command failed: Test error', 'error');
      });
    });

    it('shows toast when command has no handler', async () => {
      const showToast = vi.fn();

      render(
        <SlashCommandProvider
          config={{
            editor: mockEditor,
            showToast,
            closeMenu: vi.fn(),
            noteId: 'test-note-id',
          }}
        >
          <PluginCommandItem {...defaultProps} command={{ ...mockCommand, handler: undefined }} />
        </SlashCommandProvider>
      );

      fireEvent.click(screen.getByRole('option'));

      await vi.waitFor(() => {
        expect(showToast).toHaveBeenCalledWith('Command "mention" has no handler', 'error');
      });
    });
  });
});

describe('helper functions', () => {
  describe('getFilteredCommandCount', () => {
    it('returns total count with no query', () => {
      const count = getFilteredCommandCount(mockCoreCommands, mockPluginCommands, '');
      expect(count).toBe(5); // 3 core + 2 plugin
    });

    it('returns filtered count with query', () => {
      const count = getFilteredCommandCount(mockCoreCommands, mockPluginCommands, 'heading');
      expect(count).toBe(1);
    });

    it('returns 0 when no matches', () => {
      const count = getFilteredCommandCount(mockCoreCommands, mockPluginCommands, 'xyz123');
      expect(count).toBe(0);
    });
  });

  describe('getCommandByIndex', () => {
    it('returns core command for valid index', () => {
      const result = getCommandByIndex(mockCoreCommands, mockPluginCommands, '', 0);
      expect(result).toEqual({ type: 'core', command: mockCoreCommands[0] });
    });

    it('returns plugin command for index after core commands', () => {
      const result = getCommandByIndex(mockCoreCommands, mockPluginCommands, '', 3);
      expect(result).toEqual({ type: 'plugin', command: mockPluginCommands[0] });
    });

    it('returns null for out of bounds index', () => {
      const result = getCommandByIndex(mockCoreCommands, mockPluginCommands, '', 100);
      expect(result).toBeNull();
    });

    it('handles filtered results', () => {
      const result = getCommandByIndex(mockCoreCommands, mockPluginCommands, 'mention', 0);
      expect(result).toEqual({ type: 'plugin', command: mockPluginCommands[0] });
    });
  });
});
