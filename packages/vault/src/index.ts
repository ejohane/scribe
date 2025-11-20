/**
 * @scribe/vault
 *
 * Vault discovery and path normalization.
 */

export { Vault } from './vault.js';
export type { VaultOptions } from './vault.js';
export type { VaultFile, VaultFolder, VaultDiscoveryResult } from './types.js';
export { VaultWatcher } from './watcher.js';
export type { VaultWatcherOptions, VaultChangeEvent } from './watcher.js';
export { VaultMutations } from './mutations.js';
export type {
  VaultMutationResult,
  CreateFileOptions,
  RenameFileOptions,
  DeleteFileOptions,
} from './mutations.js';
