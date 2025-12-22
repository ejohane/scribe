/**
 * Unit tests for notes-delete.ts command module
 *
 * Tests note deletion CLI command with backlink protection.
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

import { registerNotesDeleteCommand } from '../../../src/commands/notes-delete';
import { initializeContext } from '../../../src/context.js';
import { output } from '../../../src/output.js';

describe('notes-delete command', () => {
  let program: Command;
  let notesCommand: Command;
  let mockVault: {
    read: ReturnType<typeof vi.fn>;
    delete: ReturnType<typeof vi.fn>;
  };
  let mockGraphEngine: {
    backlinks: ReturnType<typeof vi.fn>;
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
      delete: vi.fn(),
    };

    // Set up mock graph engine
    mockGraphEngine = {
      backlinks: vi.fn(),
    };

    // Set up mock context
    mockContext = {
      vault: mockVault,
      graphEngine: mockGraphEngine,
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
    registerNotesDeleteCommand(notesCommand, program);
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

  describe('successful deletion', () => {
    it('deletes a note with no backlinks', async () => {
      const note = createMockNote({ id: 'note-abc', title: 'My Note' });
      mockVault.read.mockReturnValue(note);
      mockGraphEngine.backlinks.mockReturnValue([]);
      mockVault.delete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'delete', 'note-abc']);

      expect(mockVault.read).toHaveBeenCalledWith('note-abc');
      expect(mockGraphEngine.backlinks).toHaveBeenCalledWith('note-abc');
      expect(mockVault.delete).toHaveBeenCalledWith('note-abc');
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          deleted: {
            id: 'note-abc',
            title: 'My Note',
          },
          brokenBacklinks: 0,
        }),
        expect.anything()
      );
    });

    it('does not include warning when no backlinks broken', async () => {
      const note = createMockNote({ id: 'note-xyz' });
      mockVault.read.mockReturnValue(note);
      mockGraphEngine.backlinks.mockReturnValue([]);
      mockVault.delete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'delete', 'note-xyz']);

      expect(output).toHaveBeenCalledWith(
        expect.not.objectContaining({
          warning: expect.anything(),
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
        program.parseAsync(['node', 'test', 'notes', 'delete', 'nonexistent'])
      ).rejects.toThrow(CLIError);

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'delete', 'nonexistent'])
      ).rejects.toMatchObject({
        code: ErrorCode.NOTE_NOT_FOUND,
      });
    });

    it('includes note id in error details', async () => {
      mockVault.read.mockImplementation(() => {
        throw new Error('not found');
      });

      try {
        await program.parseAsync(['node', 'test', 'notes', 'delete', 'missing-note']);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(CLIError);
        expect((err as CLIError).details).toEqual({ id: 'missing-note' });
      }
    });
  });

  describe('backlink protection', () => {
    it('prevents deletion when note has backlinks', async () => {
      const targetNote = createMockNote({ id: 'target-note', title: 'Target' });
      const linkingNote1 = createMockNote({ id: 'linking-1', title: 'Linking Note 1' });
      const linkingNote2 = createMockNote({ id: 'linking-2', title: 'Linking Note 2' });

      mockVault.read.mockReturnValue(targetNote);
      mockGraphEngine.backlinks.mockReturnValue([linkingNote1, linkingNote2]);

      await program.parseAsync(['node', 'test', 'notes', 'delete', 'target-note']);

      // Should NOT call delete
      expect(mockVault.delete).not.toHaveBeenCalled();

      // Should output error with backlink info
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: false,
          error: 'Note has incoming links from other notes',
          code: 'HAS_BACKLINKS',
          noteId: 'target-note',
          backlinkCount: 2,
          backlinks: [
            { id: 'linking-1', title: 'Linking Note 1' },
            { id: 'linking-2', title: 'Linking Note 2' },
          ],
          hint: 'Use --force to delete anyway (backlinks will become broken)',
        }),
        expect.anything()
      );
    });

    it('lists all backlinks in error response', async () => {
      const targetNote = createMockNote({ id: 'target' });
      const backlinks = [
        createMockNote({ id: 'ref-1', title: 'Reference 1' }),
        createMockNote({ id: 'ref-2', title: 'Reference 2' }),
        createMockNote({ id: 'ref-3', title: 'Reference 3' }),
      ];

      mockVault.read.mockReturnValue(targetNote);
      mockGraphEngine.backlinks.mockReturnValue(backlinks);

      await program.parseAsync(['node', 'test', 'notes', 'delete', 'target']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          backlinkCount: 3,
          backlinks: expect.arrayContaining([
            expect.objectContaining({ id: 'ref-1' }),
            expect.objectContaining({ id: 'ref-2' }),
            expect.objectContaining({ id: 'ref-3' }),
          ]),
        }),
        expect.anything()
      );
    });
  });

  describe('force deletion', () => {
    it('deletes note with backlinks when --force is used', async () => {
      const targetNote = createMockNote({ id: 'force-delete', title: 'Force Delete Me' });
      const linkingNote = createMockNote({ id: 'linking', title: 'Linking Note' });

      mockVault.read.mockReturnValue(targetNote);
      mockGraphEngine.backlinks.mockReturnValue([linkingNote]);
      mockVault.delete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'delete', 'force-delete', '--force']);

      // Should call delete despite backlinks
      expect(mockVault.delete).toHaveBeenCalledWith('force-delete');

      // Should output success with warning
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          deleted: {
            id: 'force-delete',
            title: 'Force Delete Me',
          },
          brokenBacklinks: 1,
          warning: '1 notes now have broken links to this note',
        }),
        expect.anything()
      );
    });

    it('includes broken backlink count in warning message', async () => {
      const targetNote = createMockNote({ id: 'target' });
      const backlinks = [
        createMockNote({ id: 'b1' }),
        createMockNote({ id: 'b2' }),
        createMockNote({ id: 'b3' }),
      ];

      mockVault.read.mockReturnValue(targetNote);
      mockGraphEngine.backlinks.mockReturnValue(backlinks);
      mockVault.delete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'delete', 'target', '--force']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          brokenBacklinks: 3,
          warning: '3 notes now have broken links to this note',
        }),
        expect.anything()
      );
    });

    it('works with short flag -f if supported', async () => {
      // Note: Commander may not have short flag, but --force should work
      const note = createMockNote({ id: 'note' });
      mockVault.read.mockReturnValue(note);
      mockGraphEngine.backlinks.mockReturnValue([createMockNote({ id: 'other' })]);
      mockVault.delete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'delete', 'note', '--force']);

      expect(mockVault.delete).toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('handles note with empty title', async () => {
      const note = createMockNote({ id: 'empty-title', title: '' });
      mockVault.read.mockReturnValue(note);
      mockGraphEngine.backlinks.mockReturnValue([]);
      mockVault.delete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'delete', 'empty-title']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          deleted: {
            id: 'empty-title',
            title: '',
          },
        }),
        expect.anything()
      );
    });

    it('handles note id with special characters', async () => {
      const noteId = 'note-2025-01-15';
      const note = createMockNote({ id: noteId, title: 'Dated Note' });
      mockVault.read.mockReturnValue(note);
      mockGraphEngine.backlinks.mockReturnValue([]);
      mockVault.delete.mockResolvedValue(undefined);

      await program.parseAsync(['node', 'test', 'notes', 'delete', noteId]);

      expect(mockVault.read).toHaveBeenCalledWith(noteId);
      expect(mockVault.delete).toHaveBeenCalledWith(noteId);
    });
  });
});
