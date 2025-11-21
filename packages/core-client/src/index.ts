/**
 * @scribe/core-client
 *
 * Typed API wrapper for communicating with the Core Engine.
 * Hides IPC/RPC complexity behind simple TypeScript methods.
 */

import type { ParsedNote, NoteId } from '@scribe/domain-model';
import type { SearchOptions, SearchResult } from './types.js';

/**
 * Core client for communicating with the Core Engine.
 */
export class CoreClient {
  private requestId = 0;
  private sendMessage?: (message: unknown) => Promise<unknown>;

  /**
   * Initialize the core client with a message sender.
   */
  initialize(sendMessage: (message: unknown) => Promise<unknown>): void {
    this.sendMessage = sendMessage;
  }

  /**
   * Send a JSON-RPC request to the Core Engine.
   */
  private async request(method: string, params?: unknown): Promise<unknown> {
    if (!this.sendMessage) {
      throw new Error('CoreClient not initialized');
    }

    const message = {
      jsonrpc: '2.0',
      method,
      params,
      id: ++this.requestId,
    };

    const response = (await this.sendMessage(message)) as {
      result?: unknown;
      error?: { code: number; message: string };
    };

    if (response.error) {
      throw new Error(response.error.message);
    }

    return response.result;
  }

  /**
   * Health check - ping the Core Engine.
   */
  async ping(): Promise<{ status: string; timestamp: number }> {
    return (await this.request('ping')) as { status: string; timestamp: number };
  }

  /**
   * Search for notes.
   */
  async search(query: string, options?: SearchOptions): Promise<SearchResult[]> {
    return (await this.request('search', { query, options })) as SearchResult[];
  }

  /**
   * Get a note by ID.
   */
  async getNote(noteId: NoteId): Promise<ParsedNote | null> {
    return (await this.request('getNote', { noteId })) as ParsedNote | null;
  }

  /**
   * List all notes.
   */
  async listNotes(): Promise<ParsedNote[]> {
    return (await this.request('listNotes')) as ParsedNote[];
  }

  /**
   * Get graph neighbors for a node.
   */
  async getNeighbors(nodeId: string): Promise<{
    outgoing: unknown[];
    incoming: unknown[];
  }> {
    return (await this.request('getNeighbors', { nodeId })) as {
      outgoing: unknown[];
      incoming: unknown[];
    };
  }

  /**
   * Get note content (raw markdown).
   */
  async getNoteContent(noteId: NoteId): Promise<string> {
    const result = (await this.request('getNoteContent', { noteId })) as {
      content: string;
    };
    return result.content;
  }

  /**
   * Update note content (autosave).
   */
  async updateNoteContent(
    noteId: NoteId,
    content: string
  ): Promise<{ success: boolean; path?: string }> {
    return (await this.request('updateNoteContent', { noteId, content })) as {
      success: boolean;
      path?: string;
    };
  }
}

export * from './types.js';
