/**
 * Simple logger utility for Electron main process.
 *
 * Features:
 * - Log levels: debug, info, warn, error
 * - Timestamps in development mode
 * - Ability to enable/disable logging
 * - Context prefix support (e.g., [main], [tasks])
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

interface LoggerConfig {
  /** Minimum log level to output. Default: 'debug' in dev, 'info' in production */
  minLevel: LogLevel;
  /** Whether to include timestamps. Default: true in dev, false in production */
  timestamps: boolean;
  /** Whether logging is enabled. Default: true */
  enabled: boolean;
}

const isDev = process.env.NODE_ENV === 'development';

// Default configuration
const config: LoggerConfig = {
  minLevel: isDev ? 'debug' : 'info',
  timestamps: isDev,
  enabled: true,
};

/**
 * Format a log message with optional timestamp and context.
 */
function formatMessage(level: LogLevel, context: string, message: string): string {
  const parts: string[] = [];

  if (config.timestamps) {
    parts.push(`[${new Date().toISOString()}]`);
  }

  parts.push(`[${level.toUpperCase()}]`);

  if (context) {
    parts.push(`[${context}]`);
  }

  parts.push(message);

  return parts.join(' ');
}

/**
 * Check if a log level should be output based on current config.
 */
function shouldLog(level: LogLevel): boolean {
  return config.enabled && LOG_LEVELS[level] >= LOG_LEVELS[config.minLevel];
}

/**
 * Create a logger instance with optional context prefix.
 */
export function createLogger(context: string = '') {
  return {
    debug(message: string, ...args: unknown[]): void {
      if (shouldLog('debug')) {
        console.debug(formatMessage('debug', context, message), ...args);
      }
    },

    info(message: string, ...args: unknown[]): void {
      if (shouldLog('info')) {
        console.info(formatMessage('info', context, message), ...args);
      }
    },

    warn(message: string, ...args: unknown[]): void {
      if (shouldLog('warn')) {
        console.warn(formatMessage('warn', context, message), ...args);
      }
    },

    error(message: string, ...args: unknown[]): void {
      if (shouldLog('error')) {
        console.error(formatMessage('error', context, message), ...args);
      }
    },
  };
}

/**
 * Configure the logger.
 */
export function configureLogger(options: Partial<LoggerConfig>): void {
  Object.assign(config, options);
}

/**
 * Enable or disable logging globally.
 */
export function setLoggingEnabled(enabled: boolean): void {
  config.enabled = enabled;
}

/**
 * Set the minimum log level.
 */
export function setLogLevel(level: LogLevel): void {
  config.minLevel = level;
}

// Default logger instance for quick access
export const logger = createLogger();

// Pre-configured loggers for common contexts
export const mainLogger = createLogger('main');
export const configLogger = createLogger('config');
export const tasksLogger = createLogger('tasks');
