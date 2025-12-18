/**
 * Daily Note IPC Handlers
 *
 * This module provides IPC handlers for daily note operations:
 * - Get or create today's daily note
 * - Find daily note for a specific date
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `daily:getOrCreate` | `{ date?: string }` | `Note` | Get or create daily note |
 * | `daily:find` | `{ date: string }` | `Note \| null` | Find daily note by date |
 *
 * ## Daily Note Format
 *
 * Daily notes have:
 * - `type: 'daily'` in metadata
 * - Title in "MM-dd-yyyy" format
 * - Tags: ['daily']
 * - Initial content: bullet list with empty item
 *
 * ## Date Handling
 *
 * - Dates are in "MM-dd-yyyy" format (US format)
 * - `createdAt` is set to noon on the target date to avoid timezone edge cases
 * - If no date is provided, today's date is used
 *
 * @module handlers/dailyHandlers
 */

import { ipcMain } from 'electron';
import { format } from 'date-fns';
import type { EditorContent } from '@scribe/shared';
import {
  HandlerDependencies,
  requireVault,
  requireGraphEngine,
  requireSearchEngine,
} from './types';

/**
 * Create initial content for daily notes.
 *
 * @returns EditorContent with a bullet list containing one empty item
 *
 * @remarks
 * Matches the structure in renderer/src/templates/daily.ts
 * Daily notes start with a bullet list for quick capture.
 */
function createDailyContent(): EditorContent {
  return {
    root: {
      children: [
        {
          type: 'list',
          listType: 'bullet',
          children: [
            {
              type: 'listitem',
              children: [],
              direction: null,
              format: '',
              indent: 0,
              version: 1,
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'daily',
  } as EditorContent;
}

/**
 * Setup IPC handlers for daily note operations.
 *
 * @param deps - Handler dependencies (requires vault, graphEngine, searchEngine)
 *
 * @example
 * ```typescript
 * // From renderer - get today's note
 * const today = await window.api.invoke('daily:getOrCreate');
 *
 * // Get note for specific date
 * const note = await window.api.invoke('daily:getOrCreate', { date: '2024-01-15' });
 * ```
 */
export function setupDailyHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `daily:getOrCreate`
   *
   * Gets or creates a daily note for a specific date.
   * Idempotent: returns existing note if one exists for the date.
   *
   * @param options - Optional object with date
   * @param options.date - ISO date string (e.g., '2024-01-15'). Defaults to today.
   * @returns `Note` - The daily note for the specified date
   *
   * @sideeffects
   * - Creates new note if none exists for the date
   * - Adds to graph engine and search index when creating
   *
   * @remarks
   * - Title is formatted as "MM-dd-yyyy" (e.g., "01-15-2024")
   * - `createdAt` is set to noon on the target date to avoid timezone issues
   */
  ipcMain.handle('daily:getOrCreate', async (_, options?: { date?: string }) => {
    const vault = requireVault(deps);
    const graphEngine = requireGraphEngine(deps);
    const searchEngine = requireSearchEngine(deps);

    // Use provided date or default to today
    const targetDate = options?.date ? new Date(options.date) : new Date();
    const dateStr = format(targetDate, 'MM-dd-yyyy');

    // Find existing daily note by matching type and title (MM-dd-yyyy date)
    const notes = vault.list();
    const existing = notes.find((n) => n.type === 'daily' && n.title === dateStr);
    if (existing) {
      return existing;
    }

    // Create new daily note
    // Set createdAt to noon on the target date (avoids timezone edge cases)
    const content = createDailyContent();
    const createdAt = new Date(targetDate);
    createdAt.setHours(12, 0, 0, 0);
    const note = await vault.create({
      type: 'daily',
      title: dateStr,
      tags: ['daily'],
      content,
      daily: { date: dateStr },
      createdAt: createdAt.getTime(),
    });

    // Index in engines
    graphEngine.addNote(note);
    searchEngine.indexNote(note);

    return note;
  });

  /**
   * IPC: `daily:find`
   *
   * Finds a daily note for a specific date without creating one.
   *
   * @param date - Date string in "MM-dd-yyyy" format (e.g., "01-15-2024")
   * @returns `Note | null` - The daily note, or null if none exists
   *
   * @remarks
   * Unlike `daily:getOrCreate`, this does not create a note if one doesn't exist.
   */
  ipcMain.handle('daily:find', async (_, { date }: { date: string }) => {
    const vault = requireVault(deps);

    const notes = vault.list();
    return notes.find((n) => n.type === 'daily' && n.title === date) ?? null;
  });
}

// Export for use in meetingHandlers
export { createDailyContent };
