/**
 * Core type definitions for Scribe
 *
 * This file re-exports all types from the types/ directory for backwards compatibility.
 * New code should import directly from specific modules:
 *
 * - '@scribe/shared/types/note-types' - Note identifiers, metadata, and note variants
 * - '@scribe/shared/types/editor-types' - Editor content abstraction
 * - '@scribe/shared/types/graph-types' - Knowledge graph visualization
 * - '@scribe/shared/types/search-types' - Full-text search results
 *
 * Or continue importing from '@scribe/shared/types' for all types.
 */

export * from './types/index.js';
