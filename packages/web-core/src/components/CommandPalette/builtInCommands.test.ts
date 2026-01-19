/**
 * Built-in Commands Tests
 *
 * Tests for the default commands in the command palette.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { builtInCommands, SEARCH_NOTES_COMMAND_ID } from './builtInCommands';
import type { CommandContext } from '@scribe/plugin-core';

// Helper to create mock command context
function createMockContext(overrides: Partial<CommandContext> = {}): CommandContext {
  return {
    noteId: null,
    navigate: vi.fn(),
    toast: vi.fn(),
    createNote: vi.fn().mockResolvedValue('mock-note-id'),
    ...overrides,
  };
}

describe('builtInCommands', () => {
  const originalDate = global.Date;

  beforeEach(() => {
    vi.clearAllMocks();
    // Mock Date to return a fixed time for testing
    const mockDate = new Date('2024-01-15T10:00:00Z');
    vi.spyOn(global, 'Date').mockImplementation((...args: unknown[]) => {
      if (args.length === 0) {
        return mockDate;
      }
      return new originalDate(...(args as ConstructorParameters<typeof Date>));
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('structure', () => {
    it('exports an array of commands', () => {
      expect(Array.isArray(builtInCommands)).toBe(true);
      expect(builtInCommands.length).toBeGreaterThan(0);
    });

    it('all commands have required properties', () => {
      for (const cmd of builtInCommands) {
        expect(cmd).toHaveProperty('id');
        expect(cmd).toHaveProperty('label');
        expect(cmd).toHaveProperty('icon');
        expect(cmd).toHaveProperty('category');
        expect(cmd).toHaveProperty('priority');
        expect(cmd).toHaveProperty('execute');
        expect(typeof cmd.execute).toBe('function');
      }
    });

    it('all commands have unique ids', () => {
      const ids = builtInCommands.map((cmd) => cmd.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(ids.length);
    });
  });

  describe('New Note command', () => {
    it('exists with correct properties', () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.newNote');

      expect(cmd).toBeDefined();
      expect(cmd?.label).toBe('New Note');
      expect(cmd?.icon).toBe('Plus');
      expect(cmd?.category).toBe('Notes');
      expect(cmd?.shortcut).toBe('⌘N');
    });

    it('creates a note and navigates to it', async () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.newNote')!;
      const ctx = createMockContext();

      await cmd.execute(ctx);

      expect(ctx.createNote).toHaveBeenCalledWith({ type: 'note' });
      expect(ctx.navigate).toHaveBeenCalledWith('/note/mock-note-id');
    });

    it('does not navigate if note creation fails', async () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.newNote')!;
      const ctx = createMockContext({
        createNote: vi.fn().mockResolvedValue(null),
      });

      await cmd.execute(ctx);

      expect(ctx.createNote).toHaveBeenCalled();
      expect(ctx.navigate).not.toHaveBeenCalled();
    });
  });

  describe('Search Notes command', () => {
    it('exists with correct properties', () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.searchNotes');

      expect(cmd).toBeDefined();
      expect(cmd?.label).toBe('Search Notes');
      expect(cmd?.icon).toBe('Search');
      expect(cmd?.category).toBe('Notes');
      expect(cmd?.shortcut).toBe('⌘⇧F');
    });

    it('exports SEARCH_NOTES_COMMAND_ID constant', () => {
      expect(SEARCH_NOTES_COMMAND_ID).toBe('core.searchNotes');
    });

    it('execute does nothing (handled by provider)', () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.searchNotes')!;
      const ctx = createMockContext();

      // Should not throw
      expect(() => cmd.execute(ctx)).not.toThrow();

      // Should not navigate (view switch handled by provider)
      expect(ctx.navigate).not.toHaveBeenCalled();
    });
  });

  describe('New Daily Note command', () => {
    it('exists with correct properties', () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.newDailyNote');

      expect(cmd).toBeDefined();
      expect(cmd?.label).toBe('New Daily Note');
      expect(cmd?.icon).toBe('Calendar');
      expect(cmd?.category).toBe('Notes');
    });

    it("creates a daily note with today's date and navigates to it", async () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.newDailyNote')!;
      const ctx = createMockContext();

      await cmd.execute(ctx);

      expect(ctx.createNote).toHaveBeenCalledWith({ title: '2024-01-15', type: 'daily' });
      expect(ctx.navigate).toHaveBeenCalledWith('/note/mock-note-id');
    });
  });

  describe('New Meeting command', () => {
    it('exists with correct properties', () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.newMeeting');

      expect(cmd).toBeDefined();
      expect(cmd?.label).toBe('New Meeting');
      expect(cmd?.icon).toBe('Users');
      expect(cmd?.category).toBe('Notes');
    });

    it('creates a meeting note and navigates to it', async () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.newMeeting')!;
      const ctx = createMockContext();

      await cmd.execute(ctx);

      expect(ctx.createNote).toHaveBeenCalledWith({ title: 'Meeting', type: 'meeting' });
      expect(ctx.navigate).toHaveBeenCalledWith('/note/mock-note-id');
    });
  });

  describe('Open Settings command', () => {
    it('exists with correct properties', () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.settings');

      expect(cmd).toBeDefined();
      expect(cmd?.label).toBe('Open Settings');
      expect(cmd?.icon).toBe('Settings');
      expect(cmd?.category).toBe('General');
      expect(cmd?.shortcut).toBe('⌘,');
    });

    it('shows a toast that settings is coming soon', () => {
      const cmd = builtInCommands.find((c) => c.id === 'core.settings')!;
      const ctx = createMockContext();

      cmd.execute(ctx);

      expect(ctx.toast).toHaveBeenCalledWith('Settings coming soon!', 'info');
      expect(ctx.navigate).not.toHaveBeenCalled();
    });
  });

  describe('priorities', () => {
    it('Notes commands have lower priority than General', () => {
      const notesCommands = builtInCommands.filter((c) => c.category === 'Notes');
      const generalCommands = builtInCommands.filter((c) => c.category === 'General');

      const maxNotesPriority = Math.max(...notesCommands.map((c) => c.priority));
      const minGeneralPriority = Math.min(...generalCommands.map((c) => c.priority));

      // Lower priority value means higher in list
      expect(maxNotesPriority).toBeLessThan(minGeneralPriority);
    });

    it('New Note has highest priority', () => {
      const newNote = builtInCommands.find((c) => c.id === 'core.newNote')!;

      for (const cmd of builtInCommands) {
        if (cmd.id !== 'core.newNote') {
          expect(newNote.priority).toBeLessThanOrEqual(cmd.priority);
        }
      }
    });
  });

  describe('categories', () => {
    it('uses valid category constants', () => {
      const validCategories = ['Notes', 'General', 'Navigation'];

      for (const cmd of builtInCommands) {
        expect(validCategories).toContain(cmd.category);
      }
    });
  });
});
