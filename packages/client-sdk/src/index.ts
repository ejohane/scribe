/**
 * @scribe/client-sdk
 *
 * Framework-agnostic client SDK for Scribe daemon.
 * Provides tRPC and WebSocket communication with the daemon.
 */

export const VERSION = '0.0.0';

// Discovery module
export {
  discoverDaemon,
  waitForDaemon,
  createManualDaemonInfo,
  getTrpcUrl,
  getWebSocketUrl,
  getHealthUrl,
  getDefaultConfigPath,
} from './discovery.js';

export type {
  DaemonInfo,
  DiscoveryOptions,
  HealthResponse,
  ManualDaemonConfig,
} from './discovery.js';
