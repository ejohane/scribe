/**
 * Plugin Lifecycle Manager - Activation/deactivation control for plugins
 *
 * The PluginLifecycleManager controls the activation and deactivation of plugins,
 * handling lifecycle hooks and managing state transitions. It also auto-deactivates
 * plugins that throw errors during operation.
 *
 * @module
 */

import type { PluginRegistry } from './plugin-registry.js';
import type { ServerPlugin } from './plugin-types.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when a lifecycle operation fails.
 */
export class PluginLifecycleError extends Error {
  /** The ID of the plugin related to this error */
  public readonly pluginId?: string;

  /** The underlying error that caused the lifecycle failure */
  public override readonly cause?: Error;

  constructor(message: string, pluginId?: string, cause?: Error) {
    super(message);
    this.name = 'PluginLifecycleError';
    this.pluginId = pluginId;
    this.cause = cause;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PluginLifecycleError);
    }
  }
}

// ============================================================================
// Plugin State Types
// ============================================================================

/**
 * The possible states a plugin can be in during its lifecycle.
 *
 * State Flow:
 * ```
 * discovered -> installed -> loaded -> activated
 *                              │              │
 *                              v              v
 *                         uninstalled    deactivated
 *                                             │
 *                                             v
 *                                          error (if errors occur)
 * ```
 */
export type PluginState =
  | 'discovered'
  | 'installed'
  | 'loaded'
  | 'activated'
  | 'deactivated'
  | 'uninstalled'
  | 'error';

/**
 * Status information for a plugin's current lifecycle state.
 */
export interface PluginLifecycleStatus {
  /** Current state of the plugin */
  state: PluginState;

  /** Error that caused the plugin to enter error state, if applicable */
  error?: Error;

  /** Timestamp when the plugin was activated */
  activatedAt?: Date;

  /** Timestamp when the plugin was deactivated */
  deactivatedAt?: Date;
}

// ============================================================================
// Constants
// ============================================================================

/**
 * Number of consecutive errors before auto-deactivation.
 */
const ERROR_THRESHOLD = 3;

// ============================================================================
// PluginLifecycleManager Class
// ============================================================================

/**
 * Manages plugin activation, deactivation, and error handling.
 *
 * The lifecycle manager is responsible for:
 * - Activating loaded plugins (calling onActivate hooks)
 * - Deactivating active plugins (calling onDeactivate hooks)
 * - Tracking plugin states
 * - Handling plugin errors with auto-deactivation
 *
 * @example
 * ```typescript
 * const lifecycle = new PluginLifecycleManager(registry);
 *
 * // Activate a plugin
 * await lifecycle.activate('@scribe/plugin-example');
 *
 * // Check state
 * const status = lifecycle.getState('@scribe/plugin-example');
 * console.log(status?.state); // 'activated'
 *
 * // Handle errors during operation
 * try {
 *   await pluginHandler();
 * } catch (error) {
 *   await lifecycle.handlePluginError('@scribe/plugin-example', error);
 * }
 *
 * // Deactivate
 * await lifecycle.deactivate('@scribe/plugin-example');
 * ```
 */
export class PluginLifecycleManager {
  /** Map of plugin ID to lifecycle status */
  private pluginStates: Map<string, PluginLifecycleStatus> = new Map();

  /** Map of plugin ID to consecutive error count */
  private errorCounts: Map<string, number> = new Map();

  /**
   * Create a new PluginLifecycleManager.
   *
   * @param registry - The plugin registry containing registered plugins
   */
  constructor(private readonly registry: PluginRegistry) {}

  /**
   * Activate a loaded plugin.
   *
   * Calls the plugin's onActivate hook if defined.
   *
   * @param pluginId - The ID of the plugin to activate
   * @throws {PluginLifecycleError} If the plugin is not found or activation fails
   *
   * @example
   * ```typescript
   * await lifecycle.activate('@scribe/plugin-example');
   * // Plugin is now active and handling events
   * ```
   */
  async activate(pluginId: string): Promise<void> {
    const registered = this.registry.getPlugin(pluginId);
    if (!registered) {
      throw new PluginLifecycleError(`Plugin ${pluginId} not found in registry`, pluginId);
    }

    const currentState = this.pluginStates.get(pluginId);
    if (currentState?.state === 'activated') {
      // eslint-disable-next-line no-console -- Intentional warning for plugin developers
      console.warn(`[lifecycle] Plugin ${pluginId} is already activated`);
      return;
    }

    const plugin = registered.plugin as ServerPlugin;

    try {
      // Call onActivate hook if defined
      if (plugin.onActivate) {
        await plugin.onActivate();
      }

      this.pluginStates.set(pluginId, {
        state: 'activated',
        activatedAt: new Date(),
      });

      // Reset error count on successful activation
      this.errorCounts.delete(pluginId);

      // eslint-disable-next-line no-console -- Intentional logging for plugin lifecycle events
      console.log(`[lifecycle] Activated: ${pluginId}`);
    } catch (error) {
      // eslint-disable-next-line no-console -- Intentional error logging
      console.error(`[lifecycle] Activation failed for ${pluginId}:`, error);

      this.pluginStates.set(pluginId, {
        state: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });

      throw new PluginLifecycleError(
        `Failed to activate ${pluginId}`,
        pluginId,
        error instanceof Error ? error : undefined
      );
    }
  }

  /**
   * Deactivate an active plugin.
   *
   * Calls the plugin's onDeactivate hook if defined.
   * Storage is preserved to allow re-activation with state intact.
   *
   * @param pluginId - The ID of the plugin to deactivate
   * @throws {PluginLifecycleError} If the plugin is not found
   *
   * @remarks
   * Deactivation errors are logged but don't prevent the plugin from being
   * marked as deactivated. This ensures plugins can be stopped even if their
   * cleanup code fails.
   *
   * @example
   * ```typescript
   * await lifecycle.deactivate('@scribe/plugin-example');
   * // Plugin is now inactive but storage is preserved
   * ```
   */
  async deactivate(pluginId: string): Promise<void> {
    const registered = this.registry.getPlugin(pluginId);
    if (!registered) {
      throw new PluginLifecycleError(`Plugin ${pluginId} not found`, pluginId);
    }

    const currentState = this.pluginStates.get(pluginId);
    if (currentState?.state !== 'activated') {
      // eslint-disable-next-line no-console -- Intentional warning for plugin developers
      console.warn(
        `[lifecycle] Plugin ${pluginId} is not activated (state: ${currentState?.state ?? 'unknown'})`
      );
      return;
    }

    const plugin = registered.plugin as ServerPlugin;

    try {
      // Call onDeactivate hook if defined
      if (plugin.onDeactivate) {
        await plugin.onDeactivate();
      }

      // Note: We don't unregister from registry or clear storage
      // This allows re-activation to restore state
      this.pluginStates.set(pluginId, {
        state: 'deactivated',
        deactivatedAt: new Date(),
      });

      // eslint-disable-next-line no-console -- Intentional logging for plugin lifecycle events
      console.log(`[lifecycle] Deactivated: ${pluginId}`);
    } catch (error) {
      // Deactivation failure is logged but still marks as deactivated
      // eslint-disable-next-line no-console -- Intentional error logging
      console.error(`[lifecycle] Deactivation error for ${pluginId}:`, error);

      this.pluginStates.set(pluginId, {
        state: 'deactivated',
        deactivatedAt: new Date(),
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  }

  /**
   * Get the current state of a plugin.
   *
   * @param pluginId - The ID of the plugin to check
   * @returns The plugin's current status, or undefined if not tracked
   *
   * @example
   * ```typescript
   * const status = lifecycle.getState('@scribe/plugin-example');
   * if (status?.state === 'activated') {
   *   console.log(`Activated at: ${status.activatedAt}`);
   * }
   * ```
   */
  getState(pluginId: string): PluginLifecycleStatus | undefined {
    return this.pluginStates.get(pluginId);
  }

  /**
   * Get all plugins in a specific state.
   *
   * @param state - The state to filter by
   * @returns Array of plugin IDs in the specified state
   *
   * @example
   * ```typescript
   * const activePlugins = lifecycle.getPluginsInState('activated');
   * console.log(`Active plugins: ${activePlugins.join(', ')}`);
   * ```
   */
  getPluginsInState(state: PluginState): string[] {
    const result: string[] = [];
    for (const [pluginId, status] of this.pluginStates) {
      if (status.state === state) {
        result.push(pluginId);
      }
    }
    return result;
  }

  /**
   * Handle a plugin error.
   *
   * Tracks consecutive errors and auto-deactivates the plugin after
   * reaching the error threshold (3 consecutive errors).
   *
   * @param pluginId - The ID of the plugin that threw the error
   * @param error - The error that occurred
   *
   * @remarks
   * Error counts reset when:
   * - Plugin successfully handles an event (call resetErrorCount)
   * - Plugin is manually re-activated
   *
   * @example
   * ```typescript
   * // In event handler wrapper
   * try {
   *   await originalHandler(event);
   *   lifecycle.resetErrorCount(pluginId);
   * } catch (error) {
   *   await lifecycle.handlePluginError(pluginId, error);
   * }
   * ```
   */
  async handlePluginError(pluginId: string, error: Error): Promise<void> {
    // eslint-disable-next-line no-console -- Intentional error logging
    console.error(`[lifecycle] Plugin error in ${pluginId}:`, error);

    const currentState = this.pluginStates.get(pluginId);
    if (currentState?.state !== 'activated') {
      // Not active, nothing to do
      return;
    }

    // Count errors
    const errorCount = this.incrementErrorCount(pluginId);

    if (errorCount >= ERROR_THRESHOLD) {
      // eslint-disable-next-line no-console -- Intentional warning for auto-deactivation
      console.warn(
        `[lifecycle] Auto-deactivating ${pluginId} after ${errorCount} consecutive errors`
      );

      await this.deactivate(pluginId);

      // Update state to error with combined error info
      this.pluginStates.set(pluginId, {
        state: 'error',
        error: new Error(
          `Auto-deactivated after ${errorCount} consecutive errors. Last error: ${error.message}`
        ),
        deactivatedAt: new Date(),
      });
    }
  }

  /**
   * Reset the error count for a plugin.
   *
   * Should be called after a plugin successfully handles an event
   * to reset the consecutive error counter.
   *
   * @param pluginId - The ID of the plugin
   *
   * @example
   * ```typescript
   * // After successful event handling
   * lifecycle.resetErrorCount('@scribe/plugin-example');
   * ```
   */
  resetErrorCount(pluginId: string): void {
    this.errorCounts.delete(pluginId);
  }

  /**
   * Get the current error count for a plugin.
   *
   * @param pluginId - The ID of the plugin
   * @returns The current consecutive error count
   */
  getErrorCount(pluginId: string): number {
    return this.errorCounts.get(pluginId) ?? 0;
  }

  /**
   * Set the initial state for a plugin.
   *
   * Used by the PluginLoader to set the initial state after loading.
   *
   * @param pluginId - The ID of the plugin
   * @param state - The initial state to set
   */
  setInitialState(pluginId: string, state: PluginState): void {
    this.pluginStates.set(pluginId, { state });
  }

  /**
   * Check if a plugin is active.
   *
   * @param pluginId - The ID of the plugin
   * @returns true if the plugin is in the 'activated' state
   */
  isActive(pluginId: string): boolean {
    return this.pluginStates.get(pluginId)?.state === 'activated';
  }

  /**
   * Increment the error count for a plugin.
   *
   * @param pluginId - The ID of the plugin
   * @returns The new error count after incrementing
   */
  private incrementErrorCount(pluginId: string): number {
    const current = this.errorCounts.get(pluginId) ?? 0;
    const newCount = current + 1;
    this.errorCounts.set(pluginId, newCount);
    return newCount;
  }

  /**
   * Clear all tracked states and error counts.
   *
   * Useful for testing or reset scenarios.
   */
  clear(): void {
    this.pluginStates.clear();
    this.errorCounts.clear();
  }
}
