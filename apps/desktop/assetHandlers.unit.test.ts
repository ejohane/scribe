/**
 * Unit Tests for assetHandlers.ts IPC Handler Logic
 *
 * Tests the IPC handler logic for asset operations:
 * - Save assets (ArrayBuffer -> Buffer conversion)
 * - Load assets (Buffer -> ArrayBuffer conversion)
 * - Delete assets
 * - Get asset paths
 *
 * These tests verify:
 * - ArrayBuffer to Buffer conversion for save operations
 * - Buffer to ArrayBuffer conversion for load operations
 * - Error handling and logging
 * - Correct delegation to AssetManager
 *
 * @module handlers/assetHandlers.unit.test
 */

import { describe, it, expect, beforeEach, afterEach, spyOn } from 'bun:test';
import * as fs from 'node:fs/promises';

// =============================================================================
// Types matching the actual implementation
// =============================================================================

interface AssetSaveResult {
  success: boolean;
  assetId?: string;
  ext?: string;
  error?: string;
}

interface MockAssetManager {
  save: (data: Buffer, mimeType: string) => Promise<AssetSaveResult>;
  load: (assetId: string) => Promise<Buffer | null>;
  delete: (assetId: string) => Promise<boolean>;
  getPath: (assetId: string) => Promise<string | null>;
}

// =============================================================================
// Test implementation that mirrors assetHandlers.ts logic
// This allows us to test the core algorithm without Electron/IPC dependencies
// =============================================================================

/**
 * Handle ASSETS_SAVE - Convert ArrayBuffer to Buffer and delegate to AssetManager
 */
async function handleAssetSave(
  assetManager: MockAssetManager,
  data: ArrayBuffer,
  mimeType: string,
  _filename?: string
): Promise<AssetSaveResult> {
  try {
    const buffer = Buffer.from(data);
    const result = await assetManager.save(buffer, mimeType);
    return result;
  } catch (error) {
    const err = error as Error;
    return { success: false, error: `Unexpected error: ${err.message}` };
  }
}

/**
 * Handle ASSETS_LOAD - Load asset and convert Buffer to ArrayBuffer
 */
async function handleAssetLoad(
  assetManager: MockAssetManager,
  assetId: string
): Promise<ArrayBuffer | null> {
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
    return null;
  }
}

/**
 * Handle ASSETS_DELETE - Delete asset by ID
 */
async function handleAssetDelete(
  assetManager: MockAssetManager,
  assetId: string
): Promise<boolean> {
  try {
    return await assetManager.delete(assetId);
  } catch (error) {
    return false;
  }
}

/**
 * Handle ASSETS_GET_PATH - Get filesystem path for asset
 */
async function handleAssetGetPath(
  assetManager: MockAssetManager,
  assetId: string
): Promise<string | null> {
  try {
    return await assetManager.getPath(assetId);
  } catch (error) {
    return null;
  }
}

// =============================================================================
// Helper functions for creating mocks
// =============================================================================

function createMockAssetManager(overrides: Partial<MockAssetManager> = {}): MockAssetManager {
  return {
    save: overrides.save ?? (async () => ({ success: true, assetId: 'test-uuid', ext: 'png' })),
    load: overrides.load ?? (async () => Buffer.from('test data')),
    delete: overrides.delete ?? (async () => true),
    getPath: overrides.getPath ?? (async () => '/path/to/asset.png'),
  };
}

// =============================================================================
// Unit Tests
// =============================================================================

describe('handleAssetSave', () => {
  describe('ArrayBuffer to Buffer conversion', () => {
    it('should convert ArrayBuffer to Buffer correctly', async () => {
      let receivedBuffer: Buffer | null = null;
      const mockManager = createMockAssetManager({
        save: async (data: Buffer) => {
          receivedBuffer = data;
          return { success: true, assetId: 'test-uuid', ext: 'png' };
        },
      });

      const originalData = new Uint8Array([0x89, 0x50, 0x4e, 0x47]).buffer; // PNG magic bytes
      await handleAssetSave(mockManager, originalData, 'image/png');

      expect(receivedBuffer).not.toBeNull();
      expect(receivedBuffer!.length).toBe(4);
      expect(receivedBuffer![0]).toBe(0x89);
      expect(receivedBuffer![1]).toBe(0x50);
      expect(receivedBuffer![2]).toBe(0x4e);
      expect(receivedBuffer![3]).toBe(0x47);
    });

    it('should handle empty ArrayBuffer', async () => {
      let receivedBuffer: Buffer | null = null;
      const mockManager = createMockAssetManager({
        save: async (data: Buffer) => {
          receivedBuffer = data;
          return { success: true, assetId: 'test-uuid', ext: 'png' };
        },
      });

      const emptyData = new ArrayBuffer(0);
      await handleAssetSave(mockManager, emptyData, 'image/png');

      expect(receivedBuffer).not.toBeNull();
      expect(receivedBuffer!.length).toBe(0);
    });

    it('should handle large ArrayBuffer', async () => {
      let receivedSize = 0;
      const mockManager = createMockAssetManager({
        save: async (data: Buffer) => {
          receivedSize = data.length;
          return { success: true, assetId: 'test-uuid', ext: 'png' };
        },
      });

      // 1MB of data
      const largeData = new ArrayBuffer(1024 * 1024);
      await handleAssetSave(mockManager, largeData, 'image/png');

      expect(receivedSize).toBe(1024 * 1024);
    });
  });

  describe('successful save', () => {
    it('should return success result with assetId and ext', async () => {
      const mockManager = createMockAssetManager({
        save: async () => ({ success: true, assetId: 'abc-123', ext: 'jpg' }),
      });

      const data = new Uint8Array([1, 2, 3]).buffer;
      const result = await handleAssetSave(mockManager, data, 'image/jpeg');

      expect(result.success).toBe(true);
      expect(result.assetId).toBe('abc-123');
      expect(result.ext).toBe('jpg');
      expect(result.error).toBeUndefined();
    });

    it('should pass mimeType to AssetManager', async () => {
      let receivedMimeType = '';
      const mockManager = createMockAssetManager({
        save: async (_data: Buffer, mimeType: string) => {
          receivedMimeType = mimeType;
          return { success: true, assetId: 'test-uuid', ext: 'webp' };
        },
      });

      const data = new ArrayBuffer(10);
      await handleAssetSave(mockManager, data, 'image/webp');

      expect(receivedMimeType).toBe('image/webp');
    });
  });

  describe('failed save', () => {
    it('should return error for unsupported MIME type', async () => {
      const mockManager = createMockAssetManager({
        save: async () => ({
          success: false,
          error: 'Unsupported MIME type: image/bmp',
        }),
      });

      const data = new ArrayBuffer(10);
      const result = await handleAssetSave(mockManager, data, 'image/bmp');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unsupported MIME type');
    });

    it('should catch and wrap unexpected errors', async () => {
      const mockManager = createMockAssetManager({
        save: async () => {
          throw new Error('Disk full');
        },
      });

      const data = new ArrayBuffer(10);
      const result = await handleAssetSave(mockManager, data, 'image/png');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Unexpected error');
      expect(result.error).toContain('Disk full');
    });
  });
});

describe('handleAssetLoad', () => {
  describe('Buffer to ArrayBuffer conversion', () => {
    it('should convert Buffer to ArrayBuffer correctly', async () => {
      const originalBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
      const mockManager = createMockAssetManager({
        load: async () => originalBuffer,
      });

      const result = await handleAssetLoad(mockManager, 'test-asset');

      expect(result).not.toBeNull();
      expect(result!.byteLength).toBe(4);

      const view = new Uint8Array(result!);
      expect(view[0]).toBe(0x89);
      expect(view[1]).toBe(0x50);
      expect(view[2]).toBe(0x4e);
      expect(view[3]).toBe(0x47);
    });

    it('should handle empty Buffer', async () => {
      const mockManager = createMockAssetManager({
        load: async () => Buffer.from([]),
      });

      const result = await handleAssetLoad(mockManager, 'test-asset');

      expect(result).not.toBeNull();
      expect(result!.byteLength).toBe(0);
    });

    it('should return proper ArrayBuffer not SharedArrayBuffer', async () => {
      const originalBuffer = Buffer.from([1, 2, 3]);
      const mockManager = createMockAssetManager({
        load: async () => originalBuffer,
      });

      const result = await handleAssetLoad(mockManager, 'test-asset');

      expect(result).not.toBeNull();
      expect(result!.constructor.name).toBe('ArrayBuffer');
    });
  });

  describe('asset not found', () => {
    it('should return null for non-existent asset', async () => {
      const mockManager = createMockAssetManager({
        load: async () => null,
      });

      const result = await handleAssetLoad(mockManager, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should return null on error', async () => {
      const mockManager = createMockAssetManager({
        load: async () => {
          throw new Error('Read error');
        },
      });

      const result = await handleAssetLoad(mockManager, 'test-asset');

      expect(result).toBeNull();
    });
  });
});

describe('handleAssetDelete', () => {
  describe('successful delete', () => {
    it('should return true when asset is deleted', async () => {
      const mockManager = createMockAssetManager({
        delete: async () => true,
      });

      const result = await handleAssetDelete(mockManager, 'test-asset');

      expect(result).toBe(true);
    });
  });

  describe('asset not found', () => {
    it('should return false when asset does not exist', async () => {
      const mockManager = createMockAssetManager({
        delete: async () => false,
      });

      const result = await handleAssetDelete(mockManager, 'non-existent');

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    it('should return false on error', async () => {
      const mockManager = createMockAssetManager({
        delete: async () => {
          throw new Error('Delete error');
        },
      });

      const result = await handleAssetDelete(mockManager, 'test-asset');

      expect(result).toBe(false);
    });
  });
});

describe('handleAssetGetPath', () => {
  describe('existing asset', () => {
    it('should return path for existing asset', async () => {
      const expectedPath = '/vault/assets/abc-123.png';
      const mockManager = createMockAssetManager({
        getPath: async () => expectedPath,
      });

      const result = await handleAssetGetPath(mockManager, 'abc-123');

      expect(result).toBe(expectedPath);
    });
  });

  describe('non-existent asset', () => {
    it('should return null for non-existent asset', async () => {
      const mockManager = createMockAssetManager({
        getPath: async () => null,
      });

      const result = await handleAssetGetPath(mockManager, 'non-existent');

      expect(result).toBeNull();
    });
  });

  describe('error handling', () => {
    it('should return null on error', async () => {
      const mockManager = createMockAssetManager({
        getPath: async () => {
          throw new Error('Path error');
        },
      });

      const result = await handleAssetGetPath(mockManager, 'test-asset');

      expect(result).toBeNull();
    });
  });
});

// =============================================================================
// Contract Tests - Verify the actual assetHandlers.ts matches expected behavior
// =============================================================================

describe('assetHandlers.ts Contract', () => {
  it('should have proper ArrayBuffer to Buffer conversion', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/assetHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify ArrayBuffer -> Buffer conversion
    expect(content).toContain('Buffer.from(data)');
  });

  it('should have proper Buffer to ArrayBuffer conversion for load', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/assetHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify Buffer -> ArrayBuffer conversion using Uint8Array
    expect(content).toContain('new Uint8Array(buffer).buffer');
  });

  it('should register all four handlers', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/assetHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify all handlers are registered
    expect(content).toContain('IPC_CHANNELS.ASSETS_SAVE');
    expect(content).toContain('IPC_CHANNELS.ASSETS_LOAD');
    expect(content).toContain('IPC_CHANNELS.ASSETS_DELETE');
    expect(content).toContain('IPC_CHANNELS.ASSETS_GET_PATH');
  });

  it('should have cleanup function that removes all handlers', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/assetHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify cleanup removes all handlers
    expect(content).toContain('ipcMain.removeHandler(IPC_CHANNELS.ASSETS_SAVE)');
    expect(content).toContain('ipcMain.removeHandler(IPC_CHANNELS.ASSETS_LOAD)');
    expect(content).toContain('ipcMain.removeHandler(IPC_CHANNELS.ASSETS_DELETE)');
    expect(content).toContain('ipcMain.removeHandler(IPC_CHANNELS.ASSETS_GET_PATH)');
  });

  it('should use AssetManager from @scribe/storage-fs', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/assetHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify correct import
    expect(content).toContain("import { AssetManager } from '@scribe/storage-fs'");
    expect(content).toContain('new AssetManager(vaultPath)');
  });

  it('should export setupAssetHandlers function', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/assetHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify export
    expect(content).toContain('export function setupAssetHandlers');
  });

  it('should return cleanup function from setupAssetHandlers', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/assetHandlers.ts', import.meta.url),
      'utf-8'
    );

    // Verify return type
    expect(content).toContain('setupAssetHandlers(vaultPath: VaultPath): () => void');
  });
});

describe('handlers/index.ts Contract', () => {
  it('should export setupAssetHandlers', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/handlers/index.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain("export { setupAssetHandlers } from './assetHandlers'");
  });
});

describe('main.ts Contract', () => {
  it('should import setupAssetHandlers', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('setupAssetHandlers');
  });

  it('should call setupAssetHandlers with vaultPath', async () => {
    const content = await fs.readFile(
      new URL('./electron/main/src/main.ts', import.meta.url),
      'utf-8'
    );

    expect(content).toContain('setupAssetHandlers(vaultPath)');
  });
});
