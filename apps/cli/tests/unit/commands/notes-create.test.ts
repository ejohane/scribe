/**
 * Unit tests for notes-create.ts command module
 *
 * Tests note management CLI commands: create, append, and add-task.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import type { Note, NoteId } from '@scribe/shared';
import { CLIError, ErrorCode } from '../../../src/errors';

// Mock the context module
vi.mock('../../../src/context.js', () => ({
  initializeContext: vi.fn(),
}));

// Mock the output module
vi.mock('../../../src/output.js', () => ({
  output: vi.fn(),
}));

// Mock @scribe/shared - createNoteId returns a branded type
vi.mock('@scribe/shared', () => ({
  createNoteId: (id: string) => id as NoteId,
}));

// Helper to create branded NoteId
function createTestNoteId(id: string): NoteId {
  return id as unknown as NoteId;
}

// Mock the input module
vi.mock('../../../src/input.js', () => ({
  resolveContentInput: vi.fn(),
}));

// Mock the node-builder module
const {
  mockCreateInitialContent,
  mockCreateEmptyContent,
  mockAppendParagraphToContent,
  mockAppendTaskToContent,
} = vi.hoisted(() => ({
  mockCreateInitialContent: vi.fn(),
  mockCreateEmptyContent: vi.fn(),
  mockAppendParagraphToContent: vi.fn(),
  mockAppendTaskToContent: vi.fn(),
}));

vi.mock('../../../src/node-builder.js', () => ({
  createInitialContent: mockCreateInitialContent,
  createEmptyContent: mockCreateEmptyContent,
  appendParagraphToContent: mockAppendParagraphToContent,
  appendTaskToContent: mockAppendTaskToContent,
}));

import {
  registerNotesCreateCommand,
  registerNotesAppendCommand,
  registerNotesAddTaskCommand,
} from '../../../src/commands/notes-create';
import { initializeContext } from '../../../src/context.js';
import { output } from '../../../src/output.js';
import { resolveContentInput } from '../../../src/input.js';

describe('notes-create commands', () => {
  let program: Command;
  let notesCommand: Command;
  let mockVault: {
    list: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let mockContext: {
    vault: typeof mockVault;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock vault
    mockVault = {
      list: vi.fn(() => []),
      read: vi.fn(),
      create: vi.fn(),
      save: vi.fn(),
    };

    // Set up mock context
    mockContext = {
      vault: mockVault,
    };

    vi.mocked(initializeContext).mockResolvedValue(
      mockContext as unknown as Awaited<ReturnType<typeof initializeContext>>
    );

    // Set up node-builder mocks with default implementations
    mockCreateEmptyContent.mockReturnValue({
      root: { type: 'root', children: [] },
    });
    mockCreateInitialContent.mockImplementation((text: string) => ({
      root: { type: 'root', children: [{ type: 'paragraph', children: [{ type: 'text', text }] }] },
    }));
    mockAppendParagraphToContent.mockImplementation((content, _text: string) => ({
      ...content,
      root: { ...content.root, children: [...content.root.children, { type: 'paragraph' }] },
    }));
    mockAppendTaskToContent.mockImplementation((content, _text: string) => ({
      ...content,
      root: { ...content.root, children: [...content.root.children, { type: 'task' }] },
    }));

    // Set up commander program
    program = new Command();
    program.option('--format <format>', 'output format', 'json');
    program.option('--vault <path>', 'vault path');

    // Create notes subcommand
    notesCommand = program.command('notes');
    registerNotesCreateCommand(notesCommand, program);
    registerNotesAppendCommand(notesCommand, program);
    registerNotesAddTaskCommand(notesCommand, program);
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
    return {
      id: createTestNoteId(id ?? 'note-123'),
      title: 'Test Note',
      type: undefined,
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      content: {
        root: {
          type: 'root',
          children: [],
        },
      },
      ...rest,
    } as Note;
  }

  describe('notes create', () => {
    it('creates a note with default title "Untitled"', async () => {
      const newNote = createMockNote({ title: 'Untitled' });
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'notes', 'create']);

      expect(mockVault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Untitled',
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          note: expect.objectContaining({
            id: newNote.id,
            title: 'Untitled',
          }),
        }),
        expect.anything()
      );
    });

    it('creates a note with custom title', async () => {
      const newNote = createMockNote({ title: 'My Custom Note' });
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'notes', 'create', '--title', 'My Custom Note']);

      expect(mockVault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'My Custom Note',
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          note: expect.objectContaining({
            title: 'My Custom Note',
          }),
        }),
        expect.anything()
      );
    });

    it('creates a regular note by default (type undefined)', async () => {
      const newNote = createMockNote({ type: undefined });
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'notes', 'create']);

      expect(mockVault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: undefined,
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({
            type: 'regular',
          }),
        }),
        expect.anything()
      );
    });

    it('creates a person note when type is person', async () => {
      const newNote = createMockNote({ type: 'person' });
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'notes', 'create', '--type', 'person']);

      expect(mockVault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'person',
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({
            type: 'person',
          }),
        }),
        expect.anything()
      );
    });

    it('creates a meeting note when type is meeting', async () => {
      const newNote = createMockNote({ type: 'meeting' });
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'notes', 'create', '--type', 'meeting']);

      expect(mockVault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'meeting',
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({
            type: 'meeting',
          }),
        }),
        expect.anything()
      );
    });

    it('parses comma-separated tags', async () => {
      const newNote = createMockNote({ tags: ['#work', '#important', '#todo'] });
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'create',
        '--tags',
        'work,important,todo',
      ]);

      expect(mockVault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['#work', '#important', '#todo'],
        })
      );
    });

    it('auto-prefixes tags with # if missing', async () => {
      const newNote = createMockNote({ tags: ['#work', '#important'] });
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'notes', 'create', '--tags', 'work,#important']);

      expect(mockVault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['#work', '#important'],
        })
      );
    });

    it('trims whitespace from tags', async () => {
      const newNote = createMockNote({ tags: ['#work', '#important'] });
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'notes', 'create', '--tags', ' work , important ']);

      expect(mockVault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['#work', '#important'],
        })
      );
    });

    it('creates empty content when no --content provided', async () => {
      const newNote = createMockNote();
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'notes', 'create']);

      expect(mockCreateEmptyContent).toHaveBeenCalled();
      expect(mockCreateInitialContent).not.toHaveBeenCalled();
    });

    it('creates initial content when --content provided', async () => {
      const newNote = createMockNote();
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'notes', 'create', '--content', 'Hello world']);

      expect(mockCreateInitialContent).toHaveBeenCalledWith('Hello world');
      expect(mockCreateEmptyContent).not.toHaveBeenCalled();
    });

    it('includes timestamps in output', async () => {
      const now = Date.now();
      const newNote = createMockNote({
        createdAt: now,
        updatedAt: now,
      });
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'notes', 'create']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({
            createdAt: expect.any(String),
            updatedAt: expect.any(String),
          }),
        }),
        expect.anything()
      );
    });

    it('creates note with all options combined', async () => {
      const newNote = createMockNote({
        title: 'Meeting Notes',
        type: 'meeting',
        tags: ['#work', '#weekly'],
      });
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'create',
        '--title',
        'Meeting Notes',
        '--type',
        'meeting',
        '--tags',
        'work,weekly',
        '--content',
        'Discussed Q4 goals',
      ]);

      expect(mockVault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'Meeting Notes',
          type: 'meeting',
          tags: ['#work', '#weekly'],
        })
      );
      expect(mockCreateInitialContent).toHaveBeenCalledWith('Discussed Q4 goals');
    });
  });

  describe('notes append', () => {
    it('appends text to an existing note', async () => {
      const existingNote = createMockNote({ id: 'note-abc' });
      mockVault.read.mockReturnValue(existingNote);
      vi.mocked(resolveContentInput).mockResolvedValue({ text: 'New paragraph', source: 'inline' });

      await program.parseAsync(['node', 'test', 'notes', 'append', 'note-abc', 'New paragraph']);

      expect(mockVault.read).toHaveBeenCalledWith('note-abc');
      expect(resolveContentInput).toHaveBeenCalledWith('New paragraph', undefined);
      expect(mockAppendParagraphToContent).toHaveBeenCalledWith(
        existingNote.content,
        'New paragraph'
      );
      expect(mockVault.save).toHaveBeenCalled();
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          note: expect.objectContaining({
            id: 'note-abc',
          }),
        }),
        expect.anything()
      );
    });

    it('throws noteNotFound error when note does not exist', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('not found');
      });

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'append', 'nonexistent', 'Some text'])
      ).rejects.toThrow(CLIError);

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'append', 'nonexistent', 'Some text'])
      ).rejects.toMatchObject({
        code: ErrorCode.NOTE_NOT_FOUND,
      });
    });

    it('reads content from file when --file option provided', async () => {
      const existingNote = createMockNote({ id: 'note-abc' });
      mockVault.read.mockReturnValue(existingNote);
      vi.mocked(resolveContentInput).mockResolvedValue({
        text: 'File content here',
        source: 'file',
      });

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'append',
        'note-abc',
        '-',
        '--file',
        '/path/to/file.txt',
      ]);

      expect(resolveContentInput).toHaveBeenCalledWith('-', '/path/to/file.txt');
      expect(mockAppendParagraphToContent).toHaveBeenCalledWith(
        existingNote.content,
        'File content here'
      );
    });

    it('includes updated timestamp in output', async () => {
      const existingNote = createMockNote({ id: 'note-abc', title: 'My Note' });
      mockVault.read.mockReturnValue(existingNote);
      vi.mocked(resolveContentInput).mockResolvedValue({ text: 'Appended text', source: 'inline' });

      await program.parseAsync(['node', 'test', 'notes', 'append', 'note-abc', 'Appended text']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          note: expect.objectContaining({
            id: 'note-abc',
            title: 'My Note',
            updatedAt: expect.any(String),
          }),
        }),
        expect.anything()
      );
    });
  });

  describe('notes add-task', () => {
    it('adds a task to an existing note', async () => {
      const existingNote = createMockNote({ id: 'note-xyz', title: 'Project Tasks' });
      mockVault.read.mockReturnValue(existingNote);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'add-task',
        'note-xyz',
        'Complete the tests',
      ]);

      expect(mockVault.read).toHaveBeenCalledWith('note-xyz');
      expect(mockAppendTaskToContent).toHaveBeenCalledWith(
        existingNote.content,
        'Complete the tests'
      );
      expect(mockVault.save).toHaveBeenCalled();
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          task: expect.objectContaining({
            text: 'Complete the tests',
            completed: false,
            noteId: 'note-xyz',
            noteTitle: 'Project Tasks',
          }),
        }),
        expect.anything()
      );
    });

    it('throws noteNotFound error when note does not exist', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('not found');
      });

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'add-task', 'nonexistent', 'Some task'])
      ).rejects.toThrow(CLIError);

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'add-task', 'nonexistent', 'Some task'])
      ).rejects.toMatchObject({
        code: ErrorCode.NOTE_NOT_FOUND,
      });
    });

    it('generates task ID from note ID and task text', async () => {
      const existingNote = createMockNote({ id: 'note-123', title: 'Tasks' });
      mockVault.read.mockReturnValue(existingNote);

      await program.parseAsync(['node', 'test', 'notes', 'add-task', 'note-123', 'Buy groceries']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({
            id: 'note-123:task:Buygroc',
          }),
        }),
        expect.anything()
      );
    });

    it('handles task text with spaces in ID generation', async () => {
      const existingNote = createMockNote({ id: 'note-123', title: 'Tasks' });
      mockVault.read.mockReturnValue(existingNote);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'add-task',
        'note-123',
        'A B C D E F G H I',
      ]);

      // First 8 chars "A B C D " then spaces removed = "ABCD"
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({
            id: 'note-123:task:ABCD',
          }),
        }),
        expect.anything()
      );
    });

    it('handles short task text in ID generation', async () => {
      const existingNote = createMockNote({ id: 'note-123', title: 'Tasks' });
      mockVault.read.mockReturnValue(existingNote);

      await program.parseAsync(['node', 'test', 'notes', 'add-task', 'note-123', 'Go']);

      // Short text uses what's available
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({
            id: 'note-123:task:Go',
          }),
        }),
        expect.anything()
      );
    });

    it('always sets completed to false for new tasks', async () => {
      const existingNote = createMockNote({ id: 'note-abc' });
      mockVault.read.mockReturnValue(existingNote);

      await program.parseAsync(['node', 'test', 'notes', 'add-task', 'note-abc', 'New task']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          task: expect.objectContaining({
            completed: false,
          }),
        }),
        expect.anything()
      );
    });
  });

  describe('error handling', () => {
    it('notes append propagates CLIError with correct code', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('Database error');
      });

      try {
        await program.parseAsync(['node', 'test', 'notes', 'append', 'bad-id', 'text']);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CLIError);
        expect((err as CLIError).code).toBe(ErrorCode.NOTE_NOT_FOUND);
        expect((err as CLIError).details).toEqual({ id: 'bad-id' });
      }
    });

    it('notes add-task propagates CLIError with correct code', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('Database error');
      });

      try {
        await program.parseAsync(['node', 'test', 'notes', 'add-task', 'bad-id', 'task']);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CLIError);
        expect((err as CLIError).code).toBe(ErrorCode.NOTE_NOT_FOUND);
        expect((err as CLIError).details).toEqual({ id: 'bad-id' });
      }
    });
  });
});
