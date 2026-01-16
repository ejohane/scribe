/**
 * tRPC initialization for Scribe server.
 *
 * Sets up the tRPC instance with context, providing type-safe
 * access to services throughout the router tree.
 *
 * @module
 */

import { initTRPC, TRPCError } from '@trpc/server';
import type { Services } from '../container.js';
import { isDocumentError } from '../errors.js';

/**
 * Context available to all procedures.
 * Contains the service container for accessing business logic.
 */
export interface Context {
  /** All instantiated services */
  services: Services;
}

/**
 * Create a context factory for tRPC.
 *
 * @param services - The service container
 * @returns A context factory function
 *
 * @example
 * ```typescript
 * const services = createServices({ vaultPath: '...', dbPath: '...' });
 * const createContext = createContextFactory(services);
 *
 * // Use with HTTP adapter
 * createHTTPServer({
 *   router: appRouter,
 *   createContext,
 * });
 * ```
 */
export function createContextFactory(services: Services) {
  return (): Context => ({ services });
}

// Initialize tRPC with context type
const t = initTRPC.context<Context>().create({
  errorFormatter({ shape, error }) {
    return {
      ...shape,
      data: {
        ...shape.data,
        // Include document error code if available
        documentErrorCode: isDocumentError(error.cause) ? error.cause.code : undefined,
      },
    };
  },
});

/**
 * Create a tRPC router.
 */
export const router = t.router;

/**
 * Create a public procedure (no auth required).
 */
export const publicProcedure = t.procedure;

/**
 * Middleware to handle DocumentErrors and convert to TRPCErrors.
 */
export const withErrorHandling = t.middleware(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (isDocumentError(error)) {
      switch (error.code) {
        case 'NOTE_NOT_FOUND':
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: error.message,
            cause: error,
          });
        case 'FILE_READ_ERROR':
        case 'FILE_WRITE_ERROR':
        case 'FILE_DELETE_ERROR':
        case 'INDEX_ERROR':
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            cause: error,
          });
        case 'INVALID_CONTENT':
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: error.message,
            cause: error,
          });
        default:
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: error.message,
            cause: error,
          });
      }
    }
    throw error;
  }
});

/**
 * Procedure with error handling middleware.
 */
export const procedure = publicProcedure.use(withErrorHandling);
