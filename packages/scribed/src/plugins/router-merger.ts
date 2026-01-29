/**
 * Plugin tRPC Router Merger
 *
 * Provides functionality to dynamically merge plugin tRPC routers into the
 * main appRouter at runtime. This enables plugins to expose API endpoints
 * that clients can call using the standard tRPC client.
 *
 * @module
 */

import type { AnyRouter } from '@trpc/server';
import type { PluginRegistry } from '@scribe/plugin-core';
import type { ServerPlugin } from '@scribe/plugin-core';
import type { PluginLifecycleManager } from '@scribe/plugin-core';

// ============================================================================
// Constants
// ============================================================================

/**
 * Reserved namespaces for core routers that plugins cannot use.
 */
export const RESERVED_NAMESPACES = Object.freeze([
  'notes',
  'search',
  'graph',
  'sync',
  'auth',
  'system',
  'health',
  'plugins',
] as const);

/**
 * Type for reserved namespace strings.
 */
export type ReservedNamespace = (typeof RESERVED_NAMESPACES)[number];

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when a namespace validation fails.
 */
export class NamespaceValidationError extends Error {
  /** The namespace that failed validation */
  public readonly namespace: string;

  /** The reason for the validation failure */
  public readonly reason: 'reserved' | 'invalid_format' | 'conflict';

  constructor(namespace: string, reason: 'reserved' | 'invalid_format' | 'conflict') {
    let message: string;
    switch (reason) {
      case 'reserved':
        message = `Namespace "${namespace}" is reserved for core routers`;
        break;
      case 'invalid_format':
        message = `Invalid namespace: "${namespace}" (must be camelCase, starting with lowercase letter)`;
        break;
      case 'conflict':
        message = `Namespace "${namespace}" conflicts with an existing router`;
        break;
    }

    super(message);
    this.name = 'NamespaceValidationError';
    this.namespace = namespace;
    this.reason = reason;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, NamespaceValidationError);
    }
  }
}

// ============================================================================
// Types
// ============================================================================

/**
 * Entry for a plugin router to be merged into the app router.
 */
export interface PluginRouterEntry {
  /** The plugin ID that provides this router */
  pluginId: string;

  /** The namespace under which the router will be mounted */
  namespace: string;

  /** The tRPC router instance */
  router: AnyRouter;
}

/**
 * Result of building the merged app router.
 */
export interface BuildRouterResult {
  /** The merged router */
  router: AnyRouter;

  /** Plugin routers that were successfully merged */
  merged: PluginRouterEntry[];

  /** Plugin routers that were skipped due to conflicts or errors */
  skipped: Array<{
    pluginId: string;
    namespace: string;
    reason: string;
  }>;
}

/**
 * Factory function type for creating a tRPC router.
 * This allows the merger to work with different tRPC instances.
 */
export type RouterFactory = (routers: Record<string, AnyRouter>) => AnyRouter;

// ============================================================================
// Namespace Validation
// ============================================================================

/**
 * Validate that a namespace is a valid JavaScript identifier in camelCase.
 *
 * @param namespace - The namespace to validate
 * @returns true if valid
 * @throws {NamespaceValidationError} If the namespace is invalid
 *
 * @example
 * ```typescript
 * validateNamespaceFormat('examples'); // true
 * validateNamespaceFormat('myPlugin'); // true
 * validateNamespaceFormat('MyPlugin'); // throws (starts with uppercase)
 * validateNamespaceFormat('my-plugin'); // throws (contains hyphen)
 * ```
 */
export function validateNamespaceFormat(namespace: string): boolean {
  // Must be a valid camelCase identifier:
  // - Start with lowercase letter
  // - Contain only letters and numbers
  const camelCasePattern = /^[a-z][a-zA-Z0-9]*$/;

  if (!camelCasePattern.test(namespace)) {
    throw new NamespaceValidationError(namespace, 'invalid_format');
  }

  return true;
}

/**
 * Check if a namespace is reserved for core routers.
 *
 * @param namespace - The namespace to check
 * @returns true if reserved, false otherwise
 *
 * @example
 * ```typescript
 * isReservedNamespace('notes'); // true
 * isReservedNamespace('examples'); // false
 * ```
 */
export function isReservedNamespace(namespace: string): boolean {
  return (RESERVED_NAMESPACES as readonly string[]).includes(namespace);
}

/**
 * Validate a namespace for use by a plugin router.
 *
 * Checks that the namespace:
 * 1. Has a valid camelCase format
 * 2. Is not reserved for core routers
 *
 * @param namespace - The namespace to validate
 * @returns true if valid
 * @throws {NamespaceValidationError} If validation fails
 *
 * @example
 * ```typescript
 * validateNamespace('examples'); // true
 * validateNamespace('notes'); // throws (reserved)
 * validateNamespace('invalid-name'); // throws (invalid format)
 * ```
 */
export function validateNamespace(namespace: string): boolean {
  // First check format
  validateNamespaceFormat(namespace);

  // Then check if reserved
  if (isReservedNamespace(namespace)) {
    throw new NamespaceValidationError(namespace, 'reserved');
  }

  return true;
}

// ============================================================================
// Router Collection
// ============================================================================

/**
 * Collect routers from all loaded plugins in the registry.
 *
 * Iterates through all registered plugins and extracts their routers
 * if they have a 'trpc-router' capability declared.
 *
 * @param registry - The plugin registry containing loaded plugins
 * @returns Array of plugin router entries
 *
 * @example
 * ```typescript
 * const registry = new PluginRegistry();
 * // ... register plugins ...
 * const pluginRouters = collectPluginRouters(registry);
 * ```
 */
export function collectPluginRouters(registry: PluginRegistry): PluginRouterEntry[] {
  const entries: PluginRouterEntry[] = [];

  // Get all registered tRPC router capabilities
  const trpcCapabilities = registry.getCapabilities('trpc-router');

  for (const capability of trpcCapabilities) {
    // Get the plugin from the registry
    const registered = registry.getPlugin(capability.pluginId);
    if (!registered) {
      // eslint-disable-next-line no-console -- Intentional warning
      console.warn(
        `[router-merger] Plugin ${capability.pluginId} not found in registry, skipping router`
      );
      continue;
    }

    // Check if the plugin has a router
    const plugin = registered.plugin as ServerPlugin;
    if (!plugin.router) {
      // eslint-disable-next-line no-console -- Intentional warning
      console.warn(
        `[router-merger] Plugin ${capability.pluginId} declares trpc-router capability but has no router`
      );
      continue;
    }

    entries.push({
      pluginId: capability.pluginId,
      namespace: capability.namespace,
      router: plugin.router,
    });
  }

  return entries;
}

// ============================================================================
// Router Wrapping (Error Handling)
// ============================================================================

/**
 * Wrap a plugin router with error handling middleware.
 *
 * This creates a wrapper that:
 * - Catches errors from plugin router procedures
 * - Logs errors with plugin context
 * - Reports errors to the lifecycle manager for potential auto-deactivation
 * - Re-throws errors to return them to the client
 *
 * Note: tRPC doesn't support wrapping existing routers with middleware,
 * so this function returns a logging wrapper that tracks errors through
 * the lifecycle manager. The actual error boundary is implemented at
 * the procedure level by plugins themselves.
 *
 * @param pluginId - The ID of the plugin
 * @param router - The router to wrap
 * @param lifecycle - Optional lifecycle manager for error tracking
 * @returns The router (potentially wrapped) with error tracking
 *
 * @example
 * ```typescript
 * const wrappedRouter = wrapPluginRouter(
 *   '@scribe/plugin-example',
 *   exampleRouter,
 *   lifecycleManager
 * );
 * ```
 */
export function wrapPluginRouter(
  pluginId: string,
  router: AnyRouter,
  lifecycle?: PluginLifecycleManager
): AnyRouter {
  // tRPC routers are immutable and don't support wrapping after creation.
  // The error handling needs to be done at the procedure level in the plugin.
  // We return the router as-is but provide a utility for plugins to use.
  //
  // For now, we log that the router is being registered and track errors
  // through the lifecycle manager when they occur via handlePluginRouterError.

  // eslint-disable-next-line no-console -- Intentional logging
  console.log(`[router-merger] Registered router for plugin: ${pluginId}`);

  // Store lifecycle reference for error handling if provided
  if (lifecycle) {
    routerLifecycleMap.set(pluginId, lifecycle);
  }

  return router;
}

/**
 * Internal map to track lifecycle managers for router error handling.
 */
const routerLifecycleMap = new Map<string, PluginLifecycleManager>();

/**
 * Handle a router error for a plugin.
 *
 * This should be called when a plugin router throws an error.
 * It logs the error and reports it to the lifecycle manager for
 * potential auto-deactivation.
 *
 * @param pluginId - The ID of the plugin that threw the error
 * @param error - The error that occurred
 *
 * @example
 * ```typescript
 * try {
 *   await pluginProcedure();
 * } catch (error) {
 *   await handlePluginRouterError('@scribe/plugin-example', error);
 *   throw error;
 * }
 * ```
 */
export async function handlePluginRouterError(pluginId: string, error: Error): Promise<void> {
  // eslint-disable-next-line no-console -- Intentional error logging
  console.error(`[router-merger] Plugin ${pluginId} router error:`, error);

  const lifecycle = routerLifecycleMap.get(pluginId);
  if (lifecycle) {
    await lifecycle.handlePluginError(pluginId, error);
  }
}

/**
 * Clear the router lifecycle map.
 * Useful for testing or reset scenarios.
 */
export function clearRouterLifecycleMap(): void {
  routerLifecycleMap.clear();
}

// ============================================================================
// Router Merging
// ============================================================================

/**
 * Build the combined app router by merging core and plugin routers.
 *
 * This function takes the core routers (notes, search, graph, etc.) and
 * plugin routers, validates namespaces, and creates a single merged router.
 *
 * @param coreRouters - Map of core router namespaces to routers
 * @param pluginRouters - Array of plugin router entries
 * @param routerFactory - Factory function to create the final router
 * @param lifecycle - Optional lifecycle manager for error tracking
 * @returns Result containing the merged router and information about what was merged/skipped
 *
 * @example
 * ```typescript
 * import { router } from './trpc';
 *
 * const result = buildAppRouter(
 *   {
 *     notes: notesRouter,
 *     search: searchRouter,
 *     graph: graphRouter,
 *   },
 *   pluginRouters,
 *   (routers) => router(routers),
 *   lifecycleManager
 * );
 *
 * console.log(`Merged ${result.merged.length} plugin routers`);
 * console.log(`Skipped ${result.skipped.length} plugin routers`);
 * ```
 */
export function buildAppRouter(
  coreRouters: Record<string, AnyRouter>,
  pluginRouters: PluginRouterEntry[],
  routerFactory: RouterFactory,
  lifecycle?: PluginLifecycleManager
): BuildRouterResult {
  const merged: PluginRouterEntry[] = [];
  const skipped: BuildRouterResult['skipped'] = [];

  // Start with core routers
  const allRouters: Record<string, AnyRouter> = { ...coreRouters };

  // Track namespaces that are already taken
  const usedNamespaces = new Set(Object.keys(coreRouters));

  // Process each plugin router
  for (const entry of pluginRouters) {
    // Validate namespace format
    try {
      validateNamespaceFormat(entry.namespace);
    } catch (error) {
      const reason =
        error instanceof NamespaceValidationError
          ? error.message
          : `Invalid namespace format: ${entry.namespace}`;
      // eslint-disable-next-line no-console -- Intentional warning
      console.warn(`[router-merger] Plugin ${entry.pluginId}: ${reason}. Skipping.`);
      skipped.push({
        pluginId: entry.pluginId,
        namespace: entry.namespace,
        reason,
      });
      continue;
    }

    // Check for namespace conflicts
    if (usedNamespaces.has(entry.namespace)) {
      const reason = `Namespace "${entry.namespace}" conflicts with existing router`;
      // eslint-disable-next-line no-console -- Intentional warning
      console.warn(`[router-merger] Plugin ${entry.pluginId}: ${reason}. Skipping.`);
      skipped.push({
        pluginId: entry.pluginId,
        namespace: entry.namespace,
        reason,
      });
      continue;
    }

    // Wrap the router with error handling
    const wrappedRouter = wrapPluginRouter(entry.pluginId, entry.router, lifecycle);

    // Add to the router map
    allRouters[entry.namespace] = wrappedRouter;
    usedNamespaces.add(entry.namespace);
    merged.push(entry);

    // eslint-disable-next-line no-console -- Intentional logging
    console.log(`[router-merger] Merged plugin router: ${entry.pluginId} -> ${entry.namespace}`);
  }

  // Build the final router
  const router = routerFactory(allRouters);

  return {
    router,
    merged,
    skipped,
  };
}

// ============================================================================
// Convenience Helpers
// ============================================================================

/**
 * Get a list of all available namespaces (core + plugin).
 *
 * @param coreRouters - Map of core router namespaces
 * @param pluginRouters - Array of plugin router entries
 * @returns Array of all namespace strings
 */
export function getAllNamespaces(
  coreRouters: Record<string, AnyRouter>,
  pluginRouters: PluginRouterEntry[]
): string[] {
  const namespaces = new Set(Object.keys(coreRouters));

  for (const entry of pluginRouters) {
    namespaces.add(entry.namespace);
  }

  return [...namespaces].sort();
}

/**
 * Check if a namespace is available for use by a plugin.
 *
 * @param namespace - The namespace to check
 * @param coreRouters - Map of core router namespaces
 * @param existingPluginNamespaces - Set of namespaces already taken by plugins
 * @returns true if the namespace is available
 */
export function isNamespaceAvailable(
  namespace: string,
  coreRouters: Record<string, AnyRouter>,
  existingPluginNamespaces: Set<string> = new Set()
): boolean {
  // Check format
  try {
    validateNamespaceFormat(namespace);
  } catch {
    return false;
  }

  // Check if reserved
  if (isReservedNamespace(namespace)) {
    return false;
  }

  // Check if used by core
  if (namespace in coreRouters) {
    return false;
  }

  // Check if used by another plugin
  if (existingPluginNamespaces.has(namespace)) {
    return false;
  }

  return true;
}
