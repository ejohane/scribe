/**
 * Logger utilities for Electron main process.
 *
 * This module provides pre-configured loggers for the desktop application
 * by extending the shared logger from @scribe/shared. This ensures consistent
 * logging behavior across CLI and desktop applications.
 *
 * ## Usage
 *
 * ```typescript
 * import { mainLogger, tasksLogger } from './logger';
 *
 * mainLogger.info('Application started');
 * mainLogger.error('Failed to start', { error: err });
 *
 * tasksLogger.debug('Processing task', { taskId: '123' });
 * ```
 *
 * ## Log Level Configuration
 *
 * Set the LOG_LEVEL environment variable to control output:
 * - LOG_LEVEL=debug - Show all messages (default in development)
 * - LOG_LEVEL=info - Show info, warn, error (default in production)
 * - LOG_LEVEL=warn - Show warn, error only
 * - LOG_LEVEL=error - Show errors only
 *
 * ## Migration from Previous API
 *
 * The old API accepted rest parameters: `logger.error('msg', err, data)`
 * The new API uses context objects: `logger.error('msg', { error: err, data })`
 *
 * For backward compatibility during migration, error objects passed directly
 * as the second argument are automatically wrapped in a context object.
 *
 * @module electron/main/logger
 */

import { createLogger as createSharedLogger, type Logger, type LogContext } from '@scribe/shared';

/**
 * Determine log level based on environment.
 * Development defaults to 'debug' to show detailed information.
 * Production defaults to 'info' to reduce noise.
 */
const isDev = process.env.NODE_ENV === 'development';
const defaultLevel = isDev ? 'debug' : 'info';

/**
 * Create a logger with a context prefix.
 *
 * Uses the shared logger infrastructure for consistent behavior
 * across CLI and desktop applications.
 *
 * @param context - The context name to prefix log messages with (e.g., 'main', 'tasks')
 * @returns A Logger instance with the specified prefix
 *
 * @example
 * ```typescript
 * const myLogger = createLogger('myModule');
 * myLogger.info('Starting up');
 * // Output: 2024-12-21T12:00:00.000Z INFO [myModule] Starting up
 * ```
 */
export function createLogger(context: string = ''): Logger {
  return createSharedLogger({
    level: (process.env.LOG_LEVEL as 'debug' | 'info' | 'warn' | 'error') || defaultLevel,
    prefix: context,
  });
}

/**
 * Default logger instance for general use.
 *
 * Prefer using context-specific loggers (mainLogger, tasksLogger, etc.)
 * for better log traceability.
 */
export const logger = createLogger();

/**
 * Logger for the main process and application lifecycle.
 *
 * Use for:
 * - Application startup/shutdown events
 * - Window management
 * - Engine initialization
 * - IPC handler setup
 */
export const mainLogger = createLogger('main');

/**
 * Logger for configuration operations.
 *
 * Use for:
 * - Config file loading/saving
 * - Settings changes
 * - Preference updates
 */
export const configLogger = createLogger('config');

/**
 * Logger for task-related operations.
 *
 * Use for:
 * - Task indexing
 * - Task toggling
 * - Task list operations
 */
export const tasksLogger = createLogger('tasks');

// Re-export types for convenience
export type { Logger, LogContext };
