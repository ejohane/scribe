/**
 * @scribe/plugin-core
 *
 * Core type definitions and utilities for the Scribe plugin system.
 *
 * This package provides the foundational types that define the contract
 * between Scribe and plugins. All plugins must implement interfaces
 * exported from this package.
 *
 * @example
 * ```typescript
 * import type {
 *   PluginManifest,
 *   ServerPlugin,
 *   ServerPluginContext,
 * } from '@scribe/plugin-core';
 *
 * const manifest: PluginManifest = {
 *   id: '@scribe/plugin-todo',
 *   version: '1.0.0',
 *   name: 'Todo Plugin',
 *   capabilities: [
 *     { type: 'trpc-router', namespace: 'todos' },
 *   ],
 * };
 *
 * export function createPlugin(ctx: ServerPluginContext): ServerPlugin {
 *   return {
 *     manifest,
 *     router: todosRouter,
 *   };
 * }
 * ```
 *
 * @module
 */

// ============================================================================
// Plugin Manifest Types
// ============================================================================

export type { PluginManifest } from './plugin-types.js';

// ============================================================================
// Plugin Capability Types
// ============================================================================

export type {
  PluginCapability,
  TrpcRouterCapability,
  StorageCapability,
  EventHookCapability,
  SidebarPanelCapability,
  SlashCommandCapability,
} from './plugin-types.js';

// ============================================================================
// Plugin Event Types
// ============================================================================

export type {
  PluginEventType,
  PluginEvent,
  NoteCreatedEvent,
  NoteUpdatedEvent,
  NoteDeletedEvent,
  PluginEventHandlers,
} from './plugin-types.js';

// ============================================================================
// Plugin Context Types
// ============================================================================

export type {
  PluginLogger,
  PluginStorage,
  PluginEventEmitter,
  ServerPluginContext,
  ClientPluginContext,
  TRPCClientLike,
} from './plugin-types.js';

// ============================================================================
// Plugin Instance Types
// ============================================================================

export type {
  ServerPlugin,
  ClientPlugin,
  SlashCommandHandler,
  SlashCommandArgs,
} from './plugin-types.js';

// ============================================================================
// Plugin Factory Types
// ============================================================================

export type { ServerPluginFactory, ClientPluginFactory } from './plugin-types.js';

// ============================================================================
// Type Guard Utilities
// ============================================================================

export {
  isTrpcRouterCapability,
  isStorageCapability,
  isEventHookCapability,
  isSidebarPanelCapability,
  isSlashCommandCapability,
  hasCapability,
  getCapabilitiesByType,
} from './plugin-types.js';

// ============================================================================
// Plugin Manifest Validation (Zod Schemas)
// ============================================================================

export {
  // Schemas
  pluginManifestSchema,
  pluginCapabilitySchema,
  trpcRouterCapabilitySchema,
  storageCapabilitySchema,
  eventHookCapabilitySchema,
  sidebarPanelCapabilitySchema,
  slashCommandCapabilitySchema,
  // Validation helpers
  validateManifest,
  safeValidateManifest,
  validateCapability,
  // Error class
  PluginManifestError,
} from './plugin-manifest.schema.js';

export type {
  PluginManifestFromSchema,
  PluginCapabilityFromSchema,
} from './plugin-manifest.schema.js';

// ============================================================================
// Plugin Registry
// ============================================================================

export { PluginRegistry, PluginConflictError } from './plugin-registry.js';

export type {
  PluginStatus,
  RegisteredPlugin,
  TrpcRouterEntry,
  StorageEntry,
  EventHookEntry,
  SidebarPanelEntry,
  SlashCommandEntry,
  CapabilityEntry,
  CapabilityTypeMap,
  CapabilityIndex,
} from './plugin-registry.js';
