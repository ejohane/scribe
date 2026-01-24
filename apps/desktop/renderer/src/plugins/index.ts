/**
 * Plugin System - Desktop Client
 *
 * This module provides React integration for the Scribe plugin system.
 * It enables plugins to contribute UI components like sidebar panels
 * and slash commands to the desktop application.
 *
 * @example
 * ```tsx
 * // In App.tsx - wrap your app with PluginProvider
 * import { PluginProvider } from './plugins';
 *
 * export function App() {
 *   return (
 *     <PluginProvider>
 *       <MainLayout />
 *     </PluginProvider>
 *   );
 * }
 *
 * // In components - use hooks to access plugins
 * import { usePlugins, useSidebarPanels, useSlashCommands } from './plugins';
 *
 * function Sidebar() {
 *   const { panels, isLoading } = useSidebarPanels();
 *   // Render panels...
 * }
 * ```
 *
 * @module
 */

// Provider component
export { PluginProvider } from './PluginProvider';
export type { PluginProviderProps } from './PluginProvider';

// Context types
export { PluginContext } from './context';
export type { PluginContextValue, PluginLoadError } from './context';

// Hooks
export {
  usePlugins,
  useSidebarPanels,
  useSlashCommands,
  usePluginLoading,
  useCommandPaletteCommands,
  useEditorExtensions,
} from './usePlugins';
export type {
  UseSidebarPanelsResult,
  UseSlashCommandsResult,
  UsePluginLoadingResult,
  UseCommandPaletteCommandsResult,
  UseEditorExtensionsResult,
} from './usePlugins';

// Installed plugins registry
export { getInstalledPlugins } from './installed';

// Plugin client initializer
export { PluginClientInitializer } from './PluginClientInitializer';
export type { PluginClientInitializerProps } from './PluginClientInitializer';
