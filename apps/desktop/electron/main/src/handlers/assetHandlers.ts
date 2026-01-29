/**
 * Asset IPC Handlers
 *
 * This module provides IPC handlers for binary asset operations:
 * - Save assets (images) to vault
 * - Load assets from vault
 * - Delete assets from vault
 * - Get asset filesystem paths
 *
 * ## Handler Pattern
 *
 * Asset handlers follow a standalone pattern (not using HandlerDependencies)
 * because AssetManager only needs the vault path and operates independently
 * from the note engines (graph, search).
 *
 * ## IPC Channels
 *
 * | Channel | Parameters | Returns | Description |
 * |---------|------------|---------|-------------|
 * | `assets:save` | `data: ArrayBuffer, mimeType: string, filename?: string` | `AssetSaveResult` | Save binary data |
 * | `assets:load` | `assetId: string` | `ArrayBuffer \| null` | Load asset data |
 * | `assets:delete` | `assetId: string` | `boolean` | Delete an asset |
 * | `assets:getPath` | `assetId: string` | `string \| null` | Get filesystem path |
 *
 * ## Data Conversion
 *
 * ArrayBuffer ↔ Buffer conversion is handled at the IPC boundary:
 * - Renderer sends ArrayBuffer (from File/Blob.arrayBuffer())
 * - Main process converts to Buffer for AssetManager
 * - Load returns ArrayBuffer back to renderer
 *
 * @module handlers/assetHandlers
 */

import { ipcMain, protocol, net } from 'electron';
import * as fs from 'node:fs';
import * as nodePath from 'node:path';
import type { VaultPath } from '@scribe/shared';
import { IPC_CHANNELS, type AssetSaveResult } from '@scribe/shared';
import { AssetManager, getAssetsDir } from '@scribe/storage-fs';
import { createLogger } from '@scribe/shared';

const log = createLogger({ prefix: 'assetHandlers' });

/**
 * MIME type mapping for asset files
 */
const MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
};

/**
 * Register the scribe-asset:// protocol for serving local asset files.
 *
 * This protocol allows the renderer to load images from the vault's assets
 * directory in a secure manner, without exposing arbitrary file:// access.
 *
 * URLs are in the format: scribe-asset://assetId.ext
 *
 * @param vaultPath - Path to the vault directory
 */
export function registerAssetProtocol(vaultPath: VaultPath): void {
  const assetsDir = getAssetsDir(vaultPath);

  protocol.handle('scribe-asset', (request) => {
    // URL format: scribe-asset://assetId.ext
    // The host part of the URL contains the filename
    const url = new URL(request.url);
    const filename = url.hostname + url.pathname;

    // Security: Only allow files in the assets directory
    // Prevent path traversal by checking the resolved path
    const requestedPath = nodePath.join(assetsDir, filename);
    const resolvedPath = nodePath.resolve(requestedPath);

    if (!resolvedPath.startsWith(assetsDir)) {
      log.warn('Asset protocol: path traversal attempt blocked', { filename, resolvedPath });
      return new Response('Forbidden', { status: 403 });
    }

    // Check if file exists
    if (!fs.existsSync(resolvedPath)) {
      log.warn('Asset protocol: file not found', { filename, resolvedPath });
      return new Response('Not Found', { status: 404 });
    }

    // Get MIME type from extension
    const ext = nodePath.extname(filename).slice(1).toLowerCase();
    const mimeType = MIME_TYPES[ext] || 'application/octet-stream';

    log.debug('Asset protocol: serving file', { filename, resolvedPath, mimeType });

    // Use net.fetch to properly serve the file
    return net.fetch(`file://${resolvedPath}`);
  });

  log.info('Asset protocol registered', { assetsDir });
}

/**
 * Setup IPC handlers for asset operations.
 *
 * @param vaultPath - Path to the vault directory
 * @returns Cleanup function to remove all handlers
 *
 * @example
 * ```typescript
 * // During app initialization:
 * const cleanupAssets = setupAssetHandlers(vaultPath);
 *
 * // On shutdown:
 * cleanupAssets();
 * ```
 */
export function setupAssetHandlers(vaultPath: VaultPath): () => void {
  const assetManager = new AssetManager(vaultPath);

  /**
   * IPC: `assets:save`
   *
   * Saves binary data as an asset in the vault.
   * Validates MIME type and uses atomic writes for safety.
   *
   * @param data - ArrayBuffer containing the binary data
   * @param mimeType - MIME type of the asset (e.g., "image/png")
   * @param _filename - Optional original filename (currently unused)
   * @returns AssetSaveResult with assetId and ext on success
   */
  ipcMain.handle(
    IPC_CHANNELS.ASSETS_SAVE,
    async (
      _event,
      data: ArrayBuffer,
      mimeType: string,
      _filename?: string
    ): Promise<AssetSaveResult> => {
      log.debug('Saving asset', { mimeType, size: data.byteLength });
      try {
        const buffer = Buffer.from(data);
        const result = await assetManager.save(buffer, mimeType);
        if (result.success) {
          log.info('Asset saved', { assetId: result.assetId, ext: result.ext });
        }
        return result;
      } catch (error) {
        const err = error as Error;
        log.error('Asset save error', { error: err.message });
        return { success: false, error: `Unexpected error: ${err.message}` };
      }
    }
  );

  /**
   * IPC: `assets:load`
   *
   * Loads asset binary data from the vault.
   *
   * @param assetId - The asset ID (UUID, with or without extension)
   * @returns ArrayBuffer containing the asset data, or null if not found
   */
  ipcMain.handle(
    IPC_CHANNELS.ASSETS_LOAD,
    async (_event, assetId: string): Promise<ArrayBuffer | null> => {
      try {
        const buffer = await assetManager.load(assetId);
        if (buffer) {
          // Convert Buffer to ArrayBuffer for IPC transport
          // Use Uint8Array to ensure we get a proper ArrayBuffer (not SharedArrayBuffer)
          const arrayBuffer = new Uint8Array(buffer).buffer;
          return arrayBuffer;
        }
        return null;
      } catch (error) {
        log.error('Asset load error', { assetId, error: (error as Error).message });
        return null;
      }
    }
  );

  /**
   * IPC: `assets:delete`
   *
   * Deletes an asset from the vault.
   *
   * @param assetId - The asset ID to delete
   * @returns true if deleted, false if not found
   */
  ipcMain.handle(IPC_CHANNELS.ASSETS_DELETE, async (_event, assetId: string): Promise<boolean> => {
    try {
      return await assetManager.delete(assetId);
    } catch (error) {
      log.error('Asset delete error', { assetId, error: (error as Error).message });
      return false;
    }
  });

  /**
   * IPC: `assets:getPath`
   *
   * Gets the absolute filesystem path for an asset.
   * Useful for native file operations or external tools.
   *
   * @param assetId - The asset ID
   * @returns Absolute path to the asset file, or null if not found
   */
  ipcMain.handle(
    IPC_CHANNELS.ASSETS_GET_PATH,
    async (_event, assetId: string): Promise<string | null> => {
      try {
        log.debug('Getting asset path', { assetId, vaultPath });
        const path = await assetManager.getPath(assetId);
        if (path) {
          log.debug('Asset path found', { assetId, path });
        } else {
          log.warn('Asset path not found', { assetId, vaultPath });
        }
        return path;
      } catch (error) {
        log.error('Asset getPath error', { assetId, error: (error as Error).message });
        return null;
      }
    }
  );

  /**
   * Cleanup function to remove all asset handlers.
   * Call this when switching vaults or shutting down.
   */
  return () => {
    ipcMain.removeHandler(IPC_CHANNELS.ASSETS_SAVE);
    ipcMain.removeHandler(IPC_CHANNELS.ASSETS_LOAD);
    ipcMain.removeHandler(IPC_CHANNELS.ASSETS_DELETE);
    ipcMain.removeHandler(IPC_CHANNELS.ASSETS_GET_PATH);
  };
}
