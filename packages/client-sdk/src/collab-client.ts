/**
 * CollabClient - WebSocket client for Yjs CRDT synchronization.
 *
 * Handles real-time collaborative editing by:
 * 1. Managing WebSocket connection to the Scribe daemon
 * 2. Syncing Yjs document state from the server
 * 3. Sending local updates to the server
 * 4. Receiving updates from other clients
 *
 * @module
 */

import * as Y from 'yjs';
import type { WebSocket as NodeWebSocket } from 'ws';

// Server message types (matching scribed/ws/protocol.ts)
interface JoinedMessage {
  type: 'joined';
  noteId: string;
  stateVector: string;
}

interface SyncStateMessage {
  type: 'sync-state';
  noteId: string;
  state: string;
}

interface SyncUpdateMessage {
  type: 'sync-update';
  noteId: string;
  update: string;
}

interface ErrorMessage {
  type: 'error';
  message: string;
  code?: string;
}

type ServerMessage = JoinedMessage | SyncStateMessage | SyncUpdateMessage | ErrorMessage;

/**
 * Options for creating a CollabClient.
 */
export interface CollabClientOptions {
  /** Port the daemon is listening on */
  port: number;
  /** Host address (default: '127.0.0.1') */
  host?: string;
}

/**
 * Represents an active document editing session.
 */
export interface DocumentSession {
  /** The note ID being edited */
  noteId: string;
  /** The Yjs document for this session */
  doc: Y.Doc;
  /** Destroy this session and leave the document */
  destroy(): void;
}

/**
 * Event types emitted by CollabClient.
 */
export interface CollabClientEvents {
  connected: [];
  disconnected: [];
  error: [Error];
  'document-updated': [{ noteId: string; update: Uint8Array }];
}

/**
 * Event listener function type.
 */
type EventListener<T extends unknown[]> = (...args: T) => void;

// Use a union type for browser WebSocket and Node WebSocket
type WebSocketLike = WebSocket | NodeWebSocket;

/**
 * CollabClient - WebSocket client for Yjs synchronization.
 *
 * Provides real-time collaborative editing by managing WebSocket
 * connections to the Scribe daemon and synchronizing Yjs documents.
 *
 * @example
 * ```typescript
 * const collab = new CollabClient({ port: 47832 });
 * await collab.connect();
 *
 * // Join a document for editing
 * const session = await collab.joinDocument('note-id');
 *
 * // Get the Y.Doc and make changes
 * const yText = session.doc.getText('content');
 * yText.insert(0, 'Hello');
 *
 * // Changes are automatically synced to server and other clients
 *
 * // Leave when done
 * session.destroy();
 *
 * // Or disconnect entirely
 * collab.disconnect();
 * ```
 */
export class CollabClient {
  /** WebSocket connection */
  private ws: WebSocketLike | null = null;

  /** Map of noteId → Y.Doc */
  private documents: Map<string, Y.Doc> = new Map();

  /** Map of noteId → update handler bound to that doc */
  private updateHandlers: Map<string, (update: Uint8Array, origin: unknown) => void> = new Map();

  /** Timer for reconnection attempts */
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;

  /** Number of reconnection attempts */
  private connectionAttempts = 0;

  /** Maximum reconnection attempts */
  private readonly maxReconnectAttempts = 5;

  /** Event listeners */
  private listeners: Map<keyof CollabClientEvents, Set<EventListener<unknown[]>>> = new Map();

  /** Pending sync promises for documents */
  private pendingSyncs: Map<string, { resolve: () => void; reject: (err: Error) => void }> =
    new Map();

  /**
   * Create a new CollabClient.
   *
   * @param options - Client options (port required)
   */
  constructor(private options: CollabClientOptions) {}

  /**
   * Connect to the WebSocket server.
   *
   * @returns Promise that resolves when connected
   * @throws Error if connection fails
   *
   * @example
   * ```typescript
   * const collab = new CollabClient({ port: 47832 });
   * await collab.connect();
   * console.log('Connected!');
   * ```
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const host = this.options.host ?? '127.0.0.1';
      const url = `ws://${host}:${this.options.port}/ws`;

      // Use dynamic import for WebSocket to support both Node.js and browser
      const WebSocketImpl = this.getWebSocketImpl();
      this.ws = new WebSocketImpl(url) as WebSocketLike;

      const onOpen = () => {
        this.connectionAttempts = 0;
        this.emit('connected');
        resolve();
      };

      const onError = () => {
        reject(new Error('WebSocket connection failed'));
      };

      // Handle events based on environment
      if (this.isBrowserWebSocket(this.ws)) {
        this.ws.onopen = onOpen;
        this.ws.onerror = onError;
        this.ws.onclose = () => {
          this.emit('disconnected');
          this.scheduleReconnect();
        };
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data as string);
        };
      } else {
        // Node.js WebSocket (ws library)
        this.ws.on('open', onOpen);
        this.ws.on('error', onError);
        this.ws.on('close', () => {
          this.emit('disconnected');
          this.scheduleReconnect();
        });
        this.ws.on('message', (data: Buffer | string) => {
          const str = typeof data === 'string' ? data : data.toString('utf-8');
          this.handleMessage(str);
        });
      }
    });
  }

  /**
   * Disconnect from the WebSocket server.
   *
   * Closes the WebSocket connection and cleans up all document sessions.
   *
   * @example
   * ```typescript
   * collab.disconnect();
   * ```
   */
  disconnect(): void {
    // Cancel reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Close WebSocket
    if (this.ws) {
      // Remove listeners to prevent reconnect
      if (this.isBrowserWebSocket(this.ws)) {
        this.ws.onclose = null;
      } else {
        this.ws.removeAllListeners?.();
      }
      // Only close if connection was established (readyState > 0)
      // ws library throws if close() is called during CONNECTING state
      if (this.ws.readyState !== 0) {
        this.ws.close();
      }
      this.ws = null;
    }

    // Clean up all documents
    for (const [noteId, doc] of this.documents) {
      const handler = this.updateHandlers.get(noteId);
      if (handler) {
        doc.off('update', handler);
      }
      doc.destroy();
    }
    this.documents.clear();
    this.updateHandlers.clear();

    // Reject any pending syncs
    for (const [, pending] of this.pendingSyncs) {
      pending.reject(new Error('Disconnected'));
    }
    this.pendingSyncs.clear();
  }

  /**
   * Join a document for collaborative editing.
   *
   * Creates or retrieves a Y.Doc for the given note ID and syncs
   * with the server. Local changes are automatically sent to the
   * server, and remote changes are applied to the local doc.
   *
   * @param noteId - The note ID to join
   * @returns Document session with the synced Y.Doc
   * @throws Error if not connected or sync times out
   *
   * @example
   * ```typescript
   * const session = await collab.joinDocument('my-note');
   *
   * // Use the Y.Doc
   * const yText = session.doc.getText('content');
   * yText.observe(() => {
   *   console.log('Content changed:', yText.toString());
   * });
   *
   * // Make changes
   * yText.insert(0, 'Hello, world!');
   *
   * // Leave when done
   * session.destroy();
   * ```
   */
  async joinDocument(noteId: string): Promise<DocumentSession> {
    if (!this.ws || !this.isOpen()) {
      throw new Error('Not connected to collaboration server');
    }

    // Check if already joined
    const existing = this.documents.get(noteId);
    if (existing) {
      return {
        noteId,
        doc: existing,
        destroy: () => this.leaveDocument(noteId),
      };
    }

    // Create local Y.Doc
    const doc = new Y.Doc();
    console.log(`[CollabClient] Created Y.Doc with guid: ${doc.guid}`);
    this.documents.set(noteId, doc);

    // Set up local change handler
    const updateHandler = (update: Uint8Array, origin: unknown) => {
      console.log(`[CollabClient] Doc update event, origin: ${origin}`);
      if (origin !== 'remote') {
        // Send local changes to server
        this.sendUpdate(noteId, update);
      } else {
        console.log(`[CollabClient] Skipping remote origin update`);
      }
    };
    this.updateHandlers.set(noteId, updateHandler);
    doc.on('update', updateHandler);

    // Send join message
    this.send({ type: 'join', noteId });

    // Wait for initial sync state
    await this.waitForSync(noteId);

    return {
      noteId,
      doc,
      destroy: () => this.leaveDocument(noteId),
    };
  }

  /**
   * Leave a document.
   *
   * Stops synchronization and cleans up the local Y.Doc.
   *
   * @param noteId - The note ID to leave
   *
   * @example
   * ```typescript
   * collab.leaveDocument('my-note');
   * ```
   */
  leaveDocument(noteId: string): void {
    const doc = this.documents.get(noteId);
    if (!doc) return;

    // Send leave message
    if (this.ws && this.isOpen()) {
      this.send({ type: 'leave', noteId });
    }

    // Clean up update handler
    const handler = this.updateHandlers.get(noteId);
    if (handler) {
      doc.off('update', handler);
      this.updateHandlers.delete(noteId);
    }

    // Clean up doc
    doc.destroy();
    this.documents.delete(noteId);
  }

  /**
   * Check if connected to the server.
   *
   * @returns true if WebSocket is open
   */
  get isConnected(): boolean {
    return this.ws !== null && this.isOpen();
  }

  /**
   * Get the list of currently joined document IDs.
   *
   * @returns Array of note IDs
   */
  getJoinedDocuments(): string[] {
    return Array.from(this.documents.keys());
  }

  /**
   * Get a document by ID if joined.
   *
   * @param noteId - The note ID
   * @returns The Y.Doc if joined, undefined otherwise
   */
  getDocument(noteId: string): Y.Doc | undefined {
    return this.documents.get(noteId);
  }

  // ============================================================================
  // Event Emitter Interface
  // ============================================================================

  /**
   * Add an event listener.
   *
   * @param event - Event name
   * @param listener - Event handler function
   *
   * @example
   * ```typescript
   * collab.on('connected', () => console.log('Connected!'));
   * collab.on('error', (err) => console.error('Error:', err));
   * ```
   */
  on<K extends keyof CollabClientEvents>(
    event: K,
    listener: EventListener<CollabClientEvents[K]>
  ): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(listener as EventListener<unknown[]>);
  }

  /**
   * Remove an event listener.
   *
   * @param event - Event name
   * @param listener - Event handler function to remove
   */
  off<K extends keyof CollabClientEvents>(
    event: K,
    listener: EventListener<CollabClientEvents[K]>
  ): void {
    this.listeners.get(event)?.delete(listener as EventListener<unknown[]>);
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  /**
   * Get the WebSocket implementation for the current environment.
   */
  private getWebSocketImpl(): typeof WebSocket {
    // In Node.js, we need to use the ws library
    // In browser, use native WebSocket
    if (typeof globalThis.WebSocket !== 'undefined') {
      return globalThis.WebSocket;
    }
    // Dynamic require for Node.js (will be handled by bundler)
    return require('ws') as typeof WebSocket;
  }

  /**
   * Check if WebSocket is a browser WebSocket.
   */
  private isBrowserWebSocket(ws: WebSocketLike): ws is WebSocket {
    return typeof globalThis.WebSocket !== 'undefined' && ws instanceof globalThis.WebSocket;
  }

  /**
   * Check if WebSocket is open.
   */
  private isOpen(): boolean {
    if (!this.ws) return false;
    // WebSocket.OPEN is 1 in both browser and Node.js
    return this.ws.readyState === 1;
  }

  /**
   * Handle incoming WebSocket message.
   */
  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data) as ServerMessage;

      switch (message.type) {
        case 'joined':
          // Document join confirmed - state will follow
          console.log(`[CollabClient] Joined note: ${message.noteId}`);
          break;

        case 'sync-state':
          // Apply initial state
          console.log(`[CollabClient] Received sync-state for note: ${message.noteId}`);
          this.applyState(message.noteId, this.decodeBytes(message.state));
          break;

        case 'sync-update':
          // Apply incremental update
          console.log(`[CollabClient] Received sync-update for note: ${message.noteId}`);
          this.applyUpdate(message.noteId, this.decodeBytes(message.update));
          break;

        case 'error':
          this.emit('error', new Error(message.message));
          break;
      }
    } catch {
      // Silently ignore malformed messages
    }
  }

  /**
   * Apply initial document state.
   */
  private applyState(noteId: string, state: Uint8Array): void {
    const doc = this.documents.get(noteId);
    if (!doc) return;

    Y.applyUpdate(doc, state, 'remote');

    // Resolve pending sync
    const pending = this.pendingSyncs.get(noteId);
    if (pending) {
      pending.resolve();
      this.pendingSyncs.delete(noteId);
    }
  }

  /**
   * Apply incremental update from server.
   */
  private applyUpdate(noteId: string, update: Uint8Array): void {
    const doc = this.documents.get(noteId);
    if (!doc) return;

    Y.applyUpdate(doc, update, 'remote');
    this.emit('document-updated', { noteId, update });
  }

  /**
   * Send a local update to the server.
   */
  private sendUpdate(noteId: string, update: Uint8Array): void {
    console.log(`[CollabClient] Sending sync-update for note: ${noteId}, ${update.length} bytes`);
    this.send({
      type: 'sync-update',
      noteId,
      update: this.encodeBytes(update),
    });
  }

  /**
   * Send a message to the server.
   */
  private send(message: { type: string; noteId: string; update?: string }): void {
    if (!this.ws || !this.isOpen()) {
      return;
    }

    this.ws.send(JSON.stringify(message));
  }

  /**
   * Schedule a reconnection attempt.
   */
  private scheduleReconnect(): void {
    if (this.connectionAttempts >= this.maxReconnectAttempts) {
      this.emit('error', new Error('Max reconnection attempts reached'));
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.connectionAttempts), 10000);
    this.connectionAttempts++;

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Will reschedule on failure
      });
    }, delay);
  }

  /**
   * Wait for document sync to complete.
   */
  private waitForSync(noteId: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pendingSyncs.delete(noteId);
        reject(new Error('Sync timeout'));
      }, 10000);

      this.pendingSyncs.set(noteId, {
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        },
        reject: (err) => {
          clearTimeout(timeout);
          reject(err);
        },
      });
    });
  }

  /**
   * Emit an event to listeners.
   */
  private emit<K extends keyof CollabClientEvents>(event: K, ...args: CollabClientEvents[K]): void {
    const eventListeners = this.listeners.get(event);
    if (eventListeners) {
      for (const listener of eventListeners) {
        try {
          listener(...args);
        } catch {
          // Silently ignore listener errors to prevent cascade failures
        }
      }
    }
  }

  /**
   * Encode Uint8Array to base64 string.
   */
  private encodeBytes(data: Uint8Array): string {
    // Use Buffer in Node.js, btoa in browser
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(data).toString('base64');
    }
    // Browser fallback
    let binary = '';
    for (let i = 0; i < data.length; i++) {
      binary += String.fromCharCode(data[i]);
    }
    return btoa(binary);
  }

  /**
   * Decode base64 string to Uint8Array.
   */
  private decodeBytes(base64: string): Uint8Array {
    // Use Buffer in Node.js, atob in browser
    if (typeof Buffer !== 'undefined') {
      return new Uint8Array(Buffer.from(base64, 'base64'));
    }
    // Browser fallback
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  }
}
