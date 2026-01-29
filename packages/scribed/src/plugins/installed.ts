/**
 * Installed Plugins Registry
 *
 * Returns the list of plugins that are installed and should be loaded
 * at daemon startup. For v1, plugins are explicitly imported here.
 *
 * Future: Could scan node_modules for packages matching a pattern
 * or use package.json config.
 *
 * @module
 */

import type { PluginModule } from '@scribe/plugin-core';

/**
 * Get the list of installed plugin modules.
 *
 * Each plugin module must export:
 * - `manifest`: The plugin manifest describing its capabilities
 * - `createServerPlugin`: Factory function to create the server plugin instance
 *
 * @returns Array of installed plugin modules
 *
 * @example
 * ```typescript
 * // When plugins are installed:
 * import * as examplePlugin from '@scribe/plugin-example';
 * import * as calendarPlugin from '@scribe/plugin-calendar';
 *
 * export function getInstalledPlugins(): PluginModule[] {
 *   return [
 *     examplePlugin,
 *     calendarPlugin,
 *   ];
 * }
 * ```
 */
export function getInstalledPlugins(): PluginModule[] {
  // Currently no plugins are installed.
  // To add plugins, import them and add to this array.
  //
  // Example:
  // import * as examplePlugin from '@scribe/plugin-example';
  // return [examplePlugin];

  return [];
}

/**
 * Configuration for plugin discovery (future use).
 */
export interface PluginDiscoveryConfig {
  /** Patterns to match plugin packages (e.g., '@scribe/plugin-*') */
  patterns?: string[];

  /** Explicit list of plugin package names to load */
  packages?: string[];

  /** Whether to scan node_modules for matching packages */
  scanNodeModules?: boolean;
}

/**
 * Get installed plugins based on configuration (future use).
 *
 * This is a placeholder for future dynamic plugin discovery.
 * For now, it falls back to the static list.
 *
 * @param _config - Discovery configuration (unused in v1)
 * @returns Array of installed plugin modules
 */
export function discoverPlugins(_config?: PluginDiscoveryConfig): PluginModule[] {
  // Future: Implement dynamic plugin discovery based on config
  // - Scan node_modules for packages matching patterns
  // - Load from explicit package names
  // - Filter by enabled/disabled config

  return getInstalledPlugins();
}
