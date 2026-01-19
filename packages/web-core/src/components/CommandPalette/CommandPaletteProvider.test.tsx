/**
 * CommandPaletteProvider Tests
 *
 * Tests for the command palette provider, state management, and hook.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CommandPaletteProvider, useCommandPalette } from './CommandPaletteProvider';
import type { CommandItem } from './types';

// Mock the hooks that depend on tRPC
vi.mock('./useRecentNotes', () => ({
  useRecentNotes: vi.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
  })),
}));

vi.mock('./useNoteSearch', () => ({
  useNoteSearch: vi.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
  })),
}));

// Mock the ScribeProvider's useTrpc hook
vi.mock('../../providers/ScribeProvider', () => ({
  useTrpc: vi.fn(() => ({
    notes: {
      create: {
        mutate: vi.fn().mockResolvedValue({ id: 'mock-note-id' }),
      },
    },
  })),
}));

// Wrapper component with router context
function TestWrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <CommandPaletteProvider>{children}</CommandPaletteProvider>
    </MemoryRouter>
  );
}

function createWrapper(props: Partial<React.ComponentProps<typeof CommandPaletteProvider>> = {}) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return (
      <MemoryRouter>
        <CommandPaletteProvider {...props}>{children}</CommandPaletteProvider>
      </MemoryRouter>
    );
  };
}

// Helper to create mock commands
function createMockCommand(overrides: Partial<CommandItem> = {}): CommandItem {
  return {
    type: 'command',
    id: 'test.command',
    label: 'Test Command',
    description: 'A test command',
    icon: 'Test',
    category: 'General',
    priority: 100,
    handler: { execute: vi.fn() },
    ...overrides,
  };
}

describe('CommandPaletteProvider', () => {
  describe('rendering', () => {
    it('renders children', () => {
      render(
        <TestWrapper>
          <div data-testid="child">Test Child</div>
        </TestWrapper>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('provides context value', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      expect(result.current).toHaveProperty('isOpen');
      expect(result.current).toHaveProperty('view');
      expect(result.current).toHaveProperty('query');
      expect(result.current).toHaveProperty('selectedIndex');
      expect(result.current).toHaveProperty('sections');
      expect(result.current).toHaveProperty('open');
      expect(result.current).toHaveProperty('close');
      expect(result.current).toHaveProperty('toggle');
      expect(result.current).toHaveProperty('setQuery');
      expect(result.current).toHaveProperty('selectNext');
      expect(result.current).toHaveProperty('selectPrevious');
      expect(result.current).toHaveProperty('executeSelected');
    });
  });

  describe('initial state', () => {
    it('starts closed', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      expect(result.current.isOpen).toBe(false);
    });

    it('starts in command view', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      expect(result.current.view).toBe('command');
    });

    it('starts with empty query', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      expect(result.current.query).toBe('');
    });

    it('starts with selectedIndex at 0', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('open action', () => {
    it('opens the palette', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('opens with default command view', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
      });

      expect(result.current.view).toBe('command');
    });

    it('opens with specified view', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open('note-search');
      });

      expect(result.current.view).toBe('note-search');
    });

    it('resets query when opening', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
        result.current.setQuery('test');
        result.current.close();
        result.current.open();
      });

      expect(result.current.query).toBe('');
    });

    it('resets selectedIndex when opening', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
        result.current.selectNext();
        result.current.close();
        result.current.open();
      });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('close action', () => {
    it('closes the palette', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
        result.current.close();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('resets query on close', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
        result.current.setQuery('test');
        result.current.close();
      });

      expect(result.current.query).toBe('');
    });

    it('resets selectedIndex on close', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
        result.current.selectNext();
        result.current.close();
      });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('toggle action', () => {
    it('opens when closed', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('closes when open', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
        result.current.toggle();
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('opens with specified view', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.toggle('note-search');
      });

      expect(result.current.view).toBe('note-search');
    });
  });

  describe('setQuery action', () => {
    it('updates query', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
        result.current.setQuery('new note');
      });

      expect(result.current.query).toBe('new note');
    });

    it('resets selectedIndex when query changes', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
        result.current.selectNext();
        result.current.setQuery('test');
      });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('setView action', () => {
    it('changes view', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
        result.current.setView('note-search');
      });

      expect(result.current.view).toBe('note-search');
    });

    it('resets query when view changes', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        result.current.open();
        result.current.setQuery('test');
        result.current.setView('note-search');
      });

      expect(result.current.query).toBe('');
    });
  });

  describe('navigation', () => {
    const mockCommands: CommandItem[] = [
      createMockCommand({ id: 'cmd1', label: 'Command 1', category: 'General', priority: 1 }),
      createMockCommand({ id: 'cmd2', label: 'Command 2', category: 'General', priority: 2 }),
      createMockCommand({ id: 'cmd3', label: 'Command 3', category: 'General', priority: 3 }),
    ];

    it('selectNext increments selectedIndex', () => {
      const wrapper = createWrapper({ pluginCommands: mockCommands });
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        result.current.open();
        result.current.selectNext();
      });

      expect(result.current.selectedIndex).toBe(1);
    });

    it('selectPrevious decrements selectedIndex', () => {
      const wrapper = createWrapper({ pluginCommands: mockCommands });
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        result.current.open();
        result.current.selectNext();
        result.current.selectNext();
        result.current.selectPrevious();
      });

      expect(result.current.selectedIndex).toBe(1);
    });

    it('selectPrevious does not go below 0', () => {
      const wrapper = createWrapper({ pluginCommands: mockCommands });
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        result.current.open();
        result.current.selectPrevious();
      });

      expect(result.current.selectedIndex).toBe(0);
    });
  });

  describe('command execution', () => {
    it('executes command handler and closes palette', () => {
      const executeHandler = vi.fn();
      // Use a very high priority to ensure this command is selected first
      const mockCommands: CommandItem[] = [
        createMockCommand({
          id: 'test.exec',
          label: 'Test Exec',
          priority: 1,
          category: 'AAA', // Sorted alphabetically first
          handler: { execute: executeHandler },
        }),
      ];

      const wrapper = createWrapper({ pluginCommands: mockCommands });
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        result.current.open();
      });

      // Find and select our test command by filtering
      act(() => {
        result.current.setQuery('Test Exec');
      });

      act(() => {
        result.current.executeSelected();
      });

      expect(executeHandler).toHaveBeenCalled();
      expect(result.current.isOpen).toBe(false);
    });

    it('provides command context to handler', () => {
      const executeHandler = vi.fn();
      const mockCommands: CommandItem[] = [
        createMockCommand({
          id: 'test.ctx',
          label: 'Test Context',
          priority: 1,
          category: 'AAA',
          handler: { execute: executeHandler },
        }),
      ];

      const wrapper = createWrapper({
        pluginCommands: mockCommands,
        currentNoteId: 'note-123',
      });
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        result.current.open();
        result.current.setQuery('Test Context');
      });

      act(() => {
        result.current.executeSelected();
      });

      expect(executeHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          noteId: 'note-123',
          navigate: expect.any(Function),
          toast: expect.any(Function),
        })
      );
    });
  });

  describe('sections', () => {
    it('groups commands by category', () => {
      const mockCommands: CommandItem[] = [
        createMockCommand({ id: 'note1', label: 'Note 1', category: 'Notes', priority: 1 }),
        createMockCommand({ id: 'gen1', label: 'General 1', category: 'General', priority: 1 }),
        createMockCommand({ id: 'note2', label: 'Note 2', category: 'Notes', priority: 2 }),
      ];

      const wrapper = createWrapper({ pluginCommands: mockCommands });
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        result.current.open();
      });

      // Sections should be grouped by category
      const categories = result.current.sections.map((s) => s.label);
      expect(categories).toContain('Notes');
      expect(categories).toContain('General');
    });

    it('filters commands by query', () => {
      const mockCommands: CommandItem[] = [
        createMockCommand({
          id: 'plugin.uniquenew',
          label: 'UniqueNew Plugin',
          category: 'Plugin',
        }),
        createMockCommand({ id: 'plugin.open', label: 'Plugin Open', category: 'Plugin' }),
      ];

      const wrapper = createWrapper({ pluginCommands: mockCommands });
      const { result } = renderHook(() => useCommandPalette(), { wrapper });

      act(() => {
        result.current.open();
        result.current.setQuery('UniqueNew');
      });

      const allItems = result.current.sections.flatMap((s) => s.items);
      expect(allItems).toHaveLength(1);
      expect(allItems[0].label).toBe('UniqueNew Plugin');
    });
  });

  describe('useCommandPalette hook', () => {
    it('throws error when used outside provider', () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      expect(() => {
        renderHook(() => useCommandPalette());
      }).toThrow('useCommandPalette must be used within a CommandPaletteProvider');

      consoleSpy.mockRestore();
    });
  });

  describe('keyboard shortcuts', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('Cmd+K toggles command palette', async () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
        );
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.view).toBe('command');

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
        );
      });

      expect(result.current.isOpen).toBe(false);
    });

    it('Ctrl+K toggles command palette', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true })
        );
      });

      expect(result.current.isOpen).toBe(true);
    });

    it('Cmd+Shift+F opens note search view', () => {
      const { result } = renderHook(() => useCommandPalette(), { wrapper: TestWrapper });

      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'f', metaKey: true, shiftKey: true, bubbles: true })
        );
      });

      expect(result.current.isOpen).toBe(true);
      expect(result.current.view).toBe('note-search');
    });
  });
});
