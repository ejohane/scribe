/**
 * Plugin System Initialization
 *
 * Provides the infrastructure for initializing, loading, and managing
 * plugins in the scribed daemon. This module creates all necessary
 * components and coordinates the plugin lifecycle.
 *
 * @module
 */

import type {
  PluginManifest,
  PluginModule,
  ServerPluginContext,
  ServerPlugin,
  PluginEventType,
} from '@scribe/plugin-core';
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
// Event Handler Subscription Helper
// ============================================================================

/**
 * Subscribe a plugin's event handlers to the event bus.
 *
 * Iterates over the plugin's eventHandlers map and subscribes each handler
 * to the appropriate event type on the event bus.
 *
 * @param plugin - The server plugin with event handlers
 * @param eventBus - The event bus to subscribe to
 * @returns Unsubscribe function that removes all subscriptions
 */
function subscribeEventHandlers(plugin: ServerPlugin, eventBus: DefaultPluginEventBus): () => void {
  if (!plugin.eventHandlers) {
    return () => {};
  }

  const unsubscribers: Array<() => void> = [];

  for (const [eventType, handler] of Object.entries(plugin.eventHandlers)) {
    if (handler) {
      // The handler function needs to be wrapped to match the expected signature
      const wrappedHandler = handler as (event: unknown) => void | Promise<void>;
      eventBus.addHandler(eventType as PluginEventType, wrappedHandler);

      // Track unsubscribe function
      unsubscribers.push(() => {
        eventBus.removeHandler(eventType as PluginEventType, wrappedHandler);
      });
    }
  }

  // Return a function that unsubscribes all handlers
  return () => {
    for (const unsubscribe of unsubscribers) {
      unsubscribe();
    }
  };
}

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

      for (const registered of plugins) {
        const pluginId = registered.plugin.manifest.id;
        try {
          await lifecycle.activate(pluginId);

          // Subscribe event handlers for the plugin after activation
          const serverPlugin = registered.plugin as ServerPlugin;
          if (serverPlugin.eventHandlers) {
            subscribeEventHandlers(serverPlugin, eventBus);
            // eslint-disable-next-line no-console -- Intentional logging
            console.log(
              `[plugins] Subscribed event handlers for ${pluginId}: ${Object.keys(serverPlugin.eventHandlers).join(', ')}`
            );
          }

          activated++;
        } catch (error) {
          failed++;
          // eslint-disable-next-line no-console -- Intentional error logging
          console.error(
            `[plugins] Failed to activate ${pluginId}:`,
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
