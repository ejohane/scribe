/**
 * Plugin system exports for scribed daemon.
 *
 * This module provides the plugin infrastructure for the Scribe daemon,
 * including router merging and plugin initialization.
 *
 * @module
 */

// Router merger exports
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
