/**
 * YjsWebSocketServer - WebSocket server for Yjs CRDT synchronization.
 *
 * Handles real-time collaborative editing by:
 * 1. Managing WebSocket connections
 * 2. Syncing Yjs document state to new clients
 * 3. Broadcasting updates between connected clients
 * 4. Cleaning up sessions on disconnect
 *
 * @module
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import type { Server as HttpServer } from 'node:http';
import { nanoid } from 'nanoid';
import * as Y from 'yjs';
import type { CollaborationService } from '@scribe/server-core';
import {
  type ClientMessage,
  type ServerMessage,
  parseClientMessage,
  encodeServerMessage,
  encodeBytes,
  decodeBytes,
} from './protocol.js';

/**
 * Internal representation of a WebSocket connection.
 */
interface Connection {
  /** WebSocket instance */
  ws: WebSocket;
  /** Unique identifier for this connection */
  clientId: string;
  /** Set of note IDs this client has joined */
  noteIds: Set<string>;
  /** Map of noteId → sessionId from CollaborationService */
  sessions: Map<string, string>;
}

/**
 * Configuration options for YjsWebSocketServer.
 */
export interface YjsWebSocketServerConfig {
  /** WebSocket path (default: '/ws') */
  path?: string;
}

/**
 * YjsWebSocketServer - Manages WebSocket connections for Yjs synchronization.
 *
 * @example
 * ```typescript
 * const httpServer = http.createServer(app);
 * const wsServer = new YjsWebSocketServer(collaborationService, httpServer);
 *
 * // Server is automatically started and listening on /ws
 * // Clean up on shutdown:
 * wsServer.close();
 * ```
 */
export class YjsWebSocketServer {
  /** Underlying WebSocket server */
  private readonly wss: WebSocketServer;

  /** Map of WebSocket → Connection info */
  private readonly connections: Map<WebSocket, Connection> = new Map();

  /** Map of noteId → Set of connected WebSockets */
  private readonly noteClients: Map<string, Set<WebSocket>> = new Map();

  /** Reference to collaboration service */
  private readonly collaborationService: CollaborationService;

  /** Whether the server has been closed */
  private closed = false;

  constructor(
    collaborationService: CollaborationService,
    server: HttpServer,
    config: YjsWebSocketServerConfig = {}
  ) {
    this.collaborationService = collaborationService;

    // Create WebSocket server attached to HTTP server
    this.wss = new WebSocketServer({
      server,
      path: config.path ?? '/ws',
    });

    // Set up connection handling
    this.wss.on('connection', (ws) => this.handleConnection(ws));

    // Set up update handler to broadcast changes from CollaborationService
    this.collaborationService.setUpdateHandler((update) => {
      this.broadcastUpdate(update.noteId, update.update, update.origin);
    });
  }

  /**
   * Handle a new WebSocket connection.
   */
  private handleConnection(ws: WebSocket): void {
    const clientId = nanoid(8);
    const connection: Connection = {
      ws,
      clientId,
      noteIds: new Set(),
      sessions: new Map(),
    };
    this.connections.set(ws, connection);

    ws.on('message', (data) => {
      this.handleRawMessage(connection, data);
    });

    ws.on('close', () => {
      this.handleDisconnect(connection);
    });

    ws.on('error', (err) => {
      console.error(`WebSocket error for client ${clientId}:`, err);
      // Clean up on error
      this.handleDisconnect(connection);
    });
  }

  /**
   * Handle raw message data from WebSocket.
   */
  private handleRawMessage(connection: Connection, data: RawData): void {
    try {
      // RawData can be Buffer, ArrayBuffer, or Buffer[]
      let strData: string;
      if (data instanceof Buffer) {
        strData = data.toString('utf-8');
      } else if (Array.isArray(data)) {
        strData = Buffer.concat(data).toString('utf-8');
      } else if (data instanceof ArrayBuffer) {
        strData = Buffer.from(new Uint8Array(data)).toString('utf-8');
      } else {
        // Handle other typed arrays
        strData = Buffer.from(data as unknown as Uint8Array).toString('utf-8');
      }

      const message = parseClientMessage(strData);
      this.handleMessage(connection, message);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Invalid message format';
      this.sendError(connection.ws, errorMsg, 'PARSE_ERROR');
    }
  }

  /**
   * Handle a parsed client message.
   */
  private async handleMessage(connection: Connection, message: ClientMessage): Promise<void> {
    switch (message.type) {
      case 'join':
        await this.handleJoin(connection, message.noteId);
        break;

      case 'leave':
        await this.handleLeave(connection, message.noteId);
        break;

      case 'sync-update':
        await this.handleSyncUpdate(connection, message.noteId, decodeBytes(message.update));
        break;
    }
  }

  /**
   * Handle client joining a document.
   */
  private async handleJoin(connection: Connection, noteId: string): Promise<void> {
    try {
      // Get or create Y.Doc and create session
      const doc = await this.collaborationService.getDoc(noteId);
      const session = await this.collaborationService.joinSession(noteId, connection.clientId);

      // Track session
      connection.sessions.set(noteId, session.id);
      connection.noteIds.add(noteId);

      // Track client for this note
      if (!this.noteClients.has(noteId)) {
        this.noteClients.set(noteId, new Set());
      }
      this.noteClients.get(noteId)!.add(connection.ws);

      // Send joined confirmation with state vector
      this.send(connection.ws, {
        type: 'joined',
        noteId,
        stateVector: encodeBytes(Y.encodeStateVector(doc)),
      });

      // Send full state
      this.send(connection.ws, {
        type: 'sync-state',
        noteId,
        state: encodeBytes(Y.encodeStateAsUpdate(doc)),
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Failed to join';
      this.sendError(connection.ws, errorMsg, 'JOIN_ERROR');
    }
  }

  /**
   * Handle client leaving a document.
   */
  private async handleLeave(connection: Connection, noteId: string): Promise<void> {
    const sessionId = connection.sessions.get(noteId);
    if (sessionId) {
      this.collaborationService.leaveSession(sessionId);
      connection.sessions.delete(noteId);
    }

    connection.noteIds.delete(noteId);
    this.noteClients.get(noteId)?.delete(connection.ws);

    // Clean up empty note client sets
    const clients = this.noteClients.get(noteId);
    if (clients && clients.size === 0) {
      this.noteClients.delete(noteId);
    }
  }

  /**
   * Handle client sending a Yjs update.
   */
  private async handleSyncUpdate(
    connection: Connection,
    noteId: string,
    update: Uint8Array
  ): Promise<void> {
    console.log(
      `[WS] Received sync-update from ${connection.clientId} for note ${noteId}, ${update.length} bytes`
    );

    // Verify client has joined this document
    if (!connection.noteIds.has(noteId)) {
      this.sendError(connection.ws, 'Not joined to this document', 'NOT_JOINED');
      return;
    }

    // Apply update via CollaborationService
    const applied = this.collaborationService.applyUpdate(noteId, update, connection.clientId);

    if (!applied) {
      this.sendError(connection.ws, 'Document not loaded', 'DOC_NOT_LOADED');
      return;
    }

    // Broadcast update to other clients directly
    // (CollaborationService's onUpdate handler is for local changes only)
    this.broadcastUpdate(noteId, update, connection.clientId);
  }

  /**
   * Broadcast an update to all clients connected to a note (except the origin).
   */
  private broadcastUpdate(noteId: string, update: Uint8Array, origin: string): void {
    const clients = this.noteClients.get(noteId);
    if (!clients) {
      console.log(`[WS] No clients for note ${noteId}, skipping broadcast`);
      return;
    }

    console.log(
      `[WS] Broadcasting to ${clients.size} clients for note ${noteId} (origin: ${origin})`
    );

    const message: ServerMessage = {
      type: 'sync-update',
      noteId,
      update: encodeBytes(update),
    };

    let sentCount = 0;
    for (const ws of clients) {
      const conn = this.connections.get(ws);
      // Don't send update back to the originator
      if (conn && conn.clientId !== origin) {
        this.send(ws, message);
        sentCount++;
      }
    }
    console.log(`[WS] Sent update to ${sentCount} clients`);
  }

  /**
   * Handle client disconnection.
   */
  private handleDisconnect(connection: Connection): void {
    // Leave all documents
    for (const [noteId, sessionId] of connection.sessions) {
      this.collaborationService.leaveSession(sessionId);
      this.noteClients.get(noteId)?.delete(connection.ws);

      // Clean up empty note client sets
      const clients = this.noteClients.get(noteId);
      if (clients && clients.size === 0) {
        this.noteClients.delete(noteId);
      }
    }

    this.connections.delete(connection.ws);
  }

  /**
   * Send a message to a WebSocket client.
   */
  private send(ws: WebSocket, message: ServerMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(encodeServerMessage(message));
    }
  }

  /**
   * Send an error message to a WebSocket client.
   */
  private sendError(ws: WebSocket, message: string, code?: string): void {
    this.send(ws, { type: 'error', message, code });
  }

  // ============================================================================
  // Public API for monitoring and control
  // ============================================================================

  /**
   * Get the number of active WebSocket connections.
   */
  getConnectionCount(): number {
    return this.connections.size;
  }

  /**
   * Get the number of clients connected to a specific note.
   */
  getNoteClientCount(noteId: string): number {
    return this.noteClients.get(noteId)?.size ?? 0;
  }

  /**
   * Get all notes with connected clients.
   */
  getActiveNoteIds(): string[] {
    return Array.from(this.noteClients.keys());
  }

  /**
   * Close the WebSocket server and disconnect all clients.
   */
  close(): Promise<void> {
    // Handle already closed
    if (this.closed) {
      return Promise.resolve();
    }
    this.closed = true;

    return new Promise((resolve, reject) => {
      // Close all client connections
      for (const [ws, connection] of this.connections) {
        // Clean up sessions
        for (const sessionId of connection.sessions.values()) {
          this.collaborationService.leaveSession(sessionId);
        }
        ws.close(1001, 'Server shutting down');
      }
      this.connections.clear();
      this.noteClients.clear();

      // Close the server
      this.wss.close((err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }
}
