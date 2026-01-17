/**
 * Tests for Plugin Event System Implementation
 *
 * These tests verify:
 * 1. Event subscription with on()
 * 2. One-time subscription with once()
 * 3. Event emission and handler execution
 * 4. Async handler support
 * 5. Error handling (errors logged, not thrown)
 * 6. Unsubscribe functionality
 * 7. removeAllListeners cleanup
 * 8. Scoped emitter isolation
 * 9. Testing utilities
 */

import { describe, it, expect, beforeEach, vi, type Mock } from 'vitest';
import {
  DefaultPluginEventBus,
  createMockEventBus,
  createNoopEventEmitter,
} from './plugin-events.js';
import type {
  PluginEvent,
  NoteCreatedEvent,
  NoteUpdatedEvent,
  NoteDeletedEvent,
} from './plugin-types.js';

// ============================================================================
// Test Event Fixtures
// ============================================================================

function createNoteCreatedEvent(noteId = 'test-123'): NoteCreatedEvent {
  return {
    type: 'note:created',
    noteId,
    title: 'Test Note',
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };
}

function createNoteUpdatedEvent(noteId = 'test-123'): NoteUpdatedEvent {
  return {
    type: 'note:updated',
    noteId,
    title: 'Updated Note',
    updatedAt: new Date('2025-01-01T12:00:00Z'),
    changes: { title: true, content: false },
  };
}

function createNoteDeletedEvent(noteId = 'test-123'): NoteDeletedEvent {
  return {
    type: 'note:deleted',
    noteId,
  };
}

// ============================================================================
// DefaultPluginEventBus Tests
// ============================================================================

describe('DefaultPluginEventBus', () => {
  let bus: DefaultPluginEventBus;
  let errorHandler: Mock;

  beforeEach(() => {
    errorHandler = vi.fn();
    bus = new DefaultPluginEventBus(errorHandler);
  });

  // ==========================================================================
  // Basic emit() Tests
  // ==========================================================================

  describe('emit', () => {
    it('does nothing when no handlers are registered', async () => {
      const event = createNoteCreatedEvent();
      await bus.emit(event);
      // Should complete without error
      expect(errorHandler).not.toHaveBeenCalled();
    });

    it('calls registered handler with the event', async () => {
      const handler = vi.fn();
      bus.addHandler('note:created', handler);

      const event = createNoteCreatedEvent();
      await bus.emit(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it('calls multiple handlers for the same event type', async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      bus.addHandler('note:created', handler1);
      bus.addHandler('note:created', handler2);
      bus.addHandler('note:created', handler3);

      const event = createNoteCreatedEvent();
      await bus.emit(event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
      expect(handler3).toHaveBeenCalledTimes(1);
    });

    it('only calls handlers for the matching event type', async () => {
      const createdHandler = vi.fn();
      const deletedHandler = vi.fn();

      bus.addHandler('note:created', createdHandler);
      bus.addHandler('note:deleted', deletedHandler);

      await bus.emit(createNoteCreatedEvent());

      expect(createdHandler).toHaveBeenCalledTimes(1);
      expect(deletedHandler).not.toHaveBeenCalled();
    });

    it('handles all event types correctly', async () => {
      const createdHandler = vi.fn();
      const updatedHandler = vi.fn();
      const deletedHandler = vi.fn();

      bus.addHandler('note:created', createdHandler);
      bus.addHandler('note:updated', updatedHandler);
      bus.addHandler('note:deleted', deletedHandler);

      await bus.emit(createNoteCreatedEvent());
      await bus.emit(createNoteUpdatedEvent());
      await bus.emit(createNoteDeletedEvent());

      expect(createdHandler).toHaveBeenCalledTimes(1);
      expect(updatedHandler).toHaveBeenCalledTimes(1);
      expect(deletedHandler).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Async Handler Tests
  // ==========================================================================

  describe('async handlers', () => {
    it('waits for async handlers to complete', async () => {
      let completed = false;
      const asyncHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        completed = true;
      };

      bus.addHandler('note:created', asyncHandler);
      await bus.emit(createNoteCreatedEvent());

      expect(completed).toBe(true);
    });

    it('runs multiple async handlers concurrently', async () => {
      const executionOrder: number[] = [];

      const handler1 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        executionOrder.push(1);
      };
      const handler2 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push(2);
      };
      const handler3 = async () => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        executionOrder.push(3);
      };

      bus.addHandler('note:created', handler1);
      bus.addHandler('note:created', handler2);
      bus.addHandler('note:created', handler3);

      await bus.emit(createNoteCreatedEvent());

      // All should complete, order depends on timing
      expect(executionOrder).toHaveLength(3);
      // Due to concurrent execution, handler2 (10ms) should finish first,
      // then handler3 (20ms), then handler1 (30ms)
      expect(executionOrder).toEqual([2, 3, 1]);
    });

    it('waits for all handlers even if some are sync', async () => {
      const results: string[] = [];

      const syncHandler = () => {
        results.push('sync');
      };
      const asyncHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        results.push('async');
      };

      bus.addHandler('note:created', syncHandler);
      bus.addHandler('note:created', asyncHandler);

      await bus.emit(createNoteCreatedEvent());

      expect(results).toHaveLength(2);
      expect(results).toContain('sync');
      expect(results).toContain('async');
    });
  });

  // ==========================================================================
  // Error Handling Tests
  // ==========================================================================

  describe('error handling', () => {
    it('logs handler errors without throwing', async () => {
      const error = new Error('Handler failed');
      const failingHandler = () => {
        throw error;
      };

      bus.addHandler('note:created', failingHandler);

      // Should not throw
      await bus.emit(createNoteCreatedEvent());

      expect(errorHandler).toHaveBeenCalledWith('note:created', error);
    });

    it('continues calling other handlers after one fails', async () => {
      const handler1 = vi.fn();
      const failingHandler = () => {
        throw new Error('Failed');
      };
      const handler2 = vi.fn();

      bus.addHandler('note:created', handler1);
      bus.addHandler('note:created', failingHandler);
      bus.addHandler('note:created', handler2);

      await bus.emit(createNoteCreatedEvent());

      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      expect(errorHandler).toHaveBeenCalledTimes(1);
    });

    it('logs async handler errors', async () => {
      const error = new Error('Async handler failed');
      const failingHandler = async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw error;
      };

      bus.addHandler('note:created', failingHandler);

      await bus.emit(createNoteCreatedEvent());

      expect(errorHandler).toHaveBeenCalledWith('note:created', error);
    });

    it('collects all errors from multiple failing handlers', async () => {
      const error1 = new Error('Error 1');
      const error2 = new Error('Error 2');

      bus.addHandler('note:created', () => {
        throw error1;
      });
      bus.addHandler('note:created', () => {
        throw error2;
      });

      await bus.emit(createNoteCreatedEvent());

      expect(errorHandler).toHaveBeenCalledTimes(2);
      expect(errorHandler).toHaveBeenCalledWith('note:created', error1);
      expect(errorHandler).toHaveBeenCalledWith('note:created', error2);
    });

    it('uses console.error by default for errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      const defaultBus = new DefaultPluginEventBus();

      const error = new Error('Test error');
      defaultBus.addHandler('note:created', () => {
        throw error;
      });

      await defaultBus.emit(createNoteCreatedEvent());

      expect(consoleSpy).toHaveBeenCalledWith(
        '[plugin-events] Handler error for note:created:',
        error
      );

      consoleSpy.mockRestore();
    });
  });

  // ==========================================================================
  // Handler Management Tests
  // ==========================================================================

  describe('addHandler / removeHandler', () => {
    it('addHandler registers a handler', () => {
      const handler = vi.fn();
      bus.addHandler('note:created', handler);

      expect(bus.getHandlerCount('note:created')).toBe(1);
    });

    it('addHandler allows multiple handlers for same event', () => {
      bus.addHandler('note:created', vi.fn());
      bus.addHandler('note:created', vi.fn());
      bus.addHandler('note:created', vi.fn());

      expect(bus.getHandlerCount('note:created')).toBe(3);
    });

    it('removeHandler unregisters a handler', () => {
      const handler = vi.fn();
      bus.addHandler('note:created', handler);
      bus.removeHandler('note:created', handler);

      expect(bus.getHandlerCount('note:created')).toBe(0);
    });

    it('removeHandler only removes the specified handler', () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      bus.addHandler('note:created', handler1);
      bus.addHandler('note:created', handler2);
      bus.removeHandler('note:created', handler1);

      expect(bus.getHandlerCount('note:created')).toBe(1);
    });

    it('removeHandler does nothing for non-existent handler', () => {
      const handler = vi.fn();
      bus.removeHandler('note:created', handler);

      expect(bus.getHandlerCount('note:created')).toBe(0);
    });
  });

  describe('getHandlerCount', () => {
    it('returns 0 for event types with no handlers', () => {
      expect(bus.getHandlerCount('note:created')).toBe(0);
      expect(bus.getHandlerCount('note:updated')).toBe(0);
      expect(bus.getHandlerCount('note:deleted')).toBe(0);
    });

    it('returns correct count after adding handlers', () => {
      bus.addHandler('note:created', vi.fn());
      bus.addHandler('note:created', vi.fn());
      bus.addHandler('note:deleted', vi.fn());

      expect(bus.getHandlerCount('note:created')).toBe(2);
      expect(bus.getHandlerCount('note:updated')).toBe(0);
      expect(bus.getHandlerCount('note:deleted')).toBe(1);
    });
  });

  describe('clear', () => {
    it('removes all handlers for all event types', () => {
      bus.addHandler('note:created', vi.fn());
      bus.addHandler('note:updated', vi.fn());
      bus.addHandler('note:deleted', vi.fn());

      bus.clear();

      expect(bus.getHandlerCount('note:created')).toBe(0);
      expect(bus.getHandlerCount('note:updated')).toBe(0);
      expect(bus.getHandlerCount('note:deleted')).toBe(0);
    });
  });
});

// ============================================================================
// ScopedPluginEventEmitter Tests (via createScopedEmitter)
// ============================================================================

describe('ScopedPluginEventEmitter', () => {
  let bus: DefaultPluginEventBus;

  beforeEach(() => {
    bus = new DefaultPluginEventBus(vi.fn());
  });

  // ==========================================================================
  // on() Tests
  // ==========================================================================

  describe('on', () => {
    it('subscribes to events', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const handler = vi.fn();

      emitter.on('note:created', handler);

      await bus.emit(createNoteCreatedEvent());
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('returns an unsubscribe function', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const handler = vi.fn();

      const unsubscribe = emitter.on('note:created', handler);
      unsubscribe();

      await bus.emit(createNoteCreatedEvent());
      expect(handler).not.toHaveBeenCalled();
    });

    it('allows multiple subscriptions to different event types', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const createdHandler = vi.fn();
      const deletedHandler = vi.fn();

      emitter.on('note:created', createdHandler);
      emitter.on('note:deleted', deletedHandler);

      await bus.emit(createNoteCreatedEvent());
      await bus.emit(createNoteDeletedEvent());

      expect(createdHandler).toHaveBeenCalledTimes(1);
      expect(deletedHandler).toHaveBeenCalledTimes(1);
    });

    it('provides correctly typed event in handler', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');

      // TypeScript should infer the correct event type
      emitter.on('note:created', (event) => {
        // This should compile without errors
        expect(event.type).toBe('note:created');
        expect(event.noteId).toBeDefined();
        expect(event.title).toBeDefined();
        expect(event.createdAt).toBeInstanceOf(Date);
      });

      emitter.on('note:updated', (event) => {
        expect(event.type).toBe('note:updated');
        expect(event.changes).toBeDefined();
        expect(event.updatedAt).toBeInstanceOf(Date);
      });

      emitter.on('note:deleted', (event) => {
        expect(event.type).toBe('note:deleted');
        expect(event.noteId).toBeDefined();
      });

      await bus.emit(createNoteCreatedEvent());
      await bus.emit(createNoteUpdatedEvent());
      await bus.emit(createNoteDeletedEvent());
    });
  });

  // ==========================================================================
  // once() Tests
  // ==========================================================================

  describe('once', () => {
    it('fires handler only once', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const handler = vi.fn();

      emitter.once('note:created', handler);

      await bus.emit(createNoteCreatedEvent());
      await bus.emit(createNoteCreatedEvent());
      await bus.emit(createNoteCreatedEvent());

      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('returns an unsubscribe function', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const handler = vi.fn();

      const unsubscribe = emitter.once('note:created', handler);
      unsubscribe();

      await bus.emit(createNoteCreatedEvent());
      expect(handler).not.toHaveBeenCalled();
    });

    it('unsubscribe works even before event fires', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const handler = vi.fn();

      const unsubscribe = emitter.once('note:created', handler);
      unsubscribe();

      await bus.emit(createNoteCreatedEvent());
      expect(handler).not.toHaveBeenCalled();
    });

    it('handler receives the event', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const event = createNoteCreatedEvent('special-note');
      let receivedEvent: NoteCreatedEvent | null = null;

      emitter.once('note:created', (e) => {
        receivedEvent = e;
      });

      await bus.emit(event);

      expect(receivedEvent).toEqual(event);
    });

    it('async once handlers work correctly', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      let completed = false;

      emitter.once('note:created', async () => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        completed = true;
      });

      await bus.emit(createNoteCreatedEvent());
      expect(completed).toBe(true);
    });
  });

  // ==========================================================================
  // removeAllListeners() Tests
  // ==========================================================================

  describe('removeAllListeners', () => {
    it('removes all handlers registered via on()', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      const handler3 = vi.fn();

      emitter.on('note:created', handler1);
      emitter.on('note:updated', handler2);
      emitter.on('note:deleted', handler3);

      emitter.removeAllListeners();

      await bus.emit(createNoteCreatedEvent());
      await bus.emit(createNoteUpdatedEvent());
      await bus.emit(createNoteDeletedEvent());

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
      expect(handler3).not.toHaveBeenCalled();
    });

    it('removes all handlers registered via once()', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const handler = vi.fn();

      emitter.once('note:created', handler);
      emitter.removeAllListeners();

      await bus.emit(createNoteCreatedEvent());

      expect(handler).not.toHaveBeenCalled();
    });

    it('does not affect handlers from other scoped emitters', async () => {
      const emitterA = bus.createScopedEmitter('plugin-a');
      const emitterB = bus.createScopedEmitter('plugin-b');

      const handlerA = vi.fn();
      const handlerB = vi.fn();

      emitterA.on('note:created', handlerA);
      emitterB.on('note:created', handlerB);

      emitterA.removeAllListeners();

      await bus.emit(createNoteCreatedEvent());

      expect(handlerA).not.toHaveBeenCalled();
      expect(handlerB).toHaveBeenCalledTimes(1);
    });

    it('can be called multiple times safely', () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      emitter.on('note:created', vi.fn());

      emitter.removeAllListeners();
      emitter.removeAllListeners();
      emitter.removeAllListeners();

      // Should not throw
      expect(bus.getHandlerCount('note:created')).toBe(0);
    });

    it('can subscribe again after removeAllListeners', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const handler1 = vi.fn();
      const handler2 = vi.fn();

      emitter.on('note:created', handler1);
      emitter.removeAllListeners();
      emitter.on('note:created', handler2);

      await bus.emit(createNoteCreatedEvent());

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // emit() via scoped emitter Tests
  // ==========================================================================

  describe('emit (via scoped emitter)', () => {
    it('emits events to the bus', async () => {
      const emitter = bus.createScopedEmitter('test-plugin');
      const handler = vi.fn();

      bus.addHandler('note:created', handler);

      await emitter.emit(createNoteCreatedEvent());

      expect(handler).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================================
  // Plugin Isolation Tests
  // ==========================================================================

  describe('plugin isolation', () => {
    it('multiple plugins can subscribe to the same event', async () => {
      const emitterA = bus.createScopedEmitter('plugin-a');
      const emitterB = bus.createScopedEmitter('plugin-b');
      const emitterC = bus.createScopedEmitter('plugin-c');

      const handlerA = vi.fn();
      const handlerB = vi.fn();
      const handlerC = vi.fn();

      emitterA.on('note:created', handlerA);
      emitterB.on('note:created', handlerB);
      emitterC.on('note:created', handlerC);

      await bus.emit(createNoteCreatedEvent());

      expect(handlerA).toHaveBeenCalledTimes(1);
      expect(handlerB).toHaveBeenCalledTimes(1);
      expect(handlerC).toHaveBeenCalledTimes(1);
    });

    it('unsubscribe from one plugin does not affect others', async () => {
      const emitterA = bus.createScopedEmitter('plugin-a');
      const emitterB = bus.createScopedEmitter('plugin-b');

      const handlerA = vi.fn();
      const handlerB = vi.fn();

      const unsubA = emitterA.on('note:created', handlerA);
      emitterB.on('note:created', handlerB);

      unsubA();

      await bus.emit(createNoteCreatedEvent());

      expect(handlerA).not.toHaveBeenCalled();
      expect(handlerB).toHaveBeenCalledTimes(1);
    });
  });
});

// ============================================================================
// Testing Utilities Tests
// ============================================================================

describe('createMockEventBus', () => {
  it('records emitted events', async () => {
    const mockBus = createMockEventBus();

    const event1 = createNoteCreatedEvent('note-1');
    const event2 = createNoteDeletedEvent('note-2');

    await mockBus.emit(event1);
    await mockBus.emit(event2);

    expect(mockBus.emittedEvents).toHaveLength(2);
    expect(mockBus.emittedEvents[0]).toEqual(event1);
    expect(mockBus.emittedEvents[1]).toEqual(event2);
  });

  it('records errors from handlers', async () => {
    const mockBus = createMockEventBus();
    const error = new Error('Test error');

    const emitter = mockBus.createScopedEmitter('test-plugin');
    emitter.on('note:created', () => {
      throw error;
    });

    await mockBus.emit(createNoteCreatedEvent());

    expect(mockBus.errors).toHaveLength(1);
    expect(mockBus.errors[0]).toEqual({
      eventType: 'note:created',
      error,
    });
  });

  it('reset() clears emitted events and errors', async () => {
    const mockBus = createMockEventBus();

    const emitter = mockBus.createScopedEmitter('test-plugin');
    emitter.on('note:created', () => {
      throw new Error('Test');
    });

    await mockBus.emit(createNoteCreatedEvent());

    expect(mockBus.emittedEvents).toHaveLength(1);
    expect(mockBus.errors).toHaveLength(1);

    mockBus.reset();

    expect(mockBus.emittedEvents).toHaveLength(0);
    expect(mockBus.errors).toHaveLength(0);
  });

  it('scoped emitters work correctly', async () => {
    const mockBus = createMockEventBus();
    const emitter = mockBus.createScopedEmitter('test-plugin');
    const handler = vi.fn();

    emitter.on('note:created', handler);
    await mockBus.emit(createNoteCreatedEvent());

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('getHandlerCount works correctly', () => {
    const mockBus = createMockEventBus();
    const emitter = mockBus.createScopedEmitter('test-plugin');

    emitter.on('note:created', vi.fn());
    emitter.on('note:created', vi.fn());

    expect(mockBus.getHandlerCount('note:created')).toBe(2);
    expect(mockBus.getHandlerCount('note:deleted')).toBe(0);
  });

  it('clear() removes all handlers', () => {
    const mockBus = createMockEventBus();
    const emitter = mockBus.createScopedEmitter('test-plugin');

    emitter.on('note:created', vi.fn());
    emitter.on('note:deleted', vi.fn());

    mockBus.clear();

    expect(mockBus.getHandlerCount('note:created')).toBe(0);
    expect(mockBus.getHandlerCount('note:deleted')).toBe(0);
  });
});

describe('createNoopEventEmitter', () => {
  it('on() returns an unsubscribe function', () => {
    const emitter = createNoopEventEmitter();
    const unsub = emitter.on('note:created', vi.fn());

    expect(typeof unsub).toBe('function');
    unsub(); // Should not throw
  });

  it('once() returns an unsubscribe function', () => {
    const emitter = createNoopEventEmitter();
    const unsub = emitter.once('note:created', vi.fn());

    expect(typeof unsub).toBe('function');
    unsub(); // Should not throw
  });

  it('emit() resolves without calling handlers', async () => {
    const emitter = createNoopEventEmitter();
    const handler = vi.fn();

    emitter.on('note:created', handler);
    await emitter.emit(createNoteCreatedEvent());

    // Handler won't be called because noop emitter doesn't actually register handlers
    expect(handler).not.toHaveBeenCalled();
  });

  it('removeAllListeners() does not throw', () => {
    const emitter = createNoopEventEmitter();
    emitter.removeAllListeners(); // Should not throw
  });
});

// ============================================================================
// Integration Tests
// ============================================================================

describe('integration', () => {
  it('complete plugin lifecycle: subscribe, receive events, cleanup', async () => {
    const bus = new DefaultPluginEventBus(vi.fn());

    // Simulate plugin activation
    const pluginEmitter = bus.createScopedEmitter('@scribe/plugin-todo');
    const receivedEvents: PluginEvent[] = [];

    pluginEmitter.on('note:created', (event) => {
      receivedEvents.push(event);
    });
    pluginEmitter.on('note:deleted', (event) => {
      receivedEvents.push(event);
    });

    // Simulate note lifecycle
    await bus.emit(createNoteCreatedEvent('note-1'));
    await bus.emit(createNoteUpdatedEvent('note-1')); // Not subscribed
    await bus.emit(createNoteDeletedEvent('note-1'));

    expect(receivedEvents).toHaveLength(2);
    expect(receivedEvents[0].type).toBe('note:created');
    expect(receivedEvents[1].type).toBe('note:deleted');

    // Simulate plugin deactivation
    pluginEmitter.removeAllListeners();

    // Events after deactivation should not be received
    await bus.emit(createNoteCreatedEvent('note-2'));

    expect(receivedEvents).toHaveLength(2);
  });

  it('multiple plugins working together', async () => {
    const bus = new DefaultPluginEventBus(vi.fn());

    const todoPlugin = bus.createScopedEmitter('@scribe/plugin-todo');
    const searchPlugin = bus.createScopedEmitter('@scribe/plugin-search');

    const todoEvents: PluginEvent[] = [];
    const searchEvents: PluginEvent[] = [];

    todoPlugin.on('note:deleted', (event) => {
      todoEvents.push(event);
    });

    searchPlugin.on('note:created', (event) => {
      searchEvents.push(event);
    });
    searchPlugin.on('note:updated', (event) => {
      searchEvents.push(event);
    });
    searchPlugin.on('note:deleted', (event) => {
      searchEvents.push(event);
    });

    // Create and modify a note
    await bus.emit(createNoteCreatedEvent('note-1'));
    await bus.emit(createNoteUpdatedEvent('note-1'));
    await bus.emit(createNoteDeletedEvent('note-1'));

    // Todo plugin only subscribed to deleted
    expect(todoEvents).toHaveLength(1);
    expect(todoEvents[0].type).toBe('note:deleted');

    // Search plugin subscribed to all events
    expect(searchEvents).toHaveLength(3);

    // Deactivate todo plugin
    todoPlugin.removeAllListeners();

    // Create another note
    await bus.emit(createNoteCreatedEvent('note-2'));
    await bus.emit(createNoteDeletedEvent('note-2'));

    // Todo should not receive new events
    expect(todoEvents).toHaveLength(1);

    // Search should continue to receive events
    expect(searchEvents).toHaveLength(5);
  });
});
