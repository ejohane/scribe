/**
 * Server-side Daily Note Plugin
 *
 * Provides the server plugin factory and manifest export.
 *
 * @module
 */

import type { ServerPlugin, ServerPluginContext } from '@scribe/plugin-core';
import { manifest } from '../shared/manifest.js';

export { manifest } from '../shared/manifest.js';

export function createServerPlugin(_context: ServerPluginContext): ServerPlugin {
  return {
    manifest,
  };
}
