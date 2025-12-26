/**
 * Unit Tests for Vault IPC Handlers
 *
 * Tests the vault management IPC handlers:
 * - vault:getPath - Get current vault path from config
 * - vault:setPath - Save new vault path (requires restart)
 * - vault:create - Create new vault at path
 * - vault:validate - Check if path is valid vault
 *
 * Issue: scribe-roo.18
 */

import { describe, it, expect } from 'bun:test';
import path from 'path';
import { homedir } from 'node:os';

// =============================================================================
// Types matching the actual implementation
// =============================================================================

interface AppConfig {
  lastOpenedNoteId?: string;
  theme?: 'light' | 'dark' | 'system';
  vaultPath?: string;
}

interface VaultSwitchResult {
  success: boolean;
  path: string;
  error?: string;
}

interface VaultCreateResult {
  success: boolean;
  path: string;
  error?: string;
}

interface VaultValidationResult {
  valid: boolean;
  missingDirs?: string[];
}

const DEFAULT_VAULT_PATH = path.join(homedir(), 'Scribe', 'vault');

// =============================================================================
// Mock storage-fs module functions
// =============================================================================

type IsValidVaultFn = (path: string) => Promise<boolean>;
type InitializeVaultFn = (path: string) => Promise<string>;

interface MockStorageFs {
  isValidVault: IsValidVaultFn;
  initializeVault: InitializeVaultFn;
}

// =============================================================================
// Test implementation that mirrors vaultHandlers.ts logic
// This allows us to test the error-handling without Electron dependencies
// =============================================================================

async function getVaultPath(loadConfig: () => Promise<AppConfig>): Promise<string> {
  const config = await loadConfig();
  return config.vaultPath || DEFAULT_VAULT_PATH;
}

async function setVaultPath(
  newPath: string,
  loadConfig: () => Promise<AppConfig>,
  saveConfig: (config: AppConfig) => Promise<void>,
  storagefs: MockStorageFs
): Promise<VaultSwitchResult> {
  try {
    const valid = await storagefs.isValidVault(newPath);

    if (!valid) {
      return {
        success: false,
        path: newPath,
        error: 'Not a valid Scribe vault. Missing required folders (notes, quarantine).',
      };
    }

    const config = await loadConfig();
    config.vaultPath = newPath;
    await saveConfig(config);

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

async function createVault(
  newPath: string,
  loadConfig: () => Promise<AppConfig>,
  saveConfig: (config: AppConfig) => Promise<void>,
  storagefs: MockStorageFs
): Promise<VaultCreateResult> {
  try {
    // Check if vault already exists
    const exists = await storagefs.isValidVault(newPath);
    if (exists) {
      return {
        success: false,
        path: newPath,
        error: 'A vault already exists at this location.',
      };
    }

    // Create the vault structure
    await storagefs.initializeVault(newPath);

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

async function validateVault(
  pathToValidate: string,
  storagefs: MockStorageFs,
  checkDirAccess: (dirPath: string) => Promise<boolean>
): Promise<VaultValidationResult> {
  try {
    const valid = await storagefs.isValidVault(pathToValidate);

    if (valid) {
      return { valid: true };
    }

    // Check which directories are missing
    const missingDirs: string[] = [];
    for (const subdir of ['notes', 'quarantine']) {
      const subdirPath = path.join(pathToValidate, subdir);
      const exists = await checkDirAccess(subdirPath);
      if (!exists) {
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

// =============================================================================
// Unit Tests
// =============================================================================

describe('Vault IPC Handlers Unit Tests', () => {
  describe('vault:getPath', () => {
    it('should return current vault path from config', async () => {
      const mockLoadConfig = async (): Promise<AppConfig> => ({
        vaultPath: '/custom/vault/path',
      });

      const result = await getVaultPath(mockLoadConfig);

      expect(result).toBe('/custom/vault/path');
    });

    it('should return default path if none configured', async () => {
      const mockLoadConfig = async (): Promise<AppConfig> => ({});

      const result = await getVaultPath(mockLoadConfig);

      expect(result).toBe(DEFAULT_VAULT_PATH);
    });

    it('should return default path if vaultPath is undefined', async () => {
      const mockLoadConfig = async (): Promise<AppConfig> => ({
        lastOpenedNoteId: 'note-123',
        vaultPath: undefined,
      });

      const result = await getVaultPath(mockLoadConfig);

      expect(result).toBe(DEFAULT_VAULT_PATH);
    });
  });

  describe('vault:validate', () => {
    it('should return valid:true for valid vault', async () => {
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => true,
        initializeVault: async () => '/path',
      };
      const mockCheckDirAccess = async () => true;

      const result = await validateVault('/valid/vault', mockStoragefs, mockCheckDirAccess);

      expect(result).toEqual({ valid: true });
    });

    it('should return valid:false with missing dirs for invalid vault', async () => {
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => false,
        initializeVault: async () => '/path',
      };
      // Simulate both dirs missing
      const mockCheckDirAccess = async () => false;

      const result = await validateVault('/invalid/vault', mockStoragefs, mockCheckDirAccess);

      expect(result).toEqual({
        valid: false,
        missingDirs: ['notes', 'quarantine'],
      });
    });

    it('should return only missing dirs that are actually missing', async () => {
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => false,
        initializeVault: async () => '/path',
      };
      // Simulate only quarantine missing
      const mockCheckDirAccess = async (dirPath: string) => {
        return dirPath.endsWith('notes');
      };

      const result = await validateVault('/partial/vault', mockStoragefs, mockCheckDirAccess);

      expect(result).toEqual({
        valid: false,
        missingDirs: ['quarantine'],
      });
    });

    it('should handle non-existent path gracefully', async () => {
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => {
          throw new Error('ENOENT: no such file or directory');
        },
        initializeVault: async () => '/path',
      };
      const mockCheckDirAccess = async () => false;

      const result = await validateVault('/nonexistent/path', mockStoragefs, mockCheckDirAccess);

      expect(result).toEqual({ valid: false });
    });
  });

  describe('vault:setPath', () => {
    it('should validate path before saving', async () => {
      let isValidVaultCalled = false;
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => {
          isValidVaultCalled = true;
          return true;
        },
        initializeVault: async () => '/path',
      };
      const mockLoadConfig = async (): Promise<AppConfig> => ({});
      const mockSaveConfig = async () => {};

      await setVaultPath('/new/path', mockLoadConfig, mockSaveConfig, mockStoragefs);

      expect(isValidVaultCalled).toBe(true);
    });

    it('should return error for invalid vault', async () => {
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => false,
        initializeVault: async () => '/path',
      };
      const mockLoadConfig = async (): Promise<AppConfig> => ({});
      let saveConfigCalled = false;
      const mockSaveConfig = async () => {
        saveConfigCalled = true;
      };

      const result = await setVaultPath(
        '/invalid/vault',
        mockLoadConfig,
        mockSaveConfig,
        mockStoragefs
      );

      expect(result).toEqual({
        success: false,
        path: '/invalid/vault',
        error: 'Not a valid Scribe vault. Missing required folders (notes, quarantine).',
      });
      expect(saveConfigCalled).toBe(false);
    });

    it('should save new path to config on success', async () => {
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => true,
        initializeVault: async () => '/path',
      };
      const mockLoadConfig = async (): Promise<AppConfig> => ({ lastOpenedNoteId: 'note-123' });
      let savedConfig: AppConfig | null = null;
      const mockSaveConfig = async (config: AppConfig) => {
        savedConfig = config;
      };

      const result = await setVaultPath(
        '/new/vault/path',
        mockLoadConfig,
        mockSaveConfig,
        mockStoragefs
      );

      expect(result).toEqual({
        success: true,
        path: '/new/vault/path',
      });
      expect(savedConfig).not.toBeNull();
      expect(savedConfig!.vaultPath).toBe('/new/vault/path');
      expect(savedConfig!.lastOpenedNoteId).toBe('note-123');
    });

    it('should handle errors during validation gracefully', async () => {
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => {
          throw new Error('Permission denied');
        },
        initializeVault: async () => '/path',
      };
      const mockLoadConfig = async (): Promise<AppConfig> => ({});
      const mockSaveConfig = async () => {};

      const result = await setVaultPath(
        '/protected/path',
        mockLoadConfig,
        mockSaveConfig,
        mockStoragefs
      );

      expect(result).toEqual({
        success: false,
        path: '/protected/path',
        error: 'Permission denied',
      });
    });
  });

  describe('vault:create', () => {
    it('should return error if vault already exists', async () => {
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => true,
        initializeVault: async () => '/path',
      };
      const mockLoadConfig = async (): Promise<AppConfig> => ({});
      const mockSaveConfig = async () => {};
      let initializeVaultCalled = false;
      mockStoragefs.initializeVault = async () => {
        initializeVaultCalled = true;
        return '/path';
      };

      const result = await createVault(
        '/existing/vault',
        mockLoadConfig,
        mockSaveConfig,
        mockStoragefs
      );

      expect(result).toEqual({
        success: false,
        path: '/existing/vault',
        error: 'A vault already exists at this location.',
      });
      expect(initializeVaultCalled).toBe(false);
    });

    it('should call initializeVault for new path', async () => {
      let initializedPath: string | null = null;
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => false,
        initializeVault: async (p: string) => {
          initializedPath = p;
          return p;
        },
      };
      const mockLoadConfig = async (): Promise<AppConfig> => ({});
      const mockSaveConfig = async () => {};

      const result = await createVault('/new/vault', mockLoadConfig, mockSaveConfig, mockStoragefs);

      expect(result).toEqual({
        success: true,
        path: '/new/vault',
      });
      expect(initializedPath === '/new/vault').toBe(true);
    });

    it('should return error if creation fails', async () => {
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => false,
        initializeVault: async () => {
          throw new Error('Failed to create directory');
        },
      };
      const mockLoadConfig = async (): Promise<AppConfig> => ({});
      const mockSaveConfig = async () => {};

      const result = await createVault(
        '/failed/vault',
        mockLoadConfig,
        mockSaveConfig,
        mockStoragefs
      );

      expect(result).toEqual({
        success: false,
        path: '/failed/vault',
        error: 'Failed to create directory',
      });
    });

    it('should handle permission denied gracefully', async () => {
      const mockStoragefs: MockStorageFs = {
        isValidVault: async () => false,
        initializeVault: async () => {
          throw new Error('EACCES: permission denied');
        },
      };
      const mockLoadConfig = async (): Promise<AppConfig> => ({});
      const mockSaveConfig = async () => {};

      const result = await createVault(
        '/protected/path',
        mockLoadConfig,
        mockSaveConfig,
        mockStoragefs
      );

      expect(result).toEqual({
        success: false,
        path: '/protected/path',
        error: 'EACCES: permission denied',
      });
    });
  });
});
