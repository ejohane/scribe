/**
 * Unit tests for vault-resolver.ts
 *
 * Tests the vault path resolution logic with its precedence order:
 * 1. CLI flag (--vault)
 * 2. SCRIBE_VAULT_PATH environment variable
 * 3. Config file (~/.config/scribe/config.json)
 * 4. Default path (~/Scribe/vault)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { homedir } from 'os';
import { join } from 'path';
import { mkdir, rm } from 'fs/promises';
import { mkdtempSync } from 'fs';
import { tmpdir } from 'os';
import { resolveVaultPath, validateVaultPath, VaultNotFoundError } from '../../src/vault-resolver';

describe('vault-resolver', () => {
  let tempDir: string;
  let originalEnv: Record<string, string | undefined>;

  beforeEach(() => {
    // Create temp directory for tests
    tempDir = mkdtempSync(join(tmpdir(), 'vault-resolver-test-'));

    // Store original environment
    originalEnv = {
      SCRIBE_VAULT_PATH: process.env.SCRIBE_VAULT_PATH,
    };

    // Clear any existing env var
    delete process.env.SCRIBE_VAULT_PATH;
  });

  afterEach(async () => {
    // Restore original environment
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }

    // Clean up temp directory - INTENTIONAL: Swallow cleanup errors.
    // This is best-effort teardown; directory may already be removed or
    // process may be terminating. Test correctness is unaffected.
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});

    // Reset all mocks
    vi.restoreAllMocks();
  });

  describe('resolveVaultPath', () => {
    describe('precedence order', () => {
      it('should use CLI flag value when provided (highest priority)', () => {
        const flagPath = '/custom/vault/path';
        const result = resolveVaultPath(flagPath);

        expect(result.path).toBe(flagPath);
        expect(result.source).toBe('flag');
      });

      it('should expand ~ in CLI flag path', () => {
        const result = resolveVaultPath('~/my-vault');

        expect(result.path).toBe(join(homedir(), 'my-vault'));
        expect(result.source).toBe('flag');
      });

      it('should use SCRIBE_VAULT_PATH env var when no flag provided', () => {
        const envPath = '/env/vault/path';
        process.env.SCRIBE_VAULT_PATH = envPath;

        const result = resolveVaultPath();

        expect(result.path).toBe(envPath);
        expect(result.source).toBe('env');
      });

      it('should expand ~ in env var path', () => {
        process.env.SCRIBE_VAULT_PATH = '~/env-vault';

        const result = resolveVaultPath();

        expect(result.path).toBe(join(homedir(), 'env-vault'));
        expect(result.source).toBe('env');
      });

      it('should use default path when no flag, env, or config provided', () => {
        // Mock loadConfig to return null (no config file)
        vi.mock('../../src/config', () => ({
          loadConfig: () => null,
        }));

        const result = resolveVaultPath();

        // Default path is ~/Scribe/vault
        expect(result.path).toBe(join(homedir(), 'Scribe', 'vault'));
        expect(result.source).toBe('default');
      });

      it('should prefer CLI flag over env var', () => {
        const flagPath = '/flag/path';
        process.env.SCRIBE_VAULT_PATH = '/env/path';

        const result = resolveVaultPath(flagPath);

        expect(result.path).toBe(flagPath);
        expect(result.source).toBe('flag');
      });
    });

    describe('path normalization', () => {
      it('should return absolute path unchanged', () => {
        const absolutePath = '/absolute/path/to/vault';
        const result = resolveVaultPath(absolutePath);

        expect(result.path).toBe(absolutePath);
      });

      it('should expand tilde to home directory', () => {
        const result = resolveVaultPath('~/Documents/vault');

        expect(result.path).toBe(join(homedir(), 'Documents/vault'));
      });

      it('should handle tilde with no additional path', () => {
        const result = resolveVaultPath('~');

        expect(result.path).toBe(homedir());
      });

      it('should handle tilde with trailing slash', () => {
        const result = resolveVaultPath('~/');

        expect(result.path).toBe(join(homedir(), '/'));
      });
    });
  });

  describe('validateVaultPath', () => {
    it('should not throw for existing directory', async () => {
      // Create a test directory
      const vaultPath = join(tempDir, 'valid-vault');
      await mkdir(vaultPath, { recursive: true });

      expect(() => validateVaultPath(vaultPath)).not.toThrow();
    });

    it('should throw VaultNotFoundError for non-existent path', () => {
      const nonExistentPath = join(tempDir, 'does-not-exist');

      expect(() => validateVaultPath(nonExistentPath)).toThrow(VaultNotFoundError);
    });

    it('should include path in VaultNotFoundError', () => {
      const nonExistentPath = join(tempDir, 'missing-vault');

      try {
        validateVaultPath(nonExistentPath);
        expect.fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(VaultNotFoundError);
        expect((err as VaultNotFoundError).path).toBe(nonExistentPath);
        expect((err as VaultNotFoundError).message).toContain(nonExistentPath);
      }
    });
  });

  describe('VaultNotFoundError', () => {
    it('should have correct name', () => {
      const error = new VaultNotFoundError('/some/path');
      expect(error.name).toBe('VaultNotFoundError');
    });

    it('should store path property', () => {
      const path = '/test/vault/path';
      const error = new VaultNotFoundError(path);
      expect(error.path).toBe(path);
    });

    it('should include path in message', () => {
      const path = '/my/missing/vault';
      const error = new VaultNotFoundError(path);
      expect(error.message).toContain(path);
    });
  });
});
