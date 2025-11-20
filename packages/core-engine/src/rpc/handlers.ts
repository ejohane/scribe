/**
 * JSON-RPC method handlers.
 */

import type { AppState } from '@scribe/domain-model';
import type { SearchEngine } from '@scribe/search';
import type { JSONRPCServer } from './server.js';

/**
 * Register all RPC handlers.
 */
export function registerHandlers(
  server: JSONRPCServer,
  state: AppState,
  searchEngine: SearchEngine
): void {
  // Health check
  server.register('ping', async () => {
    return { status: 'ok', timestamp: Date.now() };
  });

  // Search
  server.register('search', async (params: unknown) => {
    const { query, options } = params as { query: string; options?: unknown };
    return searchEngine.search(query, options as never);
  });

  // Get note by ID
  server.register('getNote', async (params: unknown) => {
    const { noteId } = params as { noteId: string };
    const note = state.noteRegistry.byId.get(noteId);
    return note || null;
  });

  // List all notes
  server.register('listNotes', async () => {
    return Array.from(state.noteRegistry.byId.values());
  });

  // Get graph neighbors
  server.register('getNeighbors', async (params: unknown) => {
    const { nodeId } = params as { nodeId: string };
    const outgoing = state.graphIndex.outgoing.get(nodeId) || [];
    const incoming = state.graphIndex.incoming.get(nodeId) || [];
    return { outgoing, incoming };
  });
}
