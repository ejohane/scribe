/**
 * Plugin Error Handler
 *
 * Provides robust error handling for server-side plugins to ensure that
 * plugin failures never crash scribed. Includes error catching, logging,
 * and automatic deactivation of consistently failing plugins.
 *
 * @module
 */

import type { PluginLifecycleManager } from '@scribe/plugin-core';
import type { PluginEvent, PluginEventType } from '@scribe/plugin-core';

// ============================================================================
// Constants
// ============================================================================

/**
 * Default timeout for plugin operations in milliseconds.
 */
export const DEFAULT_PLUGIN_TIMEOUT = 30000;

/**
 * Timeout for event handlers in milliseconds.
 */
export const EVENT_HANDLER_TIMEOUT = 5000;

/**
 * Timeout for lifecycle hooks in milliseconds.
 */
export const LIFECYCLE_HOOK_TIMEOUT = 30000;

// ============================================================================
// Types
// ============================================================================

/**
 * Type of error that occurred in a plugin.
 */
export type PluginErrorType = 'router' | 'event' | 'lifecycle' | 'timeout';

/**
 * Structured log entry for plugin errors.
 */
export interface PluginErrorLog {
  /** Timestamp when the error occurred */
  timestamp: Date;

  /** ID of the plugin that threw the error */
  pluginId: string;

  /** Type of error */
  errorType: PluginErrorType;

  /** Event type if this was an event handler error */
  eventType?: PluginEventType;

  /** Procedure name if this was a router error */
  procedure?: string;

  /** Error details */
  error: {
    message: string;
    stack?: string;
    code?: string;
  };

  /** Number of consecutive errors for this plugin */
  consecutiveErrors: number;

  /** Action taken in response to the error */
  action: 'logged' | 'deactivated';
}

/**
 * Handler function type for plugin events with proper typing.
 */
export type PluginEventHandler<E extends PluginEvent = PluginEvent> = (
  event: E
) => void | Promise<void>;

/**
 * Options for wrapping event handlers.
 */
export interface WrapEventHandlerOptions {
  /** The ID of the plugin */
  pluginId: string;

  /** The lifecycle manager for error tracking */
  lifecycle: PluginLifecycleManager;

  /** Optional timeout in milliseconds */
  timeout?: number;

  /** Optional custom error logger */
  onError?: (log: PluginErrorLog) => void;
}

/**
 * Options for running an operation with timeout.
 */
export interface TimeoutOptions {
  /** Timeout in milliseconds */
  timeout: number;

  /** Message to include in the timeout error */
  message: string;
}

// ============================================================================
// Timeout Utility
// ============================================================================

/**
 * Create a promise that rejects after a timeout.
 *
 * @param ms - Timeout in milliseconds
 * @param message - Error message
 * @returns A promise that rejects after the timeout
 *
 * @example
 * ```typescript
 * await Promise.race([
 *   pluginOperation(),
 *   createTimeout(5000, 'Operation timed out'),
 * ]);
 * ```
 */
export function createTimeout(ms: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), ms);
  });
}

/**
 * Run an async operation with a timeout.
 *
 * @param operation - The async operation to run
 * @param options - Timeout options
 * @returns The result of the operation
 * @throws Error if the operation times out
 *
 * @example
 * ```typescript
 * const result = await withTimeout(
 *   plugin.onActivate(),
 *   { timeout: 30000, message: 'Activation timed out' }
 * );
 * ```
 */
export async function withTimeout<T>(operation: Promise<T>, options: TimeoutOptions): Promise<T> {
  return Promise.race([operation, createTimeout(options.timeout, options.message)]);
}

// ============================================================================
// Structured Logging
// ============================================================================

/**
 * Log a plugin error with structured format.
 *
 * @param log - The error log entry
 *
 * @example
 * ```typescript
 * logPluginError({
 *   timestamp: new Date(),
 *   pluginId: '@scribe/plugin-todo',
 *   errorType: 'event',
 *   eventType: 'note:created',
 *   error: { message: 'Failed to process note' },
 *   consecutiveErrors: 2,
 *   action: 'logged',
 * });
 * ```
 */
export function logPluginError(log: PluginErrorLog): void {
  const prefix = `[plugin:${log.pluginId}]`;
  const details = {
    type: log.errorType,
    eventType: log.eventType,
    procedure: log.procedure,
    consecutiveErrors: log.consecutiveErrors,
    action: log.action,
    error: log.error.message,
  };

  if (log.action === 'deactivated') {
    // eslint-disable-next-line no-console -- Intentional structured error logging
    console.error(prefix, 'Plugin auto-deactivated due to repeated errors:', details);
  } else {
    // eslint-disable-next-line no-console -- Intentional structured error logging
    console.error(prefix, 'Plugin error:', details);
  }
}

// ============================================================================
// Event Handler Wrapper
// ============================================================================

/**
 * Wrap a plugin event handler with error handling.
 *
 * The wrapper:
 * - Catches errors from the handler
 * - Logs errors with plugin context
 * - Reports errors to the lifecycle manager for potential auto-deactivation
 * - Applies a timeout to prevent hanging
 * - Resets error count on success
 * - Does not re-throw - other handlers should still run
 *
 * @param handler - The original event handler
 * @param options - Wrapping options
 * @returns A wrapped handler with error handling
 *
 * @example
 * ```typescript
 * const wrappedHandler = wrapEventHandler(
 *   plugin.eventHandlers['note:created'],
 *   {
 *     pluginId: '@scribe/plugin-todo',
 *     lifecycle: lifecycleManager,
 *     timeout: 5000,
 *   }
 * );
 * ```
 */
export function wrapEventHandler(
  handler: PluginEventHandler,
  options: WrapEventHandlerOptions
): PluginEventHandler {
  const { pluginId, lifecycle, timeout = EVENT_HANDLER_TIMEOUT, onError } = options;

  return async (event: PluginEvent) => {
    try {
      // Run handler with timeout
      await withTimeout(Promise.resolve(handler(event)), {
        timeout,
        message: `Event handler for ${event.type} timed out after ${timeout}ms`,
      });

      // Success - reset error count
      lifecycle.resetErrorCount(pluginId);
    } catch (error) {
      const consecutiveErrors = lifecycle.getErrorCount(pluginId) + 1;

      const log: PluginErrorLog = {
        timestamp: new Date(),
        pluginId,
        errorType:
          error instanceof Error && error.message.includes('timed out') ? 'timeout' : 'event',
        eventType: event.type,
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        consecutiveErrors,
        action: 'logged',
      };

      // Check if this will trigger deactivation
      const willDeactivate = consecutiveErrors >= 3;
      if (willDeactivate) {
        log.action = 'deactivated';
      }

      // Log the error
      if (onError) {
        onError(log);
      } else {
        logPluginError(log);
      }

      // Report to lifecycle manager for potential auto-deactivation
      await lifecycle.handlePluginError(
        pluginId,
        error instanceof Error ? error : new Error(String(error))
      );

      // Don't re-throw - other handlers should still run
    }
  };
}

// ============================================================================
// Lifecycle Hook Wrapper
// ============================================================================

/**
 * Options for wrapping lifecycle hooks.
 */
export interface WrapLifecycleHookOptions {
  /** The ID of the plugin */
  pluginId: string;

  /** The type of lifecycle hook */
  hookType: 'onActivate' | 'onDeactivate';

  /** Optional timeout in milliseconds */
  timeout?: number;

  /** Optional custom error logger */
  onError?: (log: PluginErrorLog) => void;
}

/**
 * Wrap a lifecycle hook with timeout protection.
 *
 * The wrapper:
 * - Applies a timeout to prevent hanging
 * - Logs errors with plugin context
 * - Re-throws errors (activation failures are fatal for that plugin)
 *
 * @param hook - The lifecycle hook function
 * @param options - Wrapping options
 * @returns A wrapped hook with timeout protection
 *
 * @example
 * ```typescript
 * const wrappedActivate = wrapLifecycleHook(
 *   plugin.onActivate,
 *   {
 *     pluginId: '@scribe/plugin-todo',
 *     hookType: 'onActivate',
 *     timeout: 30000,
 *   }
 * );
 * ```
 */
export function wrapLifecycleHook(
  hook: () => Promise<void> | void,
  options: WrapLifecycleHookOptions
): () => Promise<void> {
  const { pluginId, hookType, timeout = LIFECYCLE_HOOK_TIMEOUT, onError } = options;

  return async () => {
    try {
      await withTimeout(Promise.resolve(hook()), {
        timeout,
        message: `${hookType} timed out after ${timeout}ms`,
      });
    } catch (error) {
      const log: PluginErrorLog = {
        timestamp: new Date(),
        pluginId,
        errorType:
          error instanceof Error && error.message.includes('timed out') ? 'timeout' : 'lifecycle',
        error: {
          message: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        consecutiveErrors: 0, // Not tracked for lifecycle hooks
        action: 'logged',
      };

      // Log the error
      if (onError) {
        onError(log);
      } else {
        logPluginError(log);
      }

      // Re-throw - lifecycle hook failures are fatal for that plugin
      throw error;
    }
  };
}

// ============================================================================
// Router Error Handler
// ============================================================================

/**
 * Handle a router error for a plugin.
 *
 * This should be called when a plugin router throws an error.
 * It logs the error and reports it to the lifecycle manager for
 * potential auto-deactivation.
 *
 * @param pluginId - The ID of the plugin that threw the error
 * @param error - The error that occurred
 * @param lifecycle - The lifecycle manager for error tracking
 * @param procedure - Optional procedure name for logging
 *
 * @example
 * ```typescript
 * try {
 *   await pluginProcedure();
 * } catch (error) {
 *   await handleRouterError('@scribe/plugin-todo', error, lifecycle, 'getTodos');
 *   throw error;
 * }
 * ```
 */
export async function handleRouterError(
  pluginId: string,
  error: Error,
  lifecycle: PluginLifecycleManager,
  procedure?: string
): Promise<void> {
  const consecutiveErrors = lifecycle.getErrorCount(pluginId) + 1;

  const log: PluginErrorLog = {
    timestamp: new Date(),
    pluginId,
    errorType: 'router',
    procedure,
    error: {
      message: error.message,
      stack: error.stack,
    },
    consecutiveErrors,
    action: consecutiveErrors >= 3 ? 'deactivated' : 'logged',
  };

  logPluginError(log);

  await lifecycle.handlePluginError(pluginId, error);
}

// ============================================================================
// Safe Plugin Operation
// ============================================================================

/**
 * Run a plugin operation safely with full error handling.
 *
 * This is a general-purpose wrapper for any plugin operation that:
 * - Catches all errors
 * - Applies timeout protection
 * - Logs errors with context
 * - Reports to lifecycle manager
 * - Returns a result indicating success or failure
 *
 * @param operation - The async operation to run
 * @param options - Operation options
 * @returns Result object with success status and optional error
 *
 * @example
 * ```typescript
 * const result = await safePluginOperation(
 *   () => plugin.router.someMethod(),
 *   {
 *     pluginId: '@scribe/plugin-todo',
 *     lifecycle: lifecycleManager,
 *     timeout: 5000,
 *     errorType: 'router',
 *   }
 * );
 *
 * if (!result.success) {
 *   console.error('Operation failed:', result.error);
 * }
 * ```
 */
export async function safePluginOperation<T>(
  operation: () => Promise<T> | T,
  options: {
    pluginId: string;
    lifecycle: PluginLifecycleManager;
    timeout?: number;
    errorType: PluginErrorType;
    eventType?: PluginEventType;
    procedure?: string;
    onError?: (log: PluginErrorLog) => void;
  }
): Promise<{ success: true; value: T } | { success: false; error: Error }> {
  const {
    pluginId,
    lifecycle,
    timeout = DEFAULT_PLUGIN_TIMEOUT,
    errorType,
    eventType,
    procedure,
    onError,
  } = options;

  try {
    const value = await withTimeout(Promise.resolve(operation()), {
      timeout,
      message: `Plugin operation timed out after ${timeout}ms`,
    });

    // Reset error count on success
    lifecycle.resetErrorCount(pluginId);

    return { success: true, value };
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const consecutiveErrors = lifecycle.getErrorCount(pluginId) + 1;

    const log: PluginErrorLog = {
      timestamp: new Date(),
      pluginId,
      errorType: err.message.includes('timed out') ? 'timeout' : errorType,
      eventType,
      procedure,
      error: {
        message: err.message,
        stack: err.stack,
      },
      consecutiveErrors,
      action: consecutiveErrors >= 3 ? 'deactivated' : 'logged',
    };

    if (onError) {
      onError(log);
    } else {
      logPluginError(log);
    }

    await lifecycle.handlePluginError(pluginId, err);

    return { success: false, error: err };
  }
}
