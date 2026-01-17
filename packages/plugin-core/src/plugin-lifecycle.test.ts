/**
 * Tests for PluginLifecycleManager
 *
 * These tests verify:
 * 1. Plugin activation (including onActivate hook)
 * 2. Plugin deactivation (including onDeactivate hook)
 * 3. State management and queries
 * 4. Error handling and auto-deactivation after 3 consecutive errors
 * 5. Error count reset on successful operation
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { PluginLifecycleManager, PluginLifecycleError } from './plugin-lifecycle.js';
import { PluginRegistry } from './plugin-registry.js';
import type { ServerPlugin, PluginManifest } from './plugin-types.js';

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

// ============================================================================
// Tests
// ============================================================================

describe('PluginLifecycleManager', () => {
  let registry: PluginRegistry;
  let lifecycle: PluginLifecycleManager;

  beforeEach(() => {
    registry = new PluginRegistry();
    lifecycle = new PluginLifecycleManager(registry);
    vi.clearAllMocks();
  });

  // ==========================================================================
  // Activation Tests
  // ==========================================================================

  describe('activate', () => {
    it('activates a loaded plugin successfully', async () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-activate' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-activate');

      const status = lifecycle.getState('@scribe/plugin-activate');
      expect(status?.state).toBe('activated');
      expect(status?.activatedAt).toBeInstanceOf(Date);
    });

    it('calls onActivate hook during activation', async () => {
      const onActivate = vi.fn().mockResolvedValue(undefined);
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-hook' }),
        onActivate,
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-hook');

      expect(onActivate).toHaveBeenCalledTimes(1);
    });

    it('throws PluginLifecycleError when plugin not found', async () => {
      await expect(lifecycle.activate('@scribe/plugin-nonexistent')).rejects.toThrow(
        PluginLifecycleError
      );
      await expect(lifecycle.activate('@scribe/plugin-nonexistent')).rejects.toThrow(
        'Plugin @scribe/plugin-nonexistent not found in registry'
      );
    });

    it('warns and returns early if plugin is already activated', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const onActivate = vi.fn().mockResolvedValue(undefined);
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-double' }),
        onActivate,
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-double');
      await lifecycle.activate('@scribe/plugin-double'); // Second activation

      expect(onActivate).toHaveBeenCalledTimes(1); // Only called once
      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('already activated'));

      warnSpy.mockRestore();
    });

    it('sets error state when onActivate hook fails', async () => {
      const activationError = new Error('Activation failed');
      const onActivate = vi.fn().mockRejectedValue(activationError);
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-fail' }),
        onActivate,
      });
      registry.register(plugin);

      await expect(lifecycle.activate('@scribe/plugin-fail')).rejects.toThrow(
        'Failed to activate @scribe/plugin-fail'
      );

      const status = lifecycle.getState('@scribe/plugin-fail');
      expect(status?.state).toBe('error');
      expect(status?.error?.message).toBe('Activation failed');
    });

    it('resets error count on successful activation', async () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-reset' }),
      });
      registry.register(plugin);

      // Manually set some error count
      lifecycle.setInitialState('@scribe/plugin-reset', 'loaded');

      await lifecycle.activate('@scribe/plugin-reset');

      expect(lifecycle.getErrorCount('@scribe/plugin-reset')).toBe(0);
    });
  });

  // ==========================================================================
  // Deactivation Tests
  // ==========================================================================

  describe('deactivate', () => {
    it('deactivates an active plugin successfully', async () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-deactivate' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-deactivate');
      await lifecycle.deactivate('@scribe/plugin-deactivate');

      const status = lifecycle.getState('@scribe/plugin-deactivate');
      expect(status?.state).toBe('deactivated');
      expect(status?.deactivatedAt).toBeInstanceOf(Date);
    });

    it('calls onDeactivate hook during deactivation', async () => {
      const onDeactivate = vi.fn().mockResolvedValue(undefined);
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-hook-deact' }),
        onDeactivate,
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-hook-deact');
      await lifecycle.deactivate('@scribe/plugin-hook-deact');

      expect(onDeactivate).toHaveBeenCalledTimes(1);
    });

    it('throws PluginLifecycleError when plugin not found', async () => {
      await expect(lifecycle.deactivate('@scribe/plugin-nonexistent')).rejects.toThrow(
        PluginLifecycleError
      );
      await expect(lifecycle.deactivate('@scribe/plugin-nonexistent')).rejects.toThrow(
        'Plugin @scribe/plugin-nonexistent not found'
      );
    });

    it('warns and returns early if plugin is not activated', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-not-active' }),
      });
      registry.register(plugin);

      await lifecycle.deactivate('@scribe/plugin-not-active');

      expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('is not activated'));

      warnSpy.mockRestore();
    });

    it('still deactivates even if onDeactivate hook fails', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const onDeactivate = vi.fn().mockRejectedValue(new Error('Cleanup failed'));
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-fail-deact' }),
        onDeactivate,
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-fail-deact');
      await lifecycle.deactivate('@scribe/plugin-fail-deact');

      const status = lifecycle.getState('@scribe/plugin-fail-deact');
      expect(status?.state).toBe('deactivated');
      expect(status?.error?.message).toBe('Cleanup failed');
      expect(status?.deactivatedAt).toBeInstanceOf(Date);

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // State Query Tests
  // ==========================================================================

  describe('getState', () => {
    it('returns undefined for untracked plugin', () => {
      const status = lifecycle.getState('@scribe/plugin-unknown');
      expect(status).toBeUndefined();
    });

    it('returns correct status after activation', async () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-state' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-state');

      const status = lifecycle.getState('@scribe/plugin-state');
      expect(status?.state).toBe('activated');
      expect(status?.activatedAt).toBeInstanceOf(Date);
      expect(status?.error).toBeUndefined();
    });
  });

  describe('getPluginsInState', () => {
    it('returns empty array when no plugins in state', () => {
      const result = lifecycle.getPluginsInState('activated');
      expect(result).toEqual([]);
    });

    it('returns all plugins in the specified state', async () => {
      const plugin1 = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-1' }),
      });
      const plugin2 = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-2' }),
      });
      const plugin3 = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-3' }),
      });

      registry.register(plugin1);
      registry.register(plugin2);
      registry.register(plugin3);

      await lifecycle.activate('@scribe/plugin-1');
      await lifecycle.activate('@scribe/plugin-2');
      // plugin-3 not activated

      const activated = lifecycle.getPluginsInState('activated');
      expect(activated).toHaveLength(2);
      expect(activated).toContain('@scribe/plugin-1');
      expect(activated).toContain('@scribe/plugin-2');
    });

    it('returns deactivated plugins correctly', async () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-deact-query' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-deact-query');
      await lifecycle.deactivate('@scribe/plugin-deact-query');

      const deactivated = lifecycle.getPluginsInState('deactivated');
      expect(deactivated).toContain('@scribe/plugin-deact-query');
    });
  });

  describe('isActive', () => {
    it('returns true for activated plugins', async () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-is-active' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-is-active');

      expect(lifecycle.isActive('@scribe/plugin-is-active')).toBe(true);
    });

    it('returns false for non-activated plugins', () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-not-active-check' }),
      });
      registry.register(plugin);

      expect(lifecycle.isActive('@scribe/plugin-not-active-check')).toBe(false);
    });

    it('returns false for deactivated plugins', async () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-deact-check' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-deact-check');
      await lifecycle.deactivate('@scribe/plugin-deact-check');

      expect(lifecycle.isActive('@scribe/plugin-deact-check')).toBe(false);
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('handlePluginError', () => {
    it('does nothing if plugin is not activated', async () => {
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-inactive-error' }),
      });
      registry.register(plugin);

      // Don't activate, just handle error
      await lifecycle.handlePluginError('@scribe/plugin-inactive-error', new Error('Some error'));

      // No state change should occur
      expect(lifecycle.getState('@scribe/plugin-inactive-error')).toBeUndefined();
    });

    it('increments error count on each error', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-error-count' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-error-count');

      await lifecycle.handlePluginError('@scribe/plugin-error-count', new Error('Error 1'));
      expect(lifecycle.getErrorCount('@scribe/plugin-error-count')).toBe(1);

      await lifecycle.handlePluginError('@scribe/plugin-error-count', new Error('Error 2'));
      expect(lifecycle.getErrorCount('@scribe/plugin-error-count')).toBe(2);

      errorSpy.mockRestore();
    });

    it('auto-deactivates after 3 consecutive errors', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-auto-deact' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-auto-deact');

      // First two errors: plugin stays active
      await lifecycle.handlePluginError('@scribe/plugin-auto-deact', new Error('Error 1'));
      expect(lifecycle.isActive('@scribe/plugin-auto-deact')).toBe(true);

      await lifecycle.handlePluginError('@scribe/plugin-auto-deact', new Error('Error 2'));
      expect(lifecycle.isActive('@scribe/plugin-auto-deact')).toBe(true);

      // Third error: auto-deactivate
      await lifecycle.handlePluginError('@scribe/plugin-auto-deact', new Error('Error 3'));
      expect(lifecycle.isActive('@scribe/plugin-auto-deact')).toBe(false);

      const status = lifecycle.getState('@scribe/plugin-auto-deact');
      expect(status?.state).toBe('error');
      expect(status?.error?.message).toContain('Auto-deactivated after 3 consecutive errors');
      expect(status?.deactivatedAt).toBeInstanceOf(Date);

      // Warning should have been logged
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Auto-deactivating @scribe/plugin-auto-deact')
      );

      errorSpy.mockRestore();
      warnSpy.mockRestore();
      logSpy.mockRestore();
    });
  });

  describe('resetErrorCount', () => {
    it('resets error count to zero', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-reset-errors' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-reset-errors');

      // Add some errors
      await lifecycle.handlePluginError('@scribe/plugin-reset-errors', new Error('Error 1'));
      await lifecycle.handlePluginError('@scribe/plugin-reset-errors', new Error('Error 2'));
      expect(lifecycle.getErrorCount('@scribe/plugin-reset-errors')).toBe(2);

      // Reset
      lifecycle.resetErrorCount('@scribe/plugin-reset-errors');
      expect(lifecycle.getErrorCount('@scribe/plugin-reset-errors')).toBe(0);

      errorSpy.mockRestore();
    });

    it('allows plugin to continue operating after reset', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-continue' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-continue');

      // Add 2 errors, reset, add 2 more - should not auto-deactivate
      await lifecycle.handlePluginError('@scribe/plugin-continue', new Error('Error 1'));
      await lifecycle.handlePluginError('@scribe/plugin-continue', new Error('Error 2'));

      lifecycle.resetErrorCount('@scribe/plugin-continue');

      await lifecycle.handlePluginError('@scribe/plugin-continue', new Error('Error 3'));
      await lifecycle.handlePluginError('@scribe/plugin-continue', new Error('Error 4'));

      // Should still be active (only 2 consecutive errors after reset)
      expect(lifecycle.isActive('@scribe/plugin-continue')).toBe(true);
      expect(lifecycle.getErrorCount('@scribe/plugin-continue')).toBe(2);

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Utility Tests
  // ==========================================================================

  describe('setInitialState', () => {
    it('sets the initial state for a plugin', () => {
      lifecycle.setInitialState('@scribe/plugin-init', 'loaded');

      const status = lifecycle.getState('@scribe/plugin-init');
      expect(status?.state).toBe('loaded');
    });
  });

  describe('clear', () => {
    it('clears all tracked states and error counts', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-clear' }),
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-clear');
      await lifecycle.handlePluginError('@scribe/plugin-clear', new Error('Error'));

      expect(lifecycle.getState('@scribe/plugin-clear')).toBeDefined();
      expect(lifecycle.getErrorCount('@scribe/plugin-clear')).toBe(1);

      lifecycle.clear();

      expect(lifecycle.getState('@scribe/plugin-clear')).toBeUndefined();
      expect(lifecycle.getErrorCount('@scribe/plugin-clear')).toBe(0);

      errorSpy.mockRestore();
    });
  });

  // ==========================================================================
  // PluginLifecycleError Tests
  // ==========================================================================

  describe('PluginLifecycleError', () => {
    it('has correct name and message', () => {
      const error = new PluginLifecycleError('Test error', '@scribe/test');

      expect(error.name).toBe('PluginLifecycleError');
      expect(error.message).toBe('Test error');
      expect(error.pluginId).toBe('@scribe/test');
    });

    it('is an instance of Error', () => {
      const error = new PluginLifecycleError('Test error', '@scribe/test');

      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(PluginLifecycleError);
    });

    it('preserves cause', () => {
      const cause = new Error('Original error');
      const error = new PluginLifecycleError('Wrapped error', '@scribe/test', cause);

      expect(error.cause).toBe(cause);
    });
  });

  // ==========================================================================
  // Integration Tests
  // ==========================================================================

  describe('integration: full lifecycle', () => {
    it('handles complete plugin lifecycle flow', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      const onActivate = vi.fn().mockResolvedValue(undefined);
      const onDeactivate = vi.fn().mockResolvedValue(undefined);

      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-lifecycle' }),
        onActivate,
        onDeactivate,
      });
      registry.register(plugin);

      // Initial state: no status tracked
      expect(lifecycle.getState('@scribe/plugin-lifecycle')).toBeUndefined();

      // Set initial state (as loader would)
      lifecycle.setInitialState('@scribe/plugin-lifecycle', 'loaded');
      expect(lifecycle.getState('@scribe/plugin-lifecycle')?.state).toBe('loaded');

      // Activate
      await lifecycle.activate('@scribe/plugin-lifecycle');
      expect(lifecycle.getState('@scribe/plugin-lifecycle')?.state).toBe('activated');
      expect(onActivate).toHaveBeenCalled();

      // Verify it's in activated list
      expect(lifecycle.getPluginsInState('activated')).toContain('@scribe/plugin-lifecycle');

      // Deactivate
      await lifecycle.deactivate('@scribe/plugin-lifecycle');
      expect(lifecycle.getState('@scribe/plugin-lifecycle')?.state).toBe('deactivated');
      expect(onDeactivate).toHaveBeenCalled();

      // Verify it moved to deactivated list
      expect(lifecycle.getPluginsInState('activated')).not.toContain('@scribe/plugin-lifecycle');
      expect(lifecycle.getPluginsInState('deactivated')).toContain('@scribe/plugin-lifecycle');

      // Can reactivate
      await lifecycle.activate('@scribe/plugin-lifecycle');
      expect(lifecycle.getState('@scribe/plugin-lifecycle')?.state).toBe('activated');

      logSpy.mockRestore();
    });

    it('handles async onActivate hooks', async () => {
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      let activationComplete = false;

      const onActivate = vi.fn().mockImplementation(async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        activationComplete = true;
      });

      const plugin = createServerPlugin({
        manifest: createManifest({ id: '@scribe/plugin-async' }),
        onActivate,
      });
      registry.register(plugin);

      await lifecycle.activate('@scribe/plugin-async');

      expect(activationComplete).toBe(true);
      expect(lifecycle.isActive('@scribe/plugin-async')).toBe(true);

      logSpy.mockRestore();
    });
  });
});
