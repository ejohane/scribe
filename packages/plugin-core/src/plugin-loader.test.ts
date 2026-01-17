/**
 * Tests for PluginLoader
 *
 * These tests verify:
 * 1. Can load a valid plugin module
 * 2. Validates manifest before loading
 * 3. Creates appropriate context per environment
 * 4. Registers plugin with registry
 * 5. Handles load errors gracefully
 * 6. Batch loading continues after individual failures
 * 7. Returns structured load results
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  PluginLoader,
  PluginLoadError,
  detectEnvironment,
  type PluginModule,
  type PluginContextFactory,
} from './plugin-loader.js';
import { PluginRegistry } from './plugin-registry.js';
import type {
  PluginManifest,
  ServerPlugin,
  ClientPlugin,
  ServerPluginContext,
  ClientPluginContext,
} from './plugin-types.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createManifest(overrides: Partial<PluginManifest> = {}): PluginManifest {
  return {
    id: '@scribe/plugin-test',
    version: '1.0.0',
    name: 'Test Plugin',
    capabilities: [{ type: 'trpc-router', namespace: 'test' }],
    ...overrides,
  };
}

function createServerPluginInstance(manifest: PluginManifest): ServerPlugin {
  return {
    manifest,
  };
}

function createClientPluginInstance(manifest: PluginManifest): ClientPlugin {
  return {
    manifest,
  };
}

function createMockServerContext(manifest: PluginManifest): ServerPluginContext {
  return {
    manifest,
    storage: {
      get: vi.fn().mockResolvedValue(undefined),
      set: vi.fn().mockResolvedValue(undefined),
      delete: vi.fn().mockResolvedValue(undefined),
      keys: vi.fn().mockResolvedValue([]),
      clear: vi.fn().mockResolvedValue(undefined),
    },
    events: {
      on: vi.fn().mockReturnValue(() => {}),
      emit: vi.fn().mockResolvedValue(undefined),
    },
    logger: {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    },
  };
}

function createMockClientContext(manifest: PluginManifest): ClientPluginContext {
  return {
    manifest,
    client: {
      query: vi.fn().mockResolvedValue(undefined),
      mutate: vi.fn().mockResolvedValue(undefined),
    },
  };
}

function createPluginModule(
  manifest: PluginManifest,
  options: {
    hasServerPlugin?: boolean;
    hasClientPlugin?: boolean;
    serverPluginAsync?: boolean;
    clientPluginAsync?: boolean;
    serverPluginThrows?: boolean;
    clientPluginThrows?: boolean;
  } = {}
): PluginModule {
  const {
    hasServerPlugin = true,
    hasClientPlugin = true,
    serverPluginAsync = false,
    clientPluginAsync = false,
    serverPluginThrows = false,
    clientPluginThrows = false,
  } = options;

  const module: PluginModule = { manifest };

  if (hasServerPlugin) {
    module.createServerPlugin = serverPluginAsync
      ? async () => {
          if (serverPluginThrows) {
            throw new Error('Server plugin creation failed');
          }
          return createServerPluginInstance(manifest);
        }
      : () => {
          if (serverPluginThrows) {
            throw new Error('Server plugin creation failed');
          }
          return createServerPluginInstance(manifest);
        };
  }

  if (hasClientPlugin) {
    module.createClientPlugin = clientPluginAsync
      ? async () => {
          if (clientPluginThrows) {
            throw new Error('Client plugin creation failed');
          }
          return createClientPluginInstance(manifest);
        }
      : () => {
          if (clientPluginThrows) {
            throw new Error('Client plugin creation failed');
          }
          return createClientPluginInstance(manifest);
        };
  }

  return module;
}

// ============================================================================
// Mock Context Factory
// ============================================================================

function createMockContextFactory(isServer = true): PluginContextFactory {
  return {
    create: (manifest) => {
      if (isServer) {
        return createMockServerContext(manifest);
      }
      return createMockClientContext(manifest);
    },
  };
}

// ============================================================================
// Tests
// ============================================================================

describe('PluginLoader', () => {
  let registry: PluginRegistry;
  let contextFactory: PluginContextFactory;
  let loader: PluginLoader;

  beforeEach(() => {
    registry = new PluginRegistry();
    contextFactory = createMockContextFactory(true);
    loader = new PluginLoader(registry, contextFactory);
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // PluginLoadError Tests
  // ==========================================================================

  describe('PluginLoadError', () => {
    it('has correct name and message', () => {
      const error = new PluginLoadError('Test error message');

      expect(error.name).toBe('PluginLoadError');
      expect(error.message).toBe('Test error message');
      expect(error.pluginId).toBeUndefined();
      expect(error.cause).toBeUndefined();
    });

    it('includes pluginId when provided', () => {
      const error = new PluginLoadError('Load failed', '@scribe/test-plugin');

      expect(error.message).toBe('Load failed');
      expect(error.pluginId).toBe('@scribe/test-plugin');
    });

    it('includes cause when provided', () => {
      const cause = new Error('Original error');
      const error = new PluginLoadError('Load failed', '@scribe/test-plugin', cause);

      expect(error.cause).toBe(cause);
    });

    it('is an instance of Error', () => {
      const error = new PluginLoadError('Test error');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginLoadError);
    });
  });

  // ==========================================================================
  // Environment Detection Tests
  // ==========================================================================

  describe('detectEnvironment', () => {
    it('returns server when window is undefined', () => {
      // In Node.js test environment, window is undefined
      expect(detectEnvironment()).toBe('server');
    });
  });

  // ==========================================================================
  // Single Plugin Loading Tests
  // ==========================================================================

  describe('loadPlugin', () => {
    it('loads a valid plugin module', async () => {
      const manifest = createManifest({ id: '@scribe/plugin-valid' });
      const module = createPluginModule(manifest);

      await loader.loadPlugin(module);

      expect(registry.hasPlugin('@scribe/plugin-valid')).toBe(true);
    });

    it('validates manifest before loading', async () => {
      const invalidManifest = {
        id: '', // Invalid: empty ID
        version: '1.0.0',
        name: 'Invalid Plugin',
        capabilities: [],
      } as unknown as PluginManifest;

      const module = createPluginModule(invalidManifest);

      await expect(loader.loadPlugin(module)).rejects.toThrow(PluginLoadError);
      await expect(loader.loadPlugin(module)).rejects.toThrow('Invalid manifest');
    });

    it('throws for invalid version format', async () => {
      const manifest = createManifest({
        id: '@scribe/plugin-bad-version',
        version: 'not-a-version',
      });
      const module = createPluginModule(manifest);

      await expect(loader.loadPlugin(module)).rejects.toThrow(PluginLoadError);
    });

    it('registers plugin with registry', async () => {
      const manifest = createManifest({
        id: '@scribe/plugin-register',
        capabilities: [{ type: 'trpc-router', namespace: 'register' }],
      });
      const module = createPluginModule(manifest);

      await loader.loadPlugin(module);

      const registered = registry.getPlugin('@scribe/plugin-register');
      expect(registered).toBeDefined();
      expect(registered?.status).toBe('registered');

      const routers = registry.getCapabilities('trpc-router');
      expect(routers).toHaveLength(1);
      expect(routers[0].namespace).toBe('register');
    });

    it('throws for duplicate plugin ID', async () => {
      const manifest = createManifest({ id: '@scribe/plugin-dup' });
      const module1 = createPluginModule(manifest);
      const module2 = createPluginModule(manifest);

      await loader.loadPlugin(module1);

      await expect(loader.loadPlugin(module2)).rejects.toThrow(PluginLoadError);
      await expect(loader.loadPlugin(module2)).rejects.toThrow(
        'Plugin @scribe/plugin-dup is already loaded'
      );
    });

    it('throws when no server implementation in server environment', async () => {
      const manifest = createManifest({ id: '@scribe/plugin-client-only' });
      const module = createPluginModule(manifest, {
        hasServerPlugin: false,
        hasClientPlugin: true,
      });

      await expect(loader.loadPlugin(module)).rejects.toThrow(PluginLoadError);
      await expect(loader.loadPlugin(module)).rejects.toThrow('has no server implementation');
    });

    it('handles async plugin factory', async () => {
      const manifest = createManifest({ id: '@scribe/plugin-async' });
      const module = createPluginModule(manifest, { serverPluginAsync: true });

      await loader.loadPlugin(module);

      expect(registry.hasPlugin('@scribe/plugin-async')).toBe(true);
    });

    it('handles plugin factory errors', async () => {
      const manifest = createManifest({ id: '@scribe/plugin-error' });
      const module = createPluginModule(manifest, { serverPluginThrows: true });

      await expect(loader.loadPlugin(module)).rejects.toThrow('Server plugin creation failed');
    });

    it('logs successful load', async () => {
      const logSpy = vi.spyOn(console, 'log');
      const manifest = createManifest({ id: '@scribe/plugin-logged', version: '2.3.4' });
      const module = createPluginModule(manifest);

      await loader.loadPlugin(module);

      expect(logSpy).toHaveBeenCalledWith('[plugin-loader] Loaded: @scribe/plugin-logged v2.3.4');
    });

    it('creates context with validated manifest', async () => {
      const createSpy = vi.spyOn(contextFactory, 'create');
      const manifest = createManifest({ id: '@scribe/plugin-context' });
      const module = createPluginModule(manifest);

      await loader.loadPlugin(module);

      expect(createSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          id: '@scribe/plugin-context',
          version: '1.0.0',
          name: 'Test Plugin',
        })
      );
    });
  });

  // ==========================================================================
  // Batch Loading Tests
  // ==========================================================================

  describe('loadPlugins', () => {
    it('loads multiple plugins', async () => {
      const modules = [
        createPluginModule(
          createManifest({
            id: '@scribe/plugin-1',
            capabilities: [{ type: 'trpc-router', namespace: 'one' }],
          })
        ),
        createPluginModule(
          createManifest({
            id: '@scribe/plugin-2',
            capabilities: [{ type: 'trpc-router', namespace: 'two' }],
          })
        ),
        createPluginModule(
          createManifest({
            id: '@scribe/plugin-3',
            capabilities: [{ type: 'trpc-router', namespace: 'three' }],
          })
        ),
      ];

      const result = await loader.loadPlugins(modules);

      expect(result.loaded).toHaveLength(3);
      expect(result.loaded).toContain('@scribe/plugin-1');
      expect(result.loaded).toContain('@scribe/plugin-2');
      expect(result.loaded).toContain('@scribe/plugin-3');
      expect(result.failed).toHaveLength(0);
      expect(registry.pluginCount).toBe(3);
    });

    it('continues after individual failures', async () => {
      const modules = [
        createPluginModule(
          createManifest({
            id: '@scribe/plugin-good-1',
            capabilities: [{ type: 'trpc-router', namespace: 'good1' }],
          })
        ),
        createPluginModule(
          createManifest({
            id: '@scribe/plugin-bad',
            capabilities: [{ type: 'trpc-router', namespace: 'bad' }],
          }),
          { serverPluginThrows: true }
        ),
        createPluginModule(
          createManifest({
            id: '@scribe/plugin-good-2',
            capabilities: [{ type: 'trpc-router', namespace: 'good2' }],
          })
        ),
      ];

      const result = await loader.loadPlugins(modules);

      expect(result.loaded).toHaveLength(2);
      expect(result.loaded).toContain('@scribe/plugin-good-1');
      expect(result.loaded).toContain('@scribe/plugin-good-2');
      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].pluginId).toBe('@scribe/plugin-bad');
      expect(registry.pluginCount).toBe(2);
    });

    it('returns structured load results', async () => {
      const validManifest = createManifest({
        id: '@scribe/plugin-valid',
        capabilities: [{ type: 'trpc-router', namespace: 'valid' }],
      });
      const invalidManifest = createManifest({
        id: '@scribe/plugin-invalid',
        capabilities: [{ type: 'trpc-router', namespace: 'invalid' }],
      });

      const modules = [
        createPluginModule(validManifest),
        createPluginModule(invalidManifest, { serverPluginThrows: true }),
      ];

      const result = await loader.loadPlugins(modules);

      expect(result).toEqual({
        loaded: ['@scribe/plugin-valid'],
        failed: [
          {
            pluginId: '@scribe/plugin-invalid',
            error: expect.any(Error),
          },
        ],
      });
    });

    it('handles empty module array', async () => {
      const result = await loader.loadPlugins([]);

      expect(result.loaded).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
    });

    it('logs errors for failed plugins', async () => {
      const errorSpy = vi.spyOn(console, 'error');
      const manifest = createManifest({
        id: '@scribe/plugin-fail',
        capabilities: [{ type: 'trpc-router', namespace: 'fail' }],
      });
      const module = createPluginModule(manifest, { serverPluginThrows: true });

      await loader.loadPlugins([module]);

      expect(errorSpy).toHaveBeenCalledWith(
        '[plugin-loader] Failed to load @scribe/plugin-fail:',
        expect.any(Error)
      );
    });

    it('reports unknown for modules without manifest ID', async () => {
      const module = {
        manifest: undefined as unknown as PluginManifest,
        createServerPlugin: () => createServerPluginInstance(createManifest()),
      };

      const result = await loader.loadPlugins([module]);

      expect(result.failed).toHaveLength(1);
      expect(result.failed[0].pluginId).toBe('unknown');
    });

    it('handles multiple failures', async () => {
      const modules = [
        createPluginModule(
          createManifest({
            id: '@scribe/plugin-bad-1',
            capabilities: [{ type: 'trpc-router', namespace: 'bad1' }],
          }),
          { serverPluginThrows: true }
        ),
        createPluginModule(
          createManifest({
            id: '@scribe/plugin-bad-2',
            capabilities: [{ type: 'trpc-router', namespace: 'bad2' }],
          }),
          { serverPluginThrows: true }
        ),
      ];

      const result = await loader.loadPlugins(modules);

      expect(result.loaded).toHaveLength(0);
      expect(result.failed).toHaveLength(2);
      expect(result.failed[0].pluginId).toBe('@scribe/plugin-bad-1');
      expect(result.failed[1].pluginId).toBe('@scribe/plugin-bad-2');
    });
  });

  // ==========================================================================
  // Client Environment Tests
  // ==========================================================================

  describe('client environment', () => {
    beforeEach(() => {
      // Mock window to simulate browser environment
      vi.stubGlobal('window', {});
      contextFactory = createMockContextFactory(false);
      loader = new PluginLoader(registry, contextFactory);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('detects client environment', () => {
      expect(detectEnvironment()).toBe('client');
    });

    it('calls createClientPlugin in client environment', async () => {
      const manifest = createManifest({ id: '@scribe/plugin-client' });
      const clientFactory = vi.fn().mockReturnValue(createClientPluginInstance(manifest));
      const module: PluginModule = {
        manifest,
        createClientPlugin: clientFactory,
      };

      await loader.loadPlugin(module);

      expect(clientFactory).toHaveBeenCalled();
      expect(registry.hasPlugin('@scribe/plugin-client')).toBe(true);
    });

    it('throws when no client implementation in client environment', async () => {
      const manifest = createManifest({ id: '@scribe/plugin-server-only' });
      const module = createPluginModule(manifest, {
        hasServerPlugin: true,
        hasClientPlugin: false,
      });

      await expect(loader.loadPlugin(module)).rejects.toThrow(PluginLoadError);
      await expect(loader.loadPlugin(module)).rejects.toThrow('has no client implementation');
    });
  });

  // ==========================================================================
  // Edge Cases
  // ==========================================================================

  describe('edge cases', () => {
    it('handles manifest with minimum required fields', async () => {
      const manifest: PluginManifest = {
        id: '@scribe/minimal',
        version: '1.0.0',
        name: 'Minimal',
        capabilities: [{ type: 'trpc-router', namespace: 'minimal' }],
      };
      const module = createPluginModule(manifest);

      await loader.loadPlugin(module);

      expect(registry.hasPlugin('@scribe/minimal')).toBe(true);
    });

    it('handles manifest with all optional fields', async () => {
      const manifest: PluginManifest = {
        id: '@scribe/full',
        version: '1.0.0-beta.1',
        name: 'Full Featured Plugin',
        description: 'A plugin with all fields',
        author: 'Test Author',
        scribeVersion: '^1.0.0',
        capabilities: [
          { type: 'trpc-router', namespace: 'full' },
          { type: 'storage', keys: ['data'] },
          { type: 'event-hook', events: ['note:created'] },
          { type: 'sidebar-panel', id: 'full-panel', label: 'Full', icon: 'Star', priority: 5 },
          { type: 'slash-command', command: 'full', label: 'Full Cmd', description: 'A command' },
        ],
      };
      const module = createPluginModule(manifest);

      await loader.loadPlugin(module);

      expect(registry.hasPlugin('@scribe/full')).toBe(true);
      expect(registry.getCapabilities('trpc-router')).toHaveLength(1);
      expect(registry.getCapabilities('storage')).toHaveLength(1);
      expect(registry.getCapabilities('event-hook')).toHaveLength(1);
      expect(registry.getCapabilities('sidebar-panel')).toHaveLength(1);
      expect(registry.getCapabilities('slash-command')).toHaveLength(1);
    });

    it('preserves error information in PluginLoadError', async () => {
      const manifest = createManifest({ id: '@scribe/preserve-error' });
      const originalError = new Error('Original error');
      const module: PluginModule = {
        manifest,
        createServerPlugin: () => {
          throw originalError;
        },
      };

      try {
        await loader.loadPlugin(module);
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBe(originalError);
      }
    });
  });

  // ==========================================================================
  // Integration-style Tests
  // ==========================================================================

  describe('integration', () => {
    it('full load cycle works correctly', async () => {
      const manifest = createManifest({
        id: '@scribe/plugin-integration',
        version: '2.0.0',
        name: 'Integration Test Plugin',
        description: 'Tests the full load cycle',
        capabilities: [
          { type: 'trpc-router', namespace: 'integration' },
          { type: 'sidebar-panel', id: 'int-panel', label: 'Integration', icon: 'Check' },
        ],
      });

      const serverPlugin: ServerPlugin = {
        manifest,
        async onActivate() {
          // Setup
        },
      };

      const module: PluginModule = {
        manifest,
        createServerPlugin: async (ctx) => {
          expect(ctx.manifest.id).toBe('@scribe/plugin-integration');
          expect(ctx.logger).toBeDefined();
          expect(ctx.storage).toBeDefined();
          expect(ctx.events).toBeDefined();
          return serverPlugin;
        },
      };

      await loader.loadPlugin(module);

      const registered = registry.getPlugin('@scribe/plugin-integration');
      expect(registered).toBeDefined();
      expect(registered?.plugin).toBe(serverPlugin);
      expect(registered?.status).toBe('registered');

      const routers = registry.getCapabilities('trpc-router');
      expect(routers).toContainEqual({
        pluginId: '@scribe/plugin-integration',
        namespace: 'integration',
      });

      const panels = registry.getCapabilities('sidebar-panel');
      expect(panels).toContainEqual({
        pluginId: '@scribe/plugin-integration',
        id: 'int-panel',
        label: 'Integration',
        icon: 'Check',
        priority: 100,
        component: undefined,
      });
    });
  });
});
