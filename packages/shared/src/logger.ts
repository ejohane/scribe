/**
 * Logger Abstraction for Scribe
 *
 * A lightweight, zero-dependency logger that provides:
 * - Structured logging with typed context objects
 * - Environment-based log level filtering (LOG_LEVEL env var)
 * - Child loggers for component context prefixing
 * - Consistent output format with timestamps
 *
 * @example
 * ```typescript
 * import { logger } from '@scribe/shared';
 *
 * // Root logger
 * logger.info('Application started');
 *
 * // Child logger with component context
 * const log = logger.child('TasksWidget');
 * log.debug('Loading tasks', { count: 10 });
 * log.error('Failed to save', { error: err, taskId: '123' });
 *
 * // Output:
 * // 2024-12-21T12:00:00.000Z INFO Application started
 * // 2024-12-21T12:00:00.000Z DEBUG [TasksWidget] Loading tasks {"count":10}
 * // 2024-12-21T12:00:00.000Z ERROR [TasksWidget] Failed to save {"error":"...","taskId":"123"}
 * ```
 *
 * @module
 */

/**
 * Log levels from least to most severe.
 * - debug: Detailed information for debugging
 * - info: General operational information
 * - warn: Warning conditions that should be addressed
 * - error: Error conditions that require attention
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Context object for structured logging.
 * Keys should be descriptive identifiers, values can be any serializable data.
 */
export type LogContext = Record<string, unknown>;

/**
 * Logger interface providing structured logging methods.
 */
export interface Logger {
  /**
   * Log debug-level message. Only visible when LOG_LEVEL=debug.
   * Use for detailed debugging information during development.
   */
  debug(message: string, context?: LogContext): void;

  /**
   * Log info-level message. Visible at LOG_LEVEL=info or lower.
   * Use for general operational events.
   */
  info(message: string, context?: LogContext): void;

  /**
   * Log warn-level message. Visible at LOG_LEVEL=warn or lower.
   * Use for potentially problematic situations that don't require immediate action.
   */
  warn(message: string, context?: LogContext): void;

  /**
   * Log error-level message. Always visible.
   * Use for error conditions that require attention.
   */
  error(message: string, context?: LogContext): void;

  /**
   * Create a child logger with an additional prefix.
   * Useful for adding component context to log messages.
   *
   * @param name - The name to add to the prefix chain
   * @returns A new logger with the extended prefix
   *
   * @example
   * ```typescript
   * const componentLog = logger.child('TasksWidget');
   * componentLog.info('Loading'); // Output: ... INFO [TasksWidget] Loading
   *
   * const methodLog = componentLog.child('handleSave');
   * methodLog.debug('Saving'); // Output: ... DEBUG [TasksWidget:handleSave] Saving
   * ```
   */
  child(name: string): Logger;

  /**
   * Get the current log level threshold.
   * Messages below this level will not be output.
   */
  getLevel(): LogLevel;

  /**
   * Check if a given log level would be output.
   * Useful for avoiding expensive context computation when logging is disabled.
   *
   * @example
   * ```typescript
   * if (log.isLevelEnabled('debug')) {
   *   log.debug('Expensive debug info', { data: computeExpensiveData() });
   * }
   * ```
   */
  isLevelEnabled(level: LogLevel): boolean;
}

/**
 * Numeric priority for each log level.
 * Higher numbers = more severe/important.
 */
const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Get the minimum log level from environment.
 * Defaults to 'info' if not specified or invalid.
 */
function getMinLevelFromEnv(): LogLevel {
  // Check for environment variable (works in Node.js and some bundlers)
  const envLevel = typeof process !== 'undefined' && process.env?.LOG_LEVEL?.toLowerCase();

  if (envLevel && envLevel in LOG_LEVEL_PRIORITY) {
    return envLevel as LogLevel;
  }

  // Default to 'info' for production, but could be 'debug' for development
  return 'info';
}

/**
 * Format a context object as a JSON string for log output.
 * Returns empty string if context is empty or undefined.
 */
function formatContext(context?: LogContext): string {
  if (!context || Object.keys(context).length === 0) {
    return '';
  }

  try {
    return ' ' + JSON.stringify(context);
  } catch {
    // Handle circular references or non-serializable values
    return ' [context serialization failed]';
  }
}

/**
 * Get current ISO timestamp for log output.
 */
function getTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Internal function to create a logger instance.
 *
 * @param prefix - Optional prefix for all messages from this logger
 * @param minLevel - Minimum log level to output
 */
function createLoggerInternal(prefix: string, minLevel: LogLevel): Logger {
  const minPriority = LOG_LEVEL_PRIORITY[minLevel];
  const prefixStr = prefix ? `[${prefix}] ` : '';

  const log = (level: LogLevel, message: string, context?: LogContext): void => {
    const levelPriority = LOG_LEVEL_PRIORITY[level];

    // Skip if below minimum level
    if (levelPriority < minPriority) {
      return;
    }

    const timestamp = getTimestamp();
    const formattedContext = formatContext(context);
    const output = `${timestamp} ${level.toUpperCase()} ${prefixStr}${message}${formattedContext}`;

    // Use appropriate console method for each level
    // Note: no-console is disabled for logger.ts in ESLint config
    switch (level) {
      case 'debug':
        console.debug(output);
        break;
      case 'info':
        console.info(output);
        break;
      case 'warn':
        console.warn(output);
        break;
      case 'error':
        console.error(output);
        break;
    }
  };

  return {
    debug: (message, context) => log('debug', message, context),
    info: (message, context) => log('info', message, context),
    warn: (message, context) => log('warn', message, context),
    error: (message, context) => log('error', message, context),

    child: (name: string): Logger => {
      const newPrefix = prefix ? `${prefix}:${name}` : name;
      return createLoggerInternal(newPrefix, minLevel);
    },

    getLevel: () => minLevel,

    isLevelEnabled: (level: LogLevel): boolean => {
      return LOG_LEVEL_PRIORITY[level] >= minPriority;
    },
  };
}

/**
 * Create a new logger with optional configuration.
 *
 * @param options - Logger configuration options
 * @returns A configured Logger instance
 *
 * @example
 * ```typescript
 * // Use default settings (level from LOG_LEVEL env var)
 * const log = createLogger();
 *
 * // Explicit log level
 * const debugLog = createLogger({ level: 'debug' });
 *
 * // With component prefix
 * const componentLog = createLogger({ prefix: 'MyComponent' });
 * ```
 */
export function createLogger(options?: {
  /** Minimum log level to output. Defaults to LOG_LEVEL env var or 'info'. */
  level?: LogLevel;
  /** Optional prefix for all log messages. */
  prefix?: string;
}): Logger {
  const level = options?.level ?? getMinLevelFromEnv();
  const prefix = options?.prefix ?? '';
  return createLoggerInternal(prefix, level);
}

/**
 * Default logger instance.
 * Uses LOG_LEVEL environment variable for level filtering (defaults to 'info').
 *
 * @example
 * ```typescript
 * import { logger } from '@scribe/shared';
 *
 * logger.info('Application started');
 * const componentLog = logger.child('MyComponent');
 * componentLog.debug('Initializing', { config });
 * ```
 */
export const logger: Logger = createLogger();
