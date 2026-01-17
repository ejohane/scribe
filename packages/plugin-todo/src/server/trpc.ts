/**
 * tRPC Setup for the Todo Plugin
 *
 * This module provides the plugin-specific tRPC setup. We use a separate
 * tRPC instance to ensure plugin routers are properly typed and isolated
 * from the main application's tRPC configuration.
 *
 * @module
 */

import { initTRPC, TRPCError } from '@trpc/server';

/**
 * Initialize a tRPC instance for the plugin.
 *
 * Note: Each plugin has its own tRPC instance to maintain proper
 * type isolation and prevent conflicts with the core application.
 */
const t = initTRPC.create();

/**
 * The tRPC router builder for creating plugin routers.
 */
export const router = t.router;

/**
 * Public procedure that any client can call.
 * Use this for most CRUD operations.
 */
export const publicProcedure = t.procedure;

/**
 * Re-export TRPCError for use in router procedures.
 */
export { TRPCError };
