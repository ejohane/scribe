/**
 * CommandPalette Component Tests
 *
 * Tests for the main command palette UI component.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, act, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { CommandPalette } from './CommandPalette';
import { CommandPaletteProvider, useCommandPalette } from './CommandPaletteProvider';
import type { CommandItem } from './types';

// Helpers to query elements inside the dialog (which is inside aria-hidden backdrop)
// We use direct DOM queries because testing-library's role queries respect aria-hidden
function getDialog() {
  return document.querySelector('[role="dialog"][aria-label="Command palette"]');
}

function queryDialog() {
  return document.querySelector('[role="dialog"][aria-label="Command palette"]');
}

function getInputInDialog() {
  const dialog = getDialog();
  return dialog?.querySelector('input[type="text"]') as HTMLInputElement | null;
}

function getListboxInDialog() {
  const dialog = getDialog();
  return dialog?.querySelector('[role="listbox"]');
}

function getTextInDialog(text: string) {
  const dialog = getDialog();
  if (!dialog) return null;
  const allElements = dialog.querySelectorAll('*');
  for (const el of allElements) {
    // Check if this element's direct text content (not children) contains the text
    const directText = Array.from(el.childNodes)
      .filter((node) => node.nodeType === Node.TEXT_NODE)
      .map((node) => node.textContent?.trim())
      .join('');
    if (directText === text) {
      return el;
    }
    // Also check if element has exactly this text content (for leaf elements)
    if (el.textContent?.trim() === text && el.children.length === 0) {
      return el;
    }
  }
  return null;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- kept for future use
function queryTextInDialog(text: string) {
  return getTextInDialog(text);
}

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

// Helper to create mock commands
function createMockCommand(overrides: Partial<CommandItem> = {}): CommandItem {
  return {
    type: 'command',
    id: `test.command.${Math.random().toString(36).slice(2)}`,
    label: 'Test Command',
    description: 'A test command',
    icon: 'Test',
    category: 'General',
    priority: 100,
    handler: { execute: vi.fn() },
    ...overrides,
  };
}

// Test component that provides access to palette controls
function TestApp({
  children,
  pluginCommands = [],
  onOpenChange,
}: {
  children?: ReactNode;
  pluginCommands?: CommandItem[];
  onOpenChange?: (isOpen: boolean) => void;
}) {
  return (
    <MemoryRouter>
      <CommandPaletteProvider pluginCommands={pluginCommands}>
        <TestControls onOpenChange={onOpenChange} />
        <CommandPalette />
        {children}
      </CommandPaletteProvider>
    </MemoryRouter>
  );
}

// Component that exposes palette controls
function TestControls({ onOpenChange }: { onOpenChange?: (isOpen: boolean) => void }) {
  const { isOpen, open, close } = useCommandPalette();

  if (onOpenChange) {
    onOpenChange(isOpen);
  }

  return (
    <div>
      <button data-testid="open-palette" onClick={() => open()}>
        Open
      </button>
      <button data-testid="close-palette" onClick={() => close()}>
        Close
      </button>
      <button data-testid="open-note-search" onClick={() => open('note-search')}>
        Open Note Search
      </button>
    </div>
  );
}

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('visibility', () => {
    it('does not render when closed', () => {
      render(<TestApp />);

      expect(queryDialog()).not.toBeInTheDocument();
    });

    it('renders when opened via button', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      expect(getDialog()).toBeInTheDocument();
    });

    it('renders when opened via keyboard shortcut', async () => {
      render(<TestApp />);

      // Simulate Cmd+K
      act(() => {
        document.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'k', metaKey: true, bubbles: true })
        );
      });

      expect(getDialog()).toBeInTheDocument();
    });
  });

  describe('accessibility', () => {
    it('has proper dialog role and aria attributes', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      const dialog = getDialog();
      expect(dialog).toBeInTheDocument();
      expect(dialog).toHaveAttribute('aria-modal', 'true');
      expect(dialog).toHaveAttribute('aria-label', 'Command palette');
    });

    it('has proper listbox for results', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      const listbox = getListboxInDialog();
      expect(listbox).toBeInTheDocument();
    });

    it('has proper input with autocomplete attributes', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      const input = getInputInDialog();
      expect(input).toBeInTheDocument();
      expect(input).toHaveAttribute('aria-autocomplete', 'list');
      expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    });
  });

  describe('input behavior', () => {
    it('auto-focuses input on open', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      const input = getInputInDialog();
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
    });

    it('shows command placeholder in command view', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      const input = getInputInDialog();
      expect(input).toHaveAttribute('placeholder', 'Type a command or search...');
    });

    it('shows note search placeholder in note-search view', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-note-search'));

      const input = getInputInDialog();
      expect(input).toHaveAttribute('placeholder', 'Search notes...');
    });
  });

  describe('keyboard navigation', () => {
    it('closes on Escape', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));
      expect(getDialog()).toBeInTheDocument();

      // Type escape in the input
      const input = getInputInDialog()!;
      fireEvent.keyDown(input, { key: 'Escape' });

      expect(queryDialog()).not.toBeInTheDocument();
    });
  });

  describe('backdrop interaction', () => {
    it('closes when clicking backdrop', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));
      expect(getDialog()).toBeInTheDocument();

      // Click on the backdrop (use document query since it has aria-hidden)
      const backdrop = document.querySelector('[role="presentation"]')!;
      await user.click(backdrop);

      expect(queryDialog()).not.toBeInTheDocument();
    });

    it('does not close when clicking inside dialog', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      const dialog = getDialog()!;
      await user.click(dialog);

      expect(getDialog()).toBeInTheDocument();
    });
  });

  describe('footer hints', () => {
    it('displays keyboard navigation hints', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      expect(getTextInDialog('navigate')).toBeInTheDocument();
      expect(getTextInDialog('select')).toBeInTheDocument();
      expect(getTextInDialog('close')).toBeInTheDocument();
    });
  });

  describe('empty state', () => {
    it('shows empty state when no commands match', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));
      const input = getInputInDialog()!;
      await user.type(input, 'xyznomatch');

      expect(getTextInDialog('No commands found')).toBeInTheDocument();
    });
  });

  describe('command display', () => {
    it('displays commands with labels', async () => {
      const user = userEvent.setup();
      const mockCommands = [
        createMockCommand({ id: 'test1', label: 'Create Note', category: 'Notes' }),
      ];

      render(<TestApp pluginCommands={mockCommands} />);

      await user.click(screen.getByTestId('open-palette'));

      expect(getTextInDialog('Create Note')).toBeInTheDocument();
    });

    it('displays command descriptions', async () => {
      const user = userEvent.setup();
      const mockCommands = [
        createMockCommand({
          id: 'test1',
          label: 'Create Note',
          description: 'Create a new note',
          category: 'Notes',
        }),
      ];

      render(<TestApp pluginCommands={mockCommands} />);

      await user.click(screen.getByTestId('open-palette'));

      expect(getTextInDialog('Create a new note')).toBeInTheDocument();
    });

    it('displays keyboard shortcuts', async () => {
      const user = userEvent.setup();
      const mockCommands = [
        createMockCommand({
          id: 'test1',
          label: 'Create Note',
          shortcut: '⌘N',
          category: 'Notes',
        }),
      ];

      render(<TestApp pluginCommands={mockCommands} />);

      await user.click(screen.getByTestId('open-palette'));

      expect(getTextInDialog('⌘N')).toBeInTheDocument();
    });

    it('groups commands by category', async () => {
      const user = userEvent.setup();
      const mockCommands = [
        createMockCommand({ id: 'note1', label: 'Note Command', category: 'Plugin Notes' }),
        createMockCommand({ id: 'gen1', label: 'General Command', category: 'Plugin General' }),
      ];

      render(<TestApp pluginCommands={mockCommands} />);

      await user.click(screen.getByTestId('open-palette'));

      // Both category sections should exist
      expect(getTextInDialog('Plugin Notes')).toBeInTheDocument();
      expect(getTextInDialog('Plugin General')).toBeInTheDocument();
    });
  });

  describe('command execution', () => {
    it('closes palette on enter', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));
      expect(getDialog()).toBeInTheDocument();

      // Press enter to execute first command
      const input = getInputInDialog()!;
      fireEvent.keyDown(input, { key: 'Enter' });

      // Dialog should close
      expect(queryDialog()).not.toBeInTheDocument();
    });

    it('closes palette on item click', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      // Click on a built-in command
      const settingsItem = getTextInDialog('Open Settings')!;
      await user.click(settingsItem);

      // Dialog should close
      expect(queryDialog()).not.toBeInTheDocument();
    });
  });

  describe('built-in commands', () => {
    it('shows New Note command', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      expect(getTextInDialog('New Note')).toBeInTheDocument();
    });

    it('shows Search Notes command', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      expect(getTextInDialog('Search Notes')).toBeInTheDocument();
    });

    it('shows Open Settings command', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      expect(getTextInDialog('Open Settings')).toBeInTheDocument();
    });
  });

  describe('body scroll lock', () => {
    it('prevents body scroll when open', async () => {
      const user = userEvent.setup();

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when closed', async () => {
      const user = userEvent.setup();
      document.body.style.overflow = 'auto';

      render(<TestApp />);

      await user.click(screen.getByTestId('open-palette'));
      await user.click(screen.getByTestId('close-palette'));

      expect(document.body.style.overflow).toBe('auto');
    });
  });
});
