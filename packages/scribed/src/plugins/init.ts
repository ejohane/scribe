/**
 * Plugin System Initialization
 *
 * Provides the infrastructure for initializing, loading, and managing
 * plugins in the scribed daemon. This module creates all necessary
 * components and coordinates the plugin lifecycle.
 *
 * @module
 */

import type { PluginManifest, PluginModule, ServerPluginContext } from '@scribe/plugin-core';
import {
  PluginRegistry,
  PluginLoader,
  PluginStorageFactory,
  DefaultPluginEventBus,
  PluginLifecycleManager,
} from '@scribe/plugin-core';
import type { PluginStorageDatabase } from '@scribe/plugin-core';

import { createPluginLogger } from './logger.js';
import { collectPluginRouters, type PluginRouterEntry } from './router-merger.js';

// ============================================================================
// Types
// ============================================================================

/**
 * The plugin system interface exposed to the daemon.
 */
export interface PluginSystem {
  /** Plugin registry containing all registered plugins */
  registry: PluginRegistry;

  /** Plugin loader for loading plugin modules */
  loader: PluginLoader;

  /** Event bus for plugin events */
  eventBus: DefaultPluginEventBus;

  /** Lifecycle manager for plugin activation/deactivation */
  lifecycle: PluginLifecycleManager;

  /**
   * Load plugins from the provided modules.
   * This registers plugins but does not activate them.
   *
   * @param modules - Array of plugin modules to load
   */
  loadPlugins(modules: PluginModule[]): Promise<void>;

  /**
   * Activate all loaded plugins.
   * Should be called after services are ready.
   */
  activateAll(): Promise<void>;

  /**
   * Get tRPC routers from all plugins with router capability.
   *
   * @returns Array of plugin router entries
   */
  getRouters(): PluginRouterEntry[];

  /**
   * Shut down all plugins gracefully.
   * Deactivates all active plugins.
   */
  shutdown(): Promise<void>;
}

/**
 * Context factory for creating plugin contexts.
 */
export interface ServerPluginContextFactory {
  /**
   * Create a context for a plugin.
   *
   * @param manifest - The plugin manifest
   * @returns A ServerPluginContext for the plugin
   */
  create(manifest: PluginManifest): ServerPluginContext;
}

// ============================================================================
// Implementation
// ============================================================================

/**
 * Options for initializing the plugin system.
 */
export interface InitPluginSystemOptions {
  /** Database instance for plugin storage */
  db: PluginStorageDatabase;
  /** Optional pre-created event bus. If not provided, a new one is created. */
  eventBus?: DefaultPluginEventBus;
}

/**
 * Initialize the plugin system.
 *
 * Creates all core plugin infrastructure components:
 * - Registry: Stores registered plugins and indexes capabilities
 * - Loader: Handles plugin module loading and instantiation
 * - Storage: Provides namespaced SQLite storage for each plugin
 * - EventBus: Enables event-based communication between plugins and core
 * - Lifecycle: Manages plugin activation/deactivation states
 *
 * @param dbOrOptions - Database instance for plugin storage, or options object
 * @returns Initialized PluginSystem
 *
 * @example
 * ```typescript
 * // Create event bus first to share with services
 * const eventBus = new DefaultPluginEventBus();
 * const services = createServices({ vaultPath, dbPath, eventBus });
 * const pluginSystem = await initializePluginSystem({ db, eventBus });
 *
 * // Load plugins from installed modules
 * await pluginSystem.loadPlugins(getInstalledPlugins());
 *
 * // Get routers for tRPC integration
 * const pluginRouters = pluginSystem.getRouters();
 *
 * // Activate all plugins after services are ready
 * await pluginSystem.activateAll();
 *
 * // On shutdown
 * await pluginSystem.shutdown();
 * ```
 */
export async function initializePluginSystem(
  dbOrOptions: PluginStorageDatabase | InitPluginSystemOptions
): Promise<PluginSystem> {
  // Support both old signature (just db) and new signature (options object)
  const options: InitPluginSystemOptions = 'db' in dbOrOptions ? dbOrOptions : { db: dbOrOptions };

  // eslint-disable-next-line no-console -- Intentional startup logging
  console.log('[plugins] Initializing plugin system...');

  // Create core components
  const registry = new PluginRegistry();
  const storageFactory = new PluginStorageFactory(options.db);
  const eventBus = options.eventBus ?? new DefaultPluginEventBus();

  // Create context factory for server plugins
  const contextFactory: ServerPluginContextFactory = {
    create(manifest: PluginManifest): ServerPluginContext {
      return {
        manifest,
        storage: storageFactory.createForPlugin(manifest.id),
        events: eventBus.createScopedEmitter(manifest.id),
        logger: createPluginLogger(manifest.id),
      };
    },
  };

  // Create loader and lifecycle manager
  const loader = new PluginLoader(registry, contextFactory);
  const lifecycle = new PluginLifecycleManager(registry);

  // eslint-disable-next-line no-console -- Intentional startup logging
  console.log('[plugins] Plugin system initialized');

  return {
    registry,
    loader,
    eventBus,
    lifecycle,

    async loadPlugins(modules: PluginModule[]): Promise<void> {
      if (modules.length === 0) {
        // eslint-disable-next-line no-console -- Intentional logging
        console.log('[plugins] No plugins to load');
        return;
      }

      // eslint-disable-next-line no-console -- Intentional logging
      console.log(`[plugins] Loading ${modules.length} plugin(s)...`);

      const result = await loader.loadPlugins(modules);

      if (result.failed.length > 0) {
        // eslint-disable-next-line no-console -- Intentional warning
        console.warn(
          `[plugins] ${result.failed.length} plugin(s) failed to load:`,
          result.failed.map((f) => `${f.pluginId}: ${f.error.message}`).join(', ')
        );
      }

      if (result.loaded.length > 0) {
        // eslint-disable-next-line no-console -- Intentional logging
        console.log(
          `[plugins] Loaded ${result.loaded.length} plugin(s): ${result.loaded.join(', ')}`
        );
      }
    },

    async activateAll(): Promise<void> {
      const plugins = registry.getAllPlugins();

      if (plugins.length === 0) {
        // eslint-disable-next-line no-console -- Intentional logging
        console.log('[plugins] No plugins to activate');
        return;
      }

      // eslint-disable-next-line no-console -- Intentional logging
      console.log(`[plugins] Activating ${plugins.length} plugin(s)...`);

      let activated = 0;
      let failed = 0;

      for (const plugin of plugins) {
        try {
          await lifecycle.activate(plugin.plugin.manifest.id);
          activated++;
        } catch (error) {
          failed++;
          // eslint-disable-next-line no-console -- Intentional error logging
          console.error(
            `[plugins] Failed to activate ${plugin.plugin.manifest.id}:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      // eslint-disable-next-line no-console -- Intentional logging
      console.log(`[plugins] Activation complete: ${activated} succeeded, ${failed} failed`);
    },

    getRouters(): PluginRouterEntry[] {
      return collectPluginRouters(registry);
    },

    async shutdown(): Promise<void> {
      const plugins = registry.getAllPlugins();

      if (plugins.length === 0) {
        // eslint-disable-next-line no-console -- Intentional logging
        console.log('[plugins] No plugins to deactivate');
        return;
      }

      // eslint-disable-next-line no-console -- Intentional logging
      console.log(`[plugins] Shutting down ${plugins.length} plugin(s)...`);

      let deactivated = 0;
      let failed = 0;

      // Deactivate in reverse order (LIFO)
      for (const plugin of [...plugins].reverse()) {
        try {
          // Only deactivate if currently active
          if (lifecycle.isActive(plugin.plugin.manifest.id)) {
            await lifecycle.deactivate(plugin.plugin.manifest.id);
            deactivated++;
          }
        } catch (error) {
          failed++;
          // eslint-disable-next-line no-console -- Intentional error logging
          console.error(
            `[plugins] Failed to deactivate ${plugin.plugin.manifest.id}:`,
            error instanceof Error ? error.message : error
          );
        }
      }

      // Clear the event bus
      eventBus.clear();

      // eslint-disable-next-line no-console -- Intentional logging
      console.log(`[plugins] Shutdown complete: ${deactivated} deactivated, ${failed} failed`);
    },
  };
}
