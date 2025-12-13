/**
 * Graph Traversal IPC Handlers
 *
 * This module provides IPC handlers for knowledge graph operations:
 * - Finding connected notes (neighbors)
 * - Finding backlinks (notes that link to a note)
 * - Finding notes by tag
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `graph:forNote` | `id: NoteId` | `NoteId[]` | Get neighbors (linked notes) |
 * | `graph:backlinks` | `id: NoteId` | `NoteId[]` | Get notes that link to this note |
 * | `graph:notesWithTag` | `tag: string` | `NoteId[]` | Get notes with a specific tag |
 *
 * ## Graph Model
 *
 * The graph engine maintains:
 * - Forward links: Note A links to Note B (via wiki-links)
 * - Backlinks: Reverse lookup of forward links
 * - Tag index: Notes grouped by tag
 *
 * Links are extracted from note content when saved via `notes:save`.
 *
 * @module handlers/graphHandlers
 */

import { ipcMain } from 'electron';
import type { NoteId } from '@scribe/shared';
import { HandlerDependencies, requireGraphEngine } from './types';

/**
 * Setup IPC handlers for graph traversal operations.
 *
 * @param deps - Handler dependencies (requires graphEngine)
 *
 * @example
 * ```typescript
 * // From renderer
 * const backlinks = await window.api.invoke('graph:backlinks', 'note-123');
 * // ['note-456', 'note-789'] - IDs of notes that link to note-123
 * ```
 */
export function setupGraphHandlers(deps: HandlerDependencies): void {
  /**
   * IPC: `graph:forNote`
   *
   * Gets all notes that are linked from the given note (forward links).
   *
   * @param id - The source note ID
   * @returns `NoteId[]` - Array of note IDs that are linked from this note
   *
   * @remarks
   * Includes wiki-links extracted from the note's content.
   * Does not include the source note itself.
   */
  ipcMain.handle('graph:forNote', async (_event, id: NoteId) => {
    const graphEngine = requireGraphEngine(deps);
    return graphEngine.neighbors(id);
  });

  /**
   * IPC: `graph:backlinks`
   *
   * Gets all notes that link to the given note (reverse links).
   *
   * @param id - The target note ID
   * @returns `NoteId[]` - Array of note IDs that link to this note
   *
   * @remarks
   * Useful for discovering related content and building "mentioned in" sections.
   */
  ipcMain.handle('graph:backlinks', async (_event, id: NoteId) => {
    const graphEngine = requireGraphEngine(deps);
    return graphEngine.backlinks(id);
  });

  /**
   * IPC: `graph:notesWithTag`
   *
   * Gets all notes that have a specific tag.
   *
   * @param tag - The tag to search for (without # prefix)
   * @returns `NoteId[]` - Array of note IDs with this tag
   *
   * @remarks
   * Tags are extracted from note metadata when saved.
   * Tag matching is typically case-insensitive.
   */
  ipcMain.handle('graph:notesWithTag', async (_event, tag: string) => {
    const graphEngine = requireGraphEngine(deps);
    return graphEngine.notesWithTag(tag);
  });
}
