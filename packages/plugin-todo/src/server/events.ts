/**
 * Todo Plugin Event Handlers
 *
 * Implements event handlers for the Todo plugin that respond to
 * Scribe lifecycle events such as note deletion.
 *
 * @module
 */

import type { PluginEventHandlers, NoteDeletedEvent, PluginLogger } from '@scribe/plugin-core';
import type { TodoStore } from './store.js';

/**
 * Create event handlers for the Todo plugin.
 *
 * The handlers subscribe to Scribe lifecycle events and perform
 * cleanup operations to maintain data integrity.
 *
 * @param store - The TodoStore instance for data operations
 * @param logger - The plugin logger for diagnostic output
 * @returns Event handlers object to register with the plugin system
 *
 * @example
 * ```typescript
 * const store = new TodoStore(pluginStorage);
 * const handlers = createEventHandlers(store, logger);
 *
 * // The handlers are registered via the ServerPlugin interface:
 * return {
 *   manifest,
 *   router,
 *   eventHandlers: handlers,
 * };
 * ```
 */
export function createEventHandlers(store: TodoStore, logger: PluginLogger): PluginEventHandlers {
  return {
    /**
     * Handle note deletion by cleaning up associated todos.
     *
     * When a note is deleted, all todos linked to that note
     * should also be removed to maintain referential integrity.
     */
    'note:deleted': async (event: NoteDeletedEvent) => {
      logger.debug('Note deleted event received', { noteId: event.noteId });

      try {
        const deletedCount = await store.deleteByNoteId(event.noteId);

        if (deletedCount > 0) {
          logger.info(`Cleaned up ${deletedCount} todo(s) for deleted note`, {
            noteId: event.noteId,
            deletedCount,
          });
        }
      } catch (error) {
        logger.error('Failed to clean up todos for deleted note', {
          noteId: event.noteId,
          error: error instanceof Error ? error.message : String(error),
        });
        // Re-throw to let the event bus handle the error
        // Other plugins' handlers will still run
        throw error;
      }
    },
  };
}
