/**
 * Unit tests for vault.ts CLI command module
 *
 * Tests vault command functionality for vault-level operations and statistics.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Command } from 'commander';
import type { Note } from '@scribe/shared';
import { createMockNote } from '@scribe/test-utils';

// Mock the context module
vi.mock('../../../src/context.js', () => ({
  initializeContext: vi.fn(),
}));

// Mock the output module
vi.mock('../../../src/output.js', () => ({
  output: vi.fn(),
}));

// Import after mocking
import { registerVaultCommands } from '../../../src/commands/vault';
import { initializeContext } from '../../../src/context';
import { output } from '../../../src/output';

/**
 * Create a mock vault with common methods
 */
function createMockVault(notes: Note[]) {
  return {
    list: vi.fn().mockReturnValue(notes),
  };
}

/**
 * Create a mock graph engine with stats
 */
function createMockGraphEngine(tagCount: number) {
  return {
    getStats: vi.fn().mockReturnValue({
      notes: 0,
      tags: tagCount,
      links: 0,
      mentions: 0,
    }),
  };
}

/**
 * Create a mock context
 */
function createMockContext(
  notes: Note[],
  options?: {
    tagCount?: number;
  }
) {
  return {
    vault: createMockVault(notes),
    vaultPath: '/test/vault',
    graphEngine: createMockGraphEngine(options?.tagCount ?? 0),
  };
}

describe('vault commands', () => {
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

  describe('registerVaultCommands', () => {
    it('should register vault command on program', () => {
      registerVaultCommands(program);

      const vaultCmd = program.commands.find((cmd) => cmd.name() === 'vault');
      expect(vaultCmd).toBeDefined();
    });

    it('should register info subcommand', () => {
      registerVaultCommands(program);

      const vaultCmd = program.commands.find((cmd) => cmd.name() === 'vault');
      const infoCmd = vaultCmd?.commands.find((cmd) => cmd.name() === 'info');
      expect(infoCmd).toBeDefined();
    });
  });

  describe('info', () => {
    it('returns vault statistics', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Note 1' }),
        createMockNote({ id: 'note-2', title: 'Note 2' }),
      ];

      const ctx = createMockContext(notes, { tagCount: 5 });
      mockInitializeContext.mockResolvedValue(ctx);

      registerVaultCommands(program);
      await program.parseAsync(['node', 'test', 'vault', 'info']);

      expect(mockOutput).toHaveBeenCalledTimes(1);
      const outputData = mockOutput.mock.calls[0][0];

      expect(outputData).toHaveProperty('path', '/test/vault');
      expect(outputData).toHaveProperty('stats');
      expect(outputData).toHaveProperty('oldestNote');
      expect(outputData).toHaveProperty('newestNote');
      expect(outputData).toHaveProperty('lastModified');
    });

    it('includes note count', async () => {
      const notes = [
        createMockNote({ id: 'note-1', title: 'Note 1' }),
        createMockNote({ id: 'note-2', title: 'Note 2' }),
        createMockNote({ id: 'note-3', title: 'Note 3' }),
      ];

      const ctx = createMockContext(notes);
      mockInitializeContext.mockResolvedValue(ctx);

      registerVaultCommands(program);
      await program.parseAsync(['node', 'test', 'vault', 'info']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.stats.noteCount).toBe(3);
    });

    it('outputs JSON format correctly', async () => {
      const notes = [
        createMockNote({
          id: 'note-1',
          title: 'Note 1',
          createdAt: new Date('2024-01-01').getTime(),
          updatedAt: new Date('2024-06-15').getTime(),
        }),
      ];

      const ctx = createMockContext(notes, { tagCount: 10 });
      mockInitializeContext.mockResolvedValue(ctx);

      registerVaultCommands(program);
      await program.parseAsync(['node', 'test', 'vault', 'info']);

      const outputData = mockOutput.mock.calls[0][0];

      // Verify JSON structure
      expect(outputData).toHaveProperty('path');
      expect(outputData).toHaveProperty('stats');
      expect(outputData.stats).toHaveProperty('noteCount');
      expect(outputData.stats).toHaveProperty('tagCount');
      expect(outputData.stats).toHaveProperty('personCount');
      expect(outputData.stats).toHaveProperty('dailyNoteCount');
    });

    it('returns current vault path', async () => {
      const notes = [createMockNote({ id: 'note-1', title: 'Note 1' })];

      const ctx = createMockContext(notes);
      ctx.vaultPath = '/my/custom/vault';
      mockInitializeContext.mockResolvedValue(ctx);

      registerVaultCommands(program);
      await program.parseAsync(['node', 'test', 'vault', 'info']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.path).toBe('/my/custom/vault');
    });

    it('includes tag count from graph engine', async () => {
      const notes = [createMockNote({ id: 'note-1', title: 'Note 1' })];

      const ctx = createMockContext(notes, { tagCount: 15 });
      mockInitializeContext.mockResolvedValue(ctx);

      registerVaultCommands(program);
      await program.parseAsync(['node', 'test', 'vault', 'info']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.stats.tagCount).toBe(15);
    });

    it('counts person notes correctly', async () => {
      const notes = [
        createMockNote({ id: 'person-1', title: 'Alice', type: 'person' }),
        createMockNote({ id: 'person-2', title: 'Bob', type: 'person' }),
        createMockNote({ id: 'note-1', title: 'Regular Note' }),
      ];

      const ctx = createMockContext(notes);
      mockInitializeContext.mockResolvedValue(ctx);

      registerVaultCommands(program);
      await program.parseAsync(['node', 'test', 'vault', 'info']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.stats.personCount).toBe(2);
    });

    it('counts daily notes correctly', async () => {
      const notes = [
        createMockNote({
          id: 'daily-1',
          title: 'January 1, 2025',
          type: 'daily',
          daily: { date: '2025-01-01' },
        }),
        createMockNote({
          id: 'daily-2',
          title: 'January 2, 2025',
          type: 'daily',
          daily: { date: '2025-01-02' },
        }),
        createMockNote({ id: 'note-1', title: 'Regular Note' }),
      ];

      const ctx = createMockContext(notes);
      mockInitializeContext.mockResolvedValue(ctx);

      registerVaultCommands(program);
      await program.parseAsync(['node', 'test', 'vault', 'info']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.stats.dailyNoteCount).toBe(2);
    });

    it('calculates date range correctly', async () => {
      const oldestDate = new Date('2024-01-01T00:00:00Z').getTime();
      const newestDate = new Date('2024-12-31T00:00:00Z').getTime();

      const notes = [
        createMockNote({
          id: 'note-1',
          title: 'Oldest',
          createdAt: oldestDate,
          updatedAt: oldestDate,
        }),
        createMockNote({
          id: 'note-2',
          title: 'Newest',
          createdAt: newestDate,
          updatedAt: newestDate,
        }),
        createMockNote({
          id: 'note-3',
          title: 'Middle',
          createdAt: new Date('2024-06-15T00:00:00Z').getTime(),
          updatedAt: new Date('2024-06-15T00:00:00Z').getTime(),
        }),
      ];

      const ctx = createMockContext(notes);
      mockInitializeContext.mockResolvedValue(ctx);

      registerVaultCommands(program);
      await program.parseAsync(['node', 'test', 'vault', 'info']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.oldestNote).toBe(new Date(oldestDate).toISOString());
      expect(outputData.newestNote).toBe(new Date(newestDate).toISOString());
    });

    it('returns last modified date based on updatedAt', async () => {
      const notes = [
        createMockNote({
          id: 'note-1',
          title: 'Note 1',
          createdAt: new Date('2024-01-01').getTime(),
          updatedAt: new Date('2024-03-01').getTime(),
        }),
        createMockNote({
          id: 'note-2',
          title: 'Note 2',
          createdAt: new Date('2024-02-01').getTime(),
          updatedAt: new Date('2024-06-15').getTime(), // Most recently updated
        }),
      ];

      const ctx = createMockContext(notes);
      mockInitializeContext.mockResolvedValue(ctx);

      registerVaultCommands(program);
      await program.parseAsync(['node', 'test', 'vault', 'info']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.lastModified).toBe(new Date('2024-06-15').toISOString());
    });

    it('handles empty vault gracefully', async () => {
      const ctx = createMockContext([]);
      mockInitializeContext.mockResolvedValue(ctx);

      registerVaultCommands(program);
      await program.parseAsync(['node', 'test', 'vault', 'info']);

      const outputData = mockOutput.mock.calls[0][0];
      expect(outputData.stats.noteCount).toBe(0);
      expect(outputData.stats.personCount).toBe(0);
      expect(outputData.stats.dailyNoteCount).toBe(0);
      expect(outputData.oldestNote).toBeNull();
      expect(outputData.newestNote).toBeNull();
      expect(outputData.lastModified).toBeNull();
    });
  });
});
