/**
 * Tests for Plugin Error Handler
 *
 * These tests verify:
 * 1. Timeout utilities
 * 2. Event handler wrapping with error handling
 * 3. Lifecycle hook wrapping with timeout protection
 * 4. Router error handling
 * 5. Safe plugin operation execution
 * 6. Structured error logging
 * 7. Auto-deactivation after consecutive errors
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PluginRegistry, PluginLifecycleManager } from '@scribe/plugin-core';
import type { PluginManifest, ServerPlugin, PluginEvent } from '@scribe/plugin-core';
import {
  createTimeout,
  withTimeout,
  logPluginError,
  wrapEventHandler,
  wrapLifecycleHook,
  handleRouterError,
  safePluginOperation,
  DEFAULT_PLUGIN_TIMEOUT,
  EVENT_HANDLER_TIMEOUT,
  LIFECYCLE_HOOK_TIMEOUT,
  type PluginErrorLog,
} from './error-handler.js';

// ============================================================================
// Test Fixtures
// ============================================================================

function createTestManifest(id: string): PluginManifest {
  return {
    id,
    version: '1.0.0',
    name: 'Test Plugin',
    capabilities: [{ type: 'storage' }],
  };
}

function createTestPlugin(manifest: PluginManifest): ServerPlugin {
  return { manifest };
}

function setupTestLifecycle(): { registry: PluginRegistry; lifecycle: PluginLifecycleManager } {
  const registry = new PluginRegistry();
  const lifecycle = new PluginLifecycleManager(registry);
  return { registry, lifecycle };
}

// ============================================================================
// Tests
// ============================================================================

describe('error-handler', () => {
  beforeEach(() => {
    // Suppress console output during tests
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ==========================================================================
  // Constants Tests
  // ==========================================================================

  describe('constants', () => {
    it('exports DEFAULT_PLUGIN_TIMEOUT', () => {
      expect(DEFAULT_PLUGIN_TIMEOUT).toBe(30000);
    });

    it('exports EVENT_HANDLER_TIMEOUT', () => {
      expect(EVENT_HANDLER_TIMEOUT).toBe(5000);
    });

    it('exports LIFECYCLE_HOOK_TIMEOUT', () => {
      expect(LIFECYCLE_HOOK_TIMEOUT).toBe(30000);
    });
  });

  // ==========================================================================
  // Timeout Utility Tests
  // ==========================================================================

  describe('createTimeout', () => {
    it('rejects after specified timeout', async () => {
      const timeout = createTimeout(10, 'Test timeout');
      await expect(timeout).rejects.toThrow('Test timeout');
    });

    it('includes custom message in error', async () => {
      const timeout = createTimeout(10, 'Custom timeout message');
      await expect(timeout).rejects.toThrow('Custom timeout message');
    });
  });

  describe('withTimeout', () => {
    it('returns result when operation completes before timeout', async () => {
      const operation = Promise.resolve('success');
      const result = await withTimeout(operation, { timeout: 1000, message: 'Timeout' });
      expect(result).toBe('success');
    });

    it('throws timeout error when operation takes too long', async () => {
      const operation = new Promise((resolve) => setTimeout(() => resolve('late'), 100));
      await expect(
        withTimeout(operation, { timeout: 10, message: 'Operation timed out' })
      ).rejects.toThrow('Operation timed out');
    });

    it('propagates errors from the operation', async () => {
      const operation = Promise.reject(new Error('Operation failed'));
      await expect(withTimeout(operation, { timeout: 1000, message: 'Timeout' })).rejects.toThrow(
        'Operation failed'
      );
    });
  });

  // ==========================================================================
  // Structured Logging Tests
  // ==========================================================================

  describe('logPluginError', () => {
    it('logs error with plugin context', () => {
      const errorSpy = vi.spyOn(console, 'error');

      const log: PluginErrorLog = {
        timestamp: new Date(),
        pluginId: '@scribe/plugin-test',
        errorType: 'event',
        eventType: 'note:created',
        error: { message: 'Test error' },
        consecutiveErrors: 1,
        action: 'logged',
      };

      logPluginError(log);

      expect(errorSpy).toHaveBeenCalledWith(
        '[plugin:@scribe/plugin-test]',
        'Plugin error:',
        expect.objectContaining({
          type: 'event',
          eventType: 'note:created',
          error: 'Test error',
        })
      );
    });

    it('logs deactivation with different message', () => {
      const errorSpy = vi.spyOn(console, 'error');

      const log: PluginErrorLog = {
        timestamp: new Date(),
        pluginId: '@scribe/plugin-test',
        errorType: 'event',
        error: { message: 'Test error' },
        consecutiveErrors: 3,
        action: 'deactivated',
      };

      logPluginError(log);

      expect(errorSpy).toHaveBeenCalledWith(
        '[plugin:@scribe/plugin-test]',
        'Plugin auto-deactivated due to repeated errors:',
        expect.any(Object)
      );
    });

    it('includes procedure name for router errors', () => {
      const errorSpy = vi.spyOn(console, 'error');

      const log: PluginErrorLog = {
        timestamp: new Date(),
        pluginId: '@scribe/plugin-test',
        errorType: 'router',
        procedure: 'getSnippets',
        error: { message: 'Failed to get snippets' },
        consecutiveErrors: 1,
        action: 'logged',
      };

      logPluginError(log);

      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          procedure: 'getSnippets',
        })
      );
    });
  });

  // ==========================================================================
  // Event Handler Wrapper Tests
  // ==========================================================================

  describe('wrapEventHandler', () => {
    it('calls the original handler', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      let called = false;
      const originalHandler = async () => {
        called = true;
      };

      const wrapped = wrapEventHandler(originalHandler, {
        pluginId: manifest.id,
        lifecycle,
      });

      await wrapped({ type: 'note:created', noteId: '123', title: 'Test', createdAt: new Date() });

      expect(called).toBe(true);
    });

    it('resets error count on success', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      // Simulate previous error
      await lifecycle.handlePluginError(manifest.id, new Error('Previous error'));
      expect(lifecycle.getErrorCount(manifest.id)).toBe(1);

      const wrapped = wrapEventHandler(async () => {}, {
        pluginId: manifest.id,
        lifecycle,
      });

      await wrapped({ type: 'note:created', noteId: '123', title: 'Test', createdAt: new Date() });

      expect(lifecycle.getErrorCount(manifest.id)).toBe(0);
    });

    it('catches and reports errors to lifecycle manager', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const wrapped = wrapEventHandler(
        async () => {
          throw new Error('Handler error');
        },
        { pluginId: manifest.id, lifecycle }
      );

      await wrapped({ type: 'note:created', noteId: '123', title: 'Test', createdAt: new Date() });

      expect(lifecycle.getErrorCount(manifest.id)).toBe(1);
    });

    it('does not re-throw errors', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const wrapped = wrapEventHandler(
        async () => {
          throw new Error('Handler error');
        },
        { pluginId: manifest.id, lifecycle }
      );

      // Should not throw - calling wrapped should complete without error
      await expect(
        wrapped({ type: 'note:created', noteId: '123', title: 'Test', createdAt: new Date() })
      ).resolves.toBeUndefined();
    });

    it('auto-deactivates after 3 consecutive errors', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const wrapped = wrapEventHandler(
        async () => {
          throw new Error('Handler error');
        },
        { pluginId: manifest.id, lifecycle }
      );

      const event: PluginEvent = {
        type: 'note:created',
        noteId: '123',
        title: 'Test',
        createdAt: new Date(),
      };

      // First error
      await wrapped(event);
      expect(lifecycle.isActive(manifest.id)).toBe(true);

      // Second error
      await wrapped(event);
      expect(lifecycle.isActive(manifest.id)).toBe(true);

      // Third error - should trigger deactivation
      await wrapped(event);
      expect(lifecycle.isActive(manifest.id)).toBe(false);
    });

    it('times out slow handlers', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const logs: PluginErrorLog[] = [];

      const wrapped = wrapEventHandler(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        {
          pluginId: manifest.id,
          lifecycle,
          timeout: 10, // Very short timeout
          onError: (log) => logs.push(log),
        }
      );

      await wrapped({ type: 'note:created', noteId: '123', title: 'Test', createdAt: new Date() });

      expect(logs).toHaveLength(1);
      expect(logs[0].errorType).toBe('timeout');
      expect(logs[0].error.message).toContain('timed out');
    });

    it('calls custom error handler', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const logs: PluginErrorLog[] = [];

      const wrapped = wrapEventHandler(
        async () => {
          throw new Error('Custom error');
        },
        {
          pluginId: manifest.id,
          lifecycle,
          onError: (log) => logs.push(log),
        }
      );

      await wrapped({ type: 'note:created', noteId: '123', title: 'Test', createdAt: new Date() });

      expect(logs).toHaveLength(1);
      expect(logs[0].pluginId).toBe(manifest.id);
      expect(logs[0].eventType).toBe('note:created');
      expect(logs[0].error.message).toBe('Custom error');
    });
  });

  // ==========================================================================
  // Lifecycle Hook Wrapper Tests
  // ==========================================================================

  describe('wrapLifecycleHook', () => {
    it('calls the original hook', async () => {
      let called = false;
      const originalHook = async () => {
        called = true;
      };

      const wrapped = wrapLifecycleHook(originalHook, {
        pluginId: '@scribe/plugin-test',
        hookType: 'onActivate',
      });

      await wrapped();

      expect(called).toBe(true);
    });

    it('times out slow hooks', async () => {
      const wrapped = wrapLifecycleHook(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        {
          pluginId: '@scribe/plugin-test',
          hookType: 'onActivate',
          timeout: 10,
        }
      );

      await expect(wrapped()).rejects.toThrow('timed out');
    });

    it('re-throws errors from hooks', async () => {
      const wrapped = wrapLifecycleHook(
        async () => {
          throw new Error('Activation failed');
        },
        {
          pluginId: '@scribe/plugin-test',
          hookType: 'onActivate',
        }
      );

      await expect(wrapped()).rejects.toThrow('Activation failed');
    });

    it('logs errors before re-throwing', async () => {
      const logs: PluginErrorLog[] = [];

      const wrapped = wrapLifecycleHook(
        async () => {
          throw new Error('Hook error');
        },
        {
          pluginId: '@scribe/plugin-test',
          hookType: 'onActivate',
          onError: (log) => logs.push(log),
        }
      );

      await expect(wrapped()).rejects.toThrow();

      expect(logs).toHaveLength(1);
      expect(logs[0].errorType).toBe('lifecycle');
    });

    it('uses correct error type for timeout', async () => {
      const logs: PluginErrorLog[] = [];

      const wrapped = wrapLifecycleHook(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
        },
        {
          pluginId: '@scribe/plugin-test',
          hookType: 'onDeactivate',
          timeout: 10,
          onError: (log) => logs.push(log),
        }
      );

      await expect(wrapped()).rejects.toThrow();

      expect(logs).toHaveLength(1);
      expect(logs[0].errorType).toBe('timeout');
    });
  });

  // ==========================================================================
  // Router Error Handler Tests
  // ==========================================================================

  describe('handleRouterError', () => {
    it('logs error and reports to lifecycle manager', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const errorSpy = vi.spyOn(console, 'error');

      await handleRouterError(manifest.id, new Error('Router error'), lifecycle);

      expect(errorSpy).toHaveBeenCalled();
      expect(lifecycle.getErrorCount(manifest.id)).toBe(1);
    });

    it('includes procedure name in log', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const errorSpy = vi.spyOn(console, 'error');

      await handleRouterError(manifest.id, new Error('Error'), lifecycle, 'getTodos');

      expect(errorSpy).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(String),
        expect.objectContaining({
          procedure: 'getTodos',
        })
      );
    });

    it('triggers auto-deactivation after threshold', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      // Three errors should trigger deactivation
      await handleRouterError(manifest.id, new Error('Error 1'), lifecycle);
      await handleRouterError(manifest.id, new Error('Error 2'), lifecycle);
      await handleRouterError(manifest.id, new Error('Error 3'), lifecycle);

      expect(lifecycle.isActive(manifest.id)).toBe(false);
    });
  });

  // ==========================================================================
  // Safe Plugin Operation Tests
  // ==========================================================================

  describe('safePluginOperation', () => {
    it('returns success with value on successful operation', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const result = await safePluginOperation(() => Promise.resolve('result'), {
        pluginId: manifest.id,
        lifecycle,
        errorType: 'router',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.value).toBe('result');
      }
    });

    it('returns failure with error on failed operation', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const result = await safePluginOperation(
        () => {
          throw new Error('Operation failed');
        },
        {
          pluginId: manifest.id,
          lifecycle,
          errorType: 'router',
        }
      );

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.message).toBe('Operation failed');
      }
    });

    it('resets error count on success', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      // Add previous error
      await lifecycle.handlePluginError(manifest.id, new Error('Previous'));
      expect(lifecycle.getErrorCount(manifest.id)).toBe(1);

      await safePluginOperation(() => Promise.resolve('ok'), {
        pluginId: manifest.id,
        lifecycle,
        errorType: 'router',
      });

      expect(lifecycle.getErrorCount(manifest.id)).toBe(0);
    });

    it('reports errors to lifecycle manager', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      await safePluginOperation(
        () => {
          throw new Error('Error');
        },
        {
          pluginId: manifest.id,
          lifecycle,
          errorType: 'router',
        }
      );

      expect(lifecycle.getErrorCount(manifest.id)).toBe(1);
    });

    it('handles timeout', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const logs: PluginErrorLog[] = [];

      const result = await safePluginOperation(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return 'late';
        },
        {
          pluginId: manifest.id,
          lifecycle,
          errorType: 'router',
          timeout: 10,
          onError: (log) => logs.push(log),
        }
      );

      expect(result.success).toBe(false);
      expect(logs).toHaveLength(1);
      expect(logs[0].errorType).toBe('timeout');
    });

    it('uses custom timeout', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      // With longer timeout, operation should succeed
      const result = await safePluginOperation(
        async () => {
          await new Promise((resolve) => setTimeout(resolve, 10));
          return 'success';
        },
        {
          pluginId: manifest.id,
          lifecycle,
          errorType: 'router',
          timeout: 1000,
        }
      );

      expect(result.success).toBe(true);
    });

    it('includes event type and procedure in error log', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      const logs: PluginErrorLog[] = [];

      await safePluginOperation(
        () => {
          throw new Error('Error');
        },
        {
          pluginId: manifest.id,
          lifecycle,
          errorType: 'event',
          eventType: 'note:deleted',
          procedure: 'handleDelete',
          onError: (log) => logs.push(log),
        }
      );

      expect(logs).toHaveLength(1);
      expect(logs[0].eventType).toBe('note:deleted');
      expect(logs[0].procedure).toBe('handleDelete');
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration', () => {
    it('error tracking persists across different handler types', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      // Error from event handler
      const eventHandler = wrapEventHandler(
        async () => {
          throw new Error('Event error');
        },
        { pluginId: manifest.id, lifecycle }
      );
      await eventHandler({
        type: 'note:created',
        noteId: '1',
        title: 'Test',
        createdAt: new Date(),
      });

      expect(lifecycle.getErrorCount(manifest.id)).toBe(1);

      // Error from router
      await handleRouterError(manifest.id, new Error('Router error'), lifecycle);
      expect(lifecycle.getErrorCount(manifest.id)).toBe(2);

      // Third error triggers deactivation
      await handleRouterError(manifest.id, new Error('Another error'), lifecycle);
      expect(lifecycle.isActive(manifest.id)).toBe(false);
    });

    it('successful operation resets count across handler types', async () => {
      const { registry, lifecycle } = setupTestLifecycle();
      const manifest = createTestManifest('@scribe/plugin-test');
      registry.register(createTestPlugin(manifest));
      await lifecycle.activate(manifest.id);

      // Add two errors
      await handleRouterError(manifest.id, new Error('Error 1'), lifecycle);
      await handleRouterError(manifest.id, new Error('Error 2'), lifecycle);
      expect(lifecycle.getErrorCount(manifest.id)).toBe(2);

      // Successful event handler resets count
      const eventHandler = wrapEventHandler(async () => {}, {
        pluginId: manifest.id,
        lifecycle,
      });
      await eventHandler({
        type: 'note:created',
        noteId: '1',
        title: 'Test',
        createdAt: new Date(),
      });

      expect(lifecycle.getErrorCount(manifest.id)).toBe(0);
    });
  });
});
