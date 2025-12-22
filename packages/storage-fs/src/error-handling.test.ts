/**
 * Integration tests for error handling in save/load operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileSystemVault } from './storage.js';
import {
  ScribeError,
  ErrorCode,
  createVaultPath,
  createNoteId,
  type VaultPath,
  type EditorContent,
} from '@scribe/shared';

describe('Error Handling', () => {
  let tempDirStr: string;
  let tempDir: VaultPath;
  let vault: FileSystemVault;

  beforeEach(async () => {
    // Create temporary test directory
    tempDirStr = await fs.mkdtemp(path.join(os.tmpdir(), 'scribe-error-test-'));
    tempDir = createVaultPath(tempDirStr);
    await fs.mkdir(path.join(tempDirStr, 'notes'), { recursive: true });
    vault = new FileSystemVault(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDirStr, { recursive: true, force: true });
  });

  describe('Load Errors', () => {
    it('should throw ScribeError when vault directory does not exist', async () => {
      const nonExistentPath = createVaultPath(path.join(os.tmpdir(), 'non-existent-vault'));
      const badVault = new FileSystemVault(nonExistentPath);

      await expect(badVault.load()).rejects.toThrow(ScribeError);
      await expect(badVault.load()).rejects.toThrow(/Failed to read notes directory/);
    });

    it('should quarantine corrupted notes and continue loading valid notes', async () => {
      // Create a valid note
      await vault.create();

      // Create a corrupted note file
      const corruptedPath = path.join(tempDirStr, 'notes', 'corrupted.json');
      await fs.writeFile(corruptedPath, '{ invalid json }', 'utf-8');

      // Should load 1 note and quarantine the corrupted one
      const count = await vault.load();
      expect(count).toBe(1);

      // Verify the corrupt file was quarantined
      const quarantined = vault.getQuarantineManager().listQuarantined();
      expect(quarantined).toHaveLength(1);
      expect(quarantined[0]).toBe('corrupted.json');

      // Verify quarantine directory has the file
      const quarantineDir = path.join(tempDirStr, 'quarantine');
      const quarantineFiles = await fs.readdir(quarantineDir);
      expect(quarantineFiles.length).toBeGreaterThan(0);
      expect(quarantineFiles.some((f) => f.includes('corrupted.json'))).toBe(true);
    });

    it('should quarantine notes with missing required fields', async () => {
      // Create a note with missing metadata field
      const invalidNote = {
        id: 'test-id',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        // Missing metadata field
      };

      const invalidPath = path.join(tempDirStr, 'notes', 'invalid.json');
      await fs.writeFile(invalidPath, JSON.stringify(invalidNote), 'utf-8');

      // Should quarantine invalid note
      const count = await vault.load();
      expect(count).toBe(0);

      // Verify quarantine
      const quarantined = vault.getQuarantineManager().listQuarantined();
      expect(quarantined).toHaveLength(1);
      expect(quarantined[0]).toBe('invalid.json');
    });
  });

  describe('Read Errors', () => {
    it('should throw ScribeError when note is not found', () => {
      expect(() => vault.read(createNoteId('non-existent-id'))).toThrow(ScribeError);
      expect(() => vault.read(createNoteId('non-existent-id'))).toThrow(/Note not found/);
    });

    it('should include error code in thrown error', () => {
      try {
        vault.read(createNoteId('non-existent-id'));
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ScribeError);
        expect((error as ScribeError).code).toBe(ErrorCode.NOTE_NOT_FOUND);
      }
    });
  });

  describe('Save Errors', () => {
    it('should throw ScribeError when disk write fails', async () => {
      const note = await vault.create();

      // Make the notes directory read-only to simulate write failure
      await fs.chmod(path.join(tempDirStr, 'notes'), 0o444);

      const updatedNote = {
        ...note,
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Updated content' }],
              },
            ],
          },
        } as EditorContent,
      };

      await expect(vault.save(updatedNote)).rejects.toThrow(ScribeError);

      // Restore permissions for cleanup
      await fs.chmod(path.join(tempDirStr, 'notes'), 0o755);
    });

    it('should provide user-friendly error messages', async () => {
      const note = await vault.create();

      // Make directory read-only
      await fs.chmod(path.join(tempDirStr, 'notes'), 0o444);

      try {
        await vault.save(note);
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ScribeError);
        const scribeError = error as ScribeError;
        // Should provide a user-friendly message
        const message = scribeError.getUserMessage();
        expect(message.length).toBeGreaterThan(0);
        expect(message).toBeTruthy();
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(path.join(tempDirStr, 'notes'), 0o755);
      }
    });
  });

  describe('Delete Errors', () => {
    it('should throw ScribeError when deleting non-existent note', async () => {
      await expect(vault.delete(createNoteId('non-existent-id'))).rejects.toThrow(ScribeError);
    });

    it('should provide descriptive error on delete failure', async () => {
      try {
        await vault.delete(createNoteId('non-existent-id'));
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).toBeInstanceOf(ScribeError);
        const scribeError = error as ScribeError;
        expect(scribeError.message).toContain('Failed to delete note');
      }
    });
  });

  describe('Error Recovery', () => {
    it('should not corrupt vault state on save failure', async () => {
      const note = await vault.create();
      const originalContent = note.content;

      // Make directory read-only
      await fs.chmod(path.join(tempDirStr, 'notes'), 0o444);

      try {
        await vault.save({ ...note, content: originalContent });
      } catch {
        // Expected to fail
      }

      // Restore permissions
      await fs.chmod(path.join(tempDirStr, 'notes'), 0o755);

      // Verify note still has original content
      const loadedNote = vault.read(note.id);
      expect(loadedNote.content).toEqual(originalContent);
    });
  });

  describe('Quarantine Failure Handling (scribe-8c8)', () => {
    it('should use fallback rename when quarantine directory move fails', async () => {
      // Create a corrupted note file
      const corruptedPath = path.join(tempDirStr, 'notes', 'corrupted.json');
      await fs.writeFile(corruptedPath, '{ invalid json }', 'utf-8');

      // Make quarantine directory read-only to force move failure
      const quarantineDir = path.join(tempDirStr, 'quarantine');
      await fs.mkdir(quarantineDir, { recursive: true });
      await fs.chmod(quarantineDir, 0o444);

      try {
        // Load should succeed using fallback strategy
        const count = await vault.load();
        expect(count).toBe(0);

        // Verify the corrupt file was handled
        const quarantined = vault.getQuarantineManager().listQuarantined();
        expect(quarantined).toHaveLength(1);
        expect(quarantined[0]).toBe('corrupted.json');

        // Verify fallback: file was renamed in place with .corrupt extension
        const notesDir = path.join(tempDirStr, 'notes');
        const files = await fs.readdir(notesDir);
        expect(files.some((f) => f === 'corrupted.json.corrupt')).toBe(true);
        expect(files.some((f) => f === 'corrupted.json')).toBe(false);
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(quarantineDir, 0o755);
      }
    });

    it('should throw ScribeError when both quarantine strategies fail', async () => {
      // Create a corrupted note file
      const corruptedPath = path.join(tempDirStr, 'notes', 'corrupted.json');
      await fs.writeFile(corruptedPath, '{ invalid json }', 'utf-8');

      // Make quarantine directory read-only
      const quarantineDir = path.join(tempDirStr, 'quarantine');
      await fs.mkdir(quarantineDir, { recursive: true });
      await fs.chmod(quarantineDir, 0o444);

      // Make notes directory read-only to prevent in-place rename fallback
      const notesDir = path.join(tempDirStr, 'notes');
      await fs.chmod(notesDir, 0o444);

      try {
        // Load should throw since both strategies fail
        await expect(vault.load()).rejects.toThrow(ScribeError);
        await expect(vault.load()).rejects.toThrow(/Failed to quarantine corrupt file/);
      } finally {
        // Restore permissions for cleanup
        await fs.chmod(notesDir, 0o755);
        await fs.chmod(quarantineDir, 0o755);
      }
    });

    it('should not leave corrupt files in notes directory after successful quarantine', async () => {
      // Create a valid note
      await vault.create();

      // Create a corrupted note file
      const corruptedPath = path.join(tempDirStr, 'notes', 'corrupted.json');
      await fs.writeFile(corruptedPath, '{ invalid json }', 'utf-8');

      // Load should quarantine the corrupt file
      const count = await vault.load();
      expect(count).toBe(1);

      // Verify corrupt file is NOT in notes directory
      const notesDir = path.join(tempDirStr, 'notes');
      const files = await fs.readdir(notesDir);
      expect(files.some((f) => f === 'corrupted.json')).toBe(false);

      // Verify corrupt file IS in quarantine directory
      const quarantineDir = path.join(tempDirStr, 'quarantine');
      const quarantineFiles = await fs.readdir(quarantineDir);
      expect(quarantineFiles.some((f) => f.includes('corrupted.json'))).toBe(true);
    });

    it('should not leave corrupt files with fallback rename strategy', async () => {
      // Create a corrupted note file
      const corruptedPath = path.join(tempDirStr, 'notes', 'corrupted.json');
      await fs.writeFile(corruptedPath, '{ invalid json }', 'utf-8');

      // Make quarantine directory read-only to force fallback
      const quarantineDir = path.join(tempDirStr, 'quarantine');
      await fs.mkdir(quarantineDir, { recursive: true });
      await fs.chmod(quarantineDir, 0o444);

      try {
        await vault.load();

        // Verify original corrupt file is NOT in notes directory
        const notesDir = path.join(tempDirStr, 'notes');
        const files = await fs.readdir(notesDir);
        expect(files.some((f) => f === 'corrupted.json')).toBe(false);

        // But the .corrupt version should be there
        expect(files.some((f) => f === 'corrupted.json.corrupt')).toBe(true);
      } finally {
        await fs.chmod(quarantineDir, 0o755);
      }
    });
  });
});
