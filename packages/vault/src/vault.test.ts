/**
 * Tests for Vault manager.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { Vault } from './vault.js';
import type { VaultDiscoveryResult } from './types.js';

describe('Vault', () => {
  let testVaultPath: string;
  let vault: Vault;

  beforeEach(() => {
    // Create temporary test vault
    testVaultPath = join(import.meta.dir, '..', '.test-vault');
    mkdirSync(testVaultPath, { recursive: true });
    vault = new Vault({ vaultPath: testVaultPath });
  });

  afterEach(() => {
    // Clean up test vault
    rmSync(testVaultPath, { recursive: true, force: true });
  });

  describe('discover', () => {
    it('should discover markdown files in root', () => {
      writeFileSync(join(testVaultPath, 'note.md'), '# Note');
      writeFileSync(join(testVaultPath, 'other.md'), '# Other');

      const result = vault.discover();

      expect(result.files).toHaveLength(2);
      expect(result.files.map((f) => f.relativePath).sort()).toEqual(['note.md', 'other.md']);
    });

    it('should discover markdown files in nested folders', () => {
      mkdirSync(join(testVaultPath, 'notes'), { recursive: true });
      mkdirSync(join(testVaultPath, 'notes/archive'), { recursive: true });
      writeFileSync(join(testVaultPath, 'notes', 'plan.md'), '# Plan');
      writeFileSync(join(testVaultPath, 'notes/archive', 'old.md'), '# Old');

      const result = vault.discover();

      expect(result.files).toHaveLength(2);
      expect(result.files.map((f) => f.relativePath).sort()).toEqual([
        'notes/archive/old.md',
        'notes/plan.md',
      ]);
    });

    it('should identify people folder files', () => {
      mkdirSync(join(testVaultPath, 'people'), { recursive: true });
      writeFileSync(join(testVaultPath, 'people', 'Erik.md'), '# Erik');
      writeFileSync(join(testVaultPath, 'note.md'), '# Note');

      const result = vault.discover();

      expect(result.files).toHaveLength(2);
      const erikFile = result.files.find((f) => f.relativePath === 'people/Erik.md');
      const noteFile = result.files.find((f) => f.relativePath === 'note.md');

      expect(erikFile?.isPerson).toBe(true);
      expect(noteFile?.isPerson).toBe(false);
    });

    it('should normalize paths to IDs', () => {
      mkdirSync(join(testVaultPath, 'notes'), { recursive: true });
      writeFileSync(join(testVaultPath, 'notes', 'plan.md'), '# Plan');

      const result = vault.discover();

      const file = result.files[0];
      expect(file.id).toBe('notes/plan');
      expect(file.relativePath).toBe('notes/plan.md');
    });

    it('should map folder IDs correctly', () => {
      mkdirSync(join(testVaultPath, 'notes'), { recursive: true });
      mkdirSync(join(testVaultPath, 'people'), { recursive: true });
      writeFileSync(join(testVaultPath, 'notes', 'plan.md'), '# Plan');
      writeFileSync(join(testVaultPath, 'root.md'), '# Root');

      const result = vault.discover();

      const planFile = result.files.find((f) => f.id === 'notes/plan');
      const rootFile = result.files.find((f) => f.id === 'root');

      expect(planFile?.folderId).toBe('notes');
      expect(rootFile?.folderId).toBeUndefined();
    });

    it('should discover folders', () => {
      mkdirSync(join(testVaultPath, 'notes'), { recursive: true });
      mkdirSync(join(testVaultPath, 'notes/archive'), { recursive: true });
      mkdirSync(join(testVaultPath, 'people'), { recursive: true });

      const result = vault.discover();

      expect(result.folders).toHaveLength(3);
      expect(result.folders.map((f) => f.id).sort()).toEqual(['notes', 'notes/archive', 'people']);
    });

    it('should set folder parent IDs correctly', () => {
      mkdirSync(join(testVaultPath, 'notes'), { recursive: true });
      mkdirSync(join(testVaultPath, 'notes/archive'), { recursive: true });

      const result = vault.discover();

      const notesFolder = result.foldersById.get('notes');
      const archiveFolder = result.foldersById.get('notes/archive');

      expect(notesFolder?.parentId).toBeUndefined();
      expect(archiveFolder?.parentId).toBe('notes');
    });

    it('should ignore hidden files and folders', () => {
      mkdirSync(join(testVaultPath, '.git'), { recursive: true });
      writeFileSync(join(testVaultPath, '.gitignore'), 'node_modules');
      writeFileSync(join(testVaultPath, 'note.md'), '# Note');

      const result = vault.discover();

      expect(result.files).toHaveLength(1);
      expect(result.folders).toHaveLength(0);
      expect(result.files[0].relativePath).toBe('note.md');
    });

    it('should ignore non-markdown files', () => {
      writeFileSync(join(testVaultPath, 'note.md'), '# Note');
      writeFileSync(join(testVaultPath, 'image.png'), 'fake image');
      writeFileSync(join(testVaultPath, 'data.json'), '{}');

      const result = vault.discover();

      expect(result.files).toHaveLength(1);
      expect(result.files[0].relativePath).toBe('note.md');
    });

    it('should populate filesByPath map', () => {
      writeFileSync(join(testVaultPath, 'note.md'), '# Note');

      const result = vault.discover();

      expect(result.filesByPath.has('note.md')).toBe(true);
      expect(result.filesByPath.get('note.md')?.id).toBe('note');
    });

    it('should populate filesById map', () => {
      writeFileSync(join(testVaultPath, 'note.md'), '# Note');

      const result = vault.discover();

      expect(result.filesById.has('note')).toBe(true);
      expect(result.filesById.get('note')?.relativePath).toBe('note.md');
    });

    it('should populate foldersById map', () => {
      mkdirSync(join(testVaultPath, 'notes'), { recursive: true });

      const result = vault.discover();

      expect(result.foldersById.has('notes')).toBe(true);
      expect(result.foldersById.get('notes')?.name).toBe('notes');
    });

    it('should handle empty vault', () => {
      const result = vault.discover();

      expect(result.files).toHaveLength(0);
      expect(result.folders).toHaveLength(0);
      expect(result.filesByPath.size).toBe(0);
      expect(result.filesById.size).toBe(0);
      expect(result.foldersById.size).toBe(0);
    });

    it('should handle deep nesting', () => {
      mkdirSync(join(testVaultPath, 'a/b/c/d'), { recursive: true });
      writeFileSync(join(testVaultPath, 'a/b/c/d/deep.md'), '# Deep');

      const result = vault.discover();

      expect(result.files).toHaveLength(1);
      expect(result.files[0].relativePath).toBe('a/b/c/d/deep.md');
      expect(result.files[0].id).toBe('a/b/c/d/deep');
      expect(result.files[0].folderId).toBe('a/b/c/d');
      expect(result.folders).toHaveLength(4);
    });
  });

  describe('pathToId', () => {
    it('should convert simple path to ID', () => {
      expect(vault.pathToId('note.md')).toBe('note');
    });

    it('should convert nested path to ID', () => {
      expect(vault.pathToId('notes/plan.md')).toBe('notes/plan');
    });

    it('should handle people folder', () => {
      expect(vault.pathToId('people/Erik.md')).toBe('people/Erik');
    });

    it('should normalize backslashes', () => {
      expect(vault.pathToId('notes\\plan.md')).toBe('notes/plan');
    });
  });

  describe('isPeoplePath', () => {
    it('should identify people folder paths', () => {
      expect(vault.isPeoplePath('people/Erik.md')).toBe(true);
      expect(vault.isPeoplePath('people/nested/Mary.md')).toBe(true);
    });

    it('should identify people folder itself', () => {
      expect(vault.isPeoplePath('people')).toBe(true);
    });

    it('should reject non-people paths', () => {
      expect(vault.isPeoplePath('notes/plan.md')).toBe(false);
      expect(vault.isPeoplePath('note.md')).toBe(false);
      expect(vault.isPeoplePath('peoples/Erik.md')).toBe(false);
    });

    it('should handle backslashes', () => {
      expect(vault.isPeoplePath('people\\Erik.md')).toBe(true);
    });
  });

  describe('getFolderId', () => {
    it('should extract folder ID from nested path', () => {
      expect(vault.getFolderId('notes/plan.md')).toBe('notes');
      expect(vault.getFolderId('notes/archive/old.md')).toBe('notes/archive');
    });

    it('should return undefined for root files', () => {
      expect(vault.getFolderId('note.md')).toBeUndefined();
    });

    it('should normalize backslashes', () => {
      expect(vault.getFolderId('notes\\archive\\old.md')).toBe('notes/archive');
    });
  });

  describe('absoluteToRelative', () => {
    it('should convert absolute to relative path', () => {
      const absolutePath = join(testVaultPath, 'notes', 'plan.md');
      expect(vault.absoluteToRelative(absolutePath)).toBe('notes/plan.md');
    });

    it('should normalize backslashes on Windows', () => {
      const absolutePath = join(testVaultPath, 'notes', 'archive', 'old.md');
      const relative = vault.absoluteToRelative(absolutePath);
      expect(relative).toBe('notes/archive/old.md');
      expect(relative).not.toContain('\\');
    });
  });

  describe('relativeToAbsolute', () => {
    it('should convert relative to absolute path', () => {
      const absolute = vault.relativeToAbsolute('notes/plan.md');
      expect(absolute).toBe(join(testVaultPath, 'notes', 'plan.md'));
    });
  });

  describe('getVaultPath', () => {
    it('should return vault root path', () => {
      expect(vault.getVaultPath()).toBe(testVaultPath);
    });
  });

  describe('custom people folder', () => {
    it('should support custom people folder name', () => {
      const customVault = new Vault({
        vaultPath: testVaultPath,
        peopleFolder: 'contacts',
      });

      mkdirSync(join(testVaultPath, 'contacts'), { recursive: true });
      writeFileSync(join(testVaultPath, 'contacts', 'Erik.md'), '# Erik');

      const result = customVault.discover();

      expect(result.files[0].isPerson).toBe(true);
    });
  });
});
