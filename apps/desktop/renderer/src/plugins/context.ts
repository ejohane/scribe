/**
 * Plugin Context
 *
 * React context for the plugin system. Provides access to loaded plugins
 * and their capabilities throughout the application.
 *
 * @module
 */

import { createContext } from 'react';
import type {
  ClientPlugin,
  PluginRegistry,
  SidebarPanelEntry,
  SlashCommandEntry,
  CommandPaletteCommandEntry,
  EditorExtensionEntry,
} from '@scribe/plugin-core';

/**
 * Error information for plugin load failures.
 */
export interface PluginLoadError {
  /** The ID of the plugin that failed to load */
  pluginId: string;
  /** The error message */
  message: string;
  /** The underlying error */
  error: Error;
}

/**
 * Context value provided by PluginProvider.
 *
 * Contains all loaded plugins, the registry for capability lookup,
 * loading state, and convenience methods for accessing capabilities.
 */
export interface PluginContextValue {
  /** All loaded client plugins */
  plugins: ClientPlugin[];

  /** Plugin registry for capability lookup */
  registry: PluginRegistry;

  /** Whether plugins are currently loading */
  isLoading: boolean;

  /** Errors encountered during plugin loading */
  errors: PluginLoadError[];

  /**
   * Get all sidebar panel capabilities sorted by priority.
   * Lower priority values appear first in the list.
   *
   * @returns Array of sidebar panel entries sorted by priority
   */
  getSidebarPanels(): SidebarPanelEntry[];

  /**
   * Get all slash command capabilities.
   *
   * @returns Array of slash command entries
   */
  getSlashCommands(): SlashCommandEntry[];

  /**
   * Get all command palette command capabilities sorted by priority.
   * Lower priority values appear first in the list.
   *
   * @returns Array of command palette command entries sorted by priority
   */
  getCommandPaletteCommands(): CommandPaletteCommandEntry[];

  /**
   * Get all editor extension capabilities.
   *
   * @returns Array of editor extension entries
   */
  getEditorExtensions(): EditorExtensionEntry[];
}

/**
 * React context for the plugin system.
 *
 * Use the usePlugins hook to access this context.
 * Returns null if accessed outside of PluginProvider.
 */
export const PluginContext = createContext<PluginContextValue | null>(null);
