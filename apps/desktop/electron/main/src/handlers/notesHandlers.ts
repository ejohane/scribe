/**
 * Notes CRUD IPC Handlers
 *
 * This module provides IPC handlers for note operations:
 * - Create, read, update, delete notes
 * - Find notes by title (wiki-link resolution)
 * - Search note titles (autocomplete)
 * - Find notes by date (daily note mentions)
 *
 * ## Handler Patterns
 *
 * This module uses two distinct patterns for engine access:
 *
 * ### Pattern A: Direct Vault Access (Read-Only Operations)
 *
 * For read-only operations that only need the vault (list, read, findByTitle, searchTitles):
 * ```typescript
 * ipcMain.handle('notes:list', async () => {
 *   const vault = requireVault(deps);
 *   return vault.list();
 * });
 * ```
 *
 * Use this pattern when:
 * - Operation only reads from vault (no writes)
 * - No need to update graph, search, or task indexes
 * - Performance is critical (avoids unnecessary engine validation)
 *
 * ### Pattern B: Coordinated Engine Access (Write Operations)
 *
 * For write operations that must update all engines in sync (save, delete):
 * ```typescript
 * ipcMain.handle('notes:save', withEngines(deps, async (engines, note) => {
 *   await engines.vault.save(note);
 *   engines.graphEngine.addNote(note);
 *   engines.searchEngine.indexNote(note);
 *   const taskChanges = engines.taskIndex.indexNote(note);
 *   // Emit task changes...
 * }));
 * ```
 *
 * Use this pattern when:
 * - Operation modifies note data (create, update, delete)
 * - All engines must be updated atomically to maintain consistency
 * - Task changes need to be broadcast to the renderer
 *
 * Note: The EngineOrchestrator class in ../EngineOrchestrator.ts provides
 * similar coordination logic and could be used as an alternative to manual
 * coordination. The current inline approach was chosen for explicitness
 * and to avoid adding another dependency layer during early development.
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
import { HandlerDependencies, requireVault, withEngines, wrapError } from './types';

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
   * Uses Pattern A (direct vault access) - read-only operation.
   *
   * @returns `Note[]` - Array of all notes (metadata only, content may be lazy-loaded)
   */
  ipcMain.handle('notes:list', async () => {
    // Pattern A: Direct vault access for read-only operation
    const vault = requireVault(deps);
    return vault.list();
  });

  /**
   * IPC: `notes:read`
   *
   * Reads a single note by ID, including full content.
   * Uses Pattern A (direct vault access) - read-only operation.
   *
   * @param id - The note ID to read
   * @returns `Note` - The full note with content
   * @throws Error with user-friendly message if note not found
   */
  ipcMain.handle('notes:read', async (_event, id: NoteId) => {
    try {
      // Pattern A: Direct vault access for read-only operation
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
   * Note: This uses Pattern A (direct vault access) even though it's a write
   * operation because newly created notes are empty - they have no content to
   * index in search, no links for the graph, and no tasks to track. The caller
   * will typically follow up with a `notes:save` call once the user adds content.
   *
   * @returns `Note` - The newly created note
   */
  ipcMain.handle('notes:create', async () => {
    // Pattern A: Direct vault access - new notes are empty, no indexing needed
    const vault = requireVault(deps);
    return await vault.create();
  });

  /**
   * IPC: `notes:save`
   *
   * Saves a note to the vault and updates all indexes.
   * Uses Pattern B (coordinated engine access) - write operation requiring
   * all engines to stay in sync.
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
    // Pattern B: Coordinated engine access for write operation
    withEngines(deps, async (engines, note: Note) => {
      try {
        // Step 1: Save to vault (source of truth)
        await engines.vault.save(note);

        // Step 2: Update graph with new note data (links, backlinks, tags, mentions)
        engines.graphEngine.addNote(note);

        // Step 3: Update search index for full-text search
        engines.searchEngine.indexNote(note);

        // Step 4: Re-index tasks for this note and broadcast changes
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
   * Uses Pattern B (coordinated engine access) - write operation requiring
   * all engines to stay in sync.
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
    // Pattern B: Coordinated engine access for write operation
    withEngines(deps, async (engines, id: NoteId) => {
      try {
        // Step 1: Delete from vault (source of truth)
        await engines.vault.delete(id);

        // Step 2: Remove from graph (clears links, backlinks)
        engines.graphEngine.removeNote(id);

        // Step 3: Remove from search index
        engines.searchEngine.removeNote(id);

        // Step 4: Remove tasks for this note and broadcast changes
        const taskChanges = engines.taskIndex.removeNote(id);
        if (taskChanges.length > 0) {
          deps.mainWindow?.webContents.send('tasks:changed', taskChanges);
        }

        // Step 5: Clean up recent opens tracking (best-effort, fire-and-forget)
        try {
          if (deps.recentOpensDb) {
            deps.recentOpensDb.removeTracking(id);
          }
        } catch (cleanupError) {
          // Log but don't fail the deletion
          console.warn('Failed to clean up recent opens tracking:', cleanupError);
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
   * Uses Pattern A (direct vault access) - read-only operation.
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
    // Pattern A: Direct vault access for read-only operation
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
   * Uses Pattern A (direct vault access) - read-only operation.
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
      // Pattern A: Direct vault access for read-only operation
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
   * Uses Pattern A (direct vault access) - read-only operation.
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
    // Pattern A: Direct vault access for read-only operation
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
