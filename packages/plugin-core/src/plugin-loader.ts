/**
 * Plugin Loader - Build-time plugin discovery and instantiation
 *
 * The PluginLoader handles discovering, validating, and instantiating plugins at build time.
 * For v1, plugins are npm packages imported statically, not loaded dynamically at runtime.
 *
 * @module
 */

import { validateManifest, type PluginManifestFromSchema } from './plugin-manifest.schema.js';
import type { PluginRegistry } from './plugin-registry.js';
import type {
  PluginManifest,
  ServerPlugin,
  ClientPlugin,
  ServerPluginContext,
  ClientPluginContext,
} from './plugin-types.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when a plugin fails to load.
 *
 * Contains information about which plugin failed and optionally the underlying cause.
 *
 * @example
 * ```typescript
 * try {
 *   await loader.loadPlugin(myModule);
 * } catch (error) {
 *   if (error instanceof PluginLoadError) {
 *     console.error(`Failed to load ${error.pluginId}: ${error.message}`);
 *     if (error.cause) {
 *       console.error('Caused by:', error.cause);
 *     }
 *   }
 * }
 * ```
 */
export class PluginLoadError extends Error {
  /** The ID of the plugin that failed to load (if known) */
  public readonly pluginId?: string;

  /** The underlying error that caused the load failure */
  public override readonly cause?: Error;

  constructor(message: string, pluginId?: string, cause?: Error) {
    super(message);
    this.name = 'PluginLoadError';
    this.pluginId = pluginId;
    this.cause = cause;

    // Maintain proper stack trace in V8 environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PluginLoadError);
    }
  }
}

// ============================================================================
// Plugin Module Types
// ============================================================================

/**
 * The structure of a plugin module (npm package).
 *
 * A plugin module exports:
 * - A manifest describing the plugin's identity and capabilities
 * - Optional factory functions for server and client environments
 *
 * @example
 * ```typescript
 * // In @scribe/plugin-example/index.ts
 * export const manifest: PluginManifest = { ... };
 * export const createServerPlugin: ServerPluginFactory = (ctx) => { ... };
 * export const createClientPlugin: ClientPluginFactory = (ctx) => { ... };
 * ```
 */
export interface PluginModule {
  /** Plugin manifest (required) */
  manifest: PluginManifest;

  /** Server-side plugin factory (optional) */
  createServerPlugin?: (context: ServerPluginContext) => Promise<ServerPlugin> | ServerPlugin;

  /** Client-side plugin factory (optional) */
  createClientPlugin?: (context: ClientPluginContext) => Promise<ClientPlugin> | ClientPlugin;
}

// ============================================================================
// Load Result Types
// ============================================================================

/**
 * Individual plugin load failure details.
 */
export interface PluginLoadFailure {
  /** The ID of the plugin that failed to load */
  pluginId: string;

  /** The error that occurred during loading */
  error: Error;
}

/**
 * Result of loading multiple plugins.
 *
 * When loading plugins in batch, the loader continues even if individual plugins fail.
 * This allows the application to start with partial plugin support rather than failing entirely.
 *
 * @example
 * ```typescript
 * const result = await loader.loadPlugins([plugin1, plugin2, plugin3]);
 *
 * console.log(`Loaded: ${result.loaded.join(', ')}`);
 *
 * for (const failure of result.failed) {
 *   console.error(`Failed to load ${failure.pluginId}:`, failure.error);
 * }
 * ```
 */
export interface LoadResult {
  /** IDs of successfully loaded plugins */
  loaded: string[];

  /** Details of plugins that failed to load */
  failed: PluginLoadFailure[];
}

// ============================================================================
// Plugin Context Factory
// ============================================================================

/**
 * Factory for creating plugin contexts.
 *
 * The context factory is responsible for creating environment-specific contexts
 * for plugins. The implementation differs between server and client environments.
 *
 * @example
 * ```typescript
 * // Server-side context factory
 * const serverContextFactory: PluginContextFactory = {
 *   create(manifest) {
 *     return {
 *       manifest,
 *       storage: createNamespacedStorage(manifest.id),
 *       events: eventEmitter,
 *       logger: createScopedLogger(manifest.id),
 *     };
 *   },
 * };
 * ```
 */
export interface PluginContextFactory {
  /**
   * Create a context for a plugin.
   *
   * @param manifest - The validated plugin manifest
   * @returns A context appropriate for the current environment
   */
  create(manifest: PluginManifestFromSchema): ServerPluginContext | ClientPluginContext;
}

// ============================================================================
// Environment Detection
// ============================================================================

/**
 * Detect if we're running in a server (Node.js) or client (browser) environment.
 *
 * Uses a type-safe approach that works without DOM typings.
 *
 * @returns 'server' if running in Node.js, 'client' if running in a browser
 */
export function detectEnvironment(): 'server' | 'client' {
  return typeof globalThis !== 'undefined' &&
    'window' in globalThis &&
    (globalThis as { window?: unknown }).window !== undefined
    ? 'client'
    : 'server';
}

// ============================================================================
// PluginLoader Class
// ============================================================================

/**
 * Loads and initializes plugins at build time.
 *
 * The PluginLoader handles:
 * - Validating plugin manifests
 * - Detecting duplicate plugins
 * - Creating appropriate contexts per environment
 * - Instantiating plugin instances
 * - Registering plugins with the registry
 *
 * @example
 * ```typescript
 * import { PluginLoader, PluginRegistry } from '@scribe/plugin-core';
 * import * as examplePlugin from '@scribe/plugin-example';
 *
 * const registry = new PluginRegistry();
 * const loader = new PluginLoader(registry, contextFactory);
 *
 * await loader.loadPlugins([examplePlugin]);
 * ```
 */
export class PluginLoader {
  /**
   * Create a new PluginLoader.
   *
   * @param registry - The plugin registry to register loaded plugins with
   * @param contextFactory - Factory for creating plugin contexts
   */
  constructor(
    private readonly registry: PluginRegistry,
    private readonly contextFactory: PluginContextFactory
  ) {}

  /**
   * Load a single plugin module and register it.
   *
   * The loading process:
   * 1. Validate the manifest using Zod schema
   * 2. Check for duplicate plugin ID
   * 3. Create environment-specific context
   * 4. Instantiate the plugin using the appropriate factory
   * 5. Register the plugin with the registry
   *
   * @param module - The plugin module to load
   * @throws {PluginLoadError} If validation fails, plugin is duplicate, or instantiation fails
   *
   * @example
   * ```typescript
   * import * as examplePlugin from '@scribe/plugin-example';
   *
   * try {
   *   await loader.loadPlugin(examplePlugin);
   *   console.log('Example plugin loaded successfully');
   * } catch (error) {
   *   if (error instanceof PluginLoadError) {
   *     console.error(`Load failed: ${error.message}`);
   *   }
   * }
   * ```
   */
  async loadPlugin(module: PluginModule): Promise<void> {
    // 1. Validate manifest
    let manifest: PluginManifestFromSchema;
    try {
      manifest = validateManifest(module.manifest);
    } catch (error) {
      throw new PluginLoadError(
        `Invalid manifest: ${error instanceof Error ? error.message : String(error)}`,
        module.manifest?.id,
        error instanceof Error ? error : undefined
      );
    }

    // 2. Check for duplicate
    if (this.registry.hasPlugin(manifest.id)) {
      throw new PluginLoadError(`Plugin ${manifest.id} is already loaded`, manifest.id);
    }

    // 3. Create context for this plugin
    const context = this.contextFactory.create(manifest);

    // 4. Create plugin instance (environment-specific)
    const plugin = await this.createPlugin(module, manifest, context);

    // 5. Register with registry
    this.registry.register(plugin);

    // eslint-disable-next-line no-console -- Intentional logging for plugin load status
    console.log(`[plugin-loader] Loaded: ${manifest.id} v${manifest.version}`);
  }

  /**
   * Load multiple plugins in order.
   *
   * One plugin failing doesn't prevent others from loading. The loader continues
   * with remaining plugins and reports all failures at the end.
   *
   * @param modules - Array of plugin modules to load
   * @returns Result object with loaded plugin IDs and failure details
   *
   * @example
   * ```typescript
   * const result = await loader.loadPlugins([
   *   examplePlugin,
   *   calendarPlugin,
   *   notesPlugin,
   * ]);
   *
   * if (result.failed.length > 0) {
   *   console.warn('Some plugins failed to load:');
   *   for (const failure of result.failed) {
   *     console.error(`  - ${failure.pluginId}: ${failure.error.message}`);
   *   }
   * }
   * ```
   */
  async loadPlugins(modules: PluginModule[]): Promise<LoadResult> {
    const loaded: string[] = [];
    const failed: PluginLoadFailure[] = [];

    for (const module of modules) {
      const pluginId = module.manifest?.id ?? 'unknown';

      try {
        await this.loadPlugin(module);
        loaded.push(module.manifest.id);
      } catch (error) {
        // eslint-disable-next-line no-console -- Intentional error logging for debugging
        console.error(`[plugin-loader] Failed to load ${pluginId}:`, error);

        failed.push({
          pluginId,
          error: error instanceof Error ? error : new Error(String(error)),
        });
      }
    }

    return { loaded, failed };
  }

  /**
   * Create a plugin instance based on the current environment.
   *
   * Detects whether we're on server or client and calls the appropriate factory.
   *
   * @param module - The plugin module
   * @param manifest - The validated manifest
   * @param context - The plugin context
   * @returns The instantiated plugin
   * @throws {PluginLoadError} If the plugin doesn't have a factory for the current environment
   */
  private async createPlugin(
    module: PluginModule,
    manifest: PluginManifestFromSchema,
    context: ServerPluginContext | ClientPluginContext
  ): Promise<ServerPlugin | ClientPlugin> {
    const environment = detectEnvironment();

    if (environment === 'server') {
      if (!module.createServerPlugin) {
        throw new PluginLoadError(
          `Plugin ${manifest.id} has no server implementation`,
          manifest.id
        );
      }
      return module.createServerPlugin(context as ServerPluginContext);
    } else {
      if (!module.createClientPlugin) {
        throw new PluginLoadError(
          `Plugin ${manifest.id} has no client implementation`,
          manifest.id
        );
      }
      return module.createClientPlugin(context as ClientPluginContext);
    }
  }
}
