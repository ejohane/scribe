/**
 * Plugin system exports for scribed daemon.
 *
 * This module provides the plugin infrastructure for the Scribe daemon,
 * including router merging, plugin initialization, and plugin discovery.
 *
 * @module
 */

// ============================================================================
// Plugin Initialization
// ============================================================================

export {
  initializePluginSystem,
  type PluginSystem,
  type ServerPluginContextFactory,
  type InitPluginSystemOptions,
} from './init.js';

// ============================================================================
// Logger
// ============================================================================

export { createPluginLogger, createNoopLogger } from './logger.js';

// ============================================================================
// Installed Plugins
// ============================================================================

export { getInstalledPlugins, discoverPlugins, type PluginDiscoveryConfig } from './installed.js';

// ============================================================================
// Router Merger
// ============================================================================

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
} from './router-merger.js';

// ============================================================================
// Error Handler
// ============================================================================

export {
  // Functions
  createTimeout,
  withTimeout,
  logPluginError,
  wrapEventHandler,
  wrapLifecycleHook,
  handleRouterError,
  safePluginOperation,
  // Constants
  DEFAULT_PLUGIN_TIMEOUT,
  EVENT_HANDLER_TIMEOUT,
  LIFECYCLE_HOOK_TIMEOUT,
  // Types
  type PluginErrorType,
  type PluginErrorLog,
  type PluginEventHandler,
  type WrapEventHandlerOptions,
  type TimeoutOptions,
  type WrapLifecycleHookOptions,
} from './error-handler.js';
