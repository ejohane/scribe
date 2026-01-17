/**
 * Plugin Registry - Central tracking for plugins and capabilities
 *
 * The PluginRegistry is the central data structure that tracks all loaded plugins
 * and their capabilities. It provides lookup APIs for finding plugins and capabilities
 * by various criteria.
 *
 * @module
 */

import type { ComponentType } from 'react';
import type {
  PluginCapability,
  PluginEventType,
  ServerPlugin,
  ClientPlugin,
  SlashCommandHandler,
} from './plugin-types.js';

// ============================================================================
// Error Classes
// ============================================================================

/**
 * Error thrown when attempting to register a plugin that conflicts with
 * an existing registration.
 */
export class PluginConflictError extends Error {
  /** The ID of the plugin that caused the conflict */
  public readonly pluginId: string;

  constructor(message: string, pluginId: string) {
    super(message);
    this.name = 'PluginConflictError';
    this.pluginId = pluginId;

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, PluginConflictError);
    }
  }
}

// ============================================================================
// Registry Types
// ============================================================================

/**
 * Status of a registered plugin.
 */
export type PluginStatus = 'registered' | 'active' | 'inactive' | 'error';

/**
 * A registered plugin wrapper with status tracking.
 */
export interface RegisteredPlugin {
  /** The plugin instance (either server or client) */
  plugin: ServerPlugin | ClientPlugin;
  /** Current status of the plugin */
  status: PluginStatus;
  /** Error message if status is 'error' */
  error?: string;
}

// ============================================================================
// Capability Entry Types
// ============================================================================

/**
 * Entry for a tRPC router capability.
 */
export interface TrpcRouterEntry {
  pluginId: string;
  namespace: string;
}

/**
 * Entry for a storage capability.
 */
export interface StorageEntry {
  pluginId: string;
  keys?: string[];
}

/**
 * Entry for an event hook capability.
 */
export interface EventHookEntry {
  pluginId: string;
  events: PluginEventType[];
}

/**
 * Entry for a sidebar panel capability.
 */
export interface SidebarPanelEntry {
  pluginId: string;
  id: string;
  label: string;
  icon: string;
  priority: number;
  /** React component - only present on client side */
  component?: ComponentType;
}

/**
 * Entry for a slash command capability.
 */
export interface SlashCommandEntry {
  pluginId: string;
  command: string;
  label: string;
  description?: string;
  icon?: string;
  /** Command handler - only present on client side */
  handler?: SlashCommandHandler;
}

/**
 * Union type for all capability entries.
 */
export type CapabilityEntry =
  | TrpcRouterEntry
  | StorageEntry
  | EventHookEntry
  | SidebarPanelEntry
  | SlashCommandEntry;

/**
 * Map from capability type to its entry type.
 */
export interface CapabilityTypeMap {
  'trpc-router': TrpcRouterEntry;
  storage: StorageEntry;
  'event-hook': EventHookEntry;
  'sidebar-panel': SidebarPanelEntry;
  'slash-command': SlashCommandEntry;
}

/**
 * Index structure for capabilities by type.
 */
export interface CapabilityIndex {
  'trpc-router': Map<string, TrpcRouterEntry>;
  storage: Map<string, StorageEntry>;
  'event-hook': Map<string, EventHookEntry>;
  'sidebar-panel': Map<string, SidebarPanelEntry>;
  'slash-command': Map<string, SlashCommandEntry>;
}

// ============================================================================
// PluginRegistry Class
// ============================================================================

/**
 * Central registry for tracking plugins and their capabilities.
 *
 * The registry provides:
 * - Plugin registration and unregistration
 * - Capability indexing for O(1) lookup by type
 * - Conflict detection for duplicate registrations
 *
 * @example
 * ```typescript
 * const registry = new PluginRegistry();
 *
 * // Register a plugin
 * registry.register(myPlugin);
 *
 * // Find all sidebar panels
 * const panels = registry.getCapabilities('sidebar-panel');
 *
 * // Get a specific plugin
 * const plugin = registry.getPlugin('@scribe/plugin-todo');
 * ```
 */
export class PluginRegistry {
  /** Map of plugin ID to registered plugin */
  private plugins: Map<string, RegisteredPlugin> = new Map();

  /** Index of capabilities by type for O(1) lookup */
  private capabilityIndex: CapabilityIndex = {
    'trpc-router': new Map(),
    storage: new Map(),
    'event-hook': new Map(),
    'sidebar-panel': new Map(),
    'slash-command': new Map(),
  };

  /**
   * Register a plugin and index its capabilities.
   *
   * @param plugin - The plugin to register
   * @throws {PluginConflictError} If the plugin ID is already registered
   *
   * @remarks
   * Capability conflicts are handled gracefully:
   * - A warning is logged to the console
   * - The first registration wins (first-come-first-served)
   * - The conflicting capability is skipped
   *
   * @example
   * ```typescript
   * registry.register({
   *   manifest: { id: '@scribe/plugin-todo', ... },
   *   router: todoRouter,
   * });
   * ```
   */
  register(plugin: ServerPlugin | ClientPlugin): void {
    const pluginId = plugin.manifest.id;

    // Check for plugin ID conflict - this is a hard error
    if (this.plugins.has(pluginId)) {
      throw new PluginConflictError(`Plugin ${pluginId} is already registered`, pluginId);
    }

    // Register each capability, warning on conflicts
    for (const capability of plugin.manifest.capabilities) {
      const conflictId = this.getCapabilityConflictId(capability);

      if (this.hasCapabilityConflict(capability.type, conflictId)) {
        // eslint-disable-next-line no-console -- Intentional warning for plugin developers
        console.warn(
          `[plugin-registry] Capability conflict: ${capability.type}:${conflictId} ` +
            `from ${pluginId} conflicts with existing registration. Skipping.`
        );
        continue;
      }

      this.indexCapability(pluginId, capability, plugin);
    }

    // Add the plugin to the registry
    this.plugins.set(pluginId, {
      plugin,
      status: 'registered',
    });
  }

  /**
   * Unregister a plugin and remove its capabilities from the index.
   *
   * @param pluginId - The ID of the plugin to unregister
   * @returns true if the plugin was found and unregistered, false otherwise
   *
   * @example
   * ```typescript
   * const wasRemoved = registry.unregister('@scribe/plugin-todo');
   * ```
   */
  unregister(pluginId: string): boolean {
    const registered = this.plugins.get(pluginId);
    if (!registered) {
      return false;
    }

    // Remove all capabilities for this plugin
    for (const capability of registered.plugin.manifest.capabilities) {
      this.removeCapabilityFromIndex(capability);
    }

    // Remove the plugin from the registry
    this.plugins.delete(pluginId);
    return true;
  }

  /**
   * Get a plugin by ID.
   *
   * @param pluginId - The ID of the plugin to retrieve
   * @returns The registered plugin or undefined if not found
   *
   * @example
   * ```typescript
   * const plugin = registry.getPlugin('@scribe/plugin-todo');
   * if (plugin) {
   *   console.log(`Status: ${plugin.status}`);
   * }
   * ```
   */
  getPlugin(pluginId: string): RegisteredPlugin | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Get all registered plugins.
   *
   * @returns Array of all registered plugins (frozen for immutability)
   *
   * @example
   * ```typescript
   * const plugins = registry.getAllPlugins();
   * for (const { plugin, status } of plugins) {
   *   console.log(`${plugin.manifest.name}: ${status}`);
   * }
   * ```
   */
  getAllPlugins(): readonly RegisteredPlugin[] {
    return Object.freeze([...this.plugins.values()]);
  }

  /**
   * Get all capabilities of a specific type.
   *
   * @param type - The capability type to retrieve
   * @returns Array of capability entries (frozen for immutability)
   *
   * @example
   * ```typescript
   * const panels = registry.getCapabilities('sidebar-panel');
   * for (const panel of panels) {
   *   console.log(`Panel: ${panel.label} (priority: ${panel.priority})`);
   * }
   * ```
   */
  getCapabilities<T extends keyof CapabilityTypeMap>(type: T): readonly CapabilityTypeMap[T][] {
    const index = this.capabilityIndex[type];
    return Object.freeze([...index.values()]) as readonly CapabilityTypeMap[T][];
  }

  /**
   * Check if a capability ID would conflict with existing registrations.
   *
   * @param type - The capability type
   * @param id - The identifier to check for conflicts
   * @returns true if a conflict exists, false otherwise
   *
   * @example
   * ```typescript
   * if (registry.hasCapabilityConflict('trpc-router', 'todos')) {
   *   console.warn('Router namespace "todos" is already taken');
   * }
   * ```
   */
  hasCapabilityConflict(type: PluginCapability['type'], id: string): boolean {
    return this.capabilityIndex[type].has(id);
  }

  /**
   * Get the conflict identifier for a capability.
   * Different capability types use different fields as their unique identifier.
   *
   * @param capability - The capability to get the conflict ID for
   * @returns The unique identifier used for conflict detection
   */
  private getCapabilityConflictId(capability: PluginCapability): string {
    switch (capability.type) {
      case 'trpc-router':
        return capability.namespace;
      case 'storage':
        // Storage capabilities are keyed by plugin ID (set during indexing)
        // For conflict detection, we use a placeholder that will be replaced
        return `storage-${capability.keys?.join('-') ?? 'default'}`;
      case 'event-hook':
        // Event hooks don't conflict - multiple plugins can hook the same events
        // We use a unique ID based on events to track them
        return `event-hook-${capability.events.join('-')}`;
      case 'sidebar-panel':
        return capability.id;
      case 'slash-command':
        return capability.command;
    }
  }

  /**
   * Index a capability for fast lookup.
   *
   * @param pluginId - The ID of the plugin providing this capability
   * @param capability - The capability to index
   * @param plugin - The full plugin instance for extracting runtime values
   */
  private indexCapability(
    pluginId: string,
    capability: PluginCapability,
    plugin: ServerPlugin | ClientPlugin
  ): void {
    switch (capability.type) {
      case 'trpc-router':
        this.capabilityIndex['trpc-router'].set(capability.namespace, {
          pluginId,
          namespace: capability.namespace,
        });
        break;

      case 'storage':
        this.capabilityIndex['storage'].set(this.getCapabilityConflictId(capability), {
          pluginId,
          keys: capability.keys,
        });
        break;

      case 'event-hook':
        this.capabilityIndex['event-hook'].set(this.getCapabilityConflictId(capability), {
          pluginId,
          events: capability.events,
        });
        break;

      case 'sidebar-panel': {
        const panelEntry: SidebarPanelEntry = {
          pluginId,
          id: capability.id,
          label: capability.label,
          icon: capability.icon,
          priority: capability.priority ?? 100,
        };

        // If it's a client plugin, extract the component
        if ('sidebarPanels' in plugin && plugin.sidebarPanels) {
          panelEntry.component = plugin.sidebarPanels[capability.id];
        }

        this.capabilityIndex['sidebar-panel'].set(capability.id, panelEntry);
        break;
      }

      case 'slash-command': {
        const commandEntry: SlashCommandEntry = {
          pluginId,
          command: capability.command,
          label: capability.label,
          description: capability.description,
          icon: capability.icon,
        };

        // If it's a client plugin, extract the handler
        if ('slashCommands' in plugin && plugin.slashCommands) {
          commandEntry.handler = plugin.slashCommands[capability.command];
        }

        this.capabilityIndex['slash-command'].set(capability.command, commandEntry);
        break;
      }
    }
  }

  /**
   * Remove a capability from the index.
   *
   * @param capability - The capability to remove
   */
  private removeCapabilityFromIndex(capability: PluginCapability): void {
    const conflictId = this.getCapabilityConflictId(capability);
    this.capabilityIndex[capability.type].delete(conflictId);
  }

  /**
   * Update the status of a registered plugin.
   *
   * @param pluginId - The ID of the plugin to update
   * @param status - The new status
   * @param error - Optional error message (for 'error' status)
   * @returns true if the plugin was found and updated, false otherwise
   */
  updatePluginStatus(pluginId: string, status: PluginStatus, error?: string): boolean {
    const registered = this.plugins.get(pluginId);
    if (!registered) {
      return false;
    }

    registered.status = status;
    registered.error = error;
    return true;
  }

  /**
   * Get the number of registered plugins.
   *
   * @returns The count of registered plugins
   */
  get pluginCount(): number {
    return this.plugins.size;
  }

  /**
   * Check if a plugin is registered.
   *
   * @param pluginId - The ID of the plugin to check
   * @returns true if the plugin is registered, false otherwise
   */
  hasPlugin(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Clear all registered plugins and capabilities.
   * Useful for testing or reset scenarios.
   */
  clear(): void {
    this.plugins.clear();
    this.capabilityIndex = {
      'trpc-router': new Map(),
      storage: new Map(),
      'event-hook': new Map(),
      'sidebar-panel': new Map(),
      'slash-command': new Map(),
    };
  }
}
