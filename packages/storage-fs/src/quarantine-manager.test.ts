/**
 * QuarantineManager unit tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createVaultPath } from '@scribe/shared';
import { QuarantineManager, createQuarantineManager } from './quarantine-manager.js';
import { initializeVault } from './vault.js';

describe('QuarantineManager', () => {
  let tempDir: string;
  let vaultPath: ReturnType<typeof createVaultPath>;
  let quarantineManager: QuarantineManager;

  beforeEach(async () => {
    // Create a temporary directory for tests
    tempDir = await mkdtemp(path.join(tmpdir(), 'scribe-quarantine-test-'));
    vaultPath = createVaultPath(tempDir);
    await initializeVault(vaultPath);
    quarantineManager = createQuarantineManager(vaultPath);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('quarantine', () => {
    it('should move file to quarantine directory', async () => {
      // Create a test file
      const notesDir = path.join(tempDir, 'notes');
      const testFile = 'test-note.json';
      await fs.writeFile(path.join(notesDir, testFile), '{ invalid json }');

      // Quarantine the file
      await quarantineManager.quarantine(testFile, 'Test reason');

      // Verify the file is no longer in the notes directory
      const notesFiles = await fs.readdir(notesDir);
      expect(notesFiles).not.toContain(testFile);

      // Verify the file is in the quarantine directory
      const quarantineDir = path.join(tempDir, 'quarantine');
      const quarantineFiles = await fs.readdir(quarantineDir);
      expect(quarantineFiles.length).toBe(1);
      expect(quarantineFiles[0]).toContain(testFile);
    });

    it('should track quarantined files in memory', async () => {
      // Create and quarantine a test file
      const notesDir = path.join(tempDir, 'notes');
      const testFile = 'test-note.json';
      await fs.writeFile(path.join(notesDir, testFile), '{ invalid }');

      await quarantineManager.quarantine(testFile, 'Test reason');

      // Check the list
      const quarantined = quarantineManager.listQuarantined();
      expect(quarantined).toContain(testFile);
    });

    it('should add timestamp prefix to quarantined file', async () => {
      const notesDir = path.join(tempDir, 'notes');
      const testFile = 'test-note.json';
      await fs.writeFile(path.join(notesDir, testFile), '{ invalid }');

      await quarantineManager.quarantine(testFile, 'Test reason');

      const quarantineDir = path.join(tempDir, 'quarantine');
      const quarantineFiles = await fs.readdir(quarantineDir);

      // File should have ISO timestamp prefix
      expect(quarantineFiles[0]).toMatch(
        /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z_test-note\.json$/
      );
    });

    it('should use fallback rename when quarantine directory move fails', async () => {
      // Create test file
      const notesDir = path.join(tempDir, 'notes');
      const testFile = 'test-note.json';
      await fs.writeFile(path.join(notesDir, testFile), '{ invalid }');

      // Remove quarantine directory and make it unwritable
      const quarantineDir = path.join(tempDir, 'quarantine');
      await rm(quarantineDir, { recursive: true });
      await fs.writeFile(quarantineDir, ''); // Create a file instead of directory
      await fs.chmod(quarantineDir, 0o000);

      try {
        await quarantineManager.quarantine(testFile, 'Test reason');

        // File should be renamed in place with .corrupt extension
        const notesFiles = await fs.readdir(notesDir);
        expect(notesFiles).toContain(`${testFile}.corrupt`);
        expect(notesFiles).not.toContain(testFile);
      } finally {
        // Clean up
        await fs.chmod(quarantineDir, 0o644);
      }
    });
  });

  describe('listQuarantined', () => {
    it('should return empty array when no files quarantined', () => {
      expect(quarantineManager.listQuarantined()).toEqual([]);
    });

    it('should return all quarantined file names', async () => {
      const notesDir = path.join(tempDir, 'notes');

      // Quarantine multiple files
      await fs.writeFile(path.join(notesDir, 'file1.json'), '{ }');
      await fs.writeFile(path.join(notesDir, 'file2.json'), '{ }');

      await quarantineManager.quarantine('file1.json', 'Reason 1');
      await quarantineManager.quarantine('file2.json', 'Reason 2');

      const quarantined = quarantineManager.listQuarantined();
      expect(quarantined).toHaveLength(2);
      expect(quarantined).toContain('file1.json');
      expect(quarantined).toContain('file2.json');
    });
  });

  describe('restore', () => {
    it('should restore file from quarantine to notes directory', async () => {
      const notesDir = path.join(tempDir, 'notes');
      const testFile = 'test-note.json';
      const testContent = '{ "test": true }';

      // Create and quarantine file
      await fs.writeFile(path.join(notesDir, testFile), testContent);
      await quarantineManager.quarantine(testFile, 'Test');

      // Verify file is quarantined
      expect(quarantineManager.listQuarantined()).toContain(testFile);

      // Restore file
      await quarantineManager.restore(testFile);

      // Verify file is back in notes directory
      const restoredContent = await fs.readFile(path.join(notesDir, testFile), 'utf-8');
      expect(restoredContent).toBe(testContent);

      // Verify file is removed from quarantine list
      expect(quarantineManager.listQuarantined()).not.toContain(testFile);
    });

    it('should throw error when file not in quarantine', async () => {
      await expect(quarantineManager.restore('nonexistent.json')).rejects.toThrow(
        'not in quarantine'
      );
    });

    it('should throw error when file already exists in notes directory', async () => {
      const notesDir = path.join(tempDir, 'notes');
      const testFile = 'test-note.json';

      // Create and quarantine file
      await fs.writeFile(path.join(notesDir, testFile), 'original');
      await quarantineManager.quarantine(testFile, 'Test');

      // Create a new file with the same name
      await fs.writeFile(path.join(notesDir, testFile), 'new content');

      // Restore should fail
      await expect(quarantineManager.restore(testFile)).rejects.toThrow('already exists');
    });
  });

  describe('deleteQuarantined', () => {
    it('should permanently delete quarantined file', async () => {
      const notesDir = path.join(tempDir, 'notes');
      const testFile = 'test-note.json';

      // Create and quarantine file
      await fs.writeFile(path.join(notesDir, testFile), '{ }');
      await quarantineManager.quarantine(testFile, 'Test');

      // Delete from quarantine
      await quarantineManager.deleteQuarantined(testFile);

      // Verify file is removed from quarantine list
      expect(quarantineManager.listQuarantined()).not.toContain(testFile);

      // Verify file is actually deleted from disk
      const quarantineDir = path.join(tempDir, 'quarantine');
      const quarantineFiles = await fs.readdir(quarantineDir);
      expect(quarantineFiles).toHaveLength(0);
    });

    it('should throw error when file not in quarantine', async () => {
      await expect(quarantineManager.deleteQuarantined('nonexistent.json')).rejects.toThrow(
        'not in quarantine'
      );
    });
  });

  describe('getQuarantineInfo', () => {
    it('should return detailed info about quarantined files', async () => {
      const notesDir = path.join(tempDir, 'notes');
      const testFile = 'test-note.json';

      // Create and quarantine file
      await fs.writeFile(path.join(notesDir, testFile), '{ }');
      await quarantineManager.quarantine(testFile, 'Test reason');

      const info = quarantineManager.getQuarantineInfo();
      expect(info).toHaveLength(1);
      expect(info[0].originalName).toBe(testFile);
      expect(info[0].reason).toBe('Test reason');
      expect(info[0].quarantinedAt).toBeInstanceOf(Date);
      expect(info[0].quarantinePath).toContain('quarantine');
    });
  });

  describe('clear', () => {
    it('should clear in-memory list of quarantined files', async () => {
      const notesDir = path.join(tempDir, 'notes');

      // Quarantine a file
      await fs.writeFile(path.join(notesDir, 'test.json'), '{ }');
      await quarantineManager.quarantine('test.json', 'Test');

      expect(quarantineManager.listQuarantined()).toHaveLength(1);

      // Clear the list
      quarantineManager.clear();

      expect(quarantineManager.listQuarantined()).toHaveLength(0);
    });
  });

  describe('scanQuarantineDir', () => {
    it('should populate in-memory list from disk', async () => {
      const quarantineDir = path.join(tempDir, 'quarantine');

      // Create quarantined files directly on disk
      await fs.writeFile(path.join(quarantineDir, '2025-01-01T12-00-00-000Z_file1.json'), '{ }');
      await fs.writeFile(path.join(quarantineDir, '2025-01-02T12-00-00-000Z_file2.json'), '{ }');

      // Create a new manager and scan
      const newManager = createQuarantineManager(vaultPath);
      await newManager.scanQuarantineDir();

      const quarantined = newManager.listQuarantined();
      expect(quarantined).toHaveLength(2);
      expect(quarantined).toContain('file1.json');
      expect(quarantined).toContain('file2.json');
    });

    it('should handle empty quarantine directory', async () => {
      const newManager = createQuarantineManager(vaultPath);
      await newManager.scanQuarantineDir();

      expect(newManager.listQuarantined()).toHaveLength(0);
    });

    it('should handle non-existent quarantine directory', async () => {
      // Remove quarantine directory
      const quarantineDir = path.join(tempDir, 'quarantine');
      await rm(quarantineDir, { recursive: true });

      const newManager = createQuarantineManager(vaultPath);
      await newManager.scanQuarantineDir();

      expect(newManager.listQuarantined()).toHaveLength(0);
    });
  });

  describe('createQuarantineManager', () => {
    it('should create a functional QuarantineManager instance', () => {
      const manager = createQuarantineManager(vaultPath);
      expect(manager).toBeInstanceOf(QuarantineManager);
      expect(manager.listQuarantined()).toEqual([]);
    });
  });
});
