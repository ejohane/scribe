/**
 * Unit tests for people.ts CLI command module
 *
 * Tests the people command functionality for listing person notes
 * and finding notes that mention specific people.
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
import { registerPeopleCommands } from '../../../src/commands/people';
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
function createMockRegularNote(
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
 * Create a mock person note for testing
 */
function createMockPersonNote(
  id: string,
  title: string,
  options?: {
    updatedAt?: number;
    tags?: string[];
  }
): Note {
  const base = createBaseNote(id, title);
  return {
    ...base,
    type: 'person',
    updatedAt: options?.updatedAt ?? base.updatedAt,
    tags: options?.tags ?? [],
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

describe('people commands', () => {
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

  describe('registerPeopleCommands', () => {
    it('should register people command on program', () => {
      registerPeopleCommands(program);

      const peopleCmd = program.commands.find((cmd) => cmd.name() === 'people');
      expect(peopleCmd).toBeDefined();
    });

    it('should register list subcommand', () => {
      registerPeopleCommands(program);

      const peopleCmd = program.commands.find((cmd) => cmd.name() === 'people');
      const listCmd = peopleCmd?.commands.find((cmd) => cmd.name() === 'list');
      expect(listCmd).toBeDefined();
    });

    it('should register mentions subcommand', () => {
      registerPeopleCommands(program);

      const peopleCmd = program.commands.find((cmd) => cmd.name() === 'people');
      const mentionsCmd = peopleCmd?.commands.find((cmd) => cmd.name() === 'mentions');
      expect(mentionsCmd).toBeDefined();
    });
  });

  describe('list', () => {
    it('returns all person notes', async () => {
      const personNote1 = createMockPersonNote('person-1', 'Alice Smith', { updatedAt: 1000 });
      const personNote2 = createMockPersonNote('person-2', 'Bob Jones', { updatedAt: 2000 });
      const regularNote = createMockRegularNote('note-1', 'Regular Note');

      const ctx = createMockContext([personNote1, personNote2, regularNote]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);
      await program.parseAsync(['node', 'test', 'people', 'list']);

      expect(mockOutput).toHaveBeenCalledTimes(1);
      const outputData = mockOutput.mock.calls[0][0];

      expect(outputData.people).toHaveLength(2);
      expect(outputData.people[0].id).toBe(createNoteId('person-1'));
      expect(outputData.people[0].name).toBe('Alice Smith');
      expect(outputData.people[1].id).toBe(createNoteId('person-2'));
      expect(outputData.people[1].name).toBe('Bob Jones');
      expect(outputData.total).toBe(2);
    });

    it('supports pagination with limit option', async () => {
      const people = Array.from({ length: 10 }, (_, i) =>
        createMockPersonNote(`person-${i}`, `Person ${i}`)
      );

      const ctx = createMockContext(people);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);
      await program.parseAsync(['node', 'test', 'people', 'list', '--limit', '3']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.people).toHaveLength(3);
      expect(outputData.total).toBe(3);
    });

    it('outputs JSON format correctly', async () => {
      const personNote = createMockPersonNote('person-1', 'Alice', { updatedAt: 1700000000000 });

      const ctx = createMockContext([personNote]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);
      await program.parseAsync(['node', 'test', 'people', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData).toHaveProperty('people');
      expect(outputData).toHaveProperty('total');
      expect(outputData.people[0]).toHaveProperty('id');
      expect(outputData.people[0]).toHaveProperty('name');
      expect(outputData.people[0]).toHaveProperty('mentionCount');
      expect(outputData.people[0]).toHaveProperty('lastMentioned');
    });

    it('calculates mention counts correctly', async () => {
      const personId = createNoteId('person-1');
      const personNote = createMockPersonNote('person-1', 'Alice');
      const noteWithMention = createMockRegularNote('note-1', 'Note mentioning Alice', {
        metadata: {
          title: null,
          tags: [],
          links: [],
          mentions: [personId],
        },
      });
      const anotherNoteWithMention = createMockRegularNote('note-2', 'Another note', {
        metadata: {
          title: null,
          tags: [],
          links: [],
          mentions: [personId],
        },
      });

      const ctx = createMockContext([personNote, noteWithMention, anotherNoteWithMention]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);
      await program.parseAsync(['node', 'test', 'people', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.people[0].mentionCount).toBe(2);
    });

    it('returns empty list when no person notes exist', async () => {
      const regularNote = createMockRegularNote('note-1', 'Regular Note');

      const ctx = createMockContext([regularNote]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);
      await program.parseAsync(['node', 'test', 'people', 'list']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.people).toHaveLength(0);
      expect(outputData.total).toBe(0);
    });

    it('throws error for invalid limit value', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'people', 'list', '--limit', 'invalid'])
      ).rejects.toThrow('--limit must be a non-negative integer');
    });

    it('throws error for negative limit value', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'people', 'list', '--limit', '-5'])
      ).rejects.toThrow('--limit must be a non-negative integer');
    });
  });

  describe('mentions', () => {
    it('returns notes that mention a specific person', async () => {
      const personId = createNoteId('person-1');
      const personNote = createMockPersonNote('person-1', 'Alice');
      const noteWithMention = createMockRegularNote('note-1', 'Meeting with Alice', {
        metadata: {
          title: null,
          tags: [],
          links: [],
          mentions: [personId],
        },
      });
      const noteWithoutMention = createMockRegularNote('note-2', 'Other note');

      const ctx = createMockContext([personNote, noteWithMention, noteWithoutMention]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);
      await program.parseAsync(['node', 'test', 'people', 'mentions', 'person-1']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.person.id).toBe(personId);
      expect(outputData.person.name).toBe('Alice');
      expect(outputData.mentions).toHaveLength(1);
      expect(outputData.mentions[0].id).toBe(createNoteId('note-1'));
      expect(outputData.mentions[0].title).toBe('Meeting with Alice');
      expect(outputData.count).toBe(1);
    });

    it('includes related notes in output', async () => {
      const personId = createNoteId('person-1');
      const personNote = createMockPersonNote('person-1', 'Bob');
      const relatedNote1: Note = {
        ...createBaseNote('note-1', 'Project kickoff'),
        type: 'meeting',
        meeting: {
          date: '2024-01-15',
          dailyNoteId: createNoteId('daily-2024-01-15'),
          attendees: [personId],
        },
        metadata: {
          title: null,
          tags: [],
          links: [],
          mentions: [personId],
        },
      } as Note;
      const relatedNote2 = createMockRegularNote('note-2', 'Weekly sync', {
        metadata: {
          title: null,
          tags: [],
          links: [],
          mentions: [personId],
        },
      });

      const ctx = createMockContext([personNote, relatedNote1, relatedNote2]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);
      await program.parseAsync(['node', 'test', 'people', 'mentions', 'person-1']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.mentions).toHaveLength(2);
      expect(outputData.mentions[0]).toHaveProperty('type');
    });

    it('handles person not found', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);

      await expect(
        program.parseAsync(['node', 'test', 'people', 'mentions', 'nonexistent'])
      ).rejects.toThrow();
    });

    it('returns empty mentions list when person has no mentions', async () => {
      const personNote = createMockPersonNote('person-1', 'Alice');
      const unrelatedNote = createMockRegularNote('note-1', 'Unrelated note');

      const ctx = createMockContext([personNote, unrelatedNote]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);
      await program.parseAsync(['node', 'test', 'people', 'mentions', 'person-1']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.mentions).toHaveLength(0);
      expect(outputData.count).toBe(0);
    });

    it('outputs correct JSON structure for mentions', async () => {
      const personId = createNoteId('person-1');
      const personNote = createMockPersonNote('person-1', 'Charlie');
      const mentioningNote: Note = {
        ...createBaseNote('note-1', 'Test note'),
        type: 'daily',
        daily: { date: '2024-01-15' },
        metadata: {
          title: null,
          tags: [],
          links: [],
          mentions: [personId],
        },
      } as Note;

      const ctx = createMockContext([personNote, mentioningNote]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerPeopleCommands(program);
      await program.parseAsync(['node', 'test', 'people', 'mentions', 'person-1']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData).toHaveProperty('person');
      expect(outputData).toHaveProperty('mentions');
      expect(outputData).toHaveProperty('count');
      expect(outputData.person).toHaveProperty('id');
      expect(outputData.person).toHaveProperty('name');
      expect(outputData.mentions[0]).toHaveProperty('id');
      expect(outputData.mentions[0]).toHaveProperty('title');
      expect(outputData.mentions[0]).toHaveProperty('type');
    });
  });
});
