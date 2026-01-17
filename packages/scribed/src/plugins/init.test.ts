/**
 * Tests for Plugin System Initialization
 *
 * These tests verify:
 * 1. Plugin system initialization with database
 * 2. Plugin loading from modules
 * 3. Plugin activation and deactivation
 * 4. Router collection
 * 5. Graceful shutdown
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import type { PluginManifest, ServerPlugin, PluginModule } from '@scribe/plugin-core';
import { PLUGIN_STORAGE_SCHEMA, DefaultPluginEventBus } from '@scribe/plugin-core';
import { initializePluginSystem } from './init.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestDatabase(): Database.Database {
  const db = new Database(':memory:');
  // Initialize the plugin storage table
  db.exec(PLUGIN_STORAGE_SCHEMA);
  return db;
}

function createTestManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: '@scribe/plugin-test',
    version: '1.0.0',
    name: 'Test Plugin',
    // Manifest requires at least one capability
    capabilities: [{ type: 'storage' }],
    ...overrides,
  };
}

function createTestPluginModule(
  overrides: Partial<PluginManifest> = {},
  pluginOverrides: Partial<ServerPlugin> = {}
): PluginModule {
  const manifest = createTestManifest(overrides);

  return {
    manifest,
    createServerPlugin: () => ({
      manifest,
      ...pluginOverrides,
    }),
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('init', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = createTestDatabase();
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    db.close();
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Initialization Tests
  // ==========================================================================

  describe('initializePluginSystem', () => {
    it('creates plugin system with all required components', async () => {
      const system = await initializePluginSystem(db);

      expect(system.registry).toBeDefined();
      expect(system.loader).toBeDefined();
      expect(system.eventBus).toBeDefined();
      expect(system.lifecycle).toBeDefined();
    });

    it('exposes loadPlugins method', async () => {
      const system = await initializePluginSystem(db);
      expect(system.loadPlugins).toBeTypeOf('function');
    });

    it('exposes activateAll method', async () => {
      const system = await initializePluginSystem(db);
      expect(system.activateAll).toBeTypeOf('function');
    });

    it('exposes getRouters method', async () => {
      const system = await initializePluginSystem(db);
      expect(system.getRouters).toBeTypeOf('function');
    });

    it('exposes shutdown method', async () => {
      const system = await initializePluginSystem(db);
      expect(system.shutdown).toBeTypeOf('function');
    });

    it('logs initialization message', async () => {
      const logSpy = vi.spyOn(console, 'log');

      await initializePluginSystem(db);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Initializing plugin system'));
    });

    it('accepts options object with db', async () => {
      const system = await initializePluginSystem({ db });

      expect(system.registry).toBeDefined();
      expect(system.eventBus).toBeDefined();
    });

    it('uses provided eventBus when passed in options', async () => {
      const customEventBus = new DefaultPluginEventBus();
      const system = await initializePluginSystem({ db, eventBus: customEventBus });

      expect(system.eventBus).toBe(customEventBus);
    });

    it('creates new eventBus when not provided in options', async () => {
      const system = await initializePluginSystem({ db });

      expect(system.eventBus).toBeInstanceOf(DefaultPluginEventBus);
    });
  });

  // ==========================================================================
  // loadPlugins Tests
  // ==========================================================================

  describe('loadPlugins', () => {
    it('handles empty plugin array', async () => {
      const system = await initializePluginSystem(db);

      await expect(system.loadPlugins([])).resolves.not.toThrow();
    });

    it('loads a single plugin module', async () => {
      const system = await initializePluginSystem(db);
      const module = createTestPluginModule({ id: '@scribe/plugin-test' });

      await system.loadPlugins([module]);

      expect(system.registry.pluginCount).toBe(1);
      expect(system.registry.hasPlugin('@scribe/plugin-test')).toBe(true);
    });

    it('loads multiple plugin modules', async () => {
      const system = await initializePluginSystem(db);
      const module1 = createTestPluginModule({ id: '@scribe/plugin-one' });
      const module2 = createTestPluginModule({ id: '@scribe/plugin-two' });

      await system.loadPlugins([module1, module2]);

      expect(system.registry.pluginCount).toBe(2);
    });

    it('logs loaded plugin count', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const system = await initializePluginSystem(db);
      const module = createTestPluginModule({ id: '@scribe/plugin-test' });

      await system.loadPlugins([module]);

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Loaded 1 plugin'));
    });

    it('logs warning when plugins fail to load', async () => {
      const warnSpy = vi.spyOn(console, 'warn');
      const system = await initializePluginSystem(db);

      // Create a module that throws during plugin creation
      const badModule: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-bad' }),
        createServerPlugin: () => {
          throw new Error('Failed to create plugin');
        },
      };

      await system.loadPlugins([badModule]);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('failed to load'),
        expect.any(String)
      );
    });

    it('continues loading other plugins when one fails', async () => {
      const system = await initializePluginSystem(db);

      const goodModule = createTestPluginModule({ id: '@scribe/plugin-good' });
      const badModule: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-bad' }),
        createServerPlugin: () => {
          throw new Error('Failed');
        },
      };

      await system.loadPlugins([badModule, goodModule]);

      // Good plugin should still be loaded
      expect(system.registry.hasPlugin('@scribe/plugin-good')).toBe(true);
    });

    it('provides storage to plugins via context', async () => {
      const system = await initializePluginSystem(db);

      let receivedStorage: unknown = null;

      const module: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-storage-test' }),
        createServerPlugin: (context) => {
          receivedStorage = context.storage;
          return { manifest: context.manifest };
        },
      };

      await system.loadPlugins([module]);

      expect(receivedStorage).not.toBeNull();
      expect(receivedStorage).toHaveProperty('get');
      expect(receivedStorage).toHaveProperty('set');
    });

    it('provides event emitter to plugins via context', async () => {
      const system = await initializePluginSystem(db);

      let receivedEvents: unknown = null;

      const module: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-events-test' }),
        createServerPlugin: (context) => {
          receivedEvents = context.events;
          return { manifest: context.manifest };
        },
      };

      await system.loadPlugins([module]);

      expect(receivedEvents).not.toBeNull();
      expect(receivedEvents).toHaveProperty('on');
      expect(receivedEvents).toHaveProperty('emit');
    });

    it('provides logger to plugins via context', async () => {
      const system = await initializePluginSystem(db);

      let receivedLogger: unknown = null;

      const module: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-logger-test' }),
        createServerPlugin: (context) => {
          receivedLogger = context.logger;
          return { manifest: context.manifest };
        },
      };

      await system.loadPlugins([module]);

      expect(receivedLogger).not.toBeNull();
      expect(receivedLogger).toHaveProperty('debug');
      expect(receivedLogger).toHaveProperty('info');
      expect(receivedLogger).toHaveProperty('warn');
      expect(receivedLogger).toHaveProperty('error');
    });
  });

  // ==========================================================================
  // activateAll Tests
  // ==========================================================================

  describe('activateAll', () => {
    it('handles no plugins loaded', async () => {
      const system = await initializePluginSystem(db);

      await expect(system.activateAll()).resolves.not.toThrow();
    });

    it('activates all loaded plugins', async () => {
      const system = await initializePluginSystem(db);

      let activated = false;
      const module: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-test' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onActivate: async () => {
            activated = true;
          },
        }),
      };

      await system.loadPlugins([module]);
      await system.activateAll();

      expect(activated).toBe(true);
    });

    it('activates multiple plugins', async () => {
      const system = await initializePluginSystem(db);

      const activations: string[] = [];

      const module1: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-one' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onActivate: async () => {
            activations.push('one');
          },
        }),
      };

      const module2: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-two' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onActivate: async () => {
            activations.push('two');
          },
        }),
      };

      await system.loadPlugins([module1, module2]);
      await system.activateAll();

      expect(activations).toContain('one');
      expect(activations).toContain('two');
    });

    it('logs activation count', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const system = await initializePluginSystem(db);

      const module = createTestPluginModule({ id: '@scribe/plugin-test' });

      await system.loadPlugins([module]);
      await system.activateAll();

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Activation complete: 1 succeeded')
      );
    });

    it('continues activation when one plugin fails', async () => {
      const system = await initializePluginSystem(db);

      const activations: string[] = [];

      const goodModule: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-good' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onActivate: async () => {
            activations.push('good');
          },
        }),
      };

      const badModule: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-bad' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onActivate: async () => {
            throw new Error('Activation failed');
          },
        }),
      };

      await system.loadPlugins([badModule, goodModule]);
      await system.activateAll();

      expect(activations).toContain('good');
    });

    it('logs error when activation fails', async () => {
      const errorSpy = vi.spyOn(console, 'error');
      const system = await initializePluginSystem(db);

      const badModule: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-bad' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onActivate: async () => {
            throw new Error('Activation error');
          },
        }),
      };

      await system.loadPlugins([badModule]);
      await system.activateAll();

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to activate @scribe/plugin-bad'),
        expect.any(String)
      );
    });
  });

  // ==========================================================================
  // getRouters Tests
  // ==========================================================================

  describe('getRouters', () => {
    it('returns empty array when no plugins have routers', async () => {
      const system = await initializePluginSystem(db);
      const module = createTestPluginModule({ id: '@scribe/plugin-no-router' });

      await system.loadPlugins([module]);

      const routers = system.getRouters();
      expect(routers).toEqual([]);
    });

    it('returns routers from plugins with trpc-router capability', async () => {
      const system = await initializePluginSystem(db);

      const mockRouter = { _def: { procedures: {} } };

      const module: PluginModule = {
        manifest: createTestManifest({
          id: '@scribe/plugin-with-router',
          capabilities: [{ type: 'trpc-router', namespace: 'test' }],
        }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          router: mockRouter as unknown as import('@trpc/server').AnyRouter,
        }),
      };

      await system.loadPlugins([module]);

      const routers = system.getRouters();
      expect(routers).toHaveLength(1);
      expect(routers[0].namespace).toBe('test');
      expect(routers[0].pluginId).toBe('@scribe/plugin-with-router');
    });
  });

  // ==========================================================================
  // shutdown Tests
  // ==========================================================================

  describe('shutdown', () => {
    it('handles no plugins loaded', async () => {
      const system = await initializePluginSystem(db);

      await expect(system.shutdown()).resolves.not.toThrow();
    });

    it('deactivates active plugins', async () => {
      const system = await initializePluginSystem(db);

      let deactivated = false;

      const module: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-test' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onDeactivate: async () => {
            deactivated = true;
          },
        }),
      };

      await system.loadPlugins([module]);
      await system.activateAll();
      await system.shutdown();

      expect(deactivated).toBe(true);
    });

    it('deactivates plugins in reverse order', async () => {
      const system = await initializePluginSystem(db);

      const deactivations: string[] = [];

      const module1: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-one' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onDeactivate: async () => {
            deactivations.push('one');
          },
        }),
      };

      const module2: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-two' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onDeactivate: async () => {
            deactivations.push('two');
          },
        }),
      };

      await system.loadPlugins([module1, module2]);
      await system.activateAll();
      await system.shutdown();

      // Should deactivate in reverse order (two before one)
      expect(deactivations.indexOf('two')).toBeLessThan(deactivations.indexOf('one'));
    });

    it('logs shutdown count', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const system = await initializePluginSystem(db);

      const module = createTestPluginModule({ id: '@scribe/plugin-test' });

      await system.loadPlugins([module]);
      await system.activateAll();
      await system.shutdown();

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('Shutdown complete'));
    });

    it('continues shutdown when one plugin fails', async () => {
      const system = await initializePluginSystem(db);

      const deactivations: string[] = [];

      const goodModule: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-good' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onDeactivate: async () => {
            deactivations.push('good');
          },
        }),
      };

      const badModule: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-bad' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onDeactivate: async () => {
            throw new Error('Deactivation failed');
          },
        }),
      };

      await system.loadPlugins([goodModule, badModule]);
      await system.activateAll();
      await system.shutdown();

      // Good plugin should still be deactivated
      expect(deactivations).toContain('good');
    });

    it('clears event bus on shutdown', async () => {
      const system = await initializePluginSystem(db);
      const module = createTestPluginModule({ id: '@scribe/plugin-test' });

      await system.loadPlugins([module]);
      await system.shutdown();

      // Event bus should be cleared
      expect(system.eventBus.getHandlerCount('note:created')).toBe(0);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration', () => {
    it('full lifecycle: init -> load -> activate -> shutdown', async () => {
      const lifecycle: string[] = [];

      const system = await initializePluginSystem(db);
      lifecycle.push('init');

      const module: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-test' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onActivate: async () => {
            lifecycle.push('activate');
          },
          onDeactivate: async () => {
            lifecycle.push('deactivate');
          },
        }),
      };

      await system.loadPlugins([module]);
      lifecycle.push('loaded');

      await system.activateAll();
      lifecycle.push('activated');

      await system.shutdown();
      lifecycle.push('shutdown');

      expect(lifecycle).toEqual([
        'init',
        'loaded',
        'activate',
        'activated',
        'deactivate',
        'shutdown',
      ]);
    });

    it('plugin can use storage during lifecycle', async () => {
      const system = await initializePluginSystem(db);

      let storedValue: string | undefined = undefined;

      const module: PluginModule = {
        manifest: createTestManifest({
          id: '@scribe/plugin-storage',
          capabilities: [{ type: 'storage' }],
        }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onActivate: async () => {
            await context.storage.set('key', 'value');
            storedValue = await context.storage.get('key');
          },
        }),
      };

      await system.loadPlugins([module]);
      await system.activateAll();

      expect(storedValue).toBe('value');
    });

    it('plugin can subscribe to events during lifecycle', async () => {
      const system = await initializePluginSystem(db);

      let receivedEvent = false;

      const module: PluginModule = {
        manifest: createTestManifest({ id: '@scribe/plugin-events' }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          onActivate: async () => {
            context.events.on('note:created', () => {
              receivedEvent = true;
            });
          },
        }),
      };

      await system.loadPlugins([module]);
      await system.activateAll();

      // Emit an event through the event bus
      system.eventBus.emit({
        type: 'note:created',
        noteId: 'test-id',
        title: 'Test Note',
        createdAt: new Date(),
      });

      expect(receivedEvent).toBe(true);
    });

    it('auto-subscribes eventHandlers when plugin is activated', async () => {
      const system = await initializePluginSystem(db);

      let deletedNoteId: string | null = null;

      const module: PluginModule = {
        manifest: createTestManifest({
          id: '@scribe/plugin-event-handlers',
          capabilities: [{ type: 'storage' }, { type: 'event-hook', events: ['note:deleted'] }],
        }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          eventHandlers: {
            'note:deleted': (event) => {
              deletedNoteId = event.noteId;
            },
          },
        }),
      };

      await system.loadPlugins([module]);
      await system.activateAll();

      // Emit a note:deleted event through the event bus
      await system.eventBus.emit({
        type: 'note:deleted',
        noteId: 'deleted-note-123',
      });

      expect(deletedNoteId).toBe('deleted-note-123');
    });

    it('auto-subscribes async eventHandlers', async () => {
      const system = await initializePluginSystem(db);

      let handlerCalled = false;

      const module: PluginModule = {
        manifest: createTestManifest({
          id: '@scribe/plugin-async-handler',
          capabilities: [{ type: 'storage' }, { type: 'event-hook', events: ['note:deleted'] }],
        }),
        createServerPlugin: (context) => ({
          manifest: context.manifest,
          eventHandlers: {
            'note:deleted': async () => {
              // Simulate async operation
              await new Promise((resolve) => setTimeout(resolve, 10));
              handlerCalled = true;
            },
          },
        }),
      };

      await system.loadPlugins([module]);
      await system.activateAll();

      await system.eventBus.emit({
        type: 'note:deleted',
        noteId: 'test-note',
      });

      expect(handlerCalled).toBe(true);
    });
  });
});
