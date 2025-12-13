/**
 * QuarantineManager - Handles corrupt file quarantine operations
 *
 * Manages the lifecycle of quarantined files:
 * - Moving corrupt files to quarantine directory
 * - Tracking quarantined files in memory
 * - Restoring files from quarantine
 * - Deleting quarantined files permanently
 */

import * as fs from 'node:fs/promises';
import * as path from 'path';
import type { VaultPath } from '@scribe/shared';
import { ErrorCode, ScribeError } from '@scribe/shared';
import { getNotesDir, getQuarantineDir } from './vault.js';

/**
 * Interface for QuarantineManager operations
 */
export interface IQuarantineManager {
  /**
   * Quarantine a corrupt file
   *
   * @param fileName - Name of the file to quarantine (relative to notes directory)
   * @param reason - Reason for quarantining the file
   */
  quarantine(fileName: string, reason: string): Promise<void>;

  /**
   * List all quarantined file names
   *
   * @returns Array of original file names that have been quarantined
   */
  listQuarantined(): string[];

  /**
   * Restore a file from quarantine back to the notes directory
   *
   * @param fileName - Original file name to restore
   * @throws ScribeError if file not found in quarantine or restore fails
   */
  restore(fileName: string): Promise<void>;

  /**
   * Permanently delete a quarantined file
   *
   * @param fileName - Original file name to delete from quarantine
   * @throws ScribeError if file not found or deletion fails
   */
  deleteQuarantined(fileName: string): Promise<void>;
}

/**
 * Metadata about a quarantined file
 */
interface QuarantinedFileInfo {
  /** Original file name */
  originalName: string;
  /** Full path in quarantine directory */
  quarantinePath: string;
  /** When the file was quarantined */
  quarantinedAt: Date;
  /** Reason for quarantine */
  reason: string;
}

/**
 * QuarantineManager implementation
 *
 * Uses a two-strategy approach for quarantining files:
 * 1. Primary: Move file to quarantine directory with timestamp prefix
 * 2. Fallback: Rename in place with .corrupt extension
 *
 * This ensures corrupt files are always removed from the notes directory
 * to prevent repeated parse failures on startup.
 */
export class QuarantineManager implements IQuarantineManager {
  /** Map of original file name to quarantine info */
  private quarantinedFiles: Map<string, QuarantinedFileInfo> = new Map();

  constructor(private vaultPath: VaultPath) {}

  /**
   * Quarantine a corrupt file
   *
   * Uses a two-strategy approach:
   * 1. Primary: Move file to quarantine directory
   * 2. Fallback: Rename in place with .corrupt extension
   *
   * @param fileName - Name of the file to quarantine
   * @param reason - Reason for quarantining
   * @throws ScribeError if both quarantine strategies fail
   */
  async quarantine(fileName: string, reason: string): Promise<void> {
    const sourcePath = path.join(getNotesDir(this.vaultPath), fileName);
    const quarantineDir = getQuarantineDir(this.vaultPath);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const quarantinePath = path.join(quarantineDir, `${timestamp}_${fileName}`);

    // Strategy 1: Move to quarantine directory
    try {
      // Ensure quarantine directory exists
      await fs.mkdir(quarantineDir, { recursive: true });

      await fs.rename(sourcePath, quarantinePath);
      this.quarantinedFiles.set(fileName, {
        originalName: fileName,
        quarantinePath,
        quarantinedAt: new Date(),
        reason,
      });
      console.warn(
        `Quarantined corrupt file: ${fileName} -> ${path.basename(quarantinePath)} (${reason})`
      );
      return;
    } catch (moveError) {
      console.warn(
        `Failed to move ${fileName} to quarantine directory, trying fallback:`,
        moveError
      );
    }

    // Strategy 2: Rename in place with .corrupt extension
    const corruptPath = path.join(getNotesDir(this.vaultPath), `${fileName}.corrupt`);
    try {
      await fs.rename(sourcePath, corruptPath);
      this.quarantinedFiles.set(fileName, {
        originalName: fileName,
        quarantinePath: corruptPath,
        quarantinedAt: new Date(),
        reason,
      });
      console.warn(
        `Renamed corrupt file in place: ${fileName} -> ${path.basename(corruptPath)} (${reason})`
      );
      return;
    } catch (renameError) {
      console.error(`Failed to rename ${fileName} in place:`, renameError);
    }

    // Both strategies failed - this is a critical error
    throw new ScribeError(
      ErrorCode.FILE_WRITE_ERROR,
      `Failed to quarantine corrupt file ${fileName}: both move and rename strategies failed. ` +
        `File remains in notes directory and will cause repeated parse failures.`
    );
  }

  /**
   * Get list of quarantined file names
   *
   * @returns Array of original file names that have been quarantined
   */
  listQuarantined(): string[] {
    return Array.from(this.quarantinedFiles.keys());
  }

  /**
   * Restore a file from quarantine back to the notes directory
   *
   * @param fileName - Original file name to restore
   * @throws ScribeError if file not found in quarantine or restore fails
   */
  async restore(fileName: string): Promise<void> {
    const info = this.quarantinedFiles.get(fileName);
    if (!info) {
      throw new ScribeError(ErrorCode.FILE_NOT_FOUND, `File "${fileName}" is not in quarantine`);
    }

    const restorePath = path.join(getNotesDir(this.vaultPath), fileName);

    try {
      // Check if a file already exists at the restore path
      try {
        await fs.access(restorePath);
        throw new ScribeError(
          ErrorCode.FILE_WRITE_ERROR,
          `Cannot restore "${fileName}": a file with that name already exists in notes directory`
        );
      } catch (error) {
        // File doesn't exist, which is what we want - continue with restore
        if (error instanceof ScribeError) {
          throw error;
        }
      }

      await fs.rename(info.quarantinePath, restorePath);
      this.quarantinedFiles.delete(fileName);
      console.info(`Restored file from quarantine: ${fileName}`);
    } catch (error) {
      if (error instanceof ScribeError) {
        throw error;
      }
      const err = error as Error & { code?: string };
      const code = ScribeError.fromSystemError(err, ErrorCode.FILE_WRITE_ERROR);
      throw new ScribeError(
        code,
        `Failed to restore file "${fileName}" from quarantine: ${err.message}`,
        err
      );
    }
  }

  /**
   * Permanently delete a quarantined file
   *
   * @param fileName - Original file name to delete from quarantine
   * @throws ScribeError if file not found or deletion fails
   */
  async deleteQuarantined(fileName: string): Promise<void> {
    const info = this.quarantinedFiles.get(fileName);
    if (!info) {
      throw new ScribeError(ErrorCode.FILE_NOT_FOUND, `File "${fileName}" is not in quarantine`);
    }

    try {
      await fs.unlink(info.quarantinePath);
      this.quarantinedFiles.delete(fileName);
      console.info(`Permanently deleted quarantined file: ${fileName}`);
    } catch (error) {
      const err = error as Error & { code?: string };
      const code = ScribeError.fromSystemError(err, ErrorCode.FILE_DELETE_ERROR);
      throw new ScribeError(
        code,
        `Failed to delete quarantined file "${fileName}": ${err.message}`,
        err
      );
    }
  }

  /**
   * Get detailed information about quarantined files
   *
   * @returns Array of quarantine info objects
   */
  getQuarantineInfo(): QuarantinedFileInfo[] {
    return Array.from(this.quarantinedFiles.values());
  }

  /**
   * Clear the in-memory list of quarantined files
   * Useful when reinitializing or for testing
   */
  clear(): void {
    this.quarantinedFiles.clear();
  }

  /**
   * Scan the quarantine directory and populate the in-memory list
   * Call this during vault initialization to track pre-existing quarantined files
   */
  async scanQuarantineDir(): Promise<void> {
    const quarantineDir = getQuarantineDir(this.vaultPath);

    try {
      const files = await fs.readdir(quarantineDir);

      for (const file of files) {
        // Parse timestamp prefix and original filename
        // Format: YYYY-MM-DDTHH-MM-SS-sssZ_originalname.json
        const match = file.match(/^(\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z)_(.+)$/);
        if (match) {
          const timestampStr = match[1];
          const originalName = match[2];
          const quarantinedAt = new Date(
            timestampStr.replace(/-/g, (_match, index) => (index < 10 ? '-' : ':'))
          );

          this.quarantinedFiles.set(originalName, {
            originalName,
            quarantinePath: path.join(quarantineDir, file),
            quarantinedAt: isNaN(quarantinedAt.getTime()) ? new Date() : quarantinedAt,
            reason: 'Pre-existing quarantined file',
          });
        } else if (file.endsWith('.corrupt')) {
          // Handle fallback-renamed files in notes directory
          // These would be in the notes dir, not quarantine dir, so skip here
        } else {
          // Unknown format in quarantine dir - track it anyway
          this.quarantinedFiles.set(file, {
            originalName: file,
            quarantinePath: path.join(quarantineDir, file),
            quarantinedAt: new Date(),
            reason: 'Pre-existing quarantined file (unknown format)',
          });
        }
      }
    } catch (error) {
      // Quarantine directory might not exist yet, which is fine
      const err = error as Error & { code?: string };
      if (err.code !== 'ENOENT') {
        console.warn('Failed to scan quarantine directory:', error);
      }
    }
  }
}

/**
 * Factory function to create a QuarantineManager instance
 *
 * @param vaultPath - Path to the vault
 * @returns QuarantineManager instance
 */
export function createQuarantineManager(vaultPath: VaultPath): QuarantineManager {
  return new QuarantineManager(vaultPath);
}
