/**
 * Unit tests for vault initialization utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { createVaultPath, type VaultPath } from '@scribe/shared';
import {
  initializeVault,
  isValidVault,
  getNotesDir,
  getNoteFilePath,
  getQuarantineDir,
} from './vault.js';

describe('Vault Initialization', () => {
  let tempDir: string;
  let vaultPath: VaultPath;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scribe-vault-test-'));
    vaultPath = createVaultPath(path.join(tempDir, 'vault'));
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('initializeVault', () => {
    it('should create vault directory if it does not exist', async () => {
      const result = await initializeVault(vaultPath);

      expect(result).toBe(vaultPath);

      const stats = await fs.stat(vaultPath);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create notes subdirectory', async () => {
      await initializeVault(vaultPath);

      const notesDir = path.join(vaultPath, 'notes');
      const stats = await fs.stat(notesDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should create quarantine subdirectory', async () => {
      await initializeVault(vaultPath);

      const quarantineDir = path.join(vaultPath, 'quarantine');
      const stats = await fs.stat(quarantineDir);
      expect(stats.isDirectory()).toBe(true);
    });

    it('should be idempotent - calling multiple times succeeds', async () => {
      await initializeVault(vaultPath);
      await initializeVault(vaultPath);
      await initializeVault(vaultPath);

      const stats = await fs.stat(vaultPath);
      expect(stats.isDirectory()).toBe(true);

      const notesStats = await fs.stat(path.join(vaultPath, 'notes'));
      expect(notesStats.isDirectory()).toBe(true);

      const quarantineStats = await fs.stat(path.join(vaultPath, 'quarantine'));
      expect(quarantineStats.isDirectory()).toBe(true);
    });

    it('should create nested directories recursively', async () => {
      const deepVaultPath = createVaultPath(path.join(tempDir, 'deep', 'nested', 'path', 'vault'));

      await initializeVault(deepVaultPath);

      const stats = await fs.stat(deepVaultPath);
      expect(stats.isDirectory()).toBe(true);

      const notesStats = await fs.stat(path.join(deepVaultPath, 'notes'));
      expect(notesStats.isDirectory()).toBe(true);
    });

    it('should preserve existing content in subdirectories', async () => {
      await initializeVault(vaultPath);

      // Add a file to notes directory
      const testFile = path.join(vaultPath, 'notes', 'test.json');
      await fs.writeFile(testFile, '{"test": true}', 'utf-8');

      // Re-initialize vault
      await initializeVault(vaultPath);

      // Verify file still exists
      const content = await fs.readFile(testFile, 'utf-8');
      expect(content).toBe('{"test": true}');
    });

    it('should return the vault path as a VaultPath type', async () => {
      const result = await initializeVault(vaultPath);

      // TypeScript type check - result should be VaultPath
      const typedResult: VaultPath = result;
      expect(typedResult).toBe(vaultPath);
    });
  });

  describe('isValidVault', () => {
    it('should return true for a valid vault with all subdirectories', async () => {
      await initializeVault(vaultPath);

      const isValid = await isValidVault(vaultPath);

      expect(isValid).toBe(true);
    });

    it('should return false when vault directory does not exist', async () => {
      const nonExistentPath = createVaultPath(path.join(tempDir, 'non-existent-vault'));

      const isValid = await isValidVault(nonExistentPath);

      expect(isValid).toBe(false);
    });

    it('should return false when notes subdirectory is missing', async () => {
      // Create vault directory but only quarantine subdirectory
      await fs.mkdir(vaultPath, { recursive: true });
      await fs.mkdir(path.join(vaultPath, 'quarantine'), { recursive: true });

      const isValid = await isValidVault(vaultPath);

      expect(isValid).toBe(false);
    });

    it('should return false when quarantine subdirectory is missing', async () => {
      // Create vault directory but only notes subdirectory
      await fs.mkdir(vaultPath, { recursive: true });
      await fs.mkdir(path.join(vaultPath, 'notes'), { recursive: true });

      const isValid = await isValidVault(vaultPath);

      expect(isValid).toBe(false);
    });

    it('should return false when vault path is a file, not a directory', async () => {
      // Create a file instead of a directory
      await fs.writeFile(vaultPath, 'not a directory', 'utf-8');

      const isValid = await isValidVault(vaultPath);

      expect(isValid).toBe(false);
    });

    it('should return false when notes is a file, not a directory', async () => {
      await fs.mkdir(vaultPath, { recursive: true });
      await fs.mkdir(path.join(vaultPath, 'quarantine'), { recursive: true });
      // Create notes as a file instead of a directory
      await fs.writeFile(path.join(vaultPath, 'notes'), 'not a directory', 'utf-8');

      const isValid = await isValidVault(vaultPath);

      expect(isValid).toBe(false);
    });

    it('should return false when quarantine is a file, not a directory', async () => {
      await fs.mkdir(vaultPath, { recursive: true });
      await fs.mkdir(path.join(vaultPath, 'notes'), { recursive: true });
      // Create quarantine as a file instead of a directory
      await fs.writeFile(path.join(vaultPath, 'quarantine'), 'not a directory', 'utf-8');

      const isValid = await isValidVault(vaultPath);

      expect(isValid).toBe(false);
    });

    it('should handle permission errors gracefully', async () => {
      await initializeVault(vaultPath);

      // Make vault directory unreadable
      await fs.chmod(vaultPath, 0o000);

      try {
        const isValid = await isValidVault(vaultPath);
        // Should return false on permission error, not throw
        expect(isValid).toBe(false);
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(vaultPath, 0o755);
      }
    });
  });

  describe('getNotesDir', () => {
    it('should return the correct notes directory path', () => {
      const notesDir = getNotesDir(vaultPath);

      expect(notesDir).toBe(path.join(vaultPath, 'notes'));
    });

    it('should work with different vault paths', () => {
      const customVaultPath = createVaultPath('/custom/vault/path');

      const notesDir = getNotesDir(customVaultPath);

      expect(notesDir).toBe('/custom/vault/path/notes');
    });

    it('should handle paths with special characters', () => {
      const specialPath = createVaultPath('/path with spaces/vault');

      const notesDir = getNotesDir(specialPath);

      expect(notesDir).toBe('/path with spaces/vault/notes');
    });
  });

  describe('getNoteFilePath', () => {
    it('should return the correct note file path', () => {
      const noteFilePath = getNoteFilePath(vaultPath, 'note-123');

      expect(noteFilePath).toBe(path.join(vaultPath, 'notes', 'note-123.json'));
    });

    it('should handle different note IDs', () => {
      const noteFilePath = getNoteFilePath(vaultPath, 'abc-def-ghi');

      expect(noteFilePath).toBe(path.join(vaultPath, 'notes', 'abc-def-ghi.json'));
    });

    it('should work with UUID-style note IDs', () => {
      const noteId = 'f47ac10b-58cc-4372-a567-0e02b2c3d479';
      const noteFilePath = getNoteFilePath(vaultPath, noteId);

      expect(noteFilePath).toBe(path.join(vaultPath, 'notes', `${noteId}.json`));
    });

    it('should handle note IDs with special characters', () => {
      const noteId = 'note_with_underscores';
      const noteFilePath = getNoteFilePath(vaultPath, noteId);

      expect(noteFilePath).toBe(path.join(vaultPath, 'notes', 'note_with_underscores.json'));
    });
  });

  describe('getQuarantineDir', () => {
    it('should return the correct quarantine directory path', () => {
      const quarantineDir = getQuarantineDir(vaultPath);

      expect(quarantineDir).toBe(path.join(vaultPath, 'quarantine'));
    });

    it('should work with different vault paths', () => {
      const customVaultPath = createVaultPath('/custom/vault/path');

      const quarantineDir = getQuarantineDir(customVaultPath);

      expect(quarantineDir).toBe('/custom/vault/path/quarantine');
    });

    it('should handle paths with special characters', () => {
      const specialPath = createVaultPath('/path with spaces/vault');

      const quarantineDir = getQuarantineDir(specialPath);

      expect(quarantineDir).toBe('/path with spaces/vault/quarantine');
    });
  });

  describe('Error Handling', () => {
    it('should throw when initializing in a read-only parent directory', async () => {
      // Create a read-only directory
      const readOnlyDir = path.join(tempDir, 'readonly');
      await fs.mkdir(readOnlyDir);
      await fs.chmod(readOnlyDir, 0o444);

      const readOnlyVaultPath = createVaultPath(path.join(readOnlyDir, 'vault'));

      try {
        await expect(initializeVault(readOnlyVaultPath)).rejects.toThrow();
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(readOnlyDir, 0o755);
      }
    });

    it('should handle vault path that is already a file', async () => {
      // Create a file at the vault path
      const filePath = path.join(tempDir, 'file-vault');
      await fs.writeFile(filePath, 'I am a file', 'utf-8');

      const fileVaultPath = createVaultPath(filePath);

      // Attempting to mkdir with recursive:true when path is a file should fail
      await expect(initializeVault(fileVaultPath)).rejects.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty vault path gracefully', async () => {
      // Note: This tests behavior with an empty string path
      // The behavior depends on the OS and current directory
      const emptyPath = createVaultPath('');

      // This may succeed or fail depending on CWD permissions
      // Just verify it doesn't hang or cause unexpected behavior
      try {
        await initializeVault(emptyPath);
      } catch {
        // Expected to potentially fail
      }
    });

    it('should handle very long vault paths', async () => {
      // Create a path that is valid but very long
      const longSegment = 'a'.repeat(50);
      const longPath = createVaultPath(
        path.join(tempDir, longSegment, longSegment, longSegment, 'vault')
      );

      await initializeVault(longPath);

      const isValid = await isValidVault(longPath);
      expect(isValid).toBe(true);
    });

    it('should work with absolute paths', async () => {
      // Ensure we're using an absolute path
      const absolutePath = createVaultPath(path.resolve(tempDir, 'absolute-vault'));

      await initializeVault(absolutePath);

      const isValid = await isValidVault(absolutePath);
      expect(isValid).toBe(true);
    });

    it('should handle trailing slashes in vault path', async () => {
      const pathWithTrailingSlash = createVaultPath(
        path.join(tempDir, 'vault-with-slash') + path.sep
      );

      await initializeVault(pathWithTrailingSlash);

      // Note: path.join normalizes the path, so we need to check without trailing slash
      const normalizedPath = createVaultPath(path.join(tempDir, 'vault-with-slash'));
      const isValid = await isValidVault(normalizedPath);
      expect(isValid).toBe(true);
    });
  });

  describe('Integration', () => {
    it('should create a fully usable vault structure', async () => {
      // Initialize vault
      const result = await initializeVault(vaultPath);

      // Verify vault is valid
      expect(await isValidVault(result)).toBe(true);

      // Verify we can get all expected paths
      const notesDir = getNotesDir(result);
      const quarantineDir = getQuarantineDir(result);

      // Verify these directories exist
      const notesDirStats = await fs.stat(notesDir);
      expect(notesDirStats.isDirectory()).toBe(true);

      const quarantineDirStats = await fs.stat(quarantineDir);
      expect(quarantineDirStats.isDirectory()).toBe(true);

      // Verify we can write to the notes directory
      const testNotePath = getNoteFilePath(result, 'test-note');
      await fs.writeFile(testNotePath, '{"test": "data"}', 'utf-8');

      const noteContent = await fs.readFile(testNotePath, 'utf-8');
      expect(noteContent).toBe('{"test": "data"}');
    });

    it('should allow parallel initialization of different vaults', async () => {
      const vault1 = createVaultPath(path.join(tempDir, 'vault1'));
      const vault2 = createVaultPath(path.join(tempDir, 'vault2'));
      const vault3 = createVaultPath(path.join(tempDir, 'vault3'));

      // Initialize all vaults in parallel
      await Promise.all([
        initializeVault(vault1),
        initializeVault(vault2),
        initializeVault(vault3),
      ]);

      // Verify all vaults are valid
      expect(await isValidVault(vault1)).toBe(true);
      expect(await isValidVault(vault2)).toBe(true);
      expect(await isValidVault(vault3)).toBe(true);
    });
  });
});
