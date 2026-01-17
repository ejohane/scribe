/**
 * IPC Handler Modules
 *
 * This module exports setup functions for all IPC handlers organized by domain.
 * Each handler module registers its own IPC handlers when called with dependencies.
 *
 * ## Handler Modules
 *
 * | Module | Channels | Description |
 * |--------|----------|-------------|
 * | {@link setupAppHandlers} | `ping`, `app:*`, `shell:*` | App configuration, devtools, shell operations |
 * | {@link setupNotesHandlers} | `notes:*` | Notes CRUD, title search, date-based queries |
 * | {@link setupSearchHandlers} | `search:*` | Full-text search across notes |
 * | {@link setupGraphHandlers} | `graph:*` | Graph traversal, backlinks, tag queries |
 * | {@link setupExportHandlers} | `export:*` | Export notes to external formats |
 * | {@link setupAssetHandlers} | `assets:*` | Binary asset management (images) |
 * | {@link setupWindowHandlers} | `window:*` | Multi-window management |
 *
 * ## IPC Channel Naming Convention
 *
 * All channels follow the pattern `domain:action`:
 * - Domain groups related functionality (e.g., `notes`)
 * - Action describes the operation (e.g., `list`, `create`)
 *
 * ## Error Handling
 *
 * All handlers may throw if dependencies are not initialized (vault, graph, search, etc.).
 * Some handlers wrap errors using {@link ScribeError} for user-friendly messages.
 *
 * @module handlers
 */

export { setupNotesHandlers } from './notesHandlers';
export { setupSearchHandlers } from './searchHandlers';
export { setupGraphHandlers } from './graphHandlers';
export { setupAppHandlers } from './appHandlers';
export { setupExportHandlers } from './exportHandlers';
export { setupDialogHandlers } from './dialogHandlers';
export { setupVaultHandlers } from './vaultHandlers';
export {
  parseDeepLink,
  extractDeepLinkFromArgv,
  registerProtocolHandler,
  DEEP_LINK_PROTOCOL,
} from './deepLinkHandlers';
export { setupAssetHandlers, registerAssetProtocol } from './assetHandlers';
export { setupWindowHandlers } from './windowHandlers';

export type { HandlerDependencies, AppConfig, Engines } from './types';
export { withEngines } from './types';
export { loadConfig, saveConfig, getVaultPath, DEFAULT_VAULT_PATH } from './config';
