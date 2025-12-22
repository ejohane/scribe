/**
 * Unit tests for notes-update.ts command module
 *
 * Tests note update CLI command for modifying note metadata.
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

// Mock @scribe/shared
vi.mock('@scribe/shared', () => ({
  createNoteId: (id: string) => id as NoteId,
}));

// Helper to create branded NoteId
function createTestNoteId(id: string): NoteId {
  return id as unknown as NoteId;
}

import { registerNotesUpdateCommand } from '../../../src/commands/notes-update';
import { initializeContext } from '../../../src/context.js';
import { output } from '../../../src/output.js';

describe('notes-update command', () => {
  let program: Command;
  let notesCommand: Command;
  let mockVault: {
    read: ReturnType<typeof vi.fn>;
    save: ReturnType<typeof vi.fn>;
  };
  let mockContext: {
    vault: typeof mockVault;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock vault
    mockVault = {
      read: vi.fn(),
      save: vi.fn(),
    };

    // Set up mock context
    mockContext = {
      vault: mockVault,
    };

    vi.mocked(initializeContext).mockResolvedValue(
      mockContext as unknown as Awaited<ReturnType<typeof initializeContext>>
    );

    // Set up commander program
    program = new Command();
    program.option('--format <format>', 'output format', 'json');
    program.option('--vault <path>', 'vault path');

    // Create notes subcommand
    notesCommand = program.command('notes');
    registerNotesUpdateCommand(notesCommand, program);
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
          type: 'root' as const,
          children: [],
        },
      },
      ...rest,
    } as Note;
  }

  describe('updating title', () => {
    it('updates note title', async () => {
      const note = createMockNote({ id: 'note-1', title: 'Old Title' });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'update',
        'note-1',
        '--title',
        'New Title',
      ]);

      expect(mockVault.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Title',
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          note: expect.objectContaining({
            title: 'New Title',
          }),
          changes: expect.objectContaining({
            title: { from: 'Old Title', to: 'New Title' },
          }),
        }),
        expect.anything()
      );
    });

    it('does not track change if title is same', async () => {
      const note = createMockNote({ id: 'note-1', title: 'Same Title', tags: [] });
      mockVault.read.mockReturnValue(note);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'update',
        'note-1',
        '--title',
        'Same Title',
        '--add-tags',
        '#new', // Need another change since title unchanged
      ]);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.not.objectContaining({
            title: expect.anything(),
          }),
        }),
        expect.anything()
      );
    });
  });

  describe('updating type', () => {
    it('updates note type from regular to person', async () => {
      const note = createMockNote({ id: 'note-1', type: undefined });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'update', 'note-1', '--type', 'person']);

      expect(mockVault.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'person',
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            type: { from: 'regular', to: 'person' },
          }),
        }),
        expect.anything()
      );
    });

    it('updates note type from person to regular', async () => {
      const note = createMockNote({ id: 'note-1', type: 'person' });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'update', 'note-1', '--type', 'regular']);

      expect(mockVault.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: undefined,
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({
            type: 'regular',
          }),
          changes: expect.objectContaining({
            type: { from: 'person', to: 'regular' },
          }),
        }),
        expect.anything()
      );
    });

    it('updates note type to meeting', async () => {
      const note = createMockNote({ id: 'note-1', type: undefined });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'update', 'note-1', '--type', 'meeting']);

      expect(mockVault.save).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'meeting',
        })
      );
    });

    it('throws error for invalid type', async () => {
      const note = createMockNote({ id: 'note-1' });
      mockVault.read.mockReturnValue(note);

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'update', 'note-1', '--type', 'invalid-type'])
      ).rejects.toThrow('Invalid note type: invalid-type');
    });
  });

  describe('updating tags', () => {
    it('adds tags to note', async () => {
      const note = createMockNote({ id: 'note-1', tags: ['#existing'] });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'update',
        'note-1',
        '--add-tags',
        'new,another',
      ]);

      expect(mockVault.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['#existing', '#new', '#another'],
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            tagsAdded: ['#new', '#another'],
          }),
        }),
        expect.anything()
      );
    });

    it('removes tags from note', async () => {
      const note = createMockNote({ id: 'note-1', tags: ['#keep', '#remove1', '#remove2'] });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'update',
        'note-1',
        '--remove-tags',
        'remove1,remove2',
      ]);

      expect(mockVault.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['#keep'],
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            tagsRemoved: ['#remove1', '#remove2'],
          }),
        }),
        expect.anything()
      );
    });

    it('handles tags with or without # prefix', async () => {
      const note = createMockNote({ id: 'note-1', tags: [] });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'update',
        'note-1',
        '--add-tags',
        'without,#with',
      ]);

      expect(mockVault.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['#without', '#with'],
        })
      );
    });

    it('does not add duplicate tags', async () => {
      const note = createMockNote({ id: 'note-1', tags: ['#existing'] });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'update',
        'note-1',
        '--add-tags',
        'existing,new',
      ]);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            tagsAdded: ['#new'], // Only new tag added
          }),
        }),
        expect.anything()
      );
    });

    it('only removes tags that exist', async () => {
      const note = createMockNote({ id: 'note-1', tags: ['#exists'] });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'update',
        'note-1',
        '--remove-tags',
        'exists,nonexistent',
      ]);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: expect.objectContaining({
            tagsRemoved: ['#exists'], // Only existing tag listed
          }),
        }),
        expect.anything()
      );
    });

    it('can add and remove tags in same command', async () => {
      const note = createMockNote({ id: 'note-1', tags: ['#old'] });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'update',
        'note-1',
        '--add-tags',
        'new',
        '--remove-tags',
        'old',
      ]);

      expect(mockVault.save).toHaveBeenCalledWith(
        expect.objectContaining({
          tags: ['#new'],
        })
      );
    });
  });

  describe('validation', () => {
    it('throws error when no options provided', async () => {
      const note = createMockNote({ id: 'note-1' });
      mockVault.read.mockReturnValue(note);

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'update', 'note-1'])
      ).rejects.toThrow('At least one option must be provided');
    });

    it('throws noteNotFound when note does not exist', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('not found');
      });

      await expect(
        program.parseAsync([
          'node',
          'test',
          'notes',
          'update',
          'nonexistent',
          '--title',
          'New Title',
        ])
      ).rejects.toThrow(CLIError);

      await expect(
        program.parseAsync([
          'node',
          'test',
          'notes',
          'update',
          'nonexistent',
          '--title',
          'New Title',
        ])
      ).rejects.toMatchObject({
        code: ErrorCode.NOTE_NOT_FOUND,
      });
    });
  });

  describe('no changes', () => {
    it('does not save when no actual changes made', async () => {
      const note = createMockNote({
        id: 'note-1',
        title: 'Same',
        type: 'person',
        tags: ['#same'],
      });
      mockVault.read.mockReturnValue(note);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'update',
        'note-1',
        '--title',
        'Same',
        '--type',
        'person',
        '--add-tags',
        'same', // Already exists
      ]);

      expect(mockVault.save).not.toHaveBeenCalled();
    });
  });

  describe('combined updates', () => {
    it('updates multiple fields at once', async () => {
      const note = createMockNote({
        id: 'note-1',
        title: 'Old Title',
        type: undefined,
        tags: ['#old'],
      });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync([
        'node',
        'test',
        'notes',
        'update',
        'note-1',
        '--title',
        'New Title',
        '--type',
        'meeting',
        '--add-tags',
        'new',
        '--remove-tags',
        'old',
      ]);

      expect(mockVault.save).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'New Title',
          type: 'meeting',
          tags: ['#new'],
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          changes: {
            title: { from: 'Old Title', to: 'New Title' },
            type: { from: 'regular', to: 'meeting' },
            tagsAdded: ['#new'],
            tagsRemoved: ['#old'],
          },
        }),
        expect.anything()
      );
    });
  });

  describe('output format', () => {
    it('includes updated note info and changes in output', async () => {
      const note = createMockNote({ id: 'note-1', title: 'Old', tags: [] });
      mockVault.read.mockReturnValue(note);
      mockVault.save.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'update', 'note-1', '--title', 'New']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          note: expect.objectContaining({
            id: 'note-1',
            title: 'New',
            updatedAt: expect.any(String),
          }),
          changes: expect.objectContaining({
            title: { from: 'Old', to: 'New' },
            tagsAdded: [],
            tagsRemoved: [],
          }),
        }),
        expect.anything()
      );
    });
  });
});
