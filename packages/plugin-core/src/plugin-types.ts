/**
 * Core Plugin System TypeScript Interfaces and Types
 *
 * This module defines the foundational types that form the plugin system contract.
 * All plugin implementations must conform to these interfaces.
 *
 * @module
 */

import type { AnyRouter } from '@trpc/server';
import type { ComponentType } from 'react';

// ============================================================================
// Plugin Manifest Types
// ============================================================================

/**
 * The manifest that describes a plugin's identity and capabilities.
 *
 * Every plugin must provide a manifest that declares what it offers
 * and what it needs to function.
 *
 * @example
 * ```typescript
 * const manifest: PluginManifest = {
 *   id: '@scribe/plugin-todo',
 *   version: '1.0.0',
 *   name: 'Todo Plugin',
 *   description: 'Adds task management to your notes',
 *   author: 'Scribe Team',
 *   capabilities: [
 *     { type: 'trpc-router', namespace: 'todos' },
 *     { type: 'sidebar-panel', id: 'todo-panel', label: 'Tasks', icon: 'CheckSquare' },
 *   ],
 * };
 * ```
 */
export interface PluginManifest {
  /**
   * Unique plugin identifier.
   * Convention: use npm-style scoped packages, e.g., "@scribe/plugin-todo"
   */
  id: string;

  /**
   * SemVer version string, e.g., "1.0.0"
   */
  version: string;

  /**
   * Human-readable display name
   */
  name: string;

  /**
   * Optional description of what the plugin does
   */
  description?: string;

  /**
   * Optional author name or organization
   */
  author?: string;

  /**
   * List of capabilities this plugin provides.
   * Used for dependency resolution and feature registration.
   */
  capabilities: PluginCapability[];

  /**
   * Minimum Scribe version required (for future compatibility checks)
   */
  scribeVersion?: string;
}

// ============================================================================
// Plugin Capability Types (Discriminated Union)
// ============================================================================

/**
 * Union of all possible plugin capabilities.
 *
 * Each capability type has a `type` discriminator field that enables
 * TypeScript to narrow the type in switch statements and conditionals.
 *
 * @example
 * ```typescript
 * function handleCapability(cap: PluginCapability) {
 *   switch (cap.type) {
 *     case 'trpc-router':
 *       console.log(`Mounting router at ${cap.namespace}`);
 *       break;
 *     case 'sidebar-panel':
 *       console.log(`Registering panel ${cap.label}`);
 *       break;
 *     // TypeScript ensures all cases are handled
 *   }
 * }
 * ```
 */
export type PluginCapability =
  | TrpcRouterCapability
  | StorageCapability
  | EventHookCapability
  | SidebarPanelCapability
  | SlashCommandCapability
  | CommandPaletteCommandCapability;

/**
 * Capability for plugins that expose a tRPC router.
 * The router will be merged into the main app router under the given namespace.
 */
export interface TrpcRouterCapability {
  /**
   * Discriminator for TypeScript narrowing
   */
  type: 'trpc-router';

  /**
   * Router will be mounted at this namespace.
   * E.g., "todos" means procedures are available as `trpc.todos.*`
   */
  namespace: string;
}

/**
 * Capability for plugins that need persistent storage.
 * In v1, this is documentation-only; future versions may enforce isolation.
 */
export interface StorageCapability {
  /**
   * Discriminator for TypeScript narrowing
   */
  type: 'storage';

  /**
   * Optional list of storage keys/tables this plugin will use.
   * Useful for documentation and future isolation enforcement.
   */
  keys?: string[];
}

/**
 * Capability for plugins that subscribe to application events.
 */
export interface EventHookCapability {
  /**
   * Discriminator for TypeScript narrowing
   */
  type: 'event-hook';

  /**
   * List of event types this plugin subscribes to
   */
  events: PluginEventType[];
}

/**
 * Capability for plugins that provide a sidebar panel UI component.
 */
export interface SidebarPanelCapability {
  /**
   * Discriminator for TypeScript narrowing
   */
  type: 'sidebar-panel';

  /**
   * Unique identifier for this panel
   */
  id: string;

  /**
   * Display label shown in the sidebar
   */
  label: string;

  /**
   * Lucide icon name to display (e.g., "CheckSquare", "Calendar")
   */
  icon: string;

  /**
   * Sort priority (lower values appear higher in the list).
   * Default: 100
   */
  priority?: number;
}

/**
 * Capability for plugins that provide slash commands in the editor.
 */
export interface SlashCommandCapability {
  /**
   * Discriminator for TypeScript narrowing
   */
  type: 'slash-command';

  /**
   * Command trigger text (without the slash).
   * E.g., "task" for /task
   */
  command: string;

  /**
   * Display label in the command menu
   */
  label: string;

  /**
   * Optional description shown in the command menu
   */
  description?: string;

  /**
   * Optional Lucide icon name
   */
  icon?: string;
}

/**
 * Capability for plugins that provide commands in the command palette (cmd+k).
 *
 * Plugins declare commands; the palette owns the UX. This ensures visual consistency
 * across all commands, prevents plugin UI chaos, and keeps the API surface small.
 *
 * @example
 * ```typescript
 * const capability: CommandPaletteCommandCapability = {
 *   type: 'command-palette-command',
 *   id: 'todo.createTask',
 *   label: 'Create Task',
 *   description: 'Create a new task in the current note',
 *   icon: 'CheckSquare',
 *   category: 'Tasks',
 *   priority: 10,
 * };
 * ```
 */
export interface CommandPaletteCommandCapability {
  /**
   * Discriminator for TypeScript narrowing
   */
  type: 'command-palette-command';

  /**
   * Unique identifier for this command.
   * Convention: use dot notation like "pluginName.commandName" (e.g., "todo.createTask")
   */
  id: string;

  /**
   * Display label shown in the command palette
   */
  label: string;

  /**
   * Optional description shown below the label
   */
  description?: string;

  /**
   * Optional Lucide icon name to display (e.g., "CheckSquare", "Calendar")
   */
  icon?: string;

  /**
   * Display hint for keyboard shortcut (display only, not functional).
   * E.g., "⌘T" or "Ctrl+T"
   */
  shortcut?: string;

  /**
   * Category for grouping commands in the palette.
   * Default: "General"
   */
  category?: string;

  /**
   * Sort priority within the category (lower values appear higher).
   * Default: 100
   */
  priority?: number;
}

// ============================================================================
// Plugin Event Types
// ============================================================================

/**
 * All event types that plugins can subscribe to.
 */
export type PluginEventType = 'note:created' | 'note:updated' | 'note:deleted';

/**
 * Event emitted when a new note is created.
 */
export interface NoteCreatedEvent {
  type: 'note:created';
  noteId: string;
  title: string;
  createdAt: Date;
}

/**
 * Event emitted when a note is updated.
 */
export interface NoteUpdatedEvent {
  type: 'note:updated';
  noteId: string;
  title: string;
  updatedAt: Date;
  changes: {
    /** Whether the title was changed */
    title?: boolean;
    /** Whether the content was changed */
    content?: boolean;
  };
}

/**
 * Event emitted when a note is deleted.
 */
export interface NoteDeletedEvent {
  type: 'note:deleted';
  noteId: string;
}

/**
 * Union of all possible plugin events.
 *
 * @example
 * ```typescript
 * function handleEvent(event: PluginEvent) {
 *   switch (event.type) {
 *     case 'note:created':
 *       console.log(`Note ${event.noteId} created: ${event.title}`);
 *       break;
 *     case 'note:updated':
 *       if (event.changes.content) {
 *         console.log(`Note ${event.noteId} content changed`);
 *       }
 *       break;
 *     case 'note:deleted':
 *       console.log(`Note ${event.noteId} deleted`);
 *       break;
 *   }
 * }
 * ```
 */
export type PluginEvent = NoteCreatedEvent | NoteUpdatedEvent | NoteDeletedEvent;

/**
 * Map of event types to their corresponding handler functions.
 */
export interface PluginEventHandlers {
  'note:created'?: (event: NoteCreatedEvent) => void | Promise<void>;
  'note:updated'?: (event: NoteUpdatedEvent) => void | Promise<void>;
  'note:deleted'?: (event: NoteDeletedEvent) => void | Promise<void>;
}

// ============================================================================
// Plugin Context Types (Environment-specific APIs)
// ============================================================================

/**
 * Interface for plugin-scoped logging.
 * Logs are prefixed with the plugin ID for easy filtering.
 */
export interface PluginLogger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

/**
 * Interface for plugin-namespaced storage.
 * All keys are automatically prefixed with the plugin ID.
 */
export interface PluginStorage {
  /**
   * Get a value from storage by key.
   * Returns undefined if the key doesn't exist.
   */
  get<T>(key: string): Promise<T | undefined>;

  /**
   * Set a value in storage.
   */
  set<T>(key: string, value: T): Promise<void>;

  /**
   * Delete a value from storage.
   */
  delete(key: string): Promise<void>;

  /**
   * Check if a key exists in storage.
   */
  has(key: string): Promise<boolean>;

  /**
   * List all keys in this plugin's namespace.
   */
  keys(): Promise<string[]>;

  /**
   * Clear all data in this plugin's namespace.
   */
  clear(): Promise<void>;
}

/**
 * Interface for plugin event subscription.
 *
 * Plugins use this interface to subscribe to Scribe lifecycle events.
 * The emitter tracks subscriptions and allows cleanup on deactivation.
 */
export interface PluginEventEmitter {
  /**
   * Subscribe to an event type.
   * Returns an unsubscribe function.
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function to call when the event is emitted
   * @returns A function that unsubscribes the handler when called
   */
  on<T extends PluginEventType>(
    eventType: T,
    handler: (event: Extract<PluginEvent, { type: T }>) => void | Promise<void>
  ): () => void;

  /**
   * Subscribe to an event type, firing only once.
   * The handler will be automatically unsubscribed after the first event.
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function to call once
   * @returns A function that unsubscribes the handler when called (can be called before the event fires)
   */
  once<T extends PluginEventType>(
    eventType: T,
    handler: (event: Extract<PluginEvent, { type: T }>) => void | Promise<void>
  ): () => void;

  /**
   * Emit an event (typically called by the plugin system, not plugins).
   */
  emit(event: PluginEvent): Promise<void>;

  /**
   * Unsubscribe all handlers registered by this plugin.
   * Called during plugin deactivation to clean up subscriptions.
   */
  removeAllListeners(): void;
}

/**
 * Context provided to server-side plugin code.
 *
 * Server plugins have access to storage, events, and logging,
 * but not to React components or client-side APIs.
 *
 * @example
 * ```typescript
 * export function createServerPlugin(ctx: ServerPluginContext): ServerPlugin {
 *   ctx.logger.info('Plugin initializing');
 *
 *   ctx.events.on('note:created', async (event) => {
 *     await ctx.storage.set(`lastNote`, event.noteId);
 *   });
 *
 *   return {
 *     manifest: ctx.manifest,
 *     // ...
 *   };
 * }
 * ```
 */
export interface ServerPluginContext {
  /** This plugin's manifest */
  manifest: PluginManifest;

  /** Namespaced storage for this plugin */
  storage: PluginStorage;

  /** Event subscription interface */
  events: PluginEventEmitter;

  /** Scoped logger for this plugin */
  logger: PluginLogger;
}

/**
 * Minimal tRPC client interface for type-safe API calls.
 * The actual implementation comes from @trpc/client.
 */
export interface TRPCClientLike {
  /** Query methods */
  query: (path: string, input?: unknown) => Promise<unknown>;
  /** Mutation methods */
  mutate: (path: string, input?: unknown) => Promise<unknown>;
}

/**
 * Context provided to client-side plugin code.
 *
 * Client plugins have access to the tRPC client for API calls,
 * but not to server-side storage or events.
 *
 * @example
 * ```typescript
 * export function createClientPlugin(ctx: ClientPluginContext): ClientPlugin {
 *   return {
 *     manifest: ctx.manifest,
 *     sidebarPanels: {
 *       'todo-panel': TodoPanel,
 *     },
 *   };
 * }
 * ```
 */
export interface ClientPluginContext {
  /** This plugin's manifest */
  manifest: PluginManifest;

  /** tRPC client for making API calls */
  client: TRPCClientLike;
}

// ============================================================================
// Plugin Instance Types
// ============================================================================

/**
 * Handler function for a slash command.
 */
export interface SlashCommandHandler {
  /**
   * Execute the slash command.
   *
   * @param args - Arguments passed to the command
   * @returns Command result or void
   */
  execute(args: SlashCommandArgs): void | Promise<void>;
}

/**
 * Arguments passed to a slash command handler.
 */
export interface SlashCommandArgs {
  /** The text following the command, e.g., for "/task Buy milk", this is "Buy milk" */
  text: string;

  /** The note ID where the command was invoked */
  noteId: string;

  /** Insert content at the cursor position */
  insertContent: (content: unknown) => void;
}

/**
 * Context provided to command palette command handlers.
 *
 * This context gives commands access to navigation, notifications, and
 * the current note context without coupling to specific UI implementations.
 *
 * @example
 * ```typescript
 * const handler: CommandPaletteCommandHandler = {
 *   execute(ctx) {
 *     if (!ctx.noteId) {
 *       ctx.toast('Please open a note first', 'info');
 *       return;
 *     }
 *     // Do something with the note
 *     ctx.toast('Task created!', 'success');
 *     ctx.navigate('/tasks');
 *   },
 * };
 * ```
 */
export interface CommandContext {
  /**
   * The ID of the currently open note, or null if no note is open.
   */
  noteId: string | null;

  /**
   * Navigate to a different route in the application.
   *
   * @param path - The path to navigate to (e.g., '/notes/123', '/settings')
   */
  navigate: (path: string) => void;

  /**
   * Show a toast notification to the user.
   *
   * @param message - The message to display
   * @param type - The type of toast (default: 'info')
   */
  toast: (message: string, type?: 'success' | 'error' | 'info') => void;
}

/**
 * Handler for a command palette command.
 *
 * @example
 * ```typescript
 * const createTaskHandler: CommandPaletteCommandHandler = {
 *   execute(ctx) {
 *     if (ctx.noteId) {
 *       // Create task associated with current note
 *       ctx.toast('Task created!', 'success');
 *     }
 *   },
 * };
 * ```
 */
export interface CommandPaletteCommandHandler {
  /**
   * Execute the command.
   *
   * @param ctx - The command context providing navigation, toast, and note info
   * @returns void or Promise<void> for async commands
   */
  execute(ctx: CommandContext): void | Promise<void>;
}

/**
 * A fully initialized server-side plugin instance.
 *
 * This is what a plugin's factory function returns after initialization.
 * The plugin system uses this to integrate the plugin's features.
 *
 * @example
 * ```typescript
 * export function createTodoPlugin(ctx: ServerPluginContext): ServerPlugin {
 *   return {
 *     manifest: ctx.manifest,
 *     router: createTodoRouter(ctx),
 *     eventHandlers: {
 *       'note:deleted': async (event) => {
 *         // Clean up todos for deleted note
 *       },
 *     },
 *     async onActivate() {
 *       ctx.logger.info('Todo plugin activated');
 *     },
 *   };
 * }
 * ```
 */
export interface ServerPlugin {
  /** The plugin's manifest */
  manifest: PluginManifest;

  /**
   * tRPC router to merge into the app router.
   * Only required if the plugin has a 'trpc-router' capability.
   */
  router?: AnyRouter;

  /**
   * Event handlers for subscribed events.
   * Only required if the plugin has an 'event-hook' capability.
   */
  eventHandlers?: PluginEventHandlers;

  /**
   * Called when the plugin is activated.
   * Use for one-time setup like database migrations.
   */
  onActivate?: () => Promise<void>;

  /**
   * Called when the plugin is deactivated.
   * Use for cleanup like closing connections.
   */
  onDeactivate?: () => Promise<void>;
}

/**
 * A fully initialized client-side plugin instance.
 *
 * This is what a plugin's client factory function returns.
 * The plugin system uses this to render UI components.
 *
 * @example
 * ```typescript
 * export function createTodoClientPlugin(ctx: ClientPluginContext): ClientPlugin {
 *   return {
 *     manifest: ctx.manifest,
 *     sidebarPanels: {
 *       'todo-panel': TodoPanel,
 *     },
 *     slashCommands: {
 *       'task': {
 *         execute({ text, insertContent }) {
 *           insertContent({ type: 'todo', text, completed: false });
 *         },
 *       },
 *     },
 *   };
 * }
 * ```
 */
export interface ClientPlugin {
  /** The plugin's manifest */
  manifest: PluginManifest;

  /**
   * React components for sidebar panels.
   * Keys must match the 'id' field from SidebarPanelCapability.
   */
  sidebarPanels?: Record<string, ComponentType>;

  /**
   * Slash command handlers.
   * Keys must match the 'command' field from SlashCommandCapability.
   */
  slashCommands?: Record<string, SlashCommandHandler>;

  /**
   * Command palette command handlers.
   * Keys must match the 'id' field from CommandPaletteCommandCapability.
   */
  commandPaletteCommands?: Record<string, CommandPaletteCommandHandler>;
}

// ============================================================================
// Plugin Factory Types
// ============================================================================

/**
 * Factory function signature for creating a server plugin.
 *
 * @example
 * ```typescript
 * const createPlugin: ServerPluginFactory = (ctx) => ({
 *   manifest: ctx.manifest,
 *   router: myRouter,
 * });
 * ```
 */
export type ServerPluginFactory = (
  context: ServerPluginContext
) => ServerPlugin | Promise<ServerPlugin>;

/**
 * Factory function signature for creating a client plugin.
 *
 * @example
 * ```typescript
 * const createPlugin: ClientPluginFactory = (ctx) => ({
 *   manifest: ctx.manifest,
 *   sidebarPanels: { 'my-panel': MyPanel },
 * });
 * ```
 */
export type ClientPluginFactory = (
  context: ClientPluginContext
) => ClientPlugin | Promise<ClientPlugin>;

// ============================================================================
// Type Guard Utilities
// ============================================================================

/**
 * Type guard to check if a capability is a tRPC router capability.
 */
export function isTrpcRouterCapability(cap: PluginCapability): cap is TrpcRouterCapability {
  return cap.type === 'trpc-router';
}

/**
 * Type guard to check if a capability is a storage capability.
 */
export function isStorageCapability(cap: PluginCapability): cap is StorageCapability {
  return cap.type === 'storage';
}

/**
 * Type guard to check if a capability is an event hook capability.
 */
export function isEventHookCapability(cap: PluginCapability): cap is EventHookCapability {
  return cap.type === 'event-hook';
}

/**
 * Type guard to check if a capability is a sidebar panel capability.
 */
export function isSidebarPanelCapability(cap: PluginCapability): cap is SidebarPanelCapability {
  return cap.type === 'sidebar-panel';
}

/**
 * Type guard to check if a capability is a slash command capability.
 */
export function isSlashCommandCapability(cap: PluginCapability): cap is SlashCommandCapability {
  return cap.type === 'slash-command';
}

/**
 * Type guard to check if a capability is a command palette command capability.
 */
export function isCommandPaletteCommandCapability(
  cap: PluginCapability
): cap is CommandPaletteCommandCapability {
  return cap.type === 'command-palette-command';
}

/**
 * Check if a plugin manifest declares a specific capability type.
 *
 * @example
 * ```typescript
 * if (hasCapability(manifest, 'trpc-router')) {
 *   // Plugin has a router to merge
 * }
 * ```
 */
export function hasCapability(manifest: PluginManifest, type: PluginCapability['type']): boolean {
  return manifest.capabilities.some((cap) => cap.type === type);
}

/**
 * Get all capabilities of a specific type from a manifest.
 *
 * @example
 * ```typescript
 * const panels = getCapabilitiesByType(manifest, 'sidebar-panel');
 * for (const panel of panels) {
 *   console.log(panel.label); // TypeScript knows this is SidebarPanelCapability
 * }
 * ```
 */
export function getCapabilitiesByType<T extends PluginCapability['type']>(
  manifest: PluginManifest,
  type: T
): Extract<PluginCapability, { type: T }>[] {
  return manifest.capabilities.filter(
    (cap): cap is Extract<PluginCapability, { type: T }> => cap.type === type
  );
}
