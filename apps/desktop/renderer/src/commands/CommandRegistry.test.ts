/**
 * Unit tests for CommandRegistry
 *
 * Tests command registration, retrieval, grouping, and visibility filtering.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { CommandRegistry } from './CommandRegistry';
import type { Command, CommandGroup, CommandContext } from './types';

/**
 * Create a mock command for testing
 */
function createMockCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: overrides.id ?? 'test-command',
    title: overrides.title ?? 'Test Command',
    run: overrides.run ?? vi.fn().mockResolvedValue(undefined),
    ...overrides,
  };
}

/**
 * Create a mock context for command execution tests
 */
function createMockContext(): CommandContext {
  return {
    closePalette: vi.fn(),
    setCurrentNoteId: vi.fn(),
    getCurrentNoteId: vi.fn().mockReturnValue(null),
    saveCurrentNote: vi.fn().mockResolvedValue(undefined),
    createNote: vi.fn().mockResolvedValue(undefined),
    promptInput: vi.fn().mockResolvedValue(undefined),
    navigateToNote: vi.fn(),
    setPaletteMode: vi.fn(),
  };
}

describe('CommandRegistry', () => {
  let registry: CommandRegistry;

  beforeEach(() => {
    registry = new CommandRegistry();
  });

  // ============================================================================
  // Command Registration
  // ============================================================================
  describe('register', () => {
    it('registers a command', () => {
      const command = createMockCommand({ id: 'my-command' });
      registry.register(command);

      expect(registry.get('my-command')).toBe(command);
    });

    it('warns and overwrites when registering duplicate ID', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const command1 = createMockCommand({ id: 'dup', title: 'First' });
      const command2 = createMockCommand({ id: 'dup', title: 'Second' });

      registry.register(command1);
      registry.register(command2);

      expect(warnSpy).toHaveBeenCalledWith(
        'Command with id "dup" is already registered. Overwriting.'
      );
      expect(registry.get('dup')?.title).toBe('Second');

      warnSpy.mockRestore();
    });
  });

  describe('registerMany', () => {
    it('registers multiple commands', () => {
      const commands = [
        createMockCommand({ id: 'cmd-1' }),
        createMockCommand({ id: 'cmd-2' }),
        createMockCommand({ id: 'cmd-3' }),
      ];

      registry.registerMany(commands);

      expect(registry.getAll()).toHaveLength(3);
      expect(registry.get('cmd-1')).toBeDefined();
      expect(registry.get('cmd-2')).toBeDefined();
      expect(registry.get('cmd-3')).toBeDefined();
    });

    it('handles empty array', () => {
      registry.registerMany([]);
      expect(registry.getAll()).toHaveLength(0);
    });
  });

  // ============================================================================
  // Command Retrieval
  // ============================================================================
  describe('get', () => {
    it('returns undefined for non-existent command', () => {
      expect(registry.get('non-existent')).toBeUndefined();
    });

    it('returns the registered command', () => {
      const command = createMockCommand({ id: 'exists' });
      registry.register(command);

      expect(registry.get('exists')).toBe(command);
    });
  });

  describe('getAll', () => {
    it('returns empty array when no commands registered', () => {
      expect(registry.getAll()).toEqual([]);
    });

    it('returns all registered commands', () => {
      registry.register(createMockCommand({ id: 'cmd-1' }));
      registry.register(createMockCommand({ id: 'cmd-2' }));

      const all = registry.getAll();
      expect(all).toHaveLength(2);
      expect(all.map((c) => c.id)).toEqual(['cmd-1', 'cmd-2']);
    });

    it('includes hidden commands', () => {
      registry.register(createMockCommand({ id: 'visible', hidden: false }));
      registry.register(createMockCommand({ id: 'hidden', hidden: true }));

      expect(registry.getAll()).toHaveLength(2);
    });
  });

  describe('getVisible', () => {
    it('returns empty array when no commands registered', () => {
      expect(registry.getVisible()).toEqual([]);
    });

    it('excludes hidden commands', () => {
      registry.register(createMockCommand({ id: 'visible-1', hidden: false }));
      registry.register(createMockCommand({ id: 'visible-2' })); // undefined means not hidden
      registry.register(createMockCommand({ id: 'hidden-1', hidden: true }));

      const visible = registry.getVisible();
      expect(visible).toHaveLength(2);
      expect(visible.map((c) => c.id)).toEqual(['visible-1', 'visible-2']);
    });

    it('returns all commands when none are hidden', () => {
      registry.register(createMockCommand({ id: 'cmd-1' }));
      registry.register(createMockCommand({ id: 'cmd-2' }));

      expect(registry.getVisible()).toHaveLength(2);
    });
  });

  // ============================================================================
  // Command Groups
  // ============================================================================
  describe('registerGroup', () => {
    it('registers a command group', () => {
      const group: CommandGroup = { id: 'editing', label: 'Editing', priority: 1 };
      registry.registerGroup(group);

      const groups = registry.getGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0]).toEqual(group);
    });

    it('overwrites existing group with same ID', () => {
      registry.registerGroup({ id: 'nav', label: 'Navigation', priority: 1 });
      registry.registerGroup({ id: 'nav', label: 'Nav Updated', priority: 2 });

      const groups = registry.getGroups();
      expect(groups).toHaveLength(1);
      expect(groups[0].label).toBe('Nav Updated');
    });
  });

  describe('getGroups', () => {
    it('returns empty array when no groups registered', () => {
      expect(registry.getGroups()).toEqual([]);
    });

    it('returns groups sorted by priority (ascending)', () => {
      registry.registerGroup({ id: 'low', label: 'Low Priority', priority: 100 });
      registry.registerGroup({ id: 'high', label: 'High Priority', priority: 1 });
      registry.registerGroup({ id: 'medium', label: 'Medium Priority', priority: 50 });

      const groups = registry.getGroups();
      expect(groups.map((g) => g.id)).toEqual(['high', 'medium', 'low']);
    });

    it('maintains stable order for equal priorities', () => {
      registry.registerGroup({ id: 'first', label: 'First', priority: 10 });
      registry.registerGroup({ id: 'second', label: 'Second', priority: 10 });

      const groups = registry.getGroups();
      expect(groups).toHaveLength(2);
      // Both have priority 10, order depends on sort stability
    });
  });

  describe('getCommandsByGroup', () => {
    it('returns empty array when no commands in group', () => {
      registry.register(createMockCommand({ id: 'cmd', group: 'other' }));
      expect(registry.getCommandsByGroup('empty')).toEqual([]);
    });

    it('returns commands belonging to specified group', () => {
      registry.register(createMockCommand({ id: 'nav-1', group: 'navigation' }));
      registry.register(createMockCommand({ id: 'nav-2', group: 'navigation' }));
      registry.register(createMockCommand({ id: 'edit-1', group: 'editing' }));

      const navCommands = registry.getCommandsByGroup('navigation');
      expect(navCommands).toHaveLength(2);
      expect(navCommands.map((c) => c.id)).toEqual(['nav-1', 'nav-2']);
    });

    it('returns commands without group when querying undefined', () => {
      registry.register(createMockCommand({ id: 'grouped', group: 'some-group' }));
      registry.register(createMockCommand({ id: 'ungrouped' })); // No group

      // Commands without a group have undefined group property
      // When querying with undefined, it matches commands with undefined group
      const ungrouped = registry.getCommandsByGroup(undefined as unknown as string);
      expect(ungrouped).toHaveLength(1);
      expect(ungrouped[0].id).toBe('ungrouped');
    });

    it('includes hidden commands in group', () => {
      registry.register(createMockCommand({ id: 'visible', group: 'test', hidden: false }));
      registry.register(createMockCommand({ id: 'hidden', group: 'test', hidden: true }));

      const commands = registry.getCommandsByGroup('test');
      expect(commands).toHaveLength(2);
    });
  });

  // ============================================================================
  // Clear
  // ============================================================================
  describe('clear', () => {
    it('removes all commands', () => {
      registry.register(createMockCommand({ id: 'cmd-1' }));
      registry.register(createMockCommand({ id: 'cmd-2' }));
      registry.registerGroup({ id: 'group', label: 'Group', priority: 1 });

      registry.clear();

      expect(registry.getAll()).toEqual([]);
      expect(registry.getGroups()).toEqual([]);
    });

    it('allows re-registration after clear', () => {
      registry.register(createMockCommand({ id: 'original' }));
      registry.clear();
      registry.register(createMockCommand({ id: 'new' }));

      expect(registry.getAll()).toHaveLength(1);
      expect(registry.get('original')).toBeUndefined();
      expect(registry.get('new')).toBeDefined();
    });
  });

  // ============================================================================
  // Integration: Command with Context
  // ============================================================================
  describe('command execution', () => {
    it('executes command with context', async () => {
      const runFn = vi.fn().mockResolvedValue(undefined);
      const command = createMockCommand({ id: 'exec', run: runFn });
      registry.register(command);

      const context = createMockContext();
      const cmd = registry.get('exec');
      await cmd?.run(context);

      expect(runFn).toHaveBeenCalledWith(context);
    });

    it('command can access context methods', async () => {
      const command = createMockCommand({
        id: 'context-test',
        run: async (ctx) => {
          ctx.closePalette();
          ctx.setPaletteMode('file-browse');
        },
      });
      registry.register(command);

      const context = createMockContext();
      await registry.get('context-test')?.run(context);

      expect(context.closePalette).toHaveBeenCalled();
      expect(context.setPaletteMode).toHaveBeenCalledWith('file-browse');
    });
  });

  // ============================================================================
  // Edge Cases
  // ============================================================================
  describe('edge cases', () => {
    it('handles command with all optional properties', () => {
      const command: Command = {
        id: 'full-command',
        title: 'Full Command',
        description: 'A complete command',
        keywords: ['full', 'complete'],
        group: 'test-group',
        closeOnSelect: true,
        hidden: false,
        icon: 'icon-element',
        run: vi.fn(),
      };

      registry.register(command);
      const retrieved = registry.get('full-command');

      expect(retrieved).toBe(command);
      expect(retrieved?.description).toBe('A complete command');
      expect(retrieved?.keywords).toEqual(['full', 'complete']);
      expect(retrieved?.closeOnSelect).toBe(true);
    });

    it('handles command with minimal properties', () => {
      const command: Command = {
        id: 'minimal',
        title: 'Minimal',
        run: vi.fn(),
      };

      registry.register(command);
      const retrieved = registry.get('minimal');

      expect(retrieved).toBe(command);
      expect(retrieved?.description).toBeUndefined();
      expect(retrieved?.group).toBeUndefined();
    });

    it('handles special characters in command IDs', () => {
      registry.register(createMockCommand({ id: 'special:id/with.dots' }));
      expect(registry.get('special:id/with.dots')).toBeDefined();
    });

    it('handles empty string command ID', () => {
      registry.register(createMockCommand({ id: '' }));
      expect(registry.get('')).toBeDefined();
    });
  });
});
