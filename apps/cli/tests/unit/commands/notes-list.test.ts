/**
 * Unit tests for notes-list.ts command module
 *
 * Tests note listing CLI command with filtering, sorting, and pagination.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import type { Note, NoteId } from '@scribe/shared';

// Mock the context module
vi.mock('../../../src/context.js', () => ({
  initializeContext: vi.fn(),
}));

// Mock the output module
vi.mock('../../../src/output.js', () => ({
  output: vi.fn(),
}));

// Mock @scribe/shared - need to provide validatePaginationOptions and parseDateToTimestamp
vi.mock('@scribe/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@scribe/shared')>();
  return {
    ...actual,
    validatePaginationOptions: vi.fn(),
  };
});

// Helper to create branded NoteId
function createTestNoteId(id: string): NoteId {
  return id as unknown as NoteId;
}

import { registerNotesListCommand } from '../../../src/commands/notes-list';
import { initializeContext } from '../../../src/context.js';
import { output } from '../../../src/output.js';
import { validatePaginationOptions } from '@scribe/shared';

describe('notes-list command', () => {
  let program: Command;
  let notesCommand: Command;
  let mockVault: {
    list: ReturnType<typeof vi.fn>;
  };
  let mockContext: {
    vault: typeof mockVault;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock vault
    mockVault = {
      list: vi.fn(),
    };

    // Set up mock context
    mockContext = {
      vault: mockVault,
    };

    vi.mocked(initializeContext).mockResolvedValue(
      mockContext as unknown as Awaited<ReturnType<typeof initializeContext>>
    );

    // validatePaginationOptions shouldn't throw by default
    vi.mocked(validatePaginationOptions).mockImplementation(() => {});

    // Set up commander program
    program = new Command();
    program.option('--format <format>', 'output format', 'json');
    program.option('--vault <path>', 'vault path');

    // Create notes subcommand
    notesCommand = program.command('notes');
    registerNotesListCommand(notesCommand, program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Overrides for createMockNote - allows string for id
   */
  type MockNoteOverrides = Omit<Partial<Note>, 'id'> & { id?: string };

  /**
   * Helper to create a mock note
   */
  function createMockNote(overrides: MockNoteOverrides = {}): Note {
    const { id, ...rest } = overrides;
    const now = Date.now();
    return {
      id: createTestNoteId(id ?? 'note-123'),
      title: 'Test Note',
      type: undefined,
      tags: [],
      createdAt: now,
      updatedAt: now,
      content: {
        root: {
          type: 'root',
          children: [],
        },
      },
      metadata: {
        title: null,
        tags: [],
        links: [],
        mentions: [],
      },
      ...rest,
    } as Note;
  }

  describe('basic listing', () => {
    it('lists all notes with default options', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'First Note' }),
        createMockNote({ id: 'note-2', title: 'Second Note' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.arrayContaining([
            expect.objectContaining({ id: 'note-1', title: 'First Note' }),
            expect.objectContaining({ id: 'note-2', title: 'Second Note' }),
          ]),
          total: 2,
          limit: 100,
          offset: 0,
        }),
        expect.anything()
      );
    });

    it('includes formatted note fields in output', async () => {
      const now = Date.now();
      const notes = [
        createMockNote({
          id: 'note-1',
          title: 'My Note',
          type: 'person',
          tags: ['#work'],
          createdAt: now,
          updatedAt: now,
          metadata: {
            title: null,
            tags: [],
            links: [createTestNoteId('other')],
            mentions: [],
          },
        }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.arrayContaining([
            expect.objectContaining({
              id: 'note-1',
              title: 'My Note',
              type: 'person',
              tags: ['#work'],
              createdAt: expect.any(String),
              updatedAt: expect.any(String),
              linkCount: 1,
            }),
          ]),
        }),
        expect.anything()
      );
    });
  });

  describe('pagination', () => {
    it('respects --limit option', async () => {
      const notes = Array.from({ length: 10 }, (_, i) =>
        createMockNote({ id: `note-${i}`, title: `Note ${i}` })
      );
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list', '--limit', '3']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: unknown[]; total: number };
      expect(outputCall.notes).toHaveLength(3);
      expect(outputCall.total).toBe(10);
    });

    it('respects --offset option', async () => {
      const notes = [
        createMockNote({ id: 'note-0', title: 'Note 0', updatedAt: 1000 }),
        createMockNote({ id: 'note-1', title: 'Note 1', updatedAt: 2000 }),
        createMockNote({ id: 'note-2', title: 'Note 2', updatedAt: 3000 }),
        createMockNote({ id: 'note-3', title: 'Note 3', updatedAt: 4000 }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'list',
        '--offset',
        '2',
        '--limit',
        '10',
        '--order',
        'asc',
      ]);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: Array<{ id: string }> };
      expect(outputCall.notes).toHaveLength(2);
      expect(outputCall.notes[0].id).toBe('note-2');
    });

    it('calls validatePaginationOptions with parsed values', async () => {
      mockVault.list.mockReturnValue([]);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'list',
        '--limit',
        '50',
        '--offset',
        '10',
      ]);

      expect(validatePaginationOptions).toHaveBeenCalledWith({ limit: 50, offset: 10 });
    });
  });

  describe('type filtering', () => {
    it('filters by regular type (undefined)', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Regular', type: undefined }),
        createMockNote({ id: 'note-2', title: 'Person', type: 'person' }),
        createMockNote({ id: 'note-3', title: 'Meeting', type: 'meeting' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list', '--type', 'regular']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: Array<{ title: string }> };
      expect(outputCall.notes).toHaveLength(1);
      expect(outputCall.notes[0].title).toBe('Regular');
    });

    it('filters by person type', async () => {
      const notes = [
        createMockNote({ id: 'note-1', type: undefined }),
        createMockNote({ id: 'note-2', type: 'person' }),
        createMockNote({ id: 'note-3', type: 'person' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list', '--type', 'person']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: unknown[] };
      expect(outputCall.notes).toHaveLength(2);
    });

    it('filters by daily type', async () => {
      const notes = [
        createMockNote({ id: 'note-1', type: 'daily' }),
        createMockNote({ id: 'note-2', type: undefined }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list', '--type', 'daily']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: unknown[] };
      expect(outputCall.notes).toHaveLength(1);
    });
  });

  describe('tag filtering', () => {
    it('filters by tag with #', async () => {
      const notes = [
        createMockNote({ id: 'note-1', tags: ['#work'] }),
        createMockNote({ id: 'note-2', tags: ['#personal'] }),
        createMockNote({ id: 'note-3', tags: ['#work', '#urgent'] }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list', '--tag', '#work']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: unknown[] };
      expect(outputCall.notes).toHaveLength(2);
    });

    it('filters by tag without # (auto-normalized)', async () => {
      const notes = [
        createMockNote({ id: 'note-1', tags: ['#work'] }),
        createMockNote({ id: 'note-2', tags: ['#personal'] }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list', '--tag', 'work']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: unknown[] };
      expect(outputCall.notes).toHaveLength(1);
    });

    it('checks both explicit tags and metadata tags', async () => {
      const notes = [
        createMockNote({
          id: 'note-1',
          tags: [],
          metadata: { title: null, tags: ['#metadata-tag'], links: [], mentions: [] },
        }),
        createMockNote({ id: 'note-2', tags: ['#explicit-tag'] }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list', '--tag', '#metadata-tag']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: unknown[] };
      expect(outputCall.notes).toHaveLength(1);
    });
  });

  describe('date range filtering', () => {
    it('filters notes updated since date', async () => {
      const jan1 = new Date('2025-01-01').getTime();
      const jan15 = new Date('2025-01-15').getTime();
      const feb1 = new Date('2025-02-01').getTime();

      const notes = [
        createMockNote({ id: 'note-1', updatedAt: jan1 }),
        createMockNote({ id: 'note-2', updatedAt: jan15 }),
        createMockNote({ id: 'note-3', updatedAt: feb1 }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list', '--since', '2025-01-10']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: unknown[] };
      expect(outputCall.notes).toHaveLength(2); // jan15 and feb1
    });

    it('filters notes updated until date', async () => {
      const jan1 = new Date('2025-01-01').getTime();
      const jan15 = new Date('2025-01-15').getTime();
      const feb1 = new Date('2025-02-01').getTime();

      const notes = [
        createMockNote({ id: 'note-1', updatedAt: jan1 }),
        createMockNote({ id: 'note-2', updatedAt: jan15 }),
        createMockNote({ id: 'note-3', updatedAt: feb1 }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list', '--until', '2025-01-20']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: unknown[] };
      expect(outputCall.notes).toHaveLength(2); // jan1 and jan15
    });

    it('filters notes within date range', async () => {
      const jan1 = new Date('2025-01-01').getTime();
      const jan15 = new Date('2025-01-15').getTime();
      const feb1 = new Date('2025-02-01').getTime();

      const notes = [
        createMockNote({ id: 'note-1', updatedAt: jan1 }),
        createMockNote({ id: 'note-2', updatedAt: jan15 }),
        createMockNote({ id: 'note-3', updatedAt: feb1 }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'list',
        '--since',
        '2025-01-10',
        '--until',
        '2025-01-20',
      ]);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: unknown[] };
      expect(outputCall.notes).toHaveLength(1); // just jan15
    });
  });

  describe('sorting', () => {
    it('sorts by updated descending by default', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Old', updatedAt: 1000 }),
        createMockNote({ id: 'note-2', title: 'New', updatedAt: 3000 }),
        createMockNote({ id: 'note-3', title: 'Middle', updatedAt: 2000 }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: Array<{ title: string }> };
      expect(outputCall.notes[0].title).toBe('New');
      expect(outputCall.notes[1].title).toBe('Middle');
      expect(outputCall.notes[2].title).toBe('Old');
    });

    it('sorts by created ascending', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'First', createdAt: 1000, updatedAt: 3000 }),
        createMockNote({ id: 'note-2', title: 'Second', createdAt: 2000, updatedAt: 1000 }),
        createMockNote({ id: 'note-3', title: 'Third', createdAt: 3000, updatedAt: 2000 }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'list',
        '--sort',
        'created',
        '--order',
        'asc',
      ]);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: Array<{ title: string }> };
      expect(outputCall.notes[0].title).toBe('First');
      expect(outputCall.notes[1].title).toBe('Second');
      expect(outputCall.notes[2].title).toBe('Third');
    });

    it('sorts by title alphabetically', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Zebra' }),
        createMockNote({ id: 'note-2', title: 'Apple' }),
        createMockNote({ id: 'note-3', title: 'Mango' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'list',
        '--sort',
        'title',
        '--order',
        'asc',
      ]);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: Array<{ title: string }> };
      expect(outputCall.notes[0].title).toBe('Apple');
      expect(outputCall.notes[1].title).toBe('Mango');
      expect(outputCall.notes[2].title).toBe('Zebra');
    });

    it('sorts by title descending', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Zebra' }),
        createMockNote({ id: 'note-2', title: 'Apple' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'list',
        '--sort',
        'title',
        '--order',
        'desc',
      ]);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: Array<{ title: string }> };
      expect(outputCall.notes[0].title).toBe('Zebra');
      expect(outputCall.notes[1].title).toBe('Apple');
    });
  });

  describe('combined filters', () => {
    it('applies type and tag filters together', async () => {
      const notes = [
        createMockNote({ id: 'note-1', type: 'person', tags: ['#work'] }),
        createMockNote({ id: 'note-2', type: 'person', tags: ['#personal'] }),
        createMockNote({ id: 'note-3', type: 'meeting', tags: ['#work'] }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'list',
        '--type',
        'person',
        '--tag',
        '#work',
      ]);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { notes: unknown[] };
      expect(outputCall.notes).toHaveLength(1);
    });
  });

  describe('edge cases', () => {
    it('returns empty list when no notes match', async () => {
      mockVault.list.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'notes', 'list']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: [],
          total: 0,
        }),
        expect.anything()
      );
    });

    it('handles notes without metadata', async () => {
      const notes = [createMockNote({ id: 'note-1', metadata: undefined })];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          notes: expect.arrayContaining([expect.objectContaining({ linkCount: 0 })]),
        }),
        expect.anything()
      );
    });

    it('reports total before pagination', async () => {
      const notes = Array.from({ length: 25 }, (_, i) => createMockNote({ id: `note-${i}` }));
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'list', '--limit', '10']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          total: 25,
          limit: 10,
        }),
        expect.anything()
      );
    });
  });
});
