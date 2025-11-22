/**
 * CommandPalette component tests
 */

import { describe, it, expect, beforeEach, mock } from 'bun:test';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CommandPalette, type Command } from './CommandPalette';
import { CoreClient } from '@scribe/core-client';
import type { ParsedNote } from '@scribe/domain-model';

describe('CommandPalette', () => {
  let mockCoreClient: CoreClient;
  let mockCommands: Command[];
  let mockOnClose: ReturnType<typeof mock>;
  let mockOnOpenNote: ReturnType<typeof mock>;

  beforeEach(() => {
    mockCoreClient = new CoreClient();
    mockOnClose = vi.fn();
    mockOnOpenNote = vi.fn();

    mockCommands = [
      {
        id: 'test-command',
        label: 'Test Command',
        description: 'A test command',
        keywords: ['test', 'example'],
        action: vi.fn(),
      },
      {
        id: 'another-command',
        label: 'Another Command',
        description: 'Another test',
        keywords: ['other'],
        action: vi.fn(),
      },
    ];

    // Mock search to return empty results by default
    vi.spyOn(mockCoreClient, 'search').mockResolvedValue([]);
  });

  it('does not render when closed', () => {
    render(
      <CommandPalette
        coreClient={mockCoreClient}
        isOpen={false}
        onClose={mockOnClose}
        commands={mockCommands}
      />
    );

    expect(screen.queryByPlaceholderText(/search notes/i)).not.toBeInTheDocument();
  });

  it('renders when open', () => {
    render(
      <CommandPalette
        coreClient={mockCoreClient}
        isOpen={true}
        onClose={mockOnClose}
        commands={mockCommands}
      />
    );

    expect(screen.getByPlaceholderText(/search notes/i)).toBeInTheDocument();
  });

  it('shows all commands when query is empty', () => {
    render(
      <CommandPalette
        coreClient={mockCoreClient}
        isOpen={true}
        onClose={mockOnClose}
        commands={mockCommands}
      />
    );

    expect(screen.getByText('Test Command')).toBeInTheDocument();
    expect(screen.getByText('Another Command')).toBeInTheDocument();
  });

  it('filters commands based on query', () => {
    render(
      <CommandPalette
        coreClient={mockCoreClient}
        isOpen={true}
        onClose={mockOnClose}
        commands={mockCommands}
      />
    );

    const input = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(input, { target: { value: 'test' } });

    expect(screen.getByText('Test Command')).toBeInTheDocument();
    expect(screen.queryByText('Another Command')).not.toBeInTheDocument();
  });

  it('closes when backdrop is clicked', () => {
    render(
      <CommandPalette
        coreClient={mockCoreClient}
        isOpen={true}
        onClose={mockOnClose}
        commands={mockCommands}
      />
    );

    const backdrop = screen
      .getByPlaceholderText(/search notes/i)
      .closest('.command-palette-backdrop');
    if (backdrop) {
      fireEvent.click(backdrop);
      expect(mockOnClose).toHaveBeenCalled();
    }
  });

  it('closes when Escape is pressed', () => {
    render(
      <CommandPalette
        coreClient={mockCoreClient}
        isOpen={true}
        onClose={mockOnClose}
        commands={mockCommands}
      />
    );

    const input = screen.getByPlaceholderText(/search notes/i);
    fireEvent.keyDown(input, { key: 'Escape' });

    expect(mockOnClose).toHaveBeenCalled();
  });

  it('executes command and closes on Enter', () => {
    render(
      <CommandPalette
        coreClient={mockCoreClient}
        isOpen={true}
        onClose={mockOnClose}
        commands={mockCommands}
      />
    );

    const input = screen.getByPlaceholderText(/search notes/i);
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(mockCommands[0].action).toHaveBeenCalled();
    expect(mockOnClose).toHaveBeenCalled();
  });

  it('navigates selection with arrow keys', () => {
    render(
      <CommandPalette
        coreClient={mockCoreClient}
        isOpen={true}
        onClose={mockOnClose}
        commands={mockCommands}
      />
    );

    const input = screen.getByPlaceholderText(/search notes/i);

    // Initially first item should be selected
    const firstItem = screen.getByText('Test Command').closest('.command-palette-item');
    expect(firstItem).toHaveClass('selected');

    // Press down arrow
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // Second item should now be selected
    const secondItem = screen.getByText('Another Command').closest('.command-palette-item');
    expect(secondItem).toHaveClass('selected');
  });

  it('searches notes via CoreClient', async () => {
    const mockNote: ParsedNote = {
      id: 'note-1',
      path: '/test/note.md',
      fileName: 'note.md',
      resolvedTitle: 'Test Note',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Test content',
    };

    vi.spyOn(mockCoreClient, 'search').mockResolvedValue([{ noteId: 'note-1', score: 1.0 }]);
    vi.spyOn(mockCoreClient, 'getNote').mockResolvedValue(mockNote);

    render(
      <CommandPalette
        coreClient={mockCoreClient}
        isOpen={true}
        onClose={mockOnClose}
        onOpenNote={mockOnOpenNote}
        commands={mockCommands}
      />
    );

    const input = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(input, { target: { value: 'test query' } });

    await waitFor(() => {
      expect(mockCoreClient.search).toHaveBeenCalledWith('test query', { limit: 10 });
    });

    await waitFor(() => {
      expect(screen.getByText('Test Note')).toBeInTheDocument();
    });
  });

  it('opens note when note result is selected', async () => {
    const mockNote: ParsedNote = {
      id: 'note-1',
      path: '/test/note.md',
      fileName: 'note.md',
      resolvedTitle: 'Test Note',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Test content',
    };

    vi.spyOn(mockCoreClient, 'search').mockResolvedValue([{ noteId: 'note-1', score: 1.0 }]);
    vi.spyOn(mockCoreClient, 'getNote').mockResolvedValue(mockNote);

    render(
      <CommandPalette
        coreClient={mockCoreClient}
        isOpen={true}
        onClose={mockOnClose}
        onOpenNote={mockOnOpenNote}
        commands={[]}
      />
    );

    const input = screen.getByPlaceholderText(/search notes/i);
    fireEvent.change(input, { target: { value: 'test' } });

    await waitFor(() => {
      expect(screen.getByText('Test Note')).toBeInTheDocument();
    });

    const noteItem = screen.getByText('Test Note');
    fireEvent.click(noteItem);

    expect(mockOnOpenNote).toHaveBeenCalledWith('note-1');
    expect(mockOnClose).toHaveBeenCalled();
  });
});
