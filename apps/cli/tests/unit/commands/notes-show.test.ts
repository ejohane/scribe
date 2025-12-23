/**
 * Unit tests for notes-show.ts command module
 *
 * Tests note show CLI command for displaying note content and metadata.
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

// Mock extractMarkdown from @scribe/shared
const { mockExtractMarkdown } = vi.hoisted(() => ({
  mockExtractMarkdown: vi.fn(),
}));

vi.mock('@scribe/shared', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@scribe/shared')>();
  return {
    ...actual,
    createNoteId: (id: string) => id as NoteId,
    extractMarkdown: mockExtractMarkdown,
  };
});

// Helper to create branded NoteId
function createTestNoteId(id: string): NoteId {
  return id as unknown as NoteId;
}

import { registerNotesShowCommand } from '../../../src/commands/notes-show';
import { initializeContext } from '../../../src/context.js';
import { output } from '../../../src/output.js';

describe('notes-show command', () => {
  let program: Command;
  let notesCommand: Command;
  let mockVault: {
    read: ReturnType<typeof vi.fn>;
  };
  let mockGraphEngine: {
    backlinks: ReturnType<typeof vi.fn>;
    outlinks: ReturnType<typeof vi.fn>;
  };
  let mockContext: {
    vault: typeof mockVault;
    graphEngine: typeof mockGraphEngine;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock vault
    mockVault = {
      read: vi.fn(),
    };

    // Set up mock graph engine
    mockGraphEngine = {
      backlinks: vi.fn(),
      outlinks: vi.fn(),
    };

    // Set up mock context
    mockContext = {
      vault: mockVault,
      graphEngine: mockGraphEngine,
    };

    vi.mocked(initializeContext).mockResolvedValue(
      mockContext as unknown as Awaited<ReturnType<typeof initializeContext>>
    );

    // Default mock for extractMarkdown
    mockExtractMarkdown.mockReturnValue('');

    // Default mocks for graph engine
    mockGraphEngine.backlinks.mockReturnValue([]);
    mockGraphEngine.outlinks.mockReturnValue([]);

    // Set up commander program
    program = new Command();
    program.option('--format <format>', 'output format', 'json');
    program.option('--vault <path>', 'vault path');

    // Create notes subcommand
    notesCommand = program.command('notes');
    registerNotesShowCommand(notesCommand, program);
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
      ...rest,
    } as Note;
  }

  describe('showing note content', () => {
    it('shows note with all metadata', async () => {
      const now = Date.now();
      const note = createMockNote({
        id: 'note-abc',
        title: 'My Important Note',
        type: 'meeting',
        tags: ['#work', '#urgent'],
        createdAt: now,
        updatedAt: now,
      });
      mockVault.read.mockReturnValue(note);
      mockExtractMarkdown.mockReturnValue('This is the note content.');

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-abc']);

      expect(mockVault.read).toHaveBeenCalledWith('note-abc');
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'note-abc',
          title: 'My Important Note',
          type: 'meeting',
          tags: ['#work', '#urgent'],
          createdAt: now,
          updatedAt: now,
          content: expect.objectContaining({
            text: 'This is the note content.',
            format: 'plain',
          }),
        }),
        expect.anything()
      );
    });

    it('calls extractMarkdown with correct options', async () => {
      const note = createMockNote({ id: 'note-xyz' });
      mockVault.read.mockReturnValue(note);

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-xyz']);

      expect(mockExtractMarkdown).toHaveBeenCalledWith(note, { includeFrontmatter: false });
    });

    it('handles note with undefined type', async () => {
      const note = createMockNote({ id: 'note-1', type: undefined });
      mockVault.read.mockReturnValue(note);

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-1']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          type: undefined,
        }),
        expect.anything()
      );
    });

    it('handles note with empty tags', async () => {
      const note = createMockNote({ id: 'note-1', tags: undefined });
      mockVault.read.mockReturnValue(note);

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-1']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: [],
        }),
        expect.anything()
      );
    });
  });

  describe('note not found', () => {
    it('throws noteNotFound error when note does not exist', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('not found');
      });

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'show', 'nonexistent'])
      ).rejects.toThrow(CLIError);

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'show', 'nonexistent'])
      ).rejects.toMatchObject({
        code: ErrorCode.NOTE_NOT_FOUND,
      });
    });

    it('includes note id in error details', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('not found');
      });

      try {
        await program.parseAsync(['node', 'test', 'notes', 'show', 'missing-note']);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CLIError);
        expect((err as CLIError).details).toEqual({ id: 'missing-note' });
      }
    });
  });

  describe('--include-raw option', () => {
    it('includes raw Lexical JSON when --include-raw is used', async () => {
      const rawContent = {
        root: {
          type: 'root' as const,
          children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] }],
        },
      };
      const note = createMockNote({ id: 'note-1', content: rawContent });
      mockVault.read.mockReturnValue(note);
      mockExtractMarkdown.mockReturnValue('Hello');

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-1', '--include-raw']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            text: 'Hello',
            format: 'plain',
            raw: rawContent,
          }),
        }),
        expect.anything()
      );
    });

    it('does not include raw content by default', async () => {
      const note = createMockNote({ id: 'note-1' });
      mockVault.read.mockReturnValue(note);

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-1']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.not.objectContaining({
            raw: expect.anything(),
          }),
        }),
        expect.anything()
      );
    });
  });

  describe('links and backlinks', () => {
    it('includes outlinks in metadata', async () => {
      const note = createMockNote({ id: 'note-1' });
      const linkedNote1 = createMockNote({ id: 'linked-1', title: 'Linked Note 1' });
      const linkedNote2 = createMockNote({ id: 'linked-2', title: 'Linked Note 2' });

      mockVault.read.mockReturnValue(note);
      mockGraphEngine.outlinks.mockReturnValue([linkedNote1, linkedNote2]);

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-1']);

      expect(mockGraphEngine.outlinks).toHaveBeenCalledWith('note-1');
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            links: [
              { id: 'linked-1', title: 'Linked Note 1' },
              { id: 'linked-2', title: 'Linked Note 2' },
            ],
          }),
        }),
        expect.anything()
      );
    });

    it('includes backlinks in metadata', async () => {
      const note = createMockNote({ id: 'note-1' });
      const backlinkNote1 = createMockNote({ id: 'backlink-1', title: 'Backlink Note 1' });
      const backlinkNote2 = createMockNote({ id: 'backlink-2', title: 'Backlink Note 2' });

      mockVault.read.mockReturnValue(note);
      mockGraphEngine.backlinks.mockReturnValue([backlinkNote1, backlinkNote2]);

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-1']);

      expect(mockGraphEngine.backlinks).toHaveBeenCalledWith('note-1');
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: expect.objectContaining({
            backlinks: [
              { id: 'backlink-1', title: 'Backlink Note 1' },
              { id: 'backlink-2', title: 'Backlink Note 2' },
            ],
          }),
        }),
        expect.anything()
      );
    });

    it('handles note with no links', async () => {
      const note = createMockNote({ id: 'note-1' });
      mockVault.read.mockReturnValue(note);
      mockGraphEngine.outlinks.mockReturnValue([]);
      mockGraphEngine.backlinks.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-1']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: {
            links: [],
            backlinks: [],
          },
        }),
        expect.anything()
      );
    });
  });

  describe('edge cases', () => {
    it('handles note with complex content', async () => {
      const note = createMockNote({ id: 'note-1' });
      mockVault.read.mockReturnValue(note);
      mockExtractMarkdown.mockReturnValue(
        '# Header\n\n- Item 1\n- Item 2\n\n**Bold** and *italic*'
      );

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-1']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            text: '# Header\n\n- Item 1\n- Item 2\n\n**Bold** and *italic*',
          }),
        }),
        expect.anything()
      );
    });

    it('handles note with empty content', async () => {
      const note = createMockNote({ id: 'note-1' });
      mockVault.read.mockReturnValue(note);
      mockExtractMarkdown.mockReturnValue('');

      await program.parseAsync(['node', 'test', 'notes', 'show', 'note-1']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          content: expect.objectContaining({
            text: '',
          }),
        }),
        expect.anything()
      );
    });

    it('handles note id with special characters', async () => {
      const noteId = 'note-2025-01-15-meeting';
      const note = createMockNote({ id: noteId });
      mockVault.read.mockReturnValue(note);

      await program.parseAsync(['node', 'test', 'notes', 'show', noteId]);

      expect(mockVault.read).toHaveBeenCalledWith(noteId);
    });
  });
});
