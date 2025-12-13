/**
 * Search IPC Handlers
 *
 * This module provides IPC handlers for full-text search operations.
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `search:query` | `query: string` | `SearchResult[]` | Full-text search across all notes |
 *
 * ## Search Engine
 *
 * Uses the SearchEngine from `@scribe/engine-search` for:
 * - Full-text indexing of note content
 * - Relevance-ranked search results
 * - Highlighted match snippets
 *
 * @module handlers/searchHandlers
 */

import { ipcMain } from 'electron';
import { HandlerDependencies, requireSearchEngine } from './types';

/**
 * Setup IPC handlers for search operations.
 *
 * @param deps - Handler dependencies (requires searchEngine)
 *
 * @example
 * ```typescript
 * // From renderer
 * const results = await window.api.invoke('search:query', 'meeting notes');
 * // [{ id, title, snippet, score, matches }, ...]
 * ```
 */
export function setupSearchHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `search:query`
   *
   * Performs full-text search across all indexed notes.
   *
   * @param query - The search query string
   * @returns `SearchResult[]` - Array of matching notes with:
   *   - `id`: Note ID
   *   - `title`: Note title
   *   - `snippet`: Text snippet with matches highlighted
   *   - `score`: Relevance score (higher is better)
   *   - `matches`: Array of match positions
   *
   * @remarks
   * Search is performed against note content, not just titles.
   * Results are ranked by relevance score.
   */
  ipcMain.handle('search:query', async (_event, query: string) => {
    const searchEngine = requireSearchEngine(deps);
    return searchEngine.search(query);
  });
}
