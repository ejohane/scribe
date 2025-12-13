/**
 * Notes CRUD IPC Handlers
 *
 * This module provides IPC handlers for note operations:
 * - Create, read, update, delete notes
 * - Find notes by title (wiki-link resolution)
 * - Search note titles (autocomplete)
 * - Find notes by date (daily note mentions)
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `notes:list` | none | `Note[]` | List all notes in vault |
 * | `notes:read` | `id: NoteId` | `Note` | Read a single note by ID |
 * | `notes:create` | none | `Note` | Create a new empty note |
 * | `notes:save` | `note: Note` | `{ success: true }` | Save/update a note |
 * | `notes:delete` | `id: NoteId` | `{ success: true }` | Delete a note |
 * | `notes:findByTitle` | `title: string` | `Note \| null` | Find note by exact/fuzzy title |
 * | `notes:findByDate` | `{ date, includeCreated, includeUpdated }` | `Array<{ note, reason }>` | Find notes by date |
 * | `notes:searchTitles` | `query: string, limit?: number` | `SearchResult[]` | Search titles for autocomplete |
 *
 * ## Error Handling
 *
 * All operations may throw if vault is not initialized.
 * Read/save/delete operations wrap {@link ScribeError} with user-friendly messages.
 *
 * ## Side Effects
 *
 * - `notes:save` updates graph engine, search index, and task index
 * - `notes:delete` removes from graph engine, search index, and task index
 * - Task changes trigger `tasks:changed` event to renderer
 *
 * @module handlers/notesHandlers
 */

import { ipcMain } from 'electron';
import type { Note, NoteId } from '@scribe/shared';
import { ScribeError } from '@scribe/shared';
import { HandlerDependencies, requireVault, withEngines } from './types';

/**
 * Wrap ScribeError for IPC transport with user-friendly message.
 *
 * @param error - The error to wrap
 * @throws Always throws - either wrapped ScribeError or original error
 *
 * @remarks
 * ScribeErrors are converted to plain Errors with user-friendly messages
 * since Error subclasses don't serialize properly over IPC.
 */
function wrapError(error: unknown): never {
  if (error instanceof ScribeError) {
    const userError = new Error(error.getUserMessage());
    userError.name = error.code;
    throw userError;
  }
  throw error;
}

/**
 * Setup IPC handlers for notes CRUD operations.
 *
 * @param deps - Handler dependencies (requires vault, graphEngine, searchEngine, taskIndex)
 *
 * @example
 * ```typescript
 * // From renderer
 * const notes = await window.api.invoke('notes:list');
 * const note = await window.api.invoke('notes:read', 'note-123');
 * ```
 */
export function setupNotesHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `notes:list`
   *
   * Lists all notes in the vault.
   *
   * @returns `Note[]` - Array of all notes (metadata only, content may be lazy-loaded)
   */
  ipcMain.handle('notes:list', async () => {
    const vault = requireVault(deps);
    return vault.list();
  });

  /**
   * IPC: `notes:read`
   *
   * Reads a single note by ID, including full content.
   *
   * @param id - The note ID to read
   * @returns `Note` - The full note with content
   * @throws Error with user-friendly message if note not found
   */
  ipcMain.handle('notes:read', async (_event, id: NoteId) => {
    try {
      const vault = requireVault(deps);
      return vault.read(id);
    } catch (error) {
      wrapError(error);
    }
  });

  /**
   * IPC: `notes:create`
   *
   * Creates a new empty note with auto-generated ID.
   *
   * @returns `Note` - The newly created note
   */
  ipcMain.handle('notes:create', async () => {
    const vault = requireVault(deps);
    return await vault.create();
  });

  /**
   * IPC: `notes:save`
   *
   * Saves a note to the vault and updates all indexes.
   *
   * @param note - The complete note object to save
   * @returns `{ success: true }`
   * @throws Error with user-friendly message on save failure
   *
   * @sideeffects
   * - Updates graph engine with new note data (links, tags)
   * - Updates search index for full-text search
   * - Re-indexes tasks and broadcasts `tasks:changed` event if tasks changed
   */
  ipcMain.handle(
    'notes:save',
    withEngines(deps, async (engines, note: Note) => {
      try {
        await engines.vault.save(note);

        // Update graph with new note data
        engines.graphEngine.addNote(note);

        // Update search index with new note data
        engines.searchEngine.indexNote(note);

        // Re-index tasks for this note and broadcast changes
        const taskChanges = engines.taskIndex.indexNote(note);
        if (taskChanges.length > 0) {
          deps.mainWindow?.webContents.send('tasks:changed', taskChanges);
        }

        return { success: true };
      } catch (error) {
        wrapError(error);
      }
    })
  );

  /**
   * IPC: `notes:delete`
   *
   * Deletes a note from the vault and removes from all indexes.
   *
   * @param id - The note ID to delete
   * @returns `{ success: true }`
   * @throws Error with user-friendly message if note not found
   *
   * @sideeffects
   * - Removes from graph engine (links, backlinks)
   * - Removes from search index
   * - Removes tasks and broadcasts `tasks:changed` event
   */
  ipcMain.handle(
    'notes:delete',
    withEngines(deps, async (engines, id: NoteId) => {
      try {
        await engines.vault.delete(id);
        engines.graphEngine.removeNote(id);
        engines.searchEngine.removeNote(id);

        // Remove tasks for this note and broadcast changes
        const taskChanges = engines.taskIndex.removeNote(id);
        if (taskChanges.length > 0) {
          deps.mainWindow?.webContents.send('tasks:changed', taskChanges);
        }

        return { success: true };
      } catch (error) {
        wrapError(error);
      }
    })
  );

  /**
   * IPC: `notes:findByTitle`
   *
   * Finds a note by title for wiki-link resolution.
   *
   * @param title - The title to search for
   * @returns `Note | null` - The matching note, or null if not found
   *
   * @remarks
   * Title matching precedence:
   * 1. Exact case-sensitive match
   * 2. Case-insensitive match (most recently updated wins if multiple)
   */
  ipcMain.handle('notes:findByTitle', async (_event, title: string) => {
    const vault = requireVault(deps);
    const notes = vault.list();

    // Exact match first (using explicit title field)
    let match = notes.find((n) => n.title === title);

    // Case-insensitive fallback
    if (!match) {
      const lowerTitle = title.toLowerCase();
      const matches = notes.filter((n) => n.title?.toLowerCase() === lowerTitle);
      // Most recently updated wins
      match = matches.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    }

    return match ?? null;
  });

  /**
   * IPC: `notes:findByDate`
   *
   * Finds notes created or updated on a specific date.
   * Used for date-based linked mentions in daily notes.
   *
   * @param date - Date string in "MM-dd-yyyy" format (matches daily note title format)
   * @param includeCreated - Include notes created on this date
   * @param includeUpdated - Include notes updated (but not created) on this date
   * @returns `Array<{ note: Note, reason: 'created' | 'updated' }>` - Notes with reason
   *
   * @remarks
   * - Daily notes for the target date are excluded from results
   * - Notes created on the date are only returned with reason 'created', not 'updated'
   * - Date range is midnight to 23:59:59.999 in local timezone
   */
  ipcMain.handle(
    'notes:findByDate',
    async (
      _event,
      {
        date,
        includeCreated,
        includeUpdated,
      }: { date: string; includeCreated: boolean; includeUpdated: boolean }
    ) => {
      const vault = requireVault(deps);

      // Parse the date string (expecting "MM-dd-yyyy" format from daily note titles)
      const [month, day, year] = date.split('-').map(Number);
      const targetDate = new Date(year, month - 1, day);
      const startOfDay = new Date(targetDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(targetDate);
      endOfDay.setHours(23, 59, 59, 999);

      const startMs = startOfDay.getTime();
      const endMs = endOfDay.getTime();

      const notes = vault.list();
      const results: Array<{ note: Note; reason: 'created' | 'updated' }> = [];

      for (const note of notes) {
        // Skip the daily note itself (will be excluded later by noteId, but good to skip early)
        if (note.type === 'daily' && note.title === date) {
          continue;
        }

        const wasCreatedOnDate = note.createdAt >= startMs && note.createdAt <= endMs;
        const wasUpdatedOnDate = note.updatedAt >= startMs && note.updatedAt <= endMs;

        if (includeCreated && wasCreatedOnDate) {
          results.push({ note, reason: 'created' });
        } else if (includeUpdated && wasUpdatedOnDate && !wasCreatedOnDate) {
          // Only mark as "updated" if it wasn't also created on this date
          results.push({ note, reason: 'updated' });
        }
      }

      return results;
    }
  );

  /**
   * IPC: `notes:searchTitles`
   *
   * Searches note titles for wiki-link autocomplete.
   * Performs case-insensitive substring matching.
   *
   * @param query - The search query (substring match)
   * @param limit - Maximum results to return (default: 10)
   * @returns `SearchResult[]` - Array of matching notes with id, title, snippet, score, matches
   *
   * @remarks
   * - Empty query returns empty results
   * - Only notes with titles are included
   * - Results are not ranked; all matches have score of 1
   */
  ipcMain.handle('notes:searchTitles', async (_event, query: string, limit = 10) => {
    const vault = requireVault(deps);

    // Empty query returns empty results
    if (!query.trim()) {
      return [];
    }

    const notes = vault.list();
    const lowerQuery = query.toLowerCase();

    // Use explicit title field for search
    const matches = notes
      .filter((n) => n.title) // Has title
      .filter((n) => n.title.toLowerCase().includes(lowerQuery))
      .slice(0, limit)
      .map((n) => ({
        id: n.id,
        title: n.title,
        snippet: '',
        score: 1,
        matches: [],
      }));

    return matches;
  });
}
