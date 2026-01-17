/**
 * @scribe/scribed
 *
 * Background daemon server for Scribe.
 * Provides API endpoints for document management, graph operations, search, and collaboration.
 */

export const VERSION = '0.1.0';

// Daemon exports
export {
  Daemon,
  getExistingDaemon,
  getDaemonInfoPath,
  type DaemonConfig,
  type DaemonInfo,
  type HealthResponse,
} from './daemon.js';

// Discovery exports
export {
  discoverDaemon,
  waitForDaemon,
  getTrpcUrl,
  getWebSocketUrl,
  getHealthUrl,
  type DiscoverOptions,
  type DiscoveryResult,
} from './discovery.js';

// WebSocket server exports
export {
  YjsWebSocketServer,
  type YjsWebSocketServerConfig,
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
} from './ws/index.js';

// Plugin system exports
export {
  // Functions
  buildAppRouter,
  collectPluginRouters,
  validateNamespace,
  validateNamespaceFormat,
  isReservedNamespace,
  wrapPluginRouter,
  handlePluginRouterError,
  clearRouterLifecycleMap,
  getAllNamespaces,
  isNamespaceAvailable,
  // Constants
  RESERVED_NAMESPACES,
  // Error classes
  NamespaceValidationError,
  // Types
  type PluginRouterEntry,
  type BuildRouterResult,
  type RouterFactory,
  type ReservedNamespace,
} from './plugins/index.js';
