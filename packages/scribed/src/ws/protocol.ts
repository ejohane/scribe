/**
 * WebSocket Protocol Types for Yjs Synchronization
 *
 * Defines message types exchanged between clients and the Yjs WebSocket server.
 *
 * @module
 */

// ============================================================================
// Client → Server Messages
// ============================================================================

/**
 * Client request to join a document for collaborative editing.
 */
export interface JoinMessage {
  type: 'join';
  /** The note ID to join */
  noteId: string;
}

/**
 * Client request to leave a document.
 */
export interface LeaveMessage {
  type: 'leave';
  /** The note ID to leave */
  noteId: string;
}

/**
 * Client sending a Yjs update to the server.
 */
export interface SyncUpdateMessage {
  type: 'sync-update';
  /** The note ID being updated */
  noteId: string;
  /** Base64-encoded Yjs update */
  update: string;
}

/**
 * Union type for all client messages.
 */
export type ClientMessage = JoinMessage | LeaveMessage | SyncUpdateMessage;

// ============================================================================
// Server → Client Messages
// ============================================================================

/**
 * Server confirmation that client has joined a document.
 */
export interface JoinedMessage {
  type: 'joined';
  /** The note ID that was joined */
  noteId: string;
  /** Base64-encoded state vector of the document */
  stateVector: string;
}

/**
 * Server sending the full document state.
 */
export interface SyncStateMessage {
  type: 'sync-state';
  /** The note ID */
  noteId: string;
  /** Base64-encoded full document state */
  state: string;
}

/**
 * Server broadcasting an update from another client.
 */
export interface BroadcastUpdateMessage {
  type: 'sync-update';
  /** The note ID being updated */
  noteId: string;
  /** Base64-encoded Yjs update */
  update: string;
}

/**
 * Server sending an error message.
 */
export interface ErrorMessage {
  type: 'error';
  /** Error message */
  message: string;
  /** Optional error code */
  code?: string;
}

/**
 * Union type for all server messages.
 */
export type ServerMessage =
  | JoinedMessage
  | SyncStateMessage
  | BroadcastUpdateMessage
  | ErrorMessage;

// ============================================================================
// Encoding/Decoding Utilities
// ============================================================================

/**
 * Encode a Uint8Array to a base64 string.
 */
export function encodeBytes(data: Uint8Array): string {
  return Buffer.from(data).toString('base64');
}

/**
 * Decode a base64 string to a Uint8Array.
 */
export function decodeBytes(base64: string): Uint8Array {
  return new Uint8Array(Buffer.from(base64, 'base64'));
}

/**
 * Encode a server message to JSON string for transmission.
 */
export function encodeServerMessage(message: ServerMessage): string {
  return JSON.stringify(message);
}

/**
 * Parse a client message from JSON string.
 *
 * @throws Error if message is invalid
 */
export function parseClientMessage(data: string | Buffer): ClientMessage {
  const str = typeof data === 'string' ? data : data.toString('utf-8');
  const json = JSON.parse(str);

  if (!json || typeof json !== 'object') {
    throw new Error('Invalid message: not an object');
  }

  if (!json.type) {
    throw new Error('Invalid message: missing type');
  }

  switch (json.type) {
    case 'join':
      if (typeof json.noteId !== 'string') {
        throw new Error('Invalid join message: missing noteId');
      }
      return { type: 'join', noteId: json.noteId };

    case 'leave':
      if (typeof json.noteId !== 'string') {
        throw new Error('Invalid leave message: missing noteId');
      }
      return { type: 'leave', noteId: json.noteId };

    case 'sync-update':
      if (typeof json.noteId !== 'string') {
        throw new Error('Invalid sync-update message: missing noteId');
      }
      if (typeof json.update !== 'string') {
        throw new Error('Invalid sync-update message: missing update');
      }
      return { type: 'sync-update', noteId: json.noteId, update: json.update };

    default:
      throw new Error(`Invalid message: unknown type ${json.type}`);
  }
}

// ============================================================================
// Type Guards
// ============================================================================

/**
 * Check if a message is a ClientMessage.
 */
export function isClientMessage(msg: unknown): msg is ClientMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as { type?: unknown };
  return m.type === 'join' || m.type === 'leave' || m.type === 'sync-update';
}

/**
 * Check if a message is a ServerMessage.
 */
export function isServerMessage(msg: unknown): msg is ServerMessage {
  if (!msg || typeof msg !== 'object') return false;
  const m = msg as { type?: unknown };
  return (
    m.type === 'joined' || m.type === 'sync-state' || m.type === 'sync-update' || m.type === 'error'
  );
}
