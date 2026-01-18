/**
 * tRPC Router exports for @scribe/server-core.
 *
 * This module combines all routers into a single app router and exports:
 * - Individual routers for composition
 * - Combined appRouter for HTTP server integration
 * - AppRouter type for client type inference
 * - Context types and factories
 *
 * @module
 */

import { router } from './trpc.js';
import { notesRouter } from './notes.router.js';
import { searchRouter } from './search.router.js';
import { graphRouter } from './graph.router.js';
import { exportRouter } from './export.router.js';

// Re-export tRPC utilities
export { router, publicProcedure, procedure, createContextFactory, type Context } from './trpc.js';

// Re-export individual routers for composition
export { notesRouter } from './notes.router.js';
export { searchRouter } from './search.router.js';
export { graphRouter } from './graph.router.js';
export { exportRouter } from './export.router.js';
export type { ExportRouter } from './export.router.js';

/**
 * Combined application router.
 *
 * Contains all API endpoints:
 * - notes: CRUD operations for notes
 * - search: Full-text search
 * - graph: Knowledge graph queries (backlinks, tags, etc.)
 * - export: Export notes to various formats
 *
 * @example
 * ```typescript
 * import { createHTTPServer } from '@trpc/server/adapters/standalone';
 * import { appRouter, createContextFactory } from '@scribe/server-core';
 *
 * const services = createServices({ vaultPath: '...', dbPath: '...' });
 *
 * const server = createHTTPServer({
 *   router: appRouter,
 *   createContext: createContextFactory(services),
 * });
 *
 * server.listen(3000);
 * ```
 */
export const appRouter = router({
  /** Notes CRUD operations */
  notes: notesRouter,
  /** Full-text search */
  search: searchRouter,
  /** Graph queries (backlinks, tags, stats) */
  graph: graphRouter,
  /** Export notes to various formats */
  export: exportRouter,
});

/**
 * Type of the application router.
 *
 * Export this type for client-side type inference.
 * The client SDK will use this to provide full type safety.
 *
 * @example
 * ```typescript
 * // In client-sdk
 * import type { AppRouter } from '@scribe/server-core';
 * import { createTRPCProxyClient, httpBatchLink } from '@trpc/client';
 *
 * const client = createTRPCProxyClient<AppRouter>({
 *   links: [httpBatchLink({ url: 'http://localhost:3000/trpc' })],
 * });
 *
 * // Full type inference
 * const notes = await client.notes.list.query();
 * //    ^? NoteMetadata[]
 * ```
 */
export type AppRouter = typeof appRouter;
