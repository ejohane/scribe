/**
 * Integration tests for error handling in save/load operations
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileSystemVault } from './storage.js';
import { ScribeError, ErrorCode } from '@scribe/shared';
import type { LexicalState } from '@scribe/shared';

describe('Error Handling', () => {
  let tempDir: string;
  let vault: FileSystemVault;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scribe-error-test-'));
    await fs.mkdir(path.join(tempDir, 'notes'), { recursive: true });
    vault = new FileSystemVault(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Load Errors', () => {
    it('should throw ScribeError when vault directory does not exist', async () => {
      const nonExistentPath = path.join(os.tmpdir(), 'non-existent-vault');
      const badVault = new FileSystemVault(nonExistentPath);

      await expect(badVault.load()).rejects.toThrow(ScribeError);
      await expect(badVault.load()).rejects.toThrow(/Failed to read notes directory/);
    });

    it('should skip corrupted notes and continue loading valid notes', async () => {
      // Create a valid note
      await vault.create();

      // Create a corrupted note file
      const corruptedPath = path.join(tempDir, 'notes', 'corrupted.json');
      await fs.writeFile(corruptedPath, '{ invalid json }', 'utf-8');

      // Should load 1 note and skip the corrupted one
      const count = await vault.load();
      expect(count).toBe(1);
    });

    it('should handle notes with missing required fields', async () => {
      // Create a note with missing metadata field
      const invalidNote = {
        id: 'test-id',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        content: { root: { type: 'root', children: [] } },
        // Missing metadata field
      };

      const invalidPath = path.join(tempDir, 'notes', 'invalid.json');
      await fs.writeFile(invalidPath, JSON.stringify(invalidNote), 'utf-8');

      // Should skip invalid note
      const count = await vault.load();
      expect(count).toBe(0);
    });
  });

  describe('Read Errors', () => {
    it('should throw ScribeError when note is not found', () => {
      expect(() => vault.read('non-existent-id')).toThrow(ScribeError);
      expect(() => vault.read('non-existent-id')).toThrow(/Note not found/);
    });

    it('should include error code in thrown error', () => {
      try {
        vault.read('non-existent-id');
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
      await fs.chmod(path.join(tempDir, 'notes'), 0o444);

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
        } as LexicalState,
      };

      await expect(vault.save(updatedNote)).rejects.toThrow(ScribeError);

      // Restore permissions for cleanup
      await fs.chmod(path.join(tempDir, 'notes'), 0o755);
    });

    it('should provide user-friendly error messages', async () => {
      const note = await vault.create();

      // Make directory read-only
      await fs.chmod(path.join(tempDir, 'notes'), 0o444);

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
        await fs.chmod(path.join(tempDir, 'notes'), 0o755);
      }
    });
  });

  describe('Delete Errors', () => {
    it('should throw ScribeError when deleting non-existent note', async () => {
      await expect(vault.delete('non-existent-id')).rejects.toThrow(ScribeError);
    });

    it('should provide descriptive error on delete failure', async () => {
      try {
        await vault.delete('non-existent-id');
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
      await fs.chmod(path.join(tempDir, 'notes'), 0o444);

      try {
        await vault.save({ ...note, content: originalContent });
      } catch {
        // Expected to fail
      }

      // Restore permissions
      await fs.chmod(path.join(tempDir, 'notes'), 0o755);

      // Verify note still has original content
      const loadedNote = vault.read(note.id);
      expect(loadedNote.content).toEqual(originalContent);
    });
  });
});
