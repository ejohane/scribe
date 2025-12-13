/**
 * Vault initialization and management
 *
 * Handles locating, creating, and validating the vault directory structure
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { homedir } from 'node:os';
import type { VaultPath } from '@scribe/shared';
import { createVaultPath } from '@scribe/shared';

/**
 * Default vault location
 */
const DEFAULT_VAULT_PATH = createVaultPath(path.join(homedir(), 'Scribe', 'vault'));

/**
 * Vault subdirectories
 */
const VAULT_SUBDIRS = ['notes', 'quarantine'] as const;

/**
 * Initialize vault directory structure
 *
 * Creates the vault directory if it doesn't exist, ensuring all required
 * subdirectories are present.
 *
 * @param vaultPath - Optional custom vault path (defaults to ~/Scribe/vault)
 * @returns The absolute path to the vault directory
 */
export async function initializeVault(
  vaultPath: VaultPath = DEFAULT_VAULT_PATH
): Promise<VaultPath> {
  // Ensure vault root directory exists
  await fs.mkdir(vaultPath, { recursive: true });

  // Ensure all required subdirectories exist
  for (const subdir of VAULT_SUBDIRS) {
    const subdirPath = path.join(vaultPath, subdir);
    await fs.mkdir(subdirPath, { recursive: true });
  }

  return vaultPath;
}

/**
 * Validate that a directory is a valid vault
 *
 * @param vaultPath - Path to validate
 * @returns true if the path is a valid vault
 */
export async function isValidVault(vaultPath: VaultPath): Promise<boolean> {
  try {
    // Check that vault root exists and is a directory
    const stats = await fs.stat(vaultPath);
    if (!stats.isDirectory()) {
      return false;
    }

    // Check that all required subdirectories exist
    for (const subdir of VAULT_SUBDIRS) {
      const subdirPath = path.join(vaultPath, subdir);
      const subdirStats = await fs.stat(subdirPath);
      if (!subdirStats.isDirectory()) {
        return false;
      }
    }

    return true;
  } catch {
    return false;
  }
}

/**
 * Get the notes directory path
 *
 * @param vaultPath - Path to vault
 * @returns Path to notes directory
 */
export function getNotesDir(vaultPath: VaultPath): string {
  return path.join(vaultPath, 'notes');
}

/**
 * Get the path to a note file
 *
 * @param vaultPath - Path to vault
 * @param noteId - Note ID
 * @returns Path to note file
 */
export function getNoteFilePath(vaultPath: VaultPath, noteId: string): string {
  return path.join(getNotesDir(vaultPath), `${noteId}.json`);
}

/**
 * Get the quarantine directory path
 *
 * @param vaultPath - Path to vault
 * @returns Path to quarantine directory
 */
export function getQuarantineDir(vaultPath: VaultPath): string {
  return path.join(vaultPath, 'quarantine');
}
