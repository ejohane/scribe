/**
 * Installed Plugins Registry
 *
 * Defines which plugins are available in the desktop application.
 * New plugins should be added to this file after being installed.
 *
 * @module
 */

import type { PluginModule } from '@scribe/plugin-core';
// Import from /client to avoid pulling in server-side code (@trpc/server)
import * as dailyNotePlugin from '@scribe/plugin-daily-note/client';
import * as todoPlugin from '@scribe/plugin-todo/client';

/**
 * Get all installed plugins.
 *
 * This function returns an array of all plugin modules that should be
 * loaded in the desktop application. To add a new plugin:
 *
 * 1. Install the plugin package: `bun add @scribe/plugin-xxx`
 * 2. Import the plugin module
 * 3. Add it to the returned array
 *
 * @returns Array of plugin modules to load
 */
export function getInstalledPlugins(): PluginModule[] {
  return [
    dailyNotePlugin,
    todoPlugin,
    // Add more plugins here
  ];
}
