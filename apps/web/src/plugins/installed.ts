/**
 * Installed Plugins Registry
 *
 * Defines which plugins are available in the web application.
 * New plugins should be added to this file after being installed.
 *
 * @module
 */

import type { PluginModule } from '@scribe/plugin-core';
// Import from /client to avoid pulling in server-side code (@trpc/server)
import * as dailyNotePlugin from '@scribe/plugin-daily-note/client';

/**
 * Get all installed plugins.
 *
 * This function returns an array of all plugin modules that should be
 * loaded in the web application. To add a new plugin:
 *
 * 1. Install the plugin package: `bun add @scribe/plugin-xxx`
 * 2. Import the plugin module
 * 3. Add it to the returned array
 *
 * @example
 * ```typescript
 * export function getInstalledPlugins(): PluginModule[] {
 *   return [
 *     // Add more plugins here
 *   ];
 * }
 * ```
 *
 * @returns Array of plugin modules to load
 */
export function getInstalledPlugins(): PluginModule[] {
  return [
    dailyNotePlugin,
    // Add more plugins here
  ];
}
