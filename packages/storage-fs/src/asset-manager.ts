/**
 * Asset Manager for binary asset storage operations
 *
 * Handles storage of binary assets (images) with atomic writes,
 * MIME type validation, and file management.
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { VaultPath } from '@scribe/shared';
import { createLogger } from '@scribe/shared';
import { getAssetsDir, getAssetFilePath } from './vault.js';

const log = createLogger({ prefix: 'AssetManager' });

/**
 * Supported image MIME types for asset storage
 */
export const SUPPORTED_IMAGE_TYPES = [
  'image/png',
  'image/jpeg',
  'image/gif',
  'image/webp',
  'image/svg+xml',
] as const;

export type SupportedImageMimeType = (typeof SUPPORTED_IMAGE_TYPES)[number];

/**
 * Mapping from MIME type to file extension
 */
const MIME_TO_EXT: Record<SupportedImageMimeType, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/svg+xml': 'svg',
};

/**
 * All supported file extensions for asset lookup
 */
const SUPPORTED_EXTENSIONS = Object.values(MIME_TO_EXT);

/**
 * Result of an asset save operation
 */
export interface AssetSaveResult {
  success: boolean;
  assetId?: string;
  ext?: string;
  error?: string;
}

/**
 * Interface for asset management operations
 */
export interface IAssetManager {
  /**
   * Save binary data as an asset
   *
   * @param data - Buffer containing the asset data
   * @param mimeType - MIME type of the asset
   * @returns Result with asset ID and extension on success
   */
  save(data: Buffer, mimeType: string): Promise<AssetSaveResult>;

  /**
   * Load an asset by ID
   *
   * @param assetId - UUID of the asset
   * @returns Buffer containing asset data, or null if not found
   */
  load(assetId: string): Promise<Buffer | null>;

  /**
   * Delete an asset by ID
   *
   * @param assetId - UUID of the asset
   * @returns true if deleted, false if not found
   */
  delete(assetId: string): Promise<boolean>;

  /**
   * Check if an asset exists
   *
   * @param assetId - UUID of the asset
   * @returns true if the asset exists
   */
  exists(assetId: string): Promise<boolean>;

  /**
   * Get the full filesystem path to an asset
   *
   * @param assetId - UUID of the asset
   * @returns Full path to the asset file, or null if not found
   */
  getPath(assetId: string): Promise<string | null>;
}

/**
 * Check if a MIME type is supported for asset storage
 *
 * @param mimeType - MIME type to check
 * @returns true if the MIME type is supported
 */
export function isSupportedImageType(mimeType: string): mimeType is SupportedImageMimeType {
  return SUPPORTED_IMAGE_TYPES.includes(mimeType as SupportedImageMimeType);
}

/**
 * Get the file extension for a supported MIME type
 *
 * @param mimeType - Supported MIME type
 * @returns File extension without dot
 */
export function getExtensionForMimeType(mimeType: SupportedImageMimeType): string {
  return MIME_TO_EXT[mimeType];
}

/**
 * Asset Manager implementation
 *
 * Manages binary asset storage with:
 * - MIME type validation (only supported image types)
 * - Atomic writes (temp file -> sync -> rename)
 * - UUID-based asset identification
 */
export class AssetManager implements IAssetManager {
  private readonly vaultPath: VaultPath;

  /**
   * Create an AssetManager for a vault
   *
   * @param vaultPath - Path to the vault directory
   */
  constructor(vaultPath: VaultPath) {
    this.vaultPath = vaultPath;
    log.info('AssetManager created', { vaultPath, assetsDir: getAssetsDir(vaultPath) });
  }

  /**
   * Get the assets directory for this vault
   */
  private getAssetsDir(): string {
    return getAssetsDir(this.vaultPath);
  }

  /**
   * Get the temp file path for atomic writes
   *
   * @param finalPath - The target file path
   * @returns Path to temporary file
   */
  private getTempPath(finalPath: string): string {
    const dir = path.dirname(finalPath);
    const basename = path.basename(finalPath);
    return path.join(dir, `.${basename}.tmp`);
  }

  /**
   * Clean up a temp file, ignoring errors if it doesn't exist
   *
   * @param tempPath - Path to the temp file
   */
  private async cleanupTempFile(tempPath: string): Promise<void> {
    try {
      await fs.unlink(tempPath);
    } catch {
      // Ignore cleanup errors - temp file may not exist
    }
  }

  /**
   * Find an asset file by ID, searching all supported extensions
   *
   * @param assetId - UUID of the asset
   * @returns Full path to the asset file, or null if not found
   */
  private async findAssetPath(assetId: string): Promise<string | null> {
    const assetsDir = this.getAssetsDir();
    log.debug('Finding asset', { assetId, assetsDir, vaultPath: this.vaultPath });

    for (const ext of SUPPORTED_EXTENSIONS) {
      const filePath = path.join(assetsDir, `${assetId}.${ext}`);
      try {
        await fs.access(filePath);
        log.debug('Asset found', { assetId, filePath });
        return filePath;
      } catch {
        // File doesn't exist with this extension, try next
      }
    }

    // List files in assets directory to help debug
    try {
      const files = await fs.readdir(assetsDir);
      log.warn('Asset not found, listing assets dir', {
        assetId,
        assetsDir,
        files: files.slice(0, 10),
      });
    } catch (e) {
      log.warn('Asset not found, could not list assets dir', {
        assetId,
        assetsDir,
        error: (e as Error).message,
      });
    }

    return null;
  }

  /**
   * Save binary data as an asset
   *
   * Uses atomic write pattern: write to temp file, sync to disk, then rename.
   * This ensures no partial writes on crash or power loss.
   *
   * @param data - Buffer containing the asset data
   * @param mimeType - MIME type of the asset
   * @returns Result with asset ID and extension on success
   */
  async save(data: Buffer, mimeType: string): Promise<AssetSaveResult> {
    // Validate MIME type
    if (!isSupportedImageType(mimeType)) {
      return {
        success: false,
        error: `Unsupported MIME type: ${mimeType}. Supported types: ${SUPPORTED_IMAGE_TYPES.join(', ')}`,
      };
    }

    const ext = getExtensionForMimeType(mimeType);
    const assetId = randomUUID();
    const finalPath = getAssetFilePath(this.vaultPath, assetId, ext);
    const tempPath = this.getTempPath(finalPath);

    log.debug('Saving asset', { assetId, ext, finalPath, vaultPath: this.vaultPath });

    try {
      // Ensure assets directory exists
      await fs.mkdir(this.getAssetsDir(), { recursive: true });

      // Write to temporary file
      await fs.writeFile(tempPath, data);

      // Sync to disk (ensure data is physically written)
      const fileHandle = await fs.open(tempPath, 'r+');
      try {
        await fileHandle.sync();
      } finally {
        await fileHandle.close();
      }

      // Atomic rename
      await fs.rename(tempPath, finalPath);

      log.info('Asset saved successfully', { assetId, ext, finalPath });

      return {
        success: true,
        assetId,
        ext,
      };
    } catch (error) {
      // Clean up temp file on error
      await this.cleanupTempFile(tempPath);

      const err = error as Error;
      log.error('Failed to save asset', { assetId, error: err.message });
      return {
        success: false,
        error: `Failed to save asset: ${err.message}`,
      };
    }
  }

  /**
   * Load an asset by ID
   *
   * Searches all supported extensions to find the asset file.
   *
   * @param assetId - UUID of the asset
   * @returns Buffer containing asset data, or null if not found
   */
  async load(assetId: string): Promise<Buffer | null> {
    const filePath = await this.findAssetPath(assetId);
    if (!filePath) {
      return null;
    }

    try {
      return await fs.readFile(filePath);
    } catch {
      return null;
    }
  }

  /**
   * Delete an asset by ID
   *
   * @param assetId - UUID of the asset
   * @returns true if deleted, false if not found
   */
  async delete(assetId: string): Promise<boolean> {
    const filePath = await this.findAssetPath(assetId);
    if (!filePath) {
      return false;
    }

    try {
      await fs.unlink(filePath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if an asset exists
   *
   * @param assetId - UUID of the asset
   * @returns true if the asset exists
   */
  async exists(assetId: string): Promise<boolean> {
    const filePath = await this.findAssetPath(assetId);
    return filePath !== null;
  }

  /**
   * Get the full filesystem path to an asset
   *
   * @param assetId - UUID of the asset
   * @returns Full path to the asset file, or null if not found
   */
  async getPath(assetId: string): Promise<string | null> {
    return this.findAssetPath(assetId);
  }
}
