/**
 * Tests for PluginRegistry
 *
 * These tests verify:
 * 1. Plugin registration and unregistration
 * 2. Capability indexing by type
 * 3. Plugin ID lookup
 * 4. Capability type lookup
 * 5. Duplicate plugin ID error handling
 * 6. Capability conflict detection and warning
 * 7. First registration wins on conflict
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginRegistry, PluginConflictError } from './plugin-registry.js';
import type {
  ServerPlugin,
  ClientPlugin,
  PluginManifest,
  SlashCommandHandler,
  CommandPaletteCommandHandler,
} from './plugin-types.js';
import type { ComponentType } from 'react';

// ============================================================================
// Test Fixtures
// ============================================================================

function createManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: '@scribe/plugin-test',
    version: '1.0.0',
    name: 'Test Plugin',
    capabilities: [],
    ...overrides,
  };
}

function createServerPlugin(overrides: Partial<ServerPlugin> = {}): ServerPlugin {
  return {
    manifest: createManifest(),
    ...overrides,
  };
}

function createClientPlugin(overrides: Partial<ClientPlugin> = {}): ClientPlugin {
  return {
    manifest: createManifest(),
    ...overrides,
  };
}

// Mock React component
const MockComponent: ComponentType = () => null;

// Mock slash command handler
const mockHandler: SlashCommandHandler = {
  execute: () => {},
};

// Mock command palette command handler
const mockPaletteHandler: CommandPaletteCommandHandler = {
  execute: () => {},
};

// ============================================================================
// Tests
// ============================================================================

describe('PluginRegistry', () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  // ==========================================================================
  // Registration Tests
  // ==========================================================================

  describe('register', () => {
    it('registers a plugin successfully', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-a' }),
      });

      registry.register(plugin);

      expect(registry.hasPlugin('@scribe/plugin-a')).toBe(true);
      expect(registry.pluginCount).toBe(1);
    });

    it('registers multiple plugins', () => {
      const pluginA = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-a' }),
      });
      const pluginB = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-b' }),
      });

      registry.register(pluginA);
      registry.register(pluginB);

      expect(registry.pluginCount).toBe(2);
      expect(registry.hasPlugin('@scribe/plugin-a')).toBe(true);
      expect(registry.hasPlugin('@scribe/plugin-b')).toBe(true);
    });

    it('throws PluginConflictError for duplicate plugin ID', () => {
      const pluginA = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-dup' }),
      });
      const pluginB = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-dup' }),
      });

      registry.register(pluginA);

      expect(() => registry.register(pluginB)).toThrow(PluginConflictError);
      expect(() => registry.register(pluginB)).toThrow(
        'Plugin @scribe/plugin-dup is already registered'
      );
    });

    it('sets initial status to "registered"', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-status' }),
      });

      registry.register(plugin);

      const registered = registry.getPlugin('@scribe/plugin-status');
      expect(registered?.status).toBe('registered');
    });
  });

  // ==========================================================================
  // Unregistration Tests
  // ==========================================================================

  describe('unregister', () => {
    it('unregisters a plugin successfully', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-remove' }),
      });

      registry.register(plugin);
      expect(registry.hasPlugin('@scribe/plugin-remove')).toBe(true);

      const result = registry.unregister('@scribe/plugin-remove');

      expect(result).toBe(true);
      expect(registry.hasPlugin('@scribe/plugin-remove')).toBe(false);
      expect(registry.pluginCount).toBe(0);
    });

    it('returns false when unregistering non-existent plugin', () => {
      const result = registry.unregister('@scribe/plugin-nonexistent');

      expect(result).toBe(false);
    });

    it('removes capabilities when unregistering', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-with-caps',
          capabilities: [
            { type: 'trpc-router', namespace: 'testRouter' },
            { type: 'sidebar-panel', id: 'test-panel', label: 'Test', icon: 'Test' },
          ],
        }),
      });

      registry.register(plugin);
      expect(registry.getCapabilities('trpc-router')).toHaveLength(1);
      expect(registry.getCapabilities('sidebar-panel')).toHaveLength(1);

      registry.unregister('@scribe/plugin-with-caps');

      expect(registry.getCapabilities('trpc-router')).toHaveLength(0);
      expect(registry.getCapabilities('sidebar-panel')).toHaveLength(0);
    });
  });

  // ==========================================================================
  // Lookup Tests
  // ==========================================================================

  describe('getPlugin', () => {
    it('returns the registered plugin', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-lookup',
          name: 'Lookup Test',
        }),
      });

      registry.register(plugin);

      const registered = registry.getPlugin('@scribe/plugin-lookup');
      expect(registered).toBeDefined();
      expect(registered?.plugin.manifest.name).toBe('Lookup Test');
    });

    it('returns undefined for non-existent plugin', () => {
      const registered = registry.getPlugin('@scribe/plugin-nonexistent');
      expect(registered).toBeUndefined();
    });
  });

  describe('getAllPlugins', () => {
    it('returns empty array when no plugins registered', () => {
      const plugins = registry.getAllPlugins();
      expect(plugins).toEqual([]);
    });

    it('returns all registered plugins', () => {
      const pluginA = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-a' }),
      });
      const pluginB = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-b' }),
      });

      registry.register(pluginA);
      registry.register(pluginB);

      const plugins = registry.getAllPlugins();
      expect(plugins).toHaveLength(2);
    });

    it('returns a frozen array', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-frozen' }),
      });

      registry.register(plugin);

      const plugins = registry.getAllPlugins();
      expect(Object.isFrozen(plugins)).toBe(true);
    });
  });

  // ==========================================================================
  // Capability Indexing Tests
  // ==========================================================================

  describe('capability indexing', () => {
    describe('trpc-router', () => {
      it('indexes trpc-router capabilities', () => {
        const plugin = createServerPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-router',
            capabilities: [{ type: 'trpc-router', namespace: 'todos' }],
          }),
        });

        registry.register(plugin);

        const routers = registry.getCapabilities('trpc-router');
        expect(routers).toHaveLength(1);
        expect(routers[0].namespace).toBe('todos');
        expect(routers[0].pluginId).toBe('@scribe/plugin-router');
      });
    });

    describe('storage', () => {
      it('indexes storage capabilities', () => {
        const plugin = createServerPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-storage',
            capabilities: [{ type: 'storage', keys: ['tasks', 'settings'] }],
          }),
        });

        registry.register(plugin);

        const storage = registry.getCapabilities('storage');
        expect(storage).toHaveLength(1);
        expect(storage[0].keys).toEqual(['tasks', 'settings']);
        expect(storage[0].pluginId).toBe('@scribe/plugin-storage');
      });

      it('handles storage capability without keys', () => {
        const plugin = createServerPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-storage-nokeys',
            capabilities: [{ type: 'storage' }],
          }),
        });

        registry.register(plugin);

        const storage = registry.getCapabilities('storage');
        expect(storage).toHaveLength(1);
        expect(storage[0].keys).toBeUndefined();
      });
    });

    describe('event-hook', () => {
      it('indexes event-hook capabilities', () => {
        const plugin = createServerPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-events',
            capabilities: [{ type: 'event-hook', events: ['note:created', 'note:updated'] }],
          }),
        });

        registry.register(plugin);

        const hooks = registry.getCapabilities('event-hook');
        expect(hooks).toHaveLength(1);
        expect(hooks[0].events).toEqual(['note:created', 'note:updated']);
        expect(hooks[0].pluginId).toBe('@scribe/plugin-events');
      });
    });

    describe('sidebar-panel', () => {
      it('indexes sidebar-panel capabilities', () => {
        const plugin = createServerPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-panel',
            capabilities: [
              {
                type: 'sidebar-panel',
                id: 'tasks-panel',
                label: 'Tasks',
                icon: 'CheckSquare',
                priority: 10,
              },
            ],
          }),
        });

        registry.register(plugin);

        const panels = registry.getCapabilities('sidebar-panel');
        expect(panels).toHaveLength(1);
        expect(panels[0].id).toBe('tasks-panel');
        expect(panels[0].label).toBe('Tasks');
        expect(panels[0].icon).toBe('CheckSquare');
        expect(panels[0].priority).toBe(10);
        expect(panels[0].pluginId).toBe('@scribe/plugin-panel');
      });

      it('uses default priority of 100 when not specified', () => {
        const plugin = createServerPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-panel-default',
            capabilities: [
              {
                type: 'sidebar-panel',
                id: 'default-panel',
                label: 'Default',
                icon: 'Box',
              },
            ],
          }),
        });

        registry.register(plugin);

        const panels = registry.getCapabilities('sidebar-panel');
        expect(panels[0].priority).toBe(100);
      });

      it('extracts component from client plugin', () => {
        const plugin = createClientPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-panel-component',
            capabilities: [
              {
                type: 'sidebar-panel',
                id: 'comp-panel',
                label: 'Component Panel',
                icon: 'Box',
              },
            ],
          }),
          sidebarPanels: {
            'comp-panel': MockComponent,
          },
        });

        registry.register(plugin);

        const panels = registry.getCapabilities('sidebar-panel');
        expect(panels[0].component).toBe(MockComponent);
      });
    });

    describe('slash-command', () => {
      it('indexes slash-command capabilities', () => {
        const plugin = createServerPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-command',
            capabilities: [
              {
                type: 'slash-command',
                command: 'task',
                label: 'Add Task',
                description: 'Add a new task',
                icon: 'Plus',
              },
            ],
          }),
        });

        registry.register(plugin);

        const commands = registry.getCapabilities('slash-command');
        expect(commands).toHaveLength(1);
        expect(commands[0].command).toBe('task');
        expect(commands[0].label).toBe('Add Task');
        expect(commands[0].description).toBe('Add a new task');
        expect(commands[0].icon).toBe('Plus');
        expect(commands[0].pluginId).toBe('@scribe/plugin-command');
      });

      it('extracts handler from client plugin', () => {
        const plugin = createClientPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-command-handler',
            capabilities: [
              {
                type: 'slash-command',
                command: 'mytask',
                label: 'My Task',
              },
            ],
          }),
          slashCommands: {
            mytask: mockHandler,
          },
        });

        registry.register(plugin);

        const commands = registry.getCapabilities('slash-command');
        expect(commands[0].handler).toBe(mockHandler);
      });
    });

    describe('command-palette-command', () => {
      it('indexes command-palette-command capabilities', () => {
        const plugin = createServerPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-palette',
            capabilities: [
              {
                type: 'command-palette-command',
                id: 'todo.createTask',
                label: 'Create Task',
                description: 'Create a new task',
                icon: 'CheckSquare',
                shortcut: '⌘T',
                category: 'Tasks',
                priority: 10,
              },
            ],
          }),
        });

        registry.register(plugin);

        const paletteCommands = registry.getCapabilities('command-palette-command');
        expect(paletteCommands).toHaveLength(1);
        expect(paletteCommands[0].id).toBe('todo.createTask');
        expect(paletteCommands[0].label).toBe('Create Task');
        expect(paletteCommands[0].description).toBe('Create a new task');
        expect(paletteCommands[0].icon).toBe('CheckSquare');
        expect(paletteCommands[0].shortcut).toBe('⌘T');
        expect(paletteCommands[0].category).toBe('Tasks');
        expect(paletteCommands[0].priority).toBe(10);
        expect(paletteCommands[0].pluginId).toBe('@scribe/plugin-palette');
      });

      it('uses default category of "General" when not specified', () => {
        const plugin = createServerPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-palette-default-cat',
            capabilities: [
              {
                type: 'command-palette-command',
                id: 'test.command',
                label: 'Test Command',
              },
            ],
          }),
        });

        registry.register(plugin);

        const paletteCommands = registry.getCapabilities('command-palette-command');
        expect(paletteCommands[0].category).toBe('General');
      });

      it('uses default priority of 100 when not specified', () => {
        const plugin = createServerPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-palette-default-pri',
            capabilities: [
              {
                type: 'command-palette-command',
                id: 'test.command',
                label: 'Test Command',
              },
            ],
          }),
        });

        registry.register(plugin);

        const paletteCommands = registry.getCapabilities('command-palette-command');
        expect(paletteCommands[0].priority).toBe(100);
      });

      it('extracts handler from client plugin', () => {
        const plugin = createClientPlugin({
          manifest: createManifest({
            id: '@scribe/plugin-palette-handler',
            capabilities: [
              {
                type: 'command-palette-command',
                id: 'todo.createTask',
                label: 'Create Task',
              },
            ],
          }),
          commandPaletteCommands: {
            'todo.createTask': mockPaletteHandler,
          },
        });

        registry.register(plugin);

        const paletteCommands = registry.getCapabilities('command-palette-command');
        expect(paletteCommands[0].handler).toBe(mockPaletteHandler);
      });
    });

    it('getCapabilities returns frozen array', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-frozen-caps',
          capabilities: [{ type: 'trpc-router', namespace: 'frozenTest' }],
        }),
      });

      registry.register(plugin);

      const capabilities = registry.getCapabilities('trpc-router');
      expect(Object.isFrozen(capabilities)).toBe(true);
    });
  });

  // ==========================================================================
  // Conflict Detection Tests
  // ==========================================================================

  describe('capability conflict detection', () => {
    it('hasCapabilityConflict returns true for existing capability', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-conflict-check',
          capabilities: [{ type: 'trpc-router', namespace: 'existing' }],
        }),
      });

      registry.register(plugin);

      expect(registry.hasCapabilityConflict('trpc-router', 'existing')).toBe(true);
      expect(registry.hasCapabilityConflict('trpc-router', 'nonexistent')).toBe(false);
    });

    it('warns and skips conflicting trpc-router namespace', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const pluginA = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-a',
          capabilities: [{ type: 'trpc-router', namespace: 'sharedNs' }],
        }),
      });

      const pluginB = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-b',
          capabilities: [{ type: 'trpc-router', namespace: 'sharedNs' }],
        }),
      });

      registry.register(pluginA);
      registry.register(pluginB);

      // Both plugins are registered
      expect(registry.pluginCount).toBe(2);

      // Only one router for the namespace (first registration wins)
      const routers = registry.getCapabilities('trpc-router');
      expect(routers).toHaveLength(1);
      expect(routers[0].pluginId).toBe('@scribe/plugin-a');

      // Warning was logged
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Capability conflict: trpc-router:sharedNs')
      );

      warnSpy.mockRestore();
    });

    it('warns and skips conflicting sidebar-panel ID', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const pluginA = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-a',
          capabilities: [
            {
              type: 'sidebar-panel',
              id: 'shared-panel',
              label: 'Panel A',
              icon: 'A',
            },
          ],
        }),
      });

      const pluginB = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-b',
          capabilities: [
            {
              type: 'sidebar-panel',
              id: 'shared-panel',
              label: 'Panel B',
              icon: 'B',
            },
          ],
        }),
      });

      registry.register(pluginA);
      registry.register(pluginB);

      const panels = registry.getCapabilities('sidebar-panel');
      expect(panels).toHaveLength(1);
      expect(panels[0].label).toBe('Panel A'); // First registration wins

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Capability conflict: sidebar-panel:shared-panel')
      );

      warnSpy.mockRestore();
    });

    it('warns and skips conflicting slash-command', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const pluginA = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-a',
          capabilities: [{ type: 'slash-command', command: 'task', label: 'Task A' }],
        }),
      });

      const pluginB = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-b',
          capabilities: [{ type: 'slash-command', command: 'task', label: 'Task B' }],
        }),
      });

      registry.register(pluginA);
      registry.register(pluginB);

      const commands = registry.getCapabilities('slash-command');
      expect(commands).toHaveLength(1);
      expect(commands[0].label).toBe('Task A'); // First registration wins

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Capability conflict: slash-command:task')
      );

      warnSpy.mockRestore();
    });

    it('warns and skips conflicting command-palette-command', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const pluginA = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-a',
          capabilities: [
            { type: 'command-palette-command', id: 'todo.createTask', label: 'Create Task A' },
          ],
        }),
      });

      const pluginB = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-b',
          capabilities: [
            { type: 'command-palette-command', id: 'todo.createTask', label: 'Create Task B' },
          ],
        }),
      });

      registry.register(pluginA);
      registry.register(pluginB);

      const paletteCommands = registry.getCapabilities('command-palette-command');
      expect(paletteCommands).toHaveLength(1);
      expect(paletteCommands[0].label).toBe('Create Task A'); // First registration wins

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Capability conflict: command-palette-command:todo.createTask')
      );

      warnSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Status Management Tests
  // ==========================================================================

  describe('updatePluginStatus', () => {
    it('updates plugin status successfully', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-status' }),
      });

      registry.register(plugin);
      expect(registry.getPlugin('@scribe/plugin-status')?.status).toBe('registered');

      const result = registry.updatePluginStatus('@scribe/plugin-status', 'active');

      expect(result).toBe(true);
      expect(registry.getPlugin('@scribe/plugin-status')?.status).toBe('active');
    });

    it('sets error message when status is error', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-error' }),
      });

      registry.register(plugin);
      registry.updatePluginStatus('@scribe/plugin-error', 'error', 'Failed to activate');

      const registered = registry.getPlugin('@scribe/plugin-error');
      expect(registered?.status).toBe('error');
      expect(registered?.error).toBe('Failed to activate');
    });

    it('returns false for non-existent plugin', () => {
      const result = registry.updatePluginStatus('@scribe/plugin-nonexistent', 'active');
      expect(result).toBe(false);
    });
  });

  // ==========================================================================
  // Utility Tests
  // ==========================================================================

  describe('clear', () => {
    it('removes all plugins and capabilities', () => {
      const pluginA = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-a',
          capabilities: [{ type: 'trpc-router', namespace: 'a' }],
        }),
      });
      const pluginB = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-b',
          capabilities: [{ type: 'trpc-router', namespace: 'b' }],
        }),
      });

      registry.register(pluginA);
      registry.register(pluginB);
      expect(registry.pluginCount).toBe(2);

      registry.clear();

      expect(registry.pluginCount).toBe(0);
      expect(registry.getAllPlugins()).toHaveLength(0);
      expect(registry.getCapabilities('trpc-router')).toHaveLength(0);
    });
  });

  describe('pluginCount', () => {
    it('returns correct count', () => {
      expect(registry.pluginCount).toBe(0);

      registry.register(
        createServerPlugin({
          manifest: createManifest({ id: '@scribe/plugin-1' }),
        })
      );
      expect(registry.pluginCount).toBe(1);

      registry.register(
        createServerPlugin({
          manifest: createManifest({ id: '@scribe/plugin-2' }),
        })
      );
      expect(registry.pluginCount).toBe(2);

      registry.unregister('@scribe/plugin-1');
      expect(registry.pluginCount).toBe(1);
    });
  });

  describe('hasPlugin', () => {
    it('returns true for registered plugin', () => {
      registry.register(
        createServerPlugin({
          manifest: createManifest({ id: '@scribe/plugin-exists' }),
        })
      );

      expect(registry.hasPlugin('@scribe/plugin-exists')).toBe(true);
    });

    it('returns false for non-existent plugin', () => {
      expect(registry.hasPlugin('@scribe/plugin-nonexistent')).toBe(false);
    });
  });

  // ==========================================================================
  // PluginConflictError Tests
  // ==========================================================================

  describe('PluginConflictError', () => {
    it('has correct name and message', () => {
      const error = new PluginConflictError('Test error', '@scribe/test');

      expect(error.name).toBe('PluginConflictError');
      expect(error.message).toBe('Test error');
      expect(error.pluginId).toBe('@scribe/test');
    });

    it('is an instance of Error', () => {
      const error = new PluginConflictError('Test error', '@scribe/test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginConflictError);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles plugin with multiple capabilities of same type', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-multi',
          capabilities: [
            {
              type: 'sidebar-panel',
              id: 'panel-a',
              label: 'Panel A',
              icon: 'A',
            },
            {
              type: 'sidebar-panel',
              id: 'panel-b',
              label: 'Panel B',
              icon: 'B',
            },
          ],
        }),
      });

      registry.register(plugin);

      const panels = registry.getCapabilities('sidebar-panel');
      expect(panels).toHaveLength(2);
      expect(panels.map((p) => p.id)).toEqual(['panel-a', 'panel-b']);
    });

    it('handles plugin with no capabilities', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-empty',
          capabilities: [],
        }),
      });

      registry.register(plugin);

      expect(registry.hasPlugin('@scribe/plugin-empty')).toBe(true);
      expect(registry.getCapabilities('trpc-router')).toHaveLength(0);
    });

    it('handles plugin with all capability types', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({
          id: '@scribe/plugin-all',
          capabilities: [
            { type: 'trpc-router', namespace: 'all' },
            { type: 'storage', keys: ['data'] },
            { type: 'event-hook', events: ['note:created'] },
            { type: 'sidebar-panel', id: 'all-panel', label: 'All', icon: 'All' },
            { type: 'slash-command', command: 'all', label: 'All Command' },
            { type: 'command-palette-command', id: 'all.command', label: 'All Palette Command' },
          ],
        }),
      });

      registry.register(plugin);

      expect(registry.getCapabilities('trpc-router')).toHaveLength(1);
      expect(registry.getCapabilities('storage')).toHaveLength(1);
      expect(registry.getCapabilities('event-hook')).toHaveLength(1);
      expect(registry.getCapabilities('sidebar-panel')).toHaveLength(1);
      expect(registry.getCapabilities('slash-command')).toHaveLength(1);
      expect(registry.getCapabilities('command-palette-command')).toHaveLength(1);
    });
  });
});
