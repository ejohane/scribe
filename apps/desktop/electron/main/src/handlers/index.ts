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
 * | {@link setupAssetHandlers} | `assets:*` | Binary asset management (images) |
 * | {@link setupWindowHandlers} | `window:*` | Multi-window management |
 *
 * ## Daemon-Provided Functionality
 *
 * The following functionality is now provided by the daemon via tRPC:
 * - Notes CRUD: `notes.router.ts` (was notesHandlers.ts)
 * - Search: `search.router.ts` (was searchHandlers.ts)
 * - Graph: `graph.router.ts` (was graphHandlers.ts)
 * - Export: `export.router.ts` (was exportHandlers.ts)
 *
 * ## IPC Channel Naming Convention
 *
 * All channels follow the pattern `domain:action`:
 * - Domain groups related functionality (e.g., `notes`)
 * - Action describes the operation (e.g., `list`, `create`)
 *
 * ## Error Handling
 *
 * All handlers may throw if dependencies are not initialized.
 *
 * @module handlers
 */

export { setupAppHandlers } from './appHandlers';
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

export type { HandlerDependencies, AppConfig } from './types';
export { loadConfig, saveConfig, getVaultPath, DEFAULT_VAULT_PATH } from './config';
