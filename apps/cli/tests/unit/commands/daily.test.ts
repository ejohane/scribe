/**
 * Unit tests for daily.ts command module
 *
 * Tests daily note management CLI commands: show and create.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import type { Note } from '@scribe/shared';

// Mock the context module
vi.mock('../../../src/context.js', () => ({
  initializeContext: vi.fn(),
}));

// Mock the output module
vi.mock('../../../src/output.js', () => ({
  output: vi.fn(),
}));

// Mock extractMarkdown from @scribe/shared while keeping other exports working
// Using vi.hoisted to ensure mockExtractMarkdown is available during mock hoisting
const { mockExtractMarkdown } = vi.hoisted(() => ({
  mockExtractMarkdown: vi.fn(),
}));
vi.mock('@scribe/shared', () => ({
  createNoteId: (id: string) => id,
  isDailyNote: (note: { type?: string }) => note.type === 'daily',
  extractMarkdown: mockExtractMarkdown,
}));

// Mock the node-builder module
vi.mock('../../../src/node-builder.js', () => ({
  createEmptyContent: vi.fn(() => ({
    root: {
      type: 'root',
      children: [],
    },
  })),
}));

import { registerDailyCommands } from '../../../src/commands/daily';
import { initializeContext } from '../../../src/context.js';
import { output } from '../../../src/output.js';

describe('daily commands', () => {
  let program: Command;
  let mockVault: {
    list: ReturnType<typeof vi.fn>;
    read: ReturnType<typeof vi.fn>;
    create: ReturnType<typeof vi.fn>;
  };
  let mockTaskIndex: {
    list: ReturnType<typeof vi.fn>;
  };
  let mockContext: {
    vault: typeof mockVault;
    taskIndex: typeof mockTaskIndex;
    ensureTaskIndexLoaded: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    vi.clearAllMocks();

    // Set up mock vault
    mockVault = {
      list: vi.fn(() => []),
      read: vi.fn(),
      create: vi.fn(),
    };

    // Set up mock task index
    mockTaskIndex = {
      list: vi.fn(() => ({ tasks: [] })),
    };

    // Set up mock context
    mockContext = {
      vault: mockVault,
      taskIndex: mockTaskIndex,
      ensureTaskIndexLoaded: vi.fn(),
    };

    vi.mocked(initializeContext).mockResolvedValue(
      mockContext as unknown as Awaited<ReturnType<typeof initializeContext>>
    );
    mockExtractMarkdown.mockReturnValue('');

    // Set up commander program
    program = new Command();
    program.option('--format <format>', 'output format', 'json');
    program.option('--vault <path>', 'vault path');
    registerDailyCommands(program);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  /**
   * Helper to create a mock daily note
   */
  function createMockDailyNote(date: string, title?: string): Note {
    return {
      id: `daily-${date}`,
      title: title || `${date}`,
      type: 'daily',
      tags: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
      content: {
        root: {
          type: 'root',
          children: [],
        },
      },
      daily: {
        date,
      },
    } as Note;
  }

  describe('daily show', () => {
    it('returns existing daily note if exists', async () => {
      const targetDate = '2025-01-15';
      const mockNote = createMockDailyNote(targetDate, 'January 15, 2025');
      mockVault.list.mockReturnValue([mockNote]);
      mockExtractMarkdown.mockReturnValue('Some note content');

      await program.parseAsync(['node', 'test', 'daily', 'show', targetDate]);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          date: targetDate,
          found: true,
          note: expect.objectContaining({
            id: mockNote.id,
            title: mockNote.title,
          }),
        }),
        expect.anything()
      );
    });

    it('returns found: false if daily note does not exist', async () => {
      const targetDate = '2025-01-15';
      mockVault.list.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'daily', 'show', targetDate]);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          date: targetDate,
          found: false,
          note: null,
        }),
        expect.anything()
      );
    });

    it('uses today as default date if not provided', async () => {
      const today = new Date().toISOString().split('T')[0];
      mockVault.list.mockReturnValue([]);

      await program.parseAsync(['node', 'test', 'daily', 'show']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          date: today,
        }),
        expect.anything()
      );
    });

    it('uses correct date format in note ID lookup', async () => {
      const targetDate = '2025-12-31';
      const mockNote = createMockDailyNote(targetDate);
      mockVault.list.mockReturnValue([mockNote]);

      await program.parseAsync(['node', 'test', 'daily', 'show', targetDate]);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          date: targetDate,
          found: true,
        }),
        expect.anything()
      );
    });

    it('includes tasks from the daily note', async () => {
      const targetDate = '2025-01-15';
      const mockNote = createMockDailyNote(targetDate);
      mockVault.list.mockReturnValue([mockNote]);

      const mockTasks = [
        { text: 'Task 1', completed: false },
        { text: 'Task 2', completed: true },
      ];
      mockTaskIndex.list.mockReturnValue({ tasks: mockTasks });

      await program.parseAsync(['node', 'test', 'daily', 'show', targetDate]);

      expect(mockContext.ensureTaskIndexLoaded).toHaveBeenCalled();
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({
            tasks: expect.arrayContaining([
              expect.objectContaining({ text: 'Task 1', completed: false }),
              expect.objectContaining({ text: 'Task 2', completed: true }),
            ]),
          }),
        }),
        expect.anything()
      );
    });

    it('includes content text from the daily note', async () => {
      const targetDate = '2025-01-15';
      const mockNote = createMockDailyNote(targetDate);
      mockVault.list.mockReturnValue([mockNote]);
      mockExtractMarkdown.mockReturnValue('Today I worked on tests');

      await program.parseAsync(['node', 'test', 'daily', 'show', targetDate]);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({
            content: expect.objectContaining({
              text: 'Today I worked on tests',
              format: 'plain',
            }),
          }),
        }),
        expect.anything()
      );
    });
  });

  describe('daily create', () => {
    it('creates new daily note if not exists', async () => {
      const targetDate = '2025-01-15';
      mockVault.list.mockReturnValue([]);

      const newNote = createMockDailyNote(targetDate, 'January 15, 2025');
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'daily', 'create', targetDate]);

      expect(mockVault.create).toHaveBeenCalledWith(
        expect.objectContaining({
          title: 'January 15, 2025',
          type: 'daily',
          daily: { date: targetDate },
        })
      );
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          date: targetDate,
          created: true,
          note: expect.objectContaining({
            id: newNote.id,
            title: newNote.title,
          }),
        }),
        expect.anything()
      );
    });

    it('returns existing daily note if exists (idempotent)', async () => {
      const targetDate = '2025-01-15';
      const existingNote = createMockDailyNote(targetDate, 'January 15, 2025');
      mockVault.list.mockReturnValue([existingNote]);

      await program.parseAsync(['node', 'test', 'daily', 'create', targetDate]);

      expect(mockVault.create).not.toHaveBeenCalled();
      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          date: targetDate,
          created: false,
          note: expect.objectContaining({
            id: existingNote.id,
            title: existingNote.title,
          }),
        }),
        expect.anything()
      );
    });

    it('uses today as default date if not provided', async () => {
      const today = new Date().toISOString().split('T')[0];
      mockVault.list.mockReturnValue([]);

      const newNote = createMockDailyNote(today);
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'daily', 'create']);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          date: today,
        }),
        expect.anything()
      );
    });

    it('formats date title correctly for various dates', async () => {
      const testCases = [
        { date: '2025-01-01', expectedTitle: 'January 1, 2025' },
        { date: '2025-12-25', expectedTitle: 'December 25, 2025' },
        { date: '2024-02-29', expectedTitle: 'February 29, 2024' }, // Leap year
      ];

      for (const { date, expectedTitle } of testCases) {
        vi.clearAllMocks();
        mockVault.list.mockReturnValue([]);
        const newNote = createMockDailyNote(date, expectedTitle);
        mockVault.create.mockResolvedValue(newNote);

        await program.parseAsync(['node', 'test', 'daily', 'create', date]);

        expect(mockVault.create).toHaveBeenCalledWith(
          expect.objectContaining({
            title: expectedTitle,
          })
        );
      }
    });

    it('includes createdAt timestamp in output', async () => {
      const targetDate = '2025-01-15';
      mockVault.list.mockReturnValue([]);

      const newNote = createMockDailyNote(targetDate);
      newNote.createdAt = new Date('2025-01-15T10:00:00Z').getTime();
      mockVault.create.mockResolvedValue(newNote);

      await program.parseAsync(['node', 'test', 'daily', 'create', targetDate]);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          note: expect.objectContaining({
            createdAt: expect.any(String),
          }),
        }),
        expect.anything()
      );
    });
  });

  describe('date calculations', () => {
    it('correctly handles date string format YYYY-MM-DD', async () => {
      // Valid date formats should work
      const validDates = ['2025-01-01', '2025-12-31', '2024-06-15'];

      for (const date of validDates) {
        vi.clearAllMocks();
        mockVault.list.mockReturnValue([]);

        await program.parseAsync(['node', 'test', 'daily', 'show', date]);

        expect(output).toHaveBeenCalledWith(
          expect.objectContaining({
            date,
          }),
          expect.anything()
        );
      }
    });

    it('matches daily notes by daily.date field', async () => {
      const targetDate = '2025-01-15';
      // Create notes with different dates
      const notes = [
        createMockDailyNote('2025-01-14'),
        createMockDailyNote('2025-01-15'), // This should match
        createMockDailyNote('2025-01-16'),
      ];
      mockVault.list.mockReturnValue(notes);

      await program.parseAsync(['node', 'test', 'daily', 'show', targetDate]);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          found: true,
          note: expect.objectContaining({
            id: 'daily-2025-01-15',
          }),
        }),
        expect.anything()
      );
    });

    it('does not match non-daily notes', async () => {
      const targetDate = '2025-01-15';
      // Create a regular note with a date-like ID
      const regularNote: Note = {
        id: '2025-01-15',
        title: 'Regular Note',
        type: 'regular',
        tags: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
      } as Note;
      mockVault.list.mockReturnValue([regularNote]);

      await program.parseAsync(['node', 'test', 'daily', 'show', targetDate]);

      expect(output).toHaveBeenCalledWith(
        expect.objectContaining({
          found: false,
          note: null,
        }),
        expect.anything()
      );
    });
  });
});
