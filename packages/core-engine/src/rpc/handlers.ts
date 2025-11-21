/**
 * JSON-RPC method handlers.
 */

import type { AppState } from '@scribe/domain-model';
import type { SearchEngine } from '@scribe/search';
import type { VaultMutations } from '@scribe/vault';
import type { JSONRPCServer } from './server.js';

/**
 * Register all RPC handlers.
 */
export function registerHandlers(
  server: JSONRPCServer,
  state: AppState,
  searchEngine: SearchEngine,
  vaultMutations?: VaultMutations
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

  // Get note content (raw markdown)
  server.register('getNoteContent', async (params: unknown) => {
    const { noteId } = params as { noteId: string };

    if (!vaultMutations) {
      throw new Error('Vault mutations not available');
    }

    const result = vaultMutations.readFile(noteId as never);

    if (!result.success) {
      throw new Error(result.error || 'Failed to read note');
    }

    return { content: result.content || '' };
  });

  // Update note content (autosave)
  server.register('updateNoteContent', async (params: unknown) => {
    const { noteId, content } = params as { noteId: string; content: string };

    if (!vaultMutations) {
      throw new Error('Vault mutations not available');
    }

    const result = vaultMutations.writeFile(noteId as never, content);

    if (!result.success) {
      throw new Error(result.error || 'Failed to write note');
    }

    return { success: true, path: result.path };
  });
}
