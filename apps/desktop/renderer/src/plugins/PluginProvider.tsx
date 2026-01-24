/**
 * PluginProvider
 *
 * React provider component that initializes the plugin system and provides
 * access to plugin capabilities throughout the application.
 *
 * @module
 */

import { useEffect, useState, useMemo, useRef, type ReactNode } from 'react';
import {
  PluginRegistry,
  PluginLoader,
  type ClientPlugin,
  type PluginLoadFailure,
  type SidebarPanelEntry,
  type SlashCommandEntry,
  type CommandPaletteCommandEntry,
  type EditorExtensionEntry,
  type ClientPluginContext,
  type PluginManifest,
} from '@scribe/plugin-core';
import { getInstalledPlugins } from './installed';
import { PluginContext, type PluginContextValue, type PluginLoadError } from './context';

/**
 * Props for the PluginProvider component.
 */
export interface PluginProviderProps {
  /** Child components to wrap */
  children: ReactNode;
}

/**
 * Convert plugin load failures to PluginLoadError format.
 */
function toPluginLoadErrors(failures: PluginLoadFailure[]): PluginLoadError[] {
  return failures.map((failure) => ({
    pluginId: failure.pluginId,
    message: failure.error.message,
    error: failure.error,
  }));
}

/**
 * Provider component that initializes the plugin system.
 *
 * This component:
 * 1. Creates a PluginRegistry to track plugins
 * 2. Loads all installed plugins asynchronously
 * 3. Provides the plugin context to children
 */
export function PluginProvider({ children }: PluginProviderProps) {
  const [plugins, setPlugins] = useState<ClientPlugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<PluginLoadError[]>([]);

  // Create registry once - it persists across renders
  const registry = useMemo(() => new PluginRegistry(), []);

  // Track if plugins have been loaded to handle React StrictMode double-mounting
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    // Skip if already loaded (handles StrictMode double-mounting)
    if (hasLoadedRef.current) {
      return;
    }
    hasLoadedRef.current = true;

    async function loadPlugins() {
      // Create context factory for client plugins
      const contextFactory = {
        create(manifest: PluginManifest): ClientPluginContext {
          return {
            manifest,
            // For v1, we provide a minimal client interface
            // Plugins will use useScribeClient() hook directly in their components
            client: {
              query: async () => {
                throw new Error(
                  'Direct client.query() is not supported. Use useScribeClient() hook in your component.'
                );
              },
              mutate: async () => {
                throw new Error(
                  'Direct client.mutate() is not supported. Use useScribeClient() hook in your component.'
                );
              },
            },
          };
        },
      };

      const loader = new PluginLoader(registry, contextFactory);
      const modules = getInstalledPlugins();

      if (modules.length === 0) {
        // No plugins to load
        setIsLoading(false);
        return;
      }

      const result = await loader.loadPlugins(modules);

      // Extract client plugins from registry
      const loadedPlugins: ClientPlugin[] = [];
      for (const registered of registry.getAllPlugins()) {
        loadedPlugins.push(registered.plugin as ClientPlugin);
      }

      setPlugins(loadedPlugins);
      setErrors(toPluginLoadErrors(result.failed));
      setIsLoading(false);

      if (result.failed.length > 0) {
        // eslint-disable-next-line no-console -- Intentional warning for debugging
        console.warn(
          '[PluginProvider] Some plugins failed to load:',
          result.failed.map((f) => `${f.pluginId}: ${f.error.message}`)
        );
      }

      if (result.loaded.length > 0) {
        // eslint-disable-next-line no-console -- Intentional logging for debugging
        console.log('[PluginProvider] Loaded plugins:', result.loaded);
      }
    }

    loadPlugins();
  }, [registry]);

  // Memoize the context value to prevent unnecessary re-renders
  const value = useMemo<PluginContextValue>(
    () => ({
      plugins,
      registry,
      isLoading,
      errors,

      getSidebarPanels(): SidebarPanelEntry[] {
        const panels = registry.getCapabilities('sidebar-panel');
        // Sort by priority (lower values first)
        return [...panels].sort((a, b) => a.priority - b.priority);
      },

      getSlashCommands(): SlashCommandEntry[] {
        return [...registry.getCapabilities('slash-command')];
      },

      getCommandPaletteCommands(): CommandPaletteCommandEntry[] {
        const commands = registry.getCapabilities('command-palette-command');
        // Sort by priority (lower values first)
        return [...commands].sort((a, b) => a.priority - b.priority);
      },

      getEditorExtensions(): EditorExtensionEntry[] {
        const extensions = registry.getCapabilities('editor-extension');
        return [...extensions].sort((a, b) => a.pluginId.localeCompare(b.pluginId));
      },
    }),
    [plugins, registry, isLoading, errors]
  );

  return <PluginContext.Provider value={value}>{children}</PluginContext.Provider>;
}
