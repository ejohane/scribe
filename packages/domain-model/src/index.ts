/**
 * @scribe/domain-model
 *
 * Shared type definitions for the Scribe application.
 * This package contains all core data structures, entity models, and interfaces
 * used throughout the Core Engine, UI, and other subsystems.
 */

// Primitives
export * from './primitives.js';

// Entity models
export * from './note.js';
export * from './person.js';
export * from './tag.js';
export * from './folder.js';
export * from './heading.js';
export * from './embed.js';

// Indices and registries
export * from './registry.js';
export * from './graph.js';
export * from './unlinked-mentions.js';

// Application state
export * from './app-state.js';
