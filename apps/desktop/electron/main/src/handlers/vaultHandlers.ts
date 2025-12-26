/**
 * Vault IPC Handlers
 *
 * This module provides IPC handlers for vault management:
 * - Get current vault path
 * - Switch to a different vault (requires restart)
 * - Create new vault
 * - Validate vault path
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `vault:getPath` | none | `string` | Get current vault path |
 * | `vault:setPath` | `path: string` | `VaultSwitchResult` | Switch vault (restart required) |
 * | `vault:create` | `path: string` | `VaultCreateResult` | Create new vault |
 * | `vault:validate` | `path: string` | `VaultValidationResult` | Check if path is valid vault |
 *
 * @module handlers/vaultHandlers
 */

import { ipcMain } from 'electron';
import * as fs from 'node:fs/promises';
import path from 'path';
import {
  IPC_CHANNELS,
  createVaultPath,
  type VaultSwitchResult,
  type VaultCreateResult,
  type VaultValidationResult,
} from '@scribe/shared';
import { initializeVault, isValidVault } from '@scribe/storage-fs';
import type { HandlerDependencies } from './types';
import { loadConfig, saveConfig, DEFAULT_VAULT_PATH } from './config';

/**
 * Setup IPC handlers for vault management.
 *
 * @param _deps - Handler dependencies (reserved for future engine hot-reload)
 */
export function setupVaultHandlers(_deps: HandlerDependencies): void {
  /**
   * IPC: `vault:getPath`
   *
   * Get the current vault path.
   * Returns the configured vault path, or the default if none configured.
   */
  ipcMain.handle(IPC_CHANNELS.VAULT_GET_PATH, async () => {
    const config = await loadConfig();
    return config.vaultPath || DEFAULT_VAULT_PATH;
  });

  /**
   * IPC: `vault:setPath`
   *
   * Set the vault path for the next app launch.
   * This updates the config but doesn't switch immediately - requires app restart.
   *
   * @param path - The new vault path
   * @returns VaultSwitchResult indicating success/failure
   */
  ipcMain.handle(
    IPC_CHANNELS.VAULT_SET_PATH,
    async (_event, newPath: string): Promise<VaultSwitchResult> => {
      try {
        // Validate the path is a valid vault
        const vaultPath = createVaultPath(newPath);
        const valid = await isValidVault(vaultPath);

        if (!valid) {
          return {
            success: false,
            path: newPath,
            error: 'Not a valid Scribe vault. Missing required folders (notes, quarantine).',
          };
        }

        // Save the new vault path to config
        const config = await loadConfig();
        config.vaultPath = newPath;
        await saveConfig(config);

        return {
          success: true,
          path: newPath,
          requiresRestart: true,
        };
      } catch (error) {
        return {
          success: false,
          path: newPath,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * IPC: `vault:create`
   *
   * Create a new vault at the specified path.
   *
   * @param path - Path where to create the vault
   * @returns VaultCreateResult indicating success/failure
   */
  ipcMain.handle(
    IPC_CHANNELS.VAULT_CREATE,
    async (_event, newPath: string): Promise<VaultCreateResult> => {
      try {
        const vaultPath = createVaultPath(newPath);

        // Check if vault already exists
        const exists = await isValidVault(vaultPath);
        if (exists) {
          return {
            success: false,
            path: newPath,
            error: 'A vault already exists at this location.',
          };
        }

        // Create the vault structure
        await initializeVault(vaultPath);

        return {
          success: true,
          path: newPath,
        };
      } catch (error) {
        return {
          success: false,
          path: newPath,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }
  );

  /**
   * IPC: `vault:validate`
   *
   * Validate if a path is a valid vault.
   *
   * @param path - Path to validate
   * @returns VaultValidationResult
   */
  ipcMain.handle(
    IPC_CHANNELS.VAULT_VALIDATE,
    async (_event, pathToValidate: string): Promise<VaultValidationResult> => {
      try {
        const vaultPath = createVaultPath(pathToValidate);
        const valid = await isValidVault(vaultPath);

        if (valid) {
          return { valid: true };
        }

        // Check which directories are missing
        const missingDirs: string[] = [];
        for (const subdir of ['notes', 'quarantine']) {
          try {
            const subdirPath = path.join(pathToValidate, subdir);
            await fs.access(subdirPath);
          } catch {
            missingDirs.push(subdir);
          }
        }

        return {
          valid: false,
          missingDirs: missingDirs.length > 0 ? missingDirs : undefined,
        };
      } catch {
        return { valid: false };
      }
    }
  );
}
