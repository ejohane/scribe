/**
 * Plugin Event System Implementation
 *
 * Provides a typed event system for server-side plugins to subscribe
 * to Scribe lifecycle events (note created, updated, deleted). This
 * enables reactive plugin behavior without polling.
 *
 * @module
 */

import type { PluginEvent, PluginEventEmitter, PluginEventType } from './plugin-types.js';

// ============================================================================
// Type Definitions
// ============================================================================

/**
 * Event handler function type with proper typing.
 */
export type PluginEventHandler<E extends PluginEvent = PluginEvent> = (
  event: E
) => void | Promise<void>;

/**
 * Internal subscription tracking for the scoped emitter.
 */
interface Subscription {
  type: PluginEventType;
  handler: PluginEventHandler;
}

// ============================================================================
// PluginEventBus Interface (for Scribe core)
// ============================================================================

/**
 * Internal event bus interface for Scribe core.
 *
 * This interface is used by the core application to emit events
 * and create scoped emitters for plugins.
 *
 * @example
 * ```typescript
 * const bus = new DefaultPluginEventBus();
 *
 * // Create scoped emitter for a plugin
 * const emitter = bus.createScopedEmitter('my-plugin');
 *
 * // Emit events from the core
 * await bus.emit({
 *   type: 'note:created',
 *   noteId: '123',
 *   title: 'My Note',
 *   createdAt: new Date(),
 * });
 * ```
 */
export interface PluginEventBus {
  /**
   * Emit an event to all subscribers.
   * Handlers are called asynchronously and errors are logged but not thrown.
   */
  emit<T extends PluginEvent>(event: T): Promise<void>;

  /**
   * Create a scoped emitter for a specific plugin.
   * This allows plugins to subscribe to events while enabling
   * cleanup when the plugin is deactivated.
   */
  createScopedEmitter(pluginId: string): PluginEventEmitter;

  /**
   * Get the count of handlers for a specific event type.
   * Useful for debugging and testing.
   */
  getHandlerCount(eventType: PluginEventType): number;

  /**
   * Remove all handlers for all event types.
   * Useful for cleanup during testing or shutdown.
   */
  clear(): void;
}

// ============================================================================
// DefaultPluginEventBus Implementation
// ============================================================================

/**
 * Default implementation of the plugin event bus.
 *
 * This class manages event subscriptions and dispatches events
 * to all registered handlers. It provides:
 * - Type-safe event emission
 * - Async handler support with Promise.allSettled
 * - Error isolation (one handler failure doesn't affect others)
 * - Scoped emitters for per-plugin cleanup
 *
 * @example
 * ```typescript
 * const bus = new DefaultPluginEventBus();
 *
 * // Subscribe to events
 * bus.addHandler('note:created', (event) => {
 *   console.log(`Note created: ${event.noteId}`);
 * });
 *
 * // Emit event
 * await bus.emit({
 *   type: 'note:created',
 *   noteId: '123',
 *   title: 'New Note',
 *   createdAt: new Date(),
 * });
 * ```
 */
export class DefaultPluginEventBus implements PluginEventBus {
  /**
   * Map of event types to their handlers.
   */
  private handlers: Map<PluginEventType, Set<PluginEventHandler>> = new Map();

  /**
   * Error handler for logging failures.
   * Can be overridden for testing or custom error handling.
   */
  private errorHandler: (eventType: PluginEventType, error: unknown) => void;

  /**
   * Create a new DefaultPluginEventBus.
   *
   * @param errorHandler - Optional custom error handler. Defaults to console.error.
   */
  constructor(errorHandler?: (eventType: PluginEventType, error: unknown) => void) {
    this.errorHandler =
      errorHandler ??
      ((eventType, error) => {
        // eslint-disable-next-line no-console -- Intentional error logging for plugin event handler failures
        console.error(`[plugin-events] Handler error for ${eventType}:`, error);
      });
  }

  /**
   * Emit an event to all subscribers.
   *
   * All handlers are called concurrently using Promise.allSettled.
   * Errors are logged but not thrown, ensuring one handler's failure
   * doesn't prevent other handlers from running.
   *
   * @param event - The event to emit
   */
  async emit<T extends PluginEvent>(event: T): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (!handlers || handlers.size === 0) {
      return;
    }

    const results = await Promise.allSettled(
      [...handlers].map((handler) => this.safeCall(handler, event))
    );

    // Log errors but don't throw
    for (const result of results) {
      if (result.status === 'rejected') {
        this.errorHandler(event.type, result.reason);
      }
    }
  }

  /**
   * Safely call a handler, catching any synchronous errors.
   */
  private async safeCall(handler: PluginEventHandler, event: PluginEvent): Promise<void> {
    await handler(event);
  }

  /**
   * Create a scoped emitter for a specific plugin.
   *
   * The scoped emitter tracks all subscriptions made by the plugin
   * and allows cleanup via removeAllListeners().
   *
   * @param pluginId - The unique identifier for the plugin
   * @returns A PluginEventEmitter scoped to the plugin
   */
  createScopedEmitter(pluginId: string): PluginEventEmitter {
    return new ScopedPluginEventEmitter(this, pluginId);
  }

  /**
   * Add a handler for an event type.
   * Called internally by ScopedPluginEventEmitter.
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function
   */
  addHandler(eventType: PluginEventType, handler: PluginEventHandler): void {
    let handlers = this.handlers.get(eventType);
    if (!handlers) {
      handlers = new Set();
      this.handlers.set(eventType, handlers);
    }
    handlers.add(handler);
  }

  /**
   * Remove a handler for an event type.
   * Called internally by ScopedPluginEventEmitter.
   *
   * @param eventType - The event type to unsubscribe from
   * @param handler - The handler function to remove
   */
  removeHandler(eventType: PluginEventType, handler: PluginEventHandler): void {
    const handlers = this.handlers.get(eventType);
    if (handlers) {
      handlers.delete(handler);
      if (handlers.size === 0) {
        this.handlers.delete(eventType);
      }
    }
  }

  /**
   * Get the count of handlers for a specific event type.
   *
   * @param eventType - The event type to check
   * @returns The number of registered handlers
   */
  getHandlerCount(eventType: PluginEventType): number {
    return this.handlers.get(eventType)?.size ?? 0;
  }

  /**
   * Remove all handlers for all event types.
   */
  clear(): void {
    this.handlers.clear();
  }
}

// ============================================================================
// ScopedPluginEventEmitter Implementation
// ============================================================================

/**
 * A plugin-scoped event emitter that implements PluginEventEmitter.
 *
 * This class wraps the main event bus and tracks subscriptions
 * made by a specific plugin. When the plugin is deactivated,
 * calling removeAllListeners() will clean up all subscriptions.
 *
 * @example
 * ```typescript
 * // Plugin uses the scoped emitter
 * ctx.events.on('note:created', (event) => {
 *   console.log(`Note ${event.noteId} created`);
 * });
 *
 * // Single subscription
 * const unsub = ctx.events.on('note:deleted', handleDelete);
 * unsub(); // Unsubscribe
 *
 * // On plugin deactivation
 * ctx.events.removeAllListeners();
 * ```
 */
class ScopedPluginEventEmitter implements PluginEventEmitter {
  /**
   * Set of active subscriptions for this plugin.
   */
  private subscriptions: Set<Subscription> = new Set();

  /**
   * Create a new ScopedPluginEventEmitter.
   *
   * @param bus - The underlying event bus
   * @param _pluginId - The plugin ID (used for logging/debugging)
   */
  constructor(
    private readonly bus: DefaultPluginEventBus,
    private readonly _pluginId: string
  ) {}

  /**
   * Subscribe to an event type.
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function to call when the event is emitted
   * @returns An unsubscribe function
   */
  on<T extends PluginEventType>(
    eventType: T,
    handler: (event: Extract<PluginEvent, { type: T }>) => void | Promise<void>
  ): () => void {
    const sub: Subscription = {
      type: eventType,
      handler: handler as PluginEventHandler,
    };
    this.subscriptions.add(sub);
    this.bus.addHandler(eventType, sub.handler);

    return () => {
      this.subscriptions.delete(sub);
      this.bus.removeHandler(eventType, sub.handler);
    };
  }

  /**
   * Subscribe to an event type, firing only once.
   *
   * The handler will be automatically unsubscribed after the first event.
   *
   * @param eventType - The event type to subscribe to
   * @param handler - The handler function to call once
   * @returns An unsubscribe function (can be called before the event fires)
   */
  once<T extends PluginEventType>(
    eventType: T,
    handler: (event: Extract<PluginEvent, { type: T }>) => void | Promise<void>
  ): () => void {
    let unsubscribe: (() => void) | undefined;

    const wrappedHandler = ((event: PluginEvent) => {
      // Unsubscribe before calling the handler to prevent race conditions
      unsubscribe?.();
      return handler(event as Extract<PluginEvent, { type: T }>);
    }) as (event: Extract<PluginEvent, { type: T }>) => void | Promise<void>;

    unsubscribe = this.on(eventType, wrappedHandler);
    return unsubscribe;
  }

  /**
   * Emit an event to all subscribers.
   *
   * Note: This is typically called by the core system, not by plugins.
   * Plugins use this method through the ServerPluginContext.
   *
   * @param event - The event to emit
   */
  async emit(event: PluginEvent): Promise<void> {
    await this.bus.emit(event);
  }

  /**
   * Unsubscribe all handlers registered by this plugin.
   *
   * This should be called during plugin deactivation to clean up
   * all event subscriptions.
   */
  removeAllListeners(): void {
    for (const sub of this.subscriptions) {
      this.bus.removeHandler(sub.type, sub.handler);
    }
    this.subscriptions.clear();
  }
}

// ============================================================================
// Testing Utilities
// ============================================================================

/**
 * Create a mock event bus for testing.
 *
 * The mock bus records all emitted events and provides
 * additional inspection methods for testing assertions.
 *
 * @example
 * ```typescript
 * const mockBus = createMockEventBus();
 *
 * // Use in tests
 * await mockBus.emit({
 *   type: 'note:created',
 *   noteId: '123',
 *   title: 'Test',
 *   createdAt: new Date(),
 * });
 *
 * // Assert
 * expect(mockBus.emittedEvents).toHaveLength(1);
 * expect(mockBus.emittedEvents[0].type).toBe('note:created');
 * ```
 *
 * @returns A mock event bus with additional testing properties
 */
export function createMockEventBus(): PluginEventBus & {
  /** All events that have been emitted */
  emittedEvents: PluginEvent[];
  /** All registered handlers by event type */
  handlersByType: Map<PluginEventType, PluginEventHandler[]>;
  /** All errors that occurred during event handling */
  errors: Array<{ eventType: PluginEventType; error: unknown }>;
  /** Reset the mock state (emitted events and errors) */
  reset: () => void;
} {
  const emittedEvents: PluginEvent[] = [];
  const errors: Array<{ eventType: PluginEventType; error: unknown }> = [];

  const errorHandler = (eventType: PluginEventType, error: unknown) => {
    errors.push({ eventType, error });
  };

  const bus = new DefaultPluginEventBus(errorHandler);

  return {
    async emit<T extends PluginEvent>(event: T): Promise<void> {
      emittedEvents.push(event);
      await bus.emit(event);
    },

    createScopedEmitter(pluginId: string): PluginEventEmitter {
      return bus.createScopedEmitter(pluginId);
    },

    getHandlerCount(eventType: PluginEventType): number {
      return bus.getHandlerCount(eventType);
    },

    clear(): void {
      bus.clear();
    },

    get emittedEvents() {
      return emittedEvents;
    },

    get handlersByType() {
      // Return a view of current handlers - this is internal access for testing
      const map = new Map<PluginEventType, PluginEventHandler[]>();
      const types: PluginEventType[] = ['note:created', 'note:updated', 'note:deleted'];
      for (const type of types) {
        const count = bus.getHandlerCount(type);
        if (count > 0) {
          // We can't actually get the handlers from outside, but we can report count
          map.set(type, Array(count).fill(() => {}) as PluginEventHandler[]);
        }
      }
      return map;
    },

    get errors() {
      return errors;
    },

    reset() {
      emittedEvents.length = 0;
      errors.length = 0;
    },
  };
}

/**
 * Create a no-op event emitter for testing plugins in isolation.
 *
 * This emitter does nothing when events are emitted, useful for
 * testing plugin code that doesn't rely on event behavior.
 *
 * @returns A no-op PluginEventEmitter
 */
export function createNoopEventEmitter(): PluginEventEmitter {
  return {
    on() {
      return () => {};
    },
    once() {
      return () => {};
    },
    async emit() {
      // No-op
    },
    removeAllListeners() {
      // No-op
    },
  };
}
