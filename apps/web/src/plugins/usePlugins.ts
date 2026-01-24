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
 *
 * @example
 * ```tsx
 * function PluginStatus() {
 *   const { plugins, isLoading, errors } = usePlugins();
 *
 *   if (isLoading) {
 *     return <div>Loading plugins...</div>;
 *   }
 *
 *   if (errors.length > 0) {
 *     return (
 *       <div>
 *         Plugin errors:
 *         {errors.map(e => <div key={e.pluginId}>{e.message}</div>)}
 *       </div>
 *     );
 *   }
 *
 *   return <div>Loaded {plugins.length} plugins</div>;
 * }
 * ```
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
 *
 * @returns Object with panels array and loading state
 *
 * @example
 * ```tsx
 * function Sidebar() {
 *   const { panels, isLoading } = useSidebarPanels();
 *
 *   if (isLoading) {
 *     return <SidebarSkeleton />;
 *   }
 *
 *   return (
 *     <aside>
 *       <NotesPanel />
 *       {panels.map(panel => (
 *         <PluginPanel key={panel.id} panel={panel} />
 *       ))}
 *     </aside>
 *   );
 * }
 * ```
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
 *
 * @returns Object with commands array and loading state
 *
 * @example
 * ```tsx
 * function SlashCommandMenu() {
 *   const { commands, isLoading } = useSlashCommands();
 *
 *   if (isLoading) {
 *     return null; // Don't show menu until plugins loaded
 *   }
 *
 *   return (
 *     <menu>
 *       {commands.map(cmd => (
 *         <CommandItem
 *           key={cmd.command}
 *           command={cmd.command}
 *           label={cmd.label}
 *           description={cmd.description}
 *           icon={cmd.icon}
 *           onSelect={() => executeCommand(cmd)}
 *         />
 *       ))}
 *     </menu>
 *   );
 * }
 * ```
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
 *
 * @returns Object with loading and error status
 *
 * @example
 * ```tsx
 * function App() {
 *   const { isLoading, hasErrors } = usePluginLoading();
 *
 *   if (isLoading) {
 *     return <SplashScreen />;
 *   }
 *
 *   if (hasErrors) {
 *     return <ErrorBanner message="Some plugins failed to load" />;
 *   }
 *
 *   return <MainApp />;
 * }
 * ```
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
 *
 * @returns Object with commands array and loading state
 *
 * @example
 * ```tsx
 * function CommandPaletteWithPlugins() {
 *   const { commands, isLoading } = useCommandPaletteCommands();
 *
 *   if (isLoading) {
 *     return null; // Don't include plugin commands until loaded
 *   }
 *
 *   // Convert to CommandPaletteProvider's expected format
 *   const pluginCommands = commands.map(cmd => ({
 *     type: 'command' as const,
 *     id: cmd.id,
 *     label: cmd.label,
 *     // ...
 *   }));
 *
 *   return <CommandPaletteProvider pluginCommands={pluginCommands}>...</CommandPaletteProvider>;
 * }
 * ```
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
 *
 * @returns Object with extensions array and loading state
 */
export function useEditorExtensions(): UseEditorExtensionsResult {
  const { getEditorExtensions, isLoading } = usePlugins();

  return {
    extensions: getEditorExtensions(),
    isLoading,
  };
}
