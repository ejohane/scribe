/**
 * Unit tests for credential-manager.ts
 *
 * Tests secure credential storage using Electron's safeStorage API.
 * Uses vitest with hoisted mocks to mock Electron's safeStorage module
 * since it's only available in the Electron runtime.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as path from 'node:path';

// Use vi.hoisted for mocks that need to be available before imports
const mocks = vi.hoisted(() => ({
  // safeStorage mocks
  isEncryptionAvailable: vi.fn(() => true),
  encryptString: vi.fn((str: string) => Buffer.from(`encrypted:${str}`)),
  decryptString: vi.fn((buf: Buffer) => {
    const str = buf.toString();
    if (str.startsWith('encrypted:')) {
      return str.slice('encrypted:'.length);
    }
    throw new Error('Decryption failed');
  }),
  // fs mocks
  mkdir: vi.fn(),
  writeFile: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
  access: vi.fn(),
}));

// Mock electron safeStorage module
vi.mock('electron', () => ({
  safeStorage: {
    isEncryptionAvailable: mocks.isEncryptionAvailable,
    encryptString: mocks.encryptString,
    decryptString: mocks.decryptString,
  },
}));

// Mock fs/promises module
vi.mock('node:fs/promises', () => ({
  mkdir: mocks.mkdir,
  writeFile: mocks.writeFile,
  readFile: mocks.readFile,
  unlink: mocks.unlink,
  access: mocks.access,
}));

// Import after mocks are set up
import { CredentialManager, createCredentialManager } from './credential-manager';
import type { SyncCredentials } from './credential-manager';

describe('CredentialManager', () => {
  const testVaultPath = '/test/vault';
  const expectedCredentialPath = path.join(testVaultPath, '.scribe', '.sync-credentials');
  let manager: CredentialManager;

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset encryption availability to default (true)
    mocks.isEncryptionAvailable.mockReturnValue(true);
    manager = new CredentialManager(testVaultPath);
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isEncryptionAvailable', () => {
    it('returns true when safeStorage encryption is available', () => {
      mocks.isEncryptionAvailable.mockReturnValue(true);
      expect(manager.isEncryptionAvailable()).toBe(true);
    });

    it('returns false when safeStorage encryption is not available', () => {
      mocks.isEncryptionAvailable.mockReturnValue(false);
      expect(manager.isEncryptionAvailable()).toBe(false);
    });
  });

  describe('storeCredentials', () => {
    const testCredentials: SyncCredentials = {
      apiKey: 'test-api-key-123',
      userId: 'user-456',
    };

    it('stores encrypted credentials to file', async () => {
      await manager.storeCredentials(testCredentials);

      expect(mocks.mkdir).toHaveBeenCalledWith(path.dirname(expectedCredentialPath), {
        recursive: true,
      });
      expect(mocks.encryptString).toHaveBeenCalledWith(JSON.stringify(testCredentials));
      expect(mocks.writeFile).toHaveBeenCalledWith(expectedCredentialPath, expect.any(Buffer));
    });

    it('throws error when encryption is not available', async () => {
      mocks.isEncryptionAvailable.mockReturnValue(false);

      await expect(manager.storeCredentials(testCredentials)).rejects.toThrow(
        'Secure storage not available'
      );
    });

    it('stores credentials without userId', async () => {
      const credentialsWithoutUser: SyncCredentials = {
        apiKey: 'test-api-key',
      };

      await manager.storeCredentials(credentialsWithoutUser);

      expect(mocks.encryptString).toHaveBeenCalledWith(JSON.stringify(credentialsWithoutUser));
    });
  });

  describe('getCredentials', () => {
    const testCredentials: SyncCredentials = {
      apiKey: 'test-api-key-123',
      userId: 'user-456',
    };

    it('retrieves and decrypts stored credentials', async () => {
      const encryptedData = Buffer.from(`encrypted:${JSON.stringify(testCredentials)}`);
      mocks.readFile.mockResolvedValue(encryptedData);

      const result = await manager.getCredentials();

      expect(mocks.readFile).toHaveBeenCalledWith(expectedCredentialPath);
      expect(result).toEqual(testCredentials);
    });

    it('returns null when encryption is not available', async () => {
      mocks.isEncryptionAvailable.mockReturnValue(false);

      const result = await manager.getCredentials();

      expect(result).toBeNull();
      expect(mocks.readFile).not.toHaveBeenCalled();
    });

    it('returns null when file does not exist', async () => {
      mocks.readFile.mockRejectedValue(new Error('ENOENT: no such file'));

      const result = await manager.getCredentials();

      expect(result).toBeNull();
    });

    it('returns null when decryption fails', async () => {
      mocks.readFile.mockResolvedValue(Buffer.from('corrupted-data'));

      const result = await manager.getCredentials();

      expect(result).toBeNull();
    });
  });

  describe('getApiKey', () => {
    it('returns the API key from stored credentials', async () => {
      const testCredentials: SyncCredentials = {
        apiKey: 'my-secret-key',
        userId: 'user-123',
      };
      const encryptedData = Buffer.from(`encrypted:${JSON.stringify(testCredentials)}`);
      mocks.readFile.mockResolvedValue(encryptedData);

      const result = await manager.getApiKey();

      expect(result).toBe('my-secret-key');
    });

    it('returns null when no credentials stored', async () => {
      mocks.readFile.mockRejectedValue(new Error('ENOENT'));

      const result = await manager.getApiKey();

      expect(result).toBeNull();
    });
  });

  describe('clearCredentials', () => {
    it('deletes the credential file', async () => {
      mocks.unlink.mockResolvedValue(undefined);

      await manager.clearCredentials();

      expect(mocks.unlink).toHaveBeenCalledWith(expectedCredentialPath);
    });

    it('does not throw when file does not exist', async () => {
      mocks.unlink.mockRejectedValue(new Error('ENOENT: no such file'));

      // Should not throw
      await expect(manager.clearCredentials()).resolves.toBeUndefined();
    });
  });

  describe('hasCredentials', () => {
    it('returns true when credential file exists', async () => {
      mocks.access.mockResolvedValue(undefined);

      const result = await manager.hasCredentials();

      expect(result).toBe(true);
      expect(mocks.access).toHaveBeenCalledWith(expectedCredentialPath);
    });

    it('returns false when credential file does not exist', async () => {
      mocks.access.mockRejectedValue(new Error('ENOENT'));

      const result = await manager.hasCredentials();

      expect(result).toBe(false);
    });
  });

  describe('createCredentialManager', () => {
    it('creates a CredentialManager instance', () => {
      const result = createCredentialManager('/some/vault/path');

      expect(result).toBeInstanceOf(CredentialManager);
    });
  });
});
