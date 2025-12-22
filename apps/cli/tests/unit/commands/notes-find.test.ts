/**
 * Unit tests for notes-find.ts command module
 *
 * Tests note finding CLI command with fuzzy and exact matching.
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

// Helper to create branded NoteId
function createTestNoteId(id: string): NoteId {
  return id as unknown as NoteId;
}

import { registerNotesFindCommand } from '../../../src/commands/notes-find';
import { initializeContext } from '../../../src/context.js';
import { output } from '../../../src/output.js';

describe('notes-find command', () => {
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

    // Set up commander program
    program = new Command();
    program.option('--format <format>', 'output format', 'json');
    program.option('--vault <path>', 'vault path');

    // Create notes subcommand
    notesCommand = program.command('notes');
    registerNotesFindCommand(notesCommand, program);
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

  describe('fuzzy matching', () => {
    it('finds notes with exact title match', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Project Planning' }),
        createMockNote({ id: 'note-2', title: 'Meeting Notes' }),
        createMockNote({ id: 'note-3', title: 'Daily Log' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Project Planning']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              id: 'note-1',
              title: 'Project Planning',
              score: 1, // Exact match
            }),
          ]),
        }),
        expect.anything()
      );
    });

    it('finds notes with substring match', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Project Planning' }),
        createMockNote({ id: 'note-2', title: 'Another Project' }),
        createMockNote({ id: 'note-3', title: 'Meeting Notes' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Project']);

      // Should find both notes containing "Project"
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({ title: 'Project Planning' }),
            expect.objectContaining({ title: 'Another Project' }),
          ]),
        }),
        expect.anything()
      );
    });

    it('performs case-insensitive matching', async () => {
      const notes = [createMockNote({ id: 'note-1', title: 'Project Planning' })];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'project planning']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              title: 'Project Planning',
              score: 1, // Exact match (case-insensitive)
            }),
          ]),
        }),
        expect.anything()
      );
    });

    it('filters out low-scoring matches', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Project Planning' }),
        createMockNote({ id: 'note-2', title: 'XYZ' }), // Completely different
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Project']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.not.arrayContaining([expect.objectContaining({ title: 'XYZ' })]),
        }),
        expect.anything()
      );
    });

    it('handles multi-word queries', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Project Planning for Q4' }),
        createMockNote({ id: 'note-2', title: 'Planning Session' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Project Q4']);

      // Should find the note with both words
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({
              title: 'Project Planning for Q4',
            }),
          ]),
        }),
        expect.anything()
      );
    });

    it('sorts results by score descending', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'A Note About Testing' }),
        createMockNote({ id: 'note-2', title: 'Testing' }), // Exact match
        createMockNote({ id: 'note-3', title: 'Testing Notes' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Testing']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as {
        results: Array<{ score: number }>;
      };
      const scores = outputCall.results.map((r) => r.score);

      // Verify scores are in descending order
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeLessThanOrEqual(scores[i - 1]);
      }
    });
  });

  describe('exact matching (--exact flag)', () => {
    it('only returns substring matches when --exact is used', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Project Planning' }),
        createMockNote({ id: 'note-2', title: 'Projct Planing' }), // Typo - fuzzy would match
        createMockNote({ id: 'note-3', title: 'Another Project' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Project', '--exact']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({ title: 'Project Planning' }),
            expect.objectContaining({ title: 'Another Project' }),
          ]),
        }),
        expect.anything()
      );

      // Should NOT include fuzzy match
      const outputCall = vi.mocked(output).mock.calls[0][0] as {
        results: Array<{ title: string }>;
      };
      const titles = outputCall.results.map((r) => r.title);
      expect(titles).not.toContain('Projct Planing');
    });

    it('exact mode is case-insensitive', async () => {
      const notes = [createMockNote({ id: 'note-1', title: 'Project Planning' })];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'project', '--exact']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([expect.objectContaining({ title: 'Project Planning' })]),
        }),
        expect.anything()
      );
    });
  });

  describe('limit option', () => {
    it('respects --limit option', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Test One' }),
        createMockNote({ id: 'note-2', title: 'Test Two' }),
        createMockNote({ id: 'note-3', title: 'Test Three' }),
        createMockNote({ id: 'note-4', title: 'Test Four' }),
        createMockNote({ id: 'note-5', title: 'Test Five' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Test', '--limit', '2']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { results: unknown[] };
      expect(outputCall.results).toHaveLength(2);
    });

    it('uses default limit of 10', async () => {
      // Create 15 notes
      const notes = Array.from({ length: 15 }, (_, i) =>
        createMockNote({ id: `note-${i}`, title: `Test Note ${i}` })
      );
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Test']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as { results: unknown[] };
      expect(outputCall.results).toHaveLength(10);
    });

    it('throws error for invalid limit', async () => {
      mockVault.list.mockReturnValue([]);

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'find', 'Test', '--limit', '0'])
      ).rejects.toThrow('--limit must be a positive integer');

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'find', 'Test', '--limit', '-1'])
      ).rejects.toThrow('--limit must be a positive integer');

      await expect(
        program.parseAsync(['node', 'test', 'notes', 'find', 'Test', '--limit', 'abc'])
      ).rejects.toThrow('--limit must be a positive integer');
    });
  });

  describe('output format', () => {
    it('includes note type in results', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Regular Note', type: undefined }),
        createMockNote({ id: 'note-2', title: 'Person Note', type: 'person' }),
        createMockNote({ id: 'note-3', title: 'Meeting Note', type: 'meeting' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Note']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({ type: 'regular' }),
            expect.objectContaining({ type: 'person' }),
            expect.objectContaining({ type: 'meeting' }),
          ]),
        }),
        expect.anything()
      );
    });

    it('rounds score to 3 decimal places', async () => {
      const notes = [createMockNote({ id: 'note-1', title: 'Testing' })];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Testing']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as {
        results: Array<{ score: number }>;
      };
      const score = outputCall.results[0].score;

      // Score should have at most 3 decimal places
      const decimalPlaces = (score.toString().split('.')[1] || '').length;
      expect(decimalPlaces).toBeLessThanOrEqual(3);
    });
  });

  describe('edge cases', () => {
    it('returns empty results when no notes match', async () => {
      const notes = [createMockNote({ id: 'note-1', title: 'Project Planning' })];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'XYZ123ABC']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: [],
        }),
        expect.anything()
      );
    });

    it('handles empty vault', async () => {
      mockVault.list.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'anything']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: [],
        }),
        expect.anything()
      );
    });

    it('handles notes with empty titles', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: '' }),
        createMockNote({ id: 'note-2', title: 'Normal Note' }),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'notes', 'find', 'Normal']);

      const outputCall = vi.mocked(output).mock.calls[0][0] as {
        results: Array<{ title: string }>;
      };
      const titles = outputCall.results.map((r) => r.title);
      expect(titles).toContain('Normal Note');
    });

    it('handles special characters in query', async () => {
      const notes = [createMockNote({ id: 'note-1', title: 'Note #1 - Important!' })];
      mockVault.list.mockReturnValue(notes);

      // Use --exact to find substring match with special chars
      await program.parseAsync(['node', 'test', 'notes', 'find', '#1', '--exact']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          results: expect.arrayContaining([
            expect.objectContaining({ title: 'Note #1 - Important!' }),
          ]),
        }),
        expect.anything()
      );
    });
  });
});
