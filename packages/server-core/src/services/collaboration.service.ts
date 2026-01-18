/**
 * CollaborationService - Yjs document management for real-time collaboration.
 *
 * This service manages the lifecycle of Yjs documents:
 * 1. Load/create Y.Doc for a note
 * 2. Persist state changes to database
 * 3. Handle client connections (sessions)
 * 4. Apply and broadcast updates
 *
 * @module
 */

import * as Y from 'yjs';
import { nanoid } from 'nanoid';
import type { YjsStateRepository } from '@scribe/server-db';
import type { DocumentService } from './document.service.js';
import type { EditorContent } from '../types/index.js';

/**
 * Session representing a client connected to a collaborative document.
 */
export interface CollabSession {
  /** Unique session identifier */
  id: string;
  /** Note being edited */
  noteId: string;
  /** Client identifier (e.g., user ID or connection ID) */
  clientId: string;
  /** ISO timestamp when session started */
  connectedAt: string;
}

/**
 * Update event for broadcasting changes to clients.
 */
export interface CollabUpdate {
  /** Note that was updated */
  noteId: string;
  /** Encoded Yjs update (can be applied with Y.applyUpdate) */
  update: Uint8Array;
  /** Identifier of the client that made the change */
  origin: string;
}

/**
 * Handler function for broadcasting updates to connected clients.
 */
export type UpdateHandler = (update: CollabUpdate) => void;

/**
 * Dependencies for CollaborationService.
 */
export interface CollaborationServiceDeps {
  /** Repository for Yjs state persistence */
  yjsRepo: YjsStateRepository;
  /** Document service for reading note content */
  documentService: DocumentService;
}

/**
 * CollaborationService - Manages Yjs documents for real-time collaboration.
 *
 * Responsible for:
 * - Loading/creating Y.Doc instances for notes
 * - Persisting Yjs state to SQLite via YjsStateRepository
 * - Managing active editing sessions
 * - Applying and broadcasting collaborative updates
 *
 * @example
 * ```typescript
 * const service = new CollaborationService({
 *   yjsRepo: new YjsStateRepository(db),
 *   documentService: documentService,
 * });
 *
 * // Set up update broadcasting
 * service.setUpdateHandler((update) => {
 *   wsServer.broadcastToNote(update.noteId, update);
 * });
 *
 * // Client joins a document
 * const session = await service.joinSession('note-123', 'client-456');
 *
 * // Get the Y.Doc for editing
 * const doc = await service.getDoc('note-123');
 *
 * // Apply an update from a client
 * service.applyUpdate('note-123', update, 'client-456');
 *
 * // Client disconnects
 * service.leaveSession(session.id);
 * ```
 */
export class CollaborationService {
  private readonly yjsRepo: YjsStateRepository;
  private readonly documentService: DocumentService;

  /** Active Y.Doc instances (in memory) keyed by noteId */
  private docs: Map<string, Y.Doc> = new Map();

  /** Active sessions per document, keyed by noteId */
  private sessions: Map<string, Set<CollabSession>> = new Map();

  /** Callback for broadcasting updates to connected clients */
  private onUpdate?: UpdateHandler;

  constructor(deps: CollaborationServiceDeps) {
    this.yjsRepo = deps.yjsRepo;
    this.documentService = deps.documentService;
  }

  /**
   * Set callback for update broadcasts.
   *
   * This handler is called whenever a document is updated (either locally
   * or from a client). The WebSocket layer typically uses this to broadcast
   * changes to other connected clients.
   *
   * @param handler - Function to call with update events
   */
  setUpdateHandler(handler: UpdateHandler): void {
    this.onUpdate = handler;
  }

  /**
   * Get or create a Y.Doc for a note.
   *
   * If the document is already in memory, returns the cached instance.
   * Otherwise, creates a new Y.Doc and loads any persisted state.
   * If no persisted state exists, initializes from the note's content.
   *
   * @param noteId - The note ID
   * @returns The Y.Doc instance for the note
   */
  async getDoc(noteId: string): Promise<Y.Doc> {
    // Return cached doc if exists
    const existing = this.docs.get(noteId);
    if (existing) {
      console.log(`[CollabService] getDoc ${noteId}: returning cached doc`);
      return existing;
    }

    // Create new doc
    const doc = new Y.Doc();

    // Try to load persisted state
    const hasState = this.loadPersistedState(noteId, doc);
    console.log(`[CollabService] getDoc ${noteId}: hasPersistedState=${hasState}`);

    // If no Yjs state, initialize from note content
    if (!hasState) {
      console.log(`[CollabService] getDoc ${noteId}: initializing from note content`);
      const note = await this.documentService.read(noteId);
      if (note) {
        this.initializeDocFromContent(doc, note.content);
      }
    }

    // Set up persistence on changes
    this.setupUpdateListener(noteId, doc);

    this.docs.set(noteId, doc);
    return doc;
  }

  /**
   * Check if a document is currently loaded in memory.
   *
   * @param noteId - The note ID
   * @returns true if the document is loaded
   */
  hasDoc(noteId: string): boolean {
    return this.docs.has(noteId);
  }

  /**
   * Apply an update from a client.
   *
   * Updates are applied with 'remote' origin so the update handler
   * knows not to re-broadcast to the originating client.
   *
   * @param noteId - The note ID
   * @param update - The encoded Yjs update
   * @param clientId - The client that sent the update
   * @returns true if update was applied, false if doc not loaded
   */
  applyUpdate(noteId: string, update: Uint8Array, clientId: string): boolean {
    const doc = this.docs.get(noteId);
    if (!doc) {
      console.warn(`CollaborationService: No active doc for note ${noteId}`);
      return false;
    }

    Y.applyUpdate(doc, update, { clientId, origin: 'remote' });
    return true;
  }

  /**
   * Get the current state of a document as an encoded update.
   *
   * This is typically sent to newly connected clients so they can
   * sync to the current state.
   *
   * @param noteId - The note ID
   * @returns The encoded state, or null if doc not loaded
   */
  getState(noteId: string): Uint8Array | null {
    const doc = this.docs.get(noteId);
    if (!doc) {
      return null;
    }
    return Y.encodeStateAsUpdate(doc);
  }

  /**
   * Join a document editing session.
   *
   * Creates a session record and ensures the document is loaded.
   * The document will remain in memory as long as at least one
   * session is active.
   *
   * @param noteId - The note to edit
   * @param clientId - The client identifier
   * @returns The created session
   */
  async joinSession(noteId: string, clientId: string): Promise<CollabSession> {
    // Ensure doc is loaded
    await this.getDoc(noteId);

    const session: CollabSession = {
      id: nanoid(8),
      noteId,
      clientId,
      connectedAt: new Date().toISOString(),
    };

    if (!this.sessions.has(noteId)) {
      this.sessions.set(noteId, new Set());
    }
    this.sessions.get(noteId)!.add(session);

    return session;
  }

  /**
   * Leave a document editing session.
   *
   * Removes the session and unloads the document if no other
   * sessions are active.
   *
   * @param sessionId - The session ID to end
   * @returns true if session was found and removed
   */
  leaveSession(sessionId: string): boolean {
    for (const [noteId, sessions] of this.sessions) {
      for (const session of sessions) {
        if (session.id === sessionId) {
          sessions.delete(session);

          // If no more sessions, persist and unload doc
          if (sessions.size === 0) {
            this.unloadDoc(noteId);
          }
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Get all active sessions for a note.
   *
   * @param noteId - The note ID
   * @returns Array of active sessions
   */
  getSessions(noteId: string): CollabSession[] {
    return Array.from(this.sessions.get(noteId) ?? []);
  }

  /**
   * Get all active sessions across all documents.
   *
   * @returns Map of noteId to sessions array
   */
  getAllSessions(): Map<string, CollabSession[]> {
    const result = new Map<string, CollabSession[]>();
    for (const [noteId, sessions] of this.sessions) {
      result.set(noteId, Array.from(sessions));
    }
    return result;
  }

  /**
   * Get the count of active sessions for a note.
   *
   * @param noteId - The note ID
   * @returns The number of active sessions
   */
  getSessionCount(noteId: string): number {
    return this.sessions.get(noteId)?.size ?? 0;
  }

  /**
   * Sync Yjs content back to JSON file.
   *
   * Converts the current Yjs state to Lexical content format
   * and updates the note file via DocumentService.
   *
   * @param noteId - The note ID
   * @returns true if sync was performed
   */
  async syncToFile(noteId: string): Promise<boolean> {
    const doc = this.docs.get(noteId);
    if (!doc) {
      return false;
    }

    // Convert Yjs state to Lexical content
    const content = this.docToLexicalContent(doc);

    // Update file via DocumentService
    await this.documentService.update(noteId, { content });
    return true;
  }

  /**
   * Force persist the current state of a document.
   *
   * Useful for ensuring data is saved before server shutdown.
   *
   * @param noteId - The note ID
   * @returns true if state was persisted
   */
  persistDoc(noteId: string): boolean {
    const doc = this.docs.get(noteId);
    if (!doc) {
      return false;
    }

    this.saveDocState(noteId, doc);
    return true;
  }

  /**
   * Persist all loaded documents.
   *
   * Should be called before server shutdown.
   */
  persistAll(): void {
    for (const [noteId, doc] of this.docs) {
      this.saveDocState(noteId, doc);
    }
  }

  /**
   * Unload a document from memory.
   *
   * Persists the final state, destroys the Y.Doc, and cleans up.
   * Any active sessions for the document will be cleared.
   *
   * @param noteId - The note ID
   * @returns true if document was unloaded
   */
  unloadDoc(noteId: string): boolean {
    const doc = this.docs.get(noteId);
    if (!doc) {
      return false;
    }

    // Final persistence
    this.saveDocState(noteId, doc);

    // Clean up
    doc.destroy();
    this.docs.delete(noteId);
    this.sessions.delete(noteId);

    return true;
  }

  /**
   * Unload all documents from memory.
   *
   * Should be called on server shutdown.
   */
  unloadAll(): void {
    for (const noteId of this.docs.keys()) {
      this.unloadDoc(noteId);
    }
  }

  /**
   * Get the number of loaded documents.
   */
  getLoadedDocCount(): number {
    return this.docs.size;
  }

  /**
   * Get the IDs of all loaded documents.
   */
  getLoadedDocIds(): string[] {
    return Array.from(this.docs.keys());
  }

  // ============================================================================
  // Private helper methods
  // ============================================================================

  /**
   * Load persisted state into a Y.Doc.
   *
   * @returns true if state was loaded, false if no state exists
   */
  private loadPersistedState(noteId: string, doc: Y.Doc): boolean {
    const state = this.yjsRepo.loadAsUint8Array(noteId);
    if (!state) {
      return false;
    }

    Y.applyUpdate(doc, state);
    return true;
  }

  /**
   * Set up the update listener for a document.
   */
  private setupUpdateListener(noteId: string, doc: Y.Doc): void {
    doc.on('update', (update: Uint8Array, origin: unknown) => {
      // Persist to database
      this.saveDocState(noteId, doc);

      // Broadcast to other clients (skip remote updates to avoid loops)
      if (this.onUpdate && !this.isRemoteOrigin(origin)) {
        this.onUpdate({
          noteId,
          update,
          origin: this.extractClientId(origin),
        });
      }
    });
  }

  /**
   * Check if an update origin indicates it came from a remote client.
   */
  private isRemoteOrigin(origin: unknown): boolean {
    if (typeof origin === 'object' && origin !== null) {
      return (origin as { origin?: string }).origin === 'remote';
    }
    return false;
  }

  /**
   * Extract the client ID from an update origin.
   */
  private extractClientId(origin: unknown): string {
    if (typeof origin === 'object' && origin !== null) {
      const clientId = (origin as { clientId?: string }).clientId;
      if (clientId) {
        return clientId;
      }
    }
    return 'server';
  }

  /**
   * Save the current document state to the database.
   */
  private saveDocState(noteId: string, doc: Y.Doc): void {
    const state = Y.encodeStateAsUpdate(doc);
    console.log(`[CollabService] saveDocState for ${noteId}, ${state.length} bytes`);
    this.yjsRepo.save({
      noteId,
      state: Buffer.from(state),
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Initialize Y.Doc from Lexical content.
   *
   * Stores the serialized Lexical content in a Y.Map for now.
   * The actual Yjs-Lexical binding structure will be refined
   * in the collab package.
   */
  private initializeDocFromContent(doc: Y.Doc, content: EditorContent): void {
    const yContent = doc.getMap('content');
    yContent.set('lexical', JSON.stringify(content));
  }

  /**
   * Convert Y.Doc to Lexical content.
   */
  private docToLexicalContent(doc: Y.Doc): EditorContent {
    const yContent = doc.getMap('content');
    const serialized = yContent.get('lexical') as string | undefined;
    return serialized ? JSON.parse(serialized) : this.createEmptyContent();
  }

  /**
   * Create an empty Lexical editor content structure.
   */
  private createEmptyContent(): EditorContent {
    return {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [],
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    };
  }
}
