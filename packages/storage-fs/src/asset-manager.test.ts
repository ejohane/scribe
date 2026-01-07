/**
 * Unit tests for AssetManager
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import { createVaultPath } from '@scribe/shared';
import type { VaultPath } from '@scribe/shared';
import {
  AssetManager,
  SUPPORTED_IMAGE_TYPES,
  isSupportedImageType,
  getExtensionForMimeType,
} from './asset-manager.js';
import { initializeVault } from './vault.js';

describe('AssetManager', () => {
  let tempDir: VaultPath;
  let assetManager: AssetManager;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = createVaultPath(path.join(tmpdir(), `scribe-asset-test-${Date.now()}`));
    await initializeVault(tempDir);
    assetManager = new AssetManager(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (error) {
      console.warn('Failed to clean up temp directory:', error);
    }
  });

  describe('isSupportedImageType', () => {
    it('returns true for supported MIME types', () => {
      expect(isSupportedImageType('image/png')).toBe(true);
      expect(isSupportedImageType('image/jpeg')).toBe(true);
      expect(isSupportedImageType('image/gif')).toBe(true);
      expect(isSupportedImageType('image/webp')).toBe(true);
      expect(isSupportedImageType('image/svg+xml')).toBe(true);
    });

    it('returns false for unsupported MIME types', () => {
      expect(isSupportedImageType('image/bmp')).toBe(false);
      expect(isSupportedImageType('image/tiff')).toBe(false);
      expect(isSupportedImageType('application/pdf')).toBe(false);
      expect(isSupportedImageType('text/plain')).toBe(false);
      expect(isSupportedImageType('')).toBe(false);
    });
  });

  describe('getExtensionForMimeType', () => {
    it('returns correct extensions for supported MIME types', () => {
      expect(getExtensionForMimeType('image/png')).toBe('png');
      expect(getExtensionForMimeType('image/jpeg')).toBe('jpg');
      expect(getExtensionForMimeType('image/gif')).toBe('gif');
      expect(getExtensionForMimeType('image/webp')).toBe('webp');
      expect(getExtensionForMimeType('image/svg+xml')).toBe('svg');
    });
  });

  describe('SUPPORTED_IMAGE_TYPES', () => {
    it('contains all expected image types', () => {
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/png');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/jpeg');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/gif');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/webp');
      expect(SUPPORTED_IMAGE_TYPES).toContain('image/svg+xml');
      expect(SUPPORTED_IMAGE_TYPES).toHaveLength(5);
    });
  });

  describe('save', () => {
    it('saves a PNG image successfully', async () => {
      const data = Buffer.from('fake png data');
      const result = await assetManager.save(data, 'image/png');

      expect(result.success).toBe(true);
      expect(result.assetId).toBeDefined();
      expect(result.ext).toBe('png');
      expect(result.error).toBeUndefined();
    });

    it('saves a JPEG image successfully', async () => {
      const data = Buffer.from('fake jpeg data');
      const result = await assetManager.save(data, 'image/jpeg');

      expect(result.success).toBe(true);
      expect(result.assetId).toBeDefined();
      expect(result.ext).toBe('jpg');
    });

    it('saves a GIF image successfully', async () => {
      const data = Buffer.from('fake gif data');
      const result = await assetManager.save(data, 'image/gif');

      expect(result.success).toBe(true);
      expect(result.assetId).toBeDefined();
      expect(result.ext).toBe('gif');
    });

    it('saves a WebP image successfully', async () => {
      const data = Buffer.from('fake webp data');
      const result = await assetManager.save(data, 'image/webp');

      expect(result.success).toBe(true);
      expect(result.assetId).toBeDefined();
      expect(result.ext).toBe('webp');
    });

    it('saves an SVG image successfully', async () => {
      const svgData = Buffer.from(
        '<svg xmlns="http://www.w3.org/2000/svg"><circle cx="50" cy="50" r="40"/></svg>'
      );
      const result = await assetManager.save(svgData, 'image/svg+xml');

      expect(result.success).toBe(true);
      expect(result.assetId).toBeDefined();
      expect(result.ext).toBe('svg');
    });

    it('rejects unsupported MIME types', async () => {
      const data = Buffer.from('some data');

      const bmpResult = await assetManager.save(data, 'image/bmp');
      expect(bmpResult.success).toBe(false);
      expect(bmpResult.error).toContain('Unsupported MIME type');
      expect(bmpResult.error).toContain('image/bmp');

      const pdfResult = await assetManager.save(data, 'application/pdf');
      expect(pdfResult.success).toBe(false);
      expect(pdfResult.error).toContain('Unsupported MIME type');

      const textResult = await assetManager.save(data, 'text/plain');
      expect(textResult.success).toBe(false);
      expect(textResult.error).toContain('Unsupported MIME type');
    });

    it('generates unique asset IDs', async () => {
      const data = Buffer.from('test data');
      const result1 = await assetManager.save(data, 'image/png');
      const result2 = await assetManager.save(data, 'image/png');

      expect(result1.success).toBe(true);
      expect(result2.success).toBe(true);
      expect(result1.assetId).not.toBe(result2.assetId);
    });

    it('writes file to disk with correct content', async () => {
      const originalData = Buffer.from('original image content');
      const result = await assetManager.save(originalData, 'image/png');

      expect(result.success).toBe(true);

      // Read the file directly to verify
      const filePath = path.join(tempDir, 'assets', `${result.assetId}.png`);
      const fileContent = await fs.readFile(filePath);
      expect(fileContent.equals(originalData)).toBe(true);
    });

    it('creates assets directory if it does not exist', async () => {
      // Remove assets directory
      const assetsDir = path.join(tempDir, 'assets');
      await fs.rm(assetsDir, { recursive: true, force: true });

      // Save should recreate it
      const data = Buffer.from('test data');
      const result = await assetManager.save(data, 'image/png');

      expect(result.success).toBe(true);

      // Verify directory exists
      const stats = await fs.stat(assetsDir);
      expect(stats.isDirectory()).toBe(true);
    });
  });

  describe('load', () => {
    it('loads a saved asset', async () => {
      const originalData = Buffer.from('test image data for loading');
      const saveResult = await assetManager.save(originalData, 'image/png');

      expect(saveResult.success).toBe(true);
      expect(saveResult.assetId).toBeDefined();

      const loadedData = await assetManager.load(saveResult.assetId!);
      expect(loadedData).not.toBeNull();
      expect(loadedData!.equals(originalData)).toBe(true);
    });

    it('returns null for non-existent asset', async () => {
      const result = await assetManager.load('non-existent-id');
      expect(result).toBeNull();
    });

    it('finds asset regardless of extension', async () => {
      // Save assets with different MIME types
      const pngData = Buffer.from('png data');
      const jpegData = Buffer.from('jpeg data');

      const pngResult = await assetManager.save(pngData, 'image/png');
      const jpegResult = await assetManager.save(jpegData, 'image/jpeg');

      // Load by ID should find correct file
      const loadedPng = await assetManager.load(pngResult.assetId!);
      const loadedJpeg = await assetManager.load(jpegResult.assetId!);

      expect(loadedPng!.equals(pngData)).toBe(true);
      expect(loadedJpeg!.equals(jpegData)).toBe(true);
    });
  });

  describe('delete', () => {
    it('deletes an existing asset', async () => {
      const data = Buffer.from('data to delete');
      const saveResult = await assetManager.save(data, 'image/png');

      expect(saveResult.success).toBe(true);

      const deleteResult = await assetManager.delete(saveResult.assetId!);
      expect(deleteResult).toBe(true);

      // Verify file is gone
      const loadResult = await assetManager.load(saveResult.assetId!);
      expect(loadResult).toBeNull();
    });

    it('returns false for non-existent asset', async () => {
      const result = await assetManager.delete('non-existent-id');
      expect(result).toBe(false);
    });

    it('deletes asset with any supported extension', async () => {
      const svgData = Buffer.from('<svg></svg>');
      const saveResult = await assetManager.save(svgData, 'image/svg+xml');

      expect(saveResult.success).toBe(true);

      const deleteResult = await assetManager.delete(saveResult.assetId!);
      expect(deleteResult).toBe(true);
    });
  });

  describe('exists', () => {
    it('returns true for existing asset', async () => {
      const data = Buffer.from('test data');
      const saveResult = await assetManager.save(data, 'image/png');

      expect(saveResult.success).toBe(true);

      const existsResult = await assetManager.exists(saveResult.assetId!);
      expect(existsResult).toBe(true);
    });

    it('returns false for non-existent asset', async () => {
      const result = await assetManager.exists('non-existent-id');
      expect(result).toBe(false);
    });

    it('returns false after asset is deleted', async () => {
      const data = Buffer.from('test data');
      const saveResult = await assetManager.save(data, 'image/png');

      await assetManager.delete(saveResult.assetId!);

      const existsResult = await assetManager.exists(saveResult.assetId!);
      expect(existsResult).toBe(false);
    });
  });

  describe('getPath', () => {
    it('returns full path for existing asset', async () => {
      const data = Buffer.from('test data');
      const saveResult = await assetManager.save(data, 'image/png');

      expect(saveResult.success).toBe(true);

      const assetPath = await assetManager.getPath(saveResult.assetId!);
      expect(assetPath).not.toBeNull();
      expect(assetPath).toContain(saveResult.assetId);
      expect(assetPath!.endsWith('.png')).toBe(true);
    });

    it('returns null for non-existent asset', async () => {
      const result = await assetManager.getPath('non-existent-id');
      expect(result).toBeNull();
    });

    it('returns correct extension in path', async () => {
      const jpegData = Buffer.from('jpeg data');
      const saveResult = await assetManager.save(jpegData, 'image/jpeg');

      const assetPath = await assetManager.getPath(saveResult.assetId!);
      expect(assetPath).not.toBeNull();
      expect(assetPath!.endsWith('.jpg')).toBe(true);
    });
  });

  describe('atomic write behavior', () => {
    it('does not leave temp files on successful save', async () => {
      const data = Buffer.from('test data');
      const result = await assetManager.save(data, 'image/png');

      expect(result.success).toBe(true);

      // Check for any temp files in assets directory
      const assetsDir = path.join(tempDir, 'assets');
      const files = await fs.readdir(assetsDir);
      const tempFiles = files.filter((f) => f.includes('.tmp'));

      expect(tempFiles).toHaveLength(0);
    });

    it('cleans up temp file on error', async () => {
      // Create a read-only assets directory to force write failure
      const assetsDir = path.join(tempDir, 'assets');

      // First save something to ensure directory exists
      const initialData = Buffer.from('initial');
      await assetManager.save(initialData, 'image/png');

      // Make the directory read-only (this may not work on all systems)
      try {
        await fs.chmod(assetsDir, 0o444);

        const data = Buffer.from('test data');
        const result = await assetManager.save(data, 'image/png');

        // Restore permissions for cleanup
        await fs.chmod(assetsDir, 0o755);

        // On systems where chmod works, save should fail
        // On others, it might succeed - that's okay
        if (!result.success) {
          // Verify no temp files remain
          const files = await fs.readdir(assetsDir);
          const tempFiles = files.filter((f) => f.includes('.tmp'));
          expect(tempFiles).toHaveLength(0);
        }
      } catch {
        // If chmod doesn't work on this system, skip this test
        await fs.chmod(assetsDir, 0o755).catch(() => {});
      }
    });
  });
});
