/**
 * People Management IPC Handlers
 *
 * This module provides IPC handlers for person note operations:
 * - List all people in the vault
 * - Create new person notes
 * - Search people by name
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `people:list` | none | `Note[]` | List all person notes |
 * | `people:create` | `name: string` | `Note` | Create a new person note |
 * | `people:search` | `query: string, limit?: number` | `SearchResult[]` | Search people by name |
 *
 * ## Person Notes
 *
 * Person notes are regular notes with:
 * - `type: 'person'` in metadata
 * - Title set to the person's name
 * - Initial content with H1 heading and empty paragraph
 *
 * @module handlers/peopleHandlers
 */

import { ipcMain } from 'electron';
import type { LexicalState } from '@scribe/shared';
import { ScribeError, ErrorCode } from '@scribe/shared';
import {
  HandlerDependencies,
  requireVault,
  requireGraphEngine,
  requireSearchEngine,
} from './types';

/**
 * Wrap ScribeError for IPC transport with user-friendly message.
 *
 * @param error - The error to wrap
 * @throws Always throws - either wrapped ScribeError or original error
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
 * Create the initial Lexical content for a new person note.
 *
 * @param name - The person's name
 * @returns LexicalState with H1 heading (name) and empty paragraph
 *
 * @remarks
 * Sets up the initial structure for person notes:
 * - H1 heading with the person's name
 * - Empty paragraph for additional content
 */
function createPersonContent(name: string): LexicalState {
  return {
    root: {
      children: [
        {
          type: 'heading',
          tag: 'h1',
          children: [{ type: 'text', text: name }],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
        {
          type: 'paragraph',
          children: [],
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
    type: 'person',
  };
}

/**
 * Setup IPC handlers for people management operations.
 *
 * @param deps - Handler dependencies (requires vault, graphEngine, searchEngine)
 *
 * @example
 * ```typescript
 * // From renderer
 * const people = await window.api.invoke('people:list');
 * const newPerson = await window.api.invoke('people:create', 'John Doe');
 * ```
 */
export function setupPeopleHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `people:list`
   *
   * Lists all person notes in the vault.
   *
   * @returns `Note[]` - Array of notes with type 'person'
   */
  ipcMain.handle('people:list', async () => {
    const vault = requireVault(deps);
    const notes = vault.list();
    return notes.filter((n) => n.metadata.type === 'person');
  });

  /**
   * IPC: `people:create`
   *
   * Creates a new person note with the given name.
   *
   * @param name - The person's name (will be trimmed)
   * @returns `Note` - The newly created person note
   * @throws Error if name is empty or whitespace-only
   *
   * @sideeffects
   * - Adds note to graph engine
   * - Indexes note in search engine
   */
  ipcMain.handle('people:create', async (_event, name: string) => {
    try {
      const vault = requireVault(deps);
      const graphEngine = requireGraphEngine(deps);
      const searchEngine = requireSearchEngine(deps);

      if (!name || name.trim().length === 0) {
        throw new ScribeError(ErrorCode.VALIDATION_ERROR, 'Person name is required');
      }

      const content = createPersonContent(name.trim());
      const note = await vault.create({ content, type: 'person', title: name.trim() });

      // Update graph and search indexes
      graphEngine.addNote(note);
      searchEngine.indexNote(note);

      return note;
    } catch (error) {
      wrapError(error);
    }
  });

  /**
   * IPC: `people:search`
   *
   * Searches person notes by name substring.
   *
   * @param query - Search query (case-insensitive substring match)
   * @param limit - Maximum results to return (default: 10)
   * @returns `SearchResult[]` - Array of matching people with id, title, snippet, score, matches
   *
   * @remarks
   * - Only searches person notes (type: 'person')
   * - Matches against the note title (person's name)
   * - Results are not ranked; all matches have score of 1
   */
  ipcMain.handle('people:search', async (_event, query: string, limit = 10) => {
    const vault = requireVault(deps);
    const notes = vault.list();
    // Use explicit type field for filtering
    const people = notes.filter((n) => n.type === 'person');

    const queryLower = query.toLowerCase();
    const filtered = people.filter((n) => {
      const title = (n.title ?? '').toLowerCase();
      return title.includes(queryLower);
    });

    return filtered.slice(0, limit).map((n) => ({
      id: n.id,
      title: n.title,
      snippet: '',
      score: 1,
      matches: [],
    }));
  });
}
