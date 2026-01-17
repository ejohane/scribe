/**
 * @scribe/client-sdk
 *
 * Framework-agnostic client SDK for Scribe daemon.
 * Provides tRPC and WebSocket communication with the daemon.
 */

export const VERSION = '0.0.0';

// Main client - primary export
export { ScribeClient } from './client.js';

export type { ScribeClientOptions, ClientStatus, ScribeClientEvents } from './client.js';

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

// API client module
export {
  createApiClient,
  createApiClientFromInfo,
  isTRPCClientError,
  getApiClientUrl,
} from './api-client.js';

export type { ApiClient, ApiClientOptions } from './api-client.js';

// Error handling module
export { ApiError, isApiError, isNotFoundError, isNetworkError } from './errors.js';

export type { ApiErrorCode } from './errors.js';

// Collab client module
export { CollabClient } from './collab-client.js';

export type { CollabClientOptions, CollabClientEvents, DocumentSession } from './collab-client.js';

// Re-export types from server-core for convenience
// These types are useful when working with API responses
export type {
  // Router types for advanced usage
  AppRouter,
  ExportRouter,
  // Note types
  NoteDocument,
  NoteMetadata,
  NoteFile,
  CreateNoteOptions,
  UpdateNoteOptions,
  NoteListFilter,
  // Search types
  SearchQuery,
  SearchFilters,
  SearchOptions,
  SearchResult,
  SearchResultNote,
  MatchLocation,
  SearchSuggestion,
  ReindexResult,
  // Graph types
  GraphNode,
  LinkInfo,
  TagInfo,
  GraphStats,
  // Editor types
  LexicalNode,
  EditorContent,
  ExtractedLink,
} from '@scribe/server-core';
