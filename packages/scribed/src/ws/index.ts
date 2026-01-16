/**
 * WebSocket module for Yjs synchronization.
 *
 * @module
 */

export { YjsWebSocketServer, type YjsWebSocketServerConfig } from './server.js';

export {
  type ClientMessage,
  type ServerMessage,
  type JoinMessage,
  type LeaveMessage,
  type SyncUpdateMessage,
  type JoinedMessage,
  type SyncStateMessage,
  type BroadcastUpdateMessage,
  type ErrorMessage,
  encodeBytes,
  decodeBytes,
  encodeServerMessage,
  parseClientMessage,
  isClientMessage,
  isServerMessage,
} from './protocol.js';
