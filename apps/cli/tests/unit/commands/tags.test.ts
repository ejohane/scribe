/**
 * Unit tests for tags.ts CLI command module
 *
 * Tests the tags command functionality for listing tags and finding notes by tag.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import type { Note, NoteId, BaseNote, NoteMetadata } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';

// Mock the context module
vi.mock('../../../src/context.js', () => ({
  initializeContext: vi.fn(),
}));

// Mock the output module
vi.mock('../../../src/output.js', () => ({
  output: vi.fn(),
}));

// Import after mocking
import { registerTagsCommands } from '../../../src/commands/tags';
import { initializeContext } from '../../../src/context';
import { output } from '../../../src/output';

/**
 * Create a base note structure for testing
 */
function createBaseNote(id: string, title: string): Omit<BaseNote, 'type'> {
  return {
    id: createNoteId(id),
    title,
    content: { root: { type: 'root', children: [] } },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    tags: [],
    metadata: {
      title: null,
      tags: [],
      links: [],
      mentions: [],
    },
  };
}

/**
 * Create a mock regular note for testing
 */
function createMockNote(
  id: string,
  title: string,
  options?: {
    updatedAt?: number;
    tags?: string[];
    metadata?: Partial<NoteMetadata>;
  }
): Note {
  const base = createBaseNote(id, title);
  return {
    ...base,
    type: undefined,
    updatedAt: options?.updatedAt ?? base.updatedAt,
    tags: options?.tags ?? [],
    metadata: {
      ...base.metadata,
      ...options?.metadata,
    },
  } as Note;
}

/**
 * Create a mock vault with common methods
 */
function createMockVault(notes: Note[]) {
  return {
    list: vi.fn().mockReturnValue(notes),
    read: vi.fn().mockImplementation((id: NoteId) => {
      const note = notes.find((n) => n.id === id);
      if (!note) {
        throw new Error(`Note not found: ${id}`);
      }
      return note;
    }),
  };
}

/**
 * Create a mock context
 */
function createMockContext(notes: Note[]) {
  return {
    vault: createMockVault(notes),
    vaultPath: '/test/vault',
    options: { format: 'json' as const },
  };
}

describe('tags commands', () => {
  let program: Command;
  const mockInitializeContext = initializeContext as ReturnType<typeof vi.fn>;
  const mockOutput = output as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    program = new Command();
    program.option('--format <format>', 'Output format', 'json');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('registerTagsCommands', () => {
    it('should register tags command on program', () => {
      registerTagsCommands(program);

      const tagsCmd = program.commands.find((cmd) => cmd.name() === 'tags');
      expect(tagsCmd).toBeDefined();
    });

    it('should register list subcommand', () => {
      registerTagsCommands(program);

      const tagsCmd = program.commands.find((cmd) => cmd.name() === 'tags');
      const listCmd = tagsCmd?.commands.find((cmd) => cmd.name() === 'list');
      expect(listCmd).toBeDefined();
    });

    it('should register notes subcommand', () => {
      registerTagsCommands(program);

      const tagsCmd = program.commands.find((cmd) => cmd.name() === 'tags');
      const notesCmd = tagsCmd?.commands.find((cmd) => cmd.name() === 'notes');
      expect(notesCmd).toBeDefined();
    });
  });

  describe('list', () => {
    it('returns all unique tags', async () => {
      const note1 = createMockNote('note-1', 'Note 1', { tags: ['#work', '#important'] });
      const note2 = createMockNote('note-2', 'Note 2', { tags: ['#work', '#personal'] });
      const note3 = createMockNote('note-3', 'Note 3', { tags: ['#personal'] });

      const ctx = createMockContext([note1, note2, note3]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'list']);

      expect(mockOutput).toHaveBeenCalledTimes(1);
      const outputData = mockOutput.mock.calls[0][0];

      expect(outputData.tags).toHaveLength(3);
      expect(outputData.total).toBe(3);

      // Find tags by name
      const tagNames = outputData.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('#work');
      expect(tagNames).toContain('#important');
      expect(tagNames).toContain('#personal');
    });

    it('includes tag count per tag', async () => {
      const note1 = createMockNote('note-1', 'Note 1', { tags: ['#work'] });
      const note2 = createMockNote('note-2', 'Note 2', { tags: ['#work', '#important'] });
      const note3 = createMockNote('note-3', 'Note 3', { tags: ['#work'] });

      const ctx = createMockContext([note1, note2, note3]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'list']);

      const outputData = mockOutput.mock.calls[0][0];

      // Find the work tag
      const workTag = outputData.tags.find((t: { name: string }) => t.name === '#work');
      expect(workTag).toBeDefined();
      expect(workTag.count).toBe(3);

      // Find the important tag
      const importantTag = outputData.tags.find((t: { name: string }) => t.name === '#important');
      expect(importantTag).toBeDefined();
      expect(importantTag.count).toBe(1);
    });

    it('supports JSON output', async () => {
      const note = createMockNote('note-1', 'Note 1', { tags: ['#test'] });

      const ctx = createMockContext([note]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData).toHaveProperty('tags');
      expect(outputData).toHaveProperty('total');
      expect(Array.isArray(outputData.tags)).toBe(true);
      expect(outputData.tags[0]).toHaveProperty('name');
      expect(outputData.tags[0]).toHaveProperty('count');
    });

    it('sorts by count by default (descending)', async () => {
      const note1 = createMockNote('note-1', 'Note 1', { tags: ['#rare'] });
      const note2 = createMockNote('note-2', 'Note 2', { tags: ['#common'] });
      const note3 = createMockNote('note-3', 'Note 3', { tags: ['#common'] });
      const note4 = createMockNote('note-4', 'Note 4', { tags: ['#common'] });

      const ctx = createMockContext([note1, note2, note3, note4]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.tags[0].name).toBe('#common');
      expect(outputData.tags[0].count).toBe(3);
    });

    it('sorts by name when specified', async () => {
      const note1 = createMockNote('note-1', 'Note 1', { tags: ['#zebra'] });
      const note2 = createMockNote('note-2', 'Note 2', { tags: ['#alpha'] });
      const note3 = createMockNote('note-3', 'Note 3', { tags: ['#beta'] });

      const ctx = createMockContext([note1, note2, note3]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'list', '--sort', 'name']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.tags[0].name).toBe('#alpha');
      expect(outputData.tags[1].name).toBe('#beta');
      expect(outputData.tags[2].name).toBe('#zebra');
    });

    it('supports limit option', async () => {
      const notes = Array.from({ length: 10 }, (_, i) =>
        createMockNote(`note-${i}`, `Note ${i}`, { tags: [`#tag${i}`] })
      );

      const ctx = createMockContext(notes);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'list', '--limit', '3']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.tags).toHaveLength(3);
      expect(outputData.total).toBe(10); // Total unique tags
    });

    it('returns empty list when no tags exist', async () => {
      const note = createMockNote('note-1', 'Note without tags');

      const ctx = createMockContext([note]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.tags).toHaveLength(0);
      expect(outputData.total).toBe(0);
    });

    it('combines explicit tags and metadata tags', async () => {
      const note = createMockNote('note-1', 'Note with both', {
        tags: ['#explicit'],
        metadata: {
          title: null,
          tags: ['#inline'],
          links: [],
          mentions: [],
        },
      });

      const ctx = createMockContext([note]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      const tagNames = outputData.tags.map((t: { name: string }) => t.name);
      expect(tagNames).toContain('#explicit');
      expect(tagNames).toContain('#inline');
    });

    it('throws error for invalid limit value', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'tags', 'list', '--limit', 'invalid'])
      ).rejects.toThrow('--limit must be a non-negative integer');
    });
  });

  describe('notes (show notes with specific tag)', () => {
    it('returns notes with specific tag', async () => {
      const note1 = createMockNote('note-1', 'Work Note', { tags: ['#work'] });
      const note2 = createMockNote('note-2', 'Personal Note', { tags: ['#personal'] });
      const note3 = createMockNote('note-3', 'Another Work Note', { tags: ['#work'] });

      const ctx = createMockContext([note1, note2, note3]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'notes', '#work']);

      expect(mockOutput).toHaveBeenCalledTimes(1);
      const outputData = mockOutput.mock.calls[0][0];

      expect(outputData.tag).toBe('#work');
      expect(outputData.notes).toHaveLength(2);
      expect(outputData.total).toBe(2);
    });

    it('handles tag without hash prefix', async () => {
      const note = createMockNote('note-1', 'Work Note', { tags: ['#work'] });

      const ctx = createMockContext([note]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'notes', 'work']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.tag).toBe('#work');
      expect(outputData.notes).toHaveLength(1);
    });

    it('handles tag not found (returns empty results)', async () => {
      const note = createMockNote('note-1', 'Note', { tags: ['#other'] });

      const ctx = createMockContext([note]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'notes', '#nonexistent']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.notes).toHaveLength(0);
      expect(outputData.total).toBe(0);
    });

    it('supports pagination with limit and offset', async () => {
      const notes = Array.from({ length: 10 }, (_, i) =>
        createMockNote(`note-${i}`, `Note ${i}`, { tags: ['#common'], updatedAt: 1000 + i })
      );

      const ctx = createMockContext(notes);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync([
        'node',
        'test',
        'tags',
        'notes',
        '#common',
        '--limit',
        '3',
        '--offset',
        '2',
      ]);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.notes).toHaveLength(3);
      expect(outputData.total).toBe(10);
      expect(outputData.limit).toBe(3);
      expect(outputData.offset).toBe(2);
    });

    it('sorts notes by updatedAt descending', async () => {
      const note1 = createMockNote('note-1', 'Oldest', { tags: ['#work'], updatedAt: 1000 });
      const note2 = createMockNote('note-2', 'Middle', { tags: ['#work'], updatedAt: 2000 });
      const note3 = createMockNote('note-3', 'Newest', { tags: ['#work'], updatedAt: 3000 });

      const ctx = createMockContext([note1, note2, note3]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'notes', '#work']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.notes[0].title).toBe('Newest');
      expect(outputData.notes[1].title).toBe('Middle');
      expect(outputData.notes[2].title).toBe('Oldest');
    });

    it('includes correct note properties in output', async () => {
      const note = createMockNote('note-1', 'Test Note', {
        tags: ['#test', '#important'],
        updatedAt: 1700000000000,
      });

      const ctx = createMockContext([note]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'notes', '#test']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.notes[0]).toHaveProperty('id');
      expect(outputData.notes[0]).toHaveProperty('title');
      expect(outputData.notes[0]).toHaveProperty('type');
      expect(outputData.notes[0]).toHaveProperty('tags');
      expect(outputData.notes[0]).toHaveProperty('updatedAt');
    });

    it('matches tags with or without hash prefix', async () => {
      const note1 = createMockNote('note-1', 'With hash', { tags: ['#work'] });
      const note2 = createMockNote('note-2', 'Without hash', {
        metadata: {
          title: null,
          tags: ['work'], // Tag without hash in metadata
          links: [],
          mentions: [],
        },
      });

      const ctx = createMockContext([note1, note2]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);
      await program.parseAsync(['node', 'test', 'tags', 'notes', 'work']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.notes).toHaveLength(2);
    });

    it('throws error for invalid limit value', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'tags', 'notes', '#test', '--limit', 'invalid'])
      ).rejects.toThrow('--limit must be a non-negative integer');
    });

    it('throws error for invalid offset value', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerTagsCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'tags', 'notes', '#test', '--offset', '-1'])
      ).rejects.toThrow('--offset must be a non-negative integer');
    });
  });
});
