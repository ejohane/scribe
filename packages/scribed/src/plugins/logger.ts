/**
 * Plugin Logger Factory
 *
 * Creates namespaced loggers for plugins with consistent formatting.
 * Each plugin gets its own logger instance with a prefix identifying
 * the plugin source.
 *
 * @module
 */

import type { PluginLogger } from '@scribe/plugin-core';

/**
 * Create a namespaced logger for a plugin.
 *
 * The logger prefixes all messages with `[plugin:{pluginId}]` for easy
 * identification in logs.
 *
 * @param pluginId - The ID of the plugin
 * @returns A PluginLogger instance
 *
 * @example
 * ```typescript
 * const logger = createPluginLogger('@scribe/plugin-example');
 * logger.info('Plugin initialized'); // [plugin:@scribe/plugin-example] Plugin initialized
 * ```
 */
export function createPluginLogger(pluginId: string): PluginLogger {
  const prefix = `[plugin:${pluginId}]`;

  return {
    debug: (message: string, data?: Record<string, unknown>) => {
      if (data) {
        console.debug(prefix, message, data);
      } else {
        console.debug(prefix, message);
      }
    },
    info: (message: string, data?: Record<string, unknown>) => {
      if (data) {
        console.info(prefix, message, data);
      } else {
        console.info(prefix, message);
      }
    },
    warn: (message: string, data?: Record<string, unknown>) => {
      if (data) {
        console.warn(prefix, message, data);
      } else {
        console.warn(prefix, message);
      }
    },
    error: (message: string, data?: Record<string, unknown>) => {
      if (data) {
        console.error(prefix, message, data);
      } else {
        console.error(prefix, message);
      }
    },
  };
}

/**
 * Create a no-op logger for testing or when logging is disabled.
 *
 * @returns A PluginLogger that does nothing
 */
export function createNoopLogger(): PluginLogger {
  const noop = () => {};
  return {
    debug: noop,
    info: noop,
    warn: noop,
    error: noop,
  };
}
