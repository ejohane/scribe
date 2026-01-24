/**
 * Plugin Hooks
 *
 * React hooks for accessing the plugin system. Provides the main usePlugins
 * hook and convenience hooks for specific capabilities.
 *
 * @module
 */

import { useContext } from 'react';
import { PluginContext, type PluginContextValue } from './context';
import type {
  SidebarPanelEntry,
  SlashCommandEntry,
  CommandPaletteCommandEntry,
  EditorExtensionEntry,
} from '@scribe/plugin-core';

/**
 * Access the full plugin context.
 *
 * Returns the plugin context including all loaded plugins, the registry,
 * loading state, and convenience methods for accessing capabilities.
 *
 * @throws Error if used outside of PluginProvider
 */
export function usePlugins(): PluginContextValue {
  const context = useContext(PluginContext);

  if (!context) {
    throw new Error('usePlugins must be used within a PluginProvider');
  }

  return context;
}

/**
 * Result from useSidebarPanels hook.
 */
export interface UseSidebarPanelsResult {
  /** Sidebar panels sorted by priority */
  panels: SidebarPanelEntry[];
  /** Whether plugins are still loading */
  isLoading: boolean;
}

/**
 * Get all sidebar panels provided by plugins.
 *
 * Returns panels sorted by priority (lower values first).
 * Includes loading state to show skeleton UI while plugins load.
 */
export function useSidebarPanels(): UseSidebarPanelsResult {
  const { getSidebarPanels, isLoading } = usePlugins();

  return {
    panels: getSidebarPanels(),
    isLoading,
  };
}

/**
 * Result from useSlashCommands hook.
 */
export interface UseSlashCommandsResult {
  /** All slash commands from plugins */
  commands: SlashCommandEntry[];
  /** Whether plugins are still loading */
  isLoading: boolean;
}

/**
 * Get all slash commands provided by plugins.
 *
 * Includes loading state to handle commands not being available yet.
 */
export function useSlashCommands(): UseSlashCommandsResult {
  const { getSlashCommands, isLoading } = usePlugins();

  return {
    commands: getSlashCommands(),
    isLoading,
  };
}

/**
 * Result from usePluginLoading hook.
 */
export interface UsePluginLoadingResult {
  /** Whether plugins are still loading */
  isLoading: boolean;
  /** Whether all plugins loaded successfully */
  hasErrors: boolean;
  /** Number of errors encountered */
  errorCount: number;
}

/**
 * Get plugin loading status.
 *
 * Convenience hook for components that only need to know about loading state.
 */
export function usePluginLoading(): UsePluginLoadingResult {
  const { isLoading, errors } = usePlugins();

  return {
    isLoading,
    hasErrors: errors.length > 0,
    errorCount: errors.length,
  };
}

/**
 * Result from useCommandPaletteCommands hook.
 */
export interface UseCommandPaletteCommandsResult {
  /** Command palette commands from plugins sorted by priority */
  commands: CommandPaletteCommandEntry[];
  /** Whether plugins are still loading */
  isLoading: boolean;
}

/**
 * Get all command palette commands provided by plugins.
 *
 * Returns commands sorted by priority (lower values first).
 * Includes loading state to handle commands not being available yet.
 */
export function useCommandPaletteCommands(): UseCommandPaletteCommandsResult {
  const { getCommandPaletteCommands, isLoading } = usePlugins();

  return {
    commands: getCommandPaletteCommands(),
    isLoading,
  };
}

/**
 * Result from useEditorExtensions hook.
 */
export interface UseEditorExtensionsResult {
  /** Editor extension entries from plugins */
  extensions: EditorExtensionEntry[];
  /** Whether plugins are still loading */
  isLoading: boolean;
}

/**
 * Get all editor extensions provided by plugins.
 *
 * Includes loading state to handle extensions not being available yet.
 */
export function useEditorExtensions(): UseEditorExtensionsResult {
  const { getEditorExtensions, isLoading } = usePlugins();

  return {
    extensions: getEditorExtensions(),
    isLoading,
  };
}
