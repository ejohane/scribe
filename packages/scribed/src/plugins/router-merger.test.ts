/**
 * Tests for Plugin tRPC Router Merger
 *
 * These tests verify:
 * 1. Namespace validation (format and reserved checks)
 * 2. Plugin router collection from registry
 * 3. Router merging with conflict detection
 * 4. Error handling wrapper registration
 * 5. Namespace availability checks
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import type { AnyRouter } from '@trpc/server';
import { PluginRegistry, PluginLifecycleManager } from '@scribe/plugin-core';
import type { ServerPlugin, PluginManifest } from '@scribe/plugin-core';
import {
  validateNamespaceFormat,
  validateNamespace,
  isReservedNamespace,
  NamespaceValidationError,
  RESERVED_NAMESPACES,
  collectPluginRouters,
  buildAppRouter,
  wrapPluginRouter,
  handlePluginRouterError,
  clearRouterLifecycleMap,
  getAllNamespaces,
  isNamespaceAvailable,
  type PluginRouterEntry,
} from './router-merger.js';

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

// Mock router factory - creates a simple object that acts like a router
function createMockRouter(name = 'mock'): AnyRouter {
  return {
    _def: { procedures: {}, router: true },
    createCaller: () => ({}),
    _name: name,
  } as unknown as AnyRouter;
}

function createServerPlugin(
  overrides: Partial<ServerPlugin> = {},
  manifestOverrides: Partial<PluginManifest> = {}
): ServerPlugin {
  return {
    manifest: createManifest(manifestOverrides),
    ...overrides,
  };
}

// Simple router factory for tests
const mockRouterFactory = (routers: Record<string, AnyRouter>): AnyRouter => {
  return {
    _def: { procedures: routers, router: true },
    createCaller: () => ({}),
    _routers: routers,
  } as unknown as AnyRouter;
};

// ============================================================================
// Tests
// ============================================================================

describe('router-merger', () => {
  // Clear lifecycle map before each test
  beforeEach(() => {
    clearRouterLifecycleMap();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Namespace Format Validation Tests
  // ==========================================================================

  describe('validateNamespaceFormat', () => {
    it('accepts valid camelCase namespaces', () => {
      expect(validateNamespaceFormat('examples')).toBe(true);
      expect(validateNamespaceFormat('myPlugin')).toBe(true);
      expect(validateNamespaceFormat('myAwesomePlugin')).toBe(true);
      expect(validateNamespaceFormat('plugin123')).toBe(true);
      expect(validateNamespaceFormat('a')).toBe(true);
    });

    it('rejects namespaces starting with uppercase', () => {
      expect(() => validateNamespaceFormat('MyPlugin')).toThrow(NamespaceValidationError);
      expect(() => validateNamespaceFormat('MyPlugin')).toThrow('must be camelCase');
    });

    it('rejects namespaces with hyphens', () => {
      expect(() => validateNamespaceFormat('my-plugin')).toThrow(NamespaceValidationError);
      expect(() => validateNamespaceFormat('my-plugin')).toThrow('must be camelCase');
    });

    it('rejects namespaces with underscores', () => {
      expect(() => validateNamespaceFormat('my_plugin')).toThrow(NamespaceValidationError);
    });

    it('rejects namespaces starting with numbers', () => {
      expect(() => validateNamespaceFormat('123plugin')).toThrow(NamespaceValidationError);
    });

    it('rejects empty namespace', () => {
      expect(() => validateNamespaceFormat('')).toThrow(NamespaceValidationError);
    });

    it('rejects namespaces with special characters', () => {
      expect(() => validateNamespaceFormat('my@plugin')).toThrow(NamespaceValidationError);
      expect(() => validateNamespaceFormat('my.plugin')).toThrow(NamespaceValidationError);
      expect(() => validateNamespaceFormat('my/plugin')).toThrow(NamespaceValidationError);
    });

    it('includes namespace in error', () => {
      try {
        validateNamespaceFormat('Invalid-Name');
      } catch (error) {
        expect(error).toBeInstanceOf(NamespaceValidationError);
        expect((error as NamespaceValidationError).namespace).toBe('Invalid-Name');
        expect((error as NamespaceValidationError).reason).toBe('invalid_format');
      }
    });
  });

  // ==========================================================================
  // Reserved Namespace Tests
  // ==========================================================================

  describe('isReservedNamespace', () => {
    it('returns true for reserved namespaces', () => {
      for (const reserved of RESERVED_NAMESPACES) {
        expect(isReservedNamespace(reserved)).toBe(true);
      }
    });

    it('returns false for non-reserved namespaces', () => {
      expect(isReservedNamespace('examples')).toBe(false);
      expect(isReservedNamespace('myPlugin')).toBe(false);
      expect(isReservedNamespace('customRouter')).toBe(false);
    });

    it('includes notes, search, graph in reserved list', () => {
      expect(RESERVED_NAMESPACES).toContain('notes');
      expect(RESERVED_NAMESPACES).toContain('search');
      expect(RESERVED_NAMESPACES).toContain('graph');
    });
  });

  describe('validateNamespace', () => {
    it('accepts valid non-reserved namespaces', () => {
      expect(validateNamespace('examples')).toBe(true);
      expect(validateNamespace('myPlugin')).toBe(true);
    });

    it('rejects reserved namespaces', () => {
      expect(() => validateNamespace('notes')).toThrow(NamespaceValidationError);
      expect(() => validateNamespace('notes')).toThrow('reserved');
    });

    it('rejects invalid format before checking reserved', () => {
      // This tests that format validation happens first
      expect(() => validateNamespace('Invalid-Format')).toThrow('must be camelCase');
    });

    it('includes correct reason in error', () => {
      try {
        validateNamespace('notes');
      } catch (error) {
        expect(error).toBeInstanceOf(NamespaceValidationError);
        expect((error as NamespaceValidationError).reason).toBe('reserved');
      }
    });
  });

  // ==========================================================================
  // NamespaceValidationError Tests
  // ==========================================================================

  describe('NamespaceValidationError', () => {
    it('has correct name and properties', () => {
      const error = new NamespaceValidationError('test', 'reserved');

      expect(error.name).toBe('NamespaceValidationError');
      expect(error.namespace).toBe('test');
      expect(error.reason).toBe('reserved');
    });

    it('generates correct message for reserved', () => {
      const error = new NamespaceValidationError('notes', 'reserved');
      expect(error.message).toBe('Namespace "notes" is reserved for core routers');
    });

    it('generates correct message for invalid_format', () => {
      const error = new NamespaceValidationError('bad-name', 'invalid_format');
      expect(error.message).toContain('must be camelCase');
    });

    it('generates correct message for conflict', () => {
      const error = new NamespaceValidationError('existing', 'conflict');
      expect(error.message).toContain('conflicts with an existing router');
    });

    it('is an instance of Error', () => {
      const error = new NamespaceValidationError('test', 'reserved');
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(NamespaceValidationError);
    });
  });

  // ==========================================================================
  // collectPluginRouters Tests
  // ==========================================================================

  describe('collectPluginRouters', () => {
    let registry: PluginRegistry;

    beforeEach(() => {
      registry = new PluginRegistry();
    });

    it('returns empty array when no plugins registered', () => {
      const routers = collectPluginRouters(registry);
      expect(routers).toEqual([]);
    });

    it('returns empty array when no plugins have trpc-router capability', () => {
      const plugin = createServerPlugin(
        {},
        {
          id: '@scribe/plugin-no-router',
          capabilities: [{ type: 'storage' }],
        }
      );

      registry.register(plugin);

      const routers = collectPluginRouters(registry);
      expect(routers).toEqual([]);
    });

    it('collects router from plugin with trpc-router capability', () => {
      const mockRouter = createMockRouter('examples');
      const plugin = createServerPlugin(
        { router: mockRouter },
        {
          id: '@scribe/plugin-example',
          capabilities: [{ type: 'trpc-router', namespace: 'examples' }],
        }
      );

      registry.register(plugin);

      const routers = collectPluginRouters(registry);
      expect(routers).toHaveLength(1);
      expect(routers[0].pluginId).toBe('@scribe/plugin-example');
      expect(routers[0].namespace).toBe('examples');
      expect(routers[0].router).toBe(mockRouter);
    });

    it('collects routers from multiple plugins', () => {
      const exampleRouter = createMockRouter('examples');
      const examplePlugin = createServerPlugin(
        { router: exampleRouter },
        {
          id: '@scribe/plugin-example',
          capabilities: [{ type: 'trpc-router', namespace: 'examples' }],
        }
      );

      const calendarRouter = createMockRouter('calendar');
      const calendarPlugin = createServerPlugin(
        { router: calendarRouter },
        {
          id: '@scribe/plugin-calendar',
          capabilities: [{ type: 'trpc-router', namespace: 'calendar' }],
        }
      );

      registry.register(examplePlugin);
      registry.register(calendarPlugin);

      const routers = collectPluginRouters(registry);
      expect(routers).toHaveLength(2);
      expect(routers.map((r) => r.namespace).sort()).toEqual(['calendar', 'examples']);
    });

    it('warns and skips when plugin has capability but no router', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const plugin = createServerPlugin(
        { router: undefined }, // No router
        {
          id: '@scribe/plugin-no-router',
          capabilities: [{ type: 'trpc-router', namespace: 'missing' }],
        }
      );

      registry.register(plugin);

      const routers = collectPluginRouters(registry);
      expect(routers).toEqual([]);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('declares trpc-router capability but has no router')
      );
    });
  });

  // ==========================================================================
  // wrapPluginRouter Tests
  // ==========================================================================

  describe('wrapPluginRouter', () => {
    it('returns the router', () => {
      const mockRouter = createMockRouter('test');
      const wrapped = wrapPluginRouter('@scribe/plugin-test', mockRouter);

      expect(wrapped).toBe(mockRouter);
    });

    it('logs router registration', () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const mockRouter = createMockRouter('test');
      wrapPluginRouter('@scribe/plugin-test', mockRouter);

      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('Registered router for plugin: @scribe/plugin-test')
      );
    });
  });

  describe('handlePluginRouterError', () => {
    it('logs the error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const error = new Error('Test error');
      await handlePluginRouterError('@scribe/plugin-test', error);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Plugin @scribe/plugin-test router error'),
        error
      );
    });

    it('reports error to lifecycle manager if registered', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const registry = new PluginRegistry();
      const lifecycle = new PluginLifecycleManager(registry);

      // Register a plugin
      const plugin = createServerPlugin(
        { router: createMockRouter('test') },
        { id: '@scribe/plugin-test' }
      );
      registry.register(plugin);

      // Mark it as activated so errors will be tracked
      lifecycle.setInitialState('@scribe/plugin-test', 'activated');

      // Mock handlePluginError
      const handleErrorSpy = vi.spyOn(lifecycle, 'handlePluginError').mockResolvedValue();

      // Wrap router with lifecycle
      wrapPluginRouter('@scribe/plugin-test', createMockRouter('test'), lifecycle);

      // Trigger error
      const error = new Error('Test error');
      await handlePluginRouterError('@scribe/plugin-test', error);

      expect(handleErrorSpy).toHaveBeenCalledWith('@scribe/plugin-test', error);
    });
  });

  // ==========================================================================
  // buildAppRouter Tests
  // ==========================================================================

  describe('buildAppRouter', () => {
    it('builds router with only core routers', () => {
      const coreRouters = {
        notes: createMockRouter('notes'),
        search: createMockRouter('search'),
      };

      const result = buildAppRouter(coreRouters, [], mockRouterFactory);

      expect(result.merged).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.router).toBeDefined();
    });

    it('merges plugin routers with core routers', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const coreRouters = {
        notes: createMockRouter('notes'),
      };

      const pluginRouters: PluginRouterEntry[] = [
        {
          pluginId: '@scribe/plugin-example',
          namespace: 'examples',
          router: createMockRouter('examples'),
        },
      ];

      const result = buildAppRouter(coreRouters, pluginRouters, mockRouterFactory);

      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].namespace).toBe('examples');
      expect(result.skipped).toEqual([]);
    });

    it('skips plugin routers with invalid namespace format', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const coreRouters = {
        notes: createMockRouter('notes'),
      };

      const pluginRouters: PluginRouterEntry[] = [
        {
          pluginId: '@scribe/plugin-bad',
          namespace: 'Invalid-Name',
          router: createMockRouter('bad'),
        },
      ];

      const result = buildAppRouter(coreRouters, pluginRouters, mockRouterFactory);

      expect(result.merged).toEqual([]);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].pluginId).toBe('@scribe/plugin-bad');
      expect(result.skipped[0].reason).toContain('must be camelCase');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('skips plugin routers with conflicting namespaces', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const coreRouters = {
        notes: createMockRouter('notes'),
      };

      const pluginRouters: PluginRouterEntry[] = [
        {
          pluginId: '@scribe/plugin-conflict',
          namespace: 'notes', // Conflicts with core router
          router: createMockRouter('notes-conflict'),
        },
      ];

      const result = buildAppRouter(coreRouters, pluginRouters, mockRouterFactory);

      expect(result.merged).toEqual([]);
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toContain('conflicts');
      expect(warnSpy).toHaveBeenCalled();
    });

    it('skips plugin routers with conflicting plugin namespaces', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const coreRouters = {};

      const pluginRouters: PluginRouterEntry[] = [
        {
          pluginId: '@scribe/plugin-first',
          namespace: 'examples',
          router: createMockRouter('examples-first'),
        },
        {
          pluginId: '@scribe/plugin-second',
          namespace: 'examples', // Conflicts with first plugin
          router: createMockRouter('examples-second'),
        },
      ];

      const result = buildAppRouter(coreRouters, pluginRouters, mockRouterFactory);

      expect(result.merged).toHaveLength(1);
      expect(result.merged[0].pluginId).toBe('@scribe/plugin-first');
      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].pluginId).toBe('@scribe/plugin-second');
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Plugin @scribe/plugin-second'));
    });

    it('merges multiple valid plugin routers', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const coreRouters = {
        notes: createMockRouter('notes'),
      };

      const pluginRouters: PluginRouterEntry[] = [
        {
          pluginId: '@scribe/plugin-example',
          namespace: 'examples',
          router: createMockRouter('examples'),
        },
        {
          pluginId: '@scribe/plugin-calendar',
          namespace: 'calendar',
          router: createMockRouter('calendar'),
        },
        {
          pluginId: '@scribe/plugin-kanban',
          namespace: 'kanban',
          router: createMockRouter('kanban'),
        },
      ];

      const result = buildAppRouter(coreRouters, pluginRouters, mockRouterFactory);

      expect(result.merged).toHaveLength(3);
      expect(result.merged.map((m) => m.namespace).sort()).toEqual([
        'calendar',
        'examples',
        'kanban',
      ]);
      expect(result.skipped).toEqual([]);
    });

    it('passes lifecycle manager to router wrapper', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const registry = new PluginRegistry();
      const lifecycle = new PluginLifecycleManager(registry);

      const coreRouters = {};
      const pluginRouters: PluginRouterEntry[] = [
        {
          pluginId: '@scribe/plugin-test',
          namespace: 'test',
          router: createMockRouter('test'),
        },
      ];

      const result = buildAppRouter(coreRouters, pluginRouters, mockRouterFactory, lifecycle);

      expect(result.merged).toHaveLength(1);
    });
  });

  // ==========================================================================
  // Helper Function Tests
  // ==========================================================================

  describe('getAllNamespaces', () => {
    it('returns core namespaces when no plugins', () => {
      const coreRouters = {
        notes: createMockRouter('notes'),
        search: createMockRouter('search'),
      };

      const namespaces = getAllNamespaces(coreRouters, []);

      expect(namespaces.sort()).toEqual(['notes', 'search']);
    });

    it('combines core and plugin namespaces', () => {
      const coreRouters = {
        notes: createMockRouter('notes'),
      };

      const pluginRouters: PluginRouterEntry[] = [
        {
          pluginId: '@scribe/plugin-example',
          namespace: 'examples',
          router: createMockRouter('examples'),
        },
      ];

      const namespaces = getAllNamespaces(coreRouters, pluginRouters);

      expect(namespaces.sort()).toEqual(['examples', 'notes']);
    });

    it('returns sorted array', () => {
      const coreRouters = {
        zebra: createMockRouter('zebra'),
        apple: createMockRouter('apple'),
      };

      const pluginRouters: PluginRouterEntry[] = [
        { pluginId: 'p', namespace: 'mango', router: createMockRouter('m') },
      ];

      const namespaces = getAllNamespaces(coreRouters, pluginRouters);

      expect(namespaces).toEqual(['apple', 'mango', 'zebra']);
    });
  });

  describe('isNamespaceAvailable', () => {
    it('returns true for available namespace', () => {
      const coreRouters = {
        notes: createMockRouter('notes'),
      };

      expect(isNamespaceAvailable('examples', coreRouters)).toBe(true);
    });

    it('returns false for invalid format', () => {
      const coreRouters = {};

      expect(isNamespaceAvailable('Invalid-Name', coreRouters)).toBe(false);
      expect(isNamespaceAvailable('123name', coreRouters)).toBe(false);
    });

    it('returns false for reserved namespace', () => {
      const coreRouters = {};

      expect(isNamespaceAvailable('notes', coreRouters)).toBe(false);
      expect(isNamespaceAvailable('system', coreRouters)).toBe(false);
    });

    it('returns false for namespace used by core router', () => {
      const coreRouters = {
        customCore: createMockRouter('customCore'),
      };

      expect(isNamespaceAvailable('customCore', coreRouters)).toBe(false);
    });

    it('returns false for namespace used by another plugin', () => {
      const coreRouters = {};
      const existingPlugins = new Set(['examples']);

      expect(isNamespaceAvailable('examples', coreRouters, existingPlugins)).toBe(false);
    });

    it('returns true when namespace not in existing plugins', () => {
      const coreRouters = {};
      const existingPlugins = new Set(['examples']);

      expect(isNamespaceAvailable('calendar', coreRouters, existingPlugins)).toBe(true);
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles empty core routers and empty plugin routers', () => {
      const result = buildAppRouter({}, [], mockRouterFactory);

      expect(result.merged).toEqual([]);
      expect(result.skipped).toEqual([]);
      expect(result.router).toBeDefined();
    });

    it('handles plugin router entries with same namespace as reserved but different case', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      // 'Notes' (capital N) should be rejected due to format, not reserved
      const pluginRouters: PluginRouterEntry[] = [
        {
          pluginId: '@scribe/plugin-test',
          namespace: 'Notes', // Invalid format (starts with uppercase)
          router: createMockRouter('notes'),
        },
      ];

      const result = buildAppRouter({}, pluginRouters, mockRouterFactory);

      expect(result.skipped).toHaveLength(1);
      expect(result.skipped[0].reason).toContain('must be camelCase');
    });

    it('preserves order of merged routers', () => {
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const pluginRouters: PluginRouterEntry[] = [
        { pluginId: 'a', namespace: 'alpha', router: createMockRouter('a') },
        { pluginId: 'b', namespace: 'beta', router: createMockRouter('b') },
        { pluginId: 'c', namespace: 'gamma', router: createMockRouter('c') },
      ];

      const result = buildAppRouter({}, pluginRouters, mockRouterFactory);

      expect(result.merged.map((m) => m.namespace)).toEqual(['alpha', 'beta', 'gamma']);
    });

    it('clearRouterLifecycleMap clears the internal map', async () => {
      vi.spyOn(console, 'error').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      const registry = new PluginRegistry();
      const lifecycle = new PluginLifecycleManager(registry);
      const handleErrorSpy = vi.spyOn(lifecycle, 'handlePluginError').mockResolvedValue();

      // Wrap router with lifecycle
      wrapPluginRouter('@scribe/plugin-test', createMockRouter('test'), lifecycle);

      // Clear the map
      clearRouterLifecycleMap();

      // Now error handling should not call lifecycle
      await handlePluginRouterError('@scribe/plugin-test', new Error('Test'));

      expect(handleErrorSpy).not.toHaveBeenCalled();
    });
  });
});
