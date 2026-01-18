/**
 * API Client - Type-safe tRPC client for Scribe daemon.
 *
 * Creates a tRPC proxy client that connects to the daemon's API.
 * All methods are fully typed based on the server's AppRouter.
 *
 * @module
 */

import { createTRPCProxyClient, httpBatchLink, TRPCClientError } from '@trpc/client';
import type { AppRouter } from '@scribe/server-core';
import { getTrpcUrl, type DaemonInfo } from './discovery.js';

/**
 * Options for creating an API client.
 */
export interface ApiClientOptions {
  /** Port the daemon is listening on */
  port: number;
  /** Host address (default: '127.0.0.1') */
  host?: string;
  /** Maximum URL length before switching to POST (default: 2000) */
  maxURLLength?: number;
}

/**
 * Type of the API client.
 *
 * This is a tRPC proxy client with full type inference.
 *
 * @example
 * ```typescript
 * const client: ApiClient = createApiClient({ port: 47832 });
 *
 * // All methods are typed
 * const notes = await client.notes.list.query();
 * //    ^? NoteMetadata[]
 * ```
 */
export type ApiClient = ReturnType<typeof createTRPCProxyClient<AppRouter>>;

/**
 * Create a type-safe tRPC client for the Scribe daemon.
 *
 * The client provides full type inference for all API endpoints:
 * - `notes`: CRUD operations for notes
 * - `search`: Full-text search
 * - `graph`: Knowledge graph queries (backlinks, tags, etc.)
 * - `export`: Export notes to various formats
 *
 * @param options - Client options (port required)
 * @returns tRPC proxy client with full type inference
 *
 * @example
 * ```typescript
 * // Create client
 * const api = createApiClient({ port: 47832 });
 *
 * // Notes operations
 * const notes = await api.notes.list.query({ limit: 10 });
 * const note = await api.notes.get.query('note-id');
 * const created = await api.notes.create.mutate({
 *   title: 'New Note',
 *   type: 'note',
 * });
 *
 * // Search
 * const results = await api.search.query.query({ text: 'hello' });
 *
 * // Graph queries
 * const backlinks = await api.graph.backlinks.query('note-id');
 * const tags = await api.graph.tags.query();
 *
 * // Export
 * const exported = await api.export.toMarkdown.query({ noteId: 'note-id' });
 * console.log(exported.markdown);
 * ```
 */
export function createApiClient(options: ApiClientOptions): ApiClient {
  const host = options.host ?? '127.0.0.1';
  const baseUrl = `http://${host}:${options.port}`;

  return createTRPCProxyClient<AppRouter>({
    links: [
      httpBatchLink({
        url: `${baseUrl}/trpc`,
        // Batch requests for efficiency - switch to POST for long URLs
        maxURLLength: options.maxURLLength ?? 2000,
      }),
    ],
  });
}

/**
 * Create an API client from daemon info.
 *
 * Convenience function that extracts the port from DaemonInfo.
 *
 * @param info - Daemon info from discovery
 * @returns tRPC proxy client
 *
 * @example
 * ```typescript
 * const info = await discoverDaemon();
 * if (info) {
 *   const api = createApiClientFromInfo(info);
 *   const notes = await api.notes.list.query();
 * }
 * ```
 */
export function createApiClientFromInfo(info: DaemonInfo): ApiClient {
  return createApiClient({ port: info.port });
}

/**
 * Check if an error is a tRPC client error.
 *
 * @param err - Error to check
 * @returns true if error is a TRPCClientError
 */
export function isTRPCClientError(err: unknown): err is TRPCClientError<AppRouter> {
  return err instanceof TRPCClientError;
}

/**
 * Get the tRPC URL for an API client configuration.
 *
 * Useful for debugging or displaying the endpoint.
 *
 * @param options - Client options
 * @returns URL string
 */
export function getApiClientUrl(options: ApiClientOptions): string {
  const host = options.host ?? '127.0.0.1';
  return `http://${host}:${options.port}/trpc`;
}

// Re-export getTrpcUrl for convenience
export { getTrpcUrl };
