/**
 * Tests for VaultMutations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { Vault } from './vault.js';
import { VaultMutations } from './mutations.js';

describe('VaultMutations', () => {
  let testVaultPath: string;
  let vault: Vault;
  let mutations: VaultMutations;

  beforeEach(() => {
    // Create temporary test vault
    testVaultPath = join(import.meta.dir, '..', '.test-vault-mutations');
    mkdirSync(testVaultPath, { recursive: true });
    vault = new Vault({ vaultPath: testVaultPath });
    mutations = new VaultMutations(vault);
  });

  afterEach(() => {
    // Clean up test vault
    rmSync(testVaultPath, { recursive: true, force: true });
  });

  describe('createFile', () => {
    it('should create a new file in root', () => {
      const result = mutations.createFile({ id: 'note' });

      expect(result.success).toBe(true);
      expect(result.path).toBe('note.md');
      expect(existsSync(join(testVaultPath, 'note.md'))).toBe(true);
    });

    it('should create a file with content', () => {
      const content = '# My Note\n\nThis is content.';
      const result = mutations.createFile({
        id: 'note',
        content,
      });

      expect(result.success).toBe(true);
      const fileContent = readFileSync(join(testVaultPath, 'note.md'), 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should create nested file with directories', () => {
      const result = mutations.createFile({ id: 'notes/2025/plan' });

      expect(result.success).toBe(true);
      expect(result.path).toBe('notes/2025/plan.md');
      expect(existsSync(join(testVaultPath, 'notes/2025/plan.md'))).toBe(true);
    });

    it('should fail if file exists without overwrite', () => {
      writeFileSync(join(testVaultPath, 'note.md'), 'existing');

      const result = mutations.createFile({ id: 'note' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should overwrite if overwrite flag is set', () => {
      writeFileSync(join(testVaultPath, 'note.md'), 'existing');

      const result = mutations.createFile({
        id: 'note',
        content: 'new content',
        overwrite: true,
      });

      expect(result.success).toBe(true);
      const content = readFileSync(join(testVaultPath, 'note.md'), 'utf-8');
      expect(content).toBe('new content');
    });

    it('should create person file', () => {
      const result = mutations.createFile({
        id: 'people/Erik',
        content: '# Erik',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('people/Erik.md');
      expect(existsSync(join(testVaultPath, 'people/Erik.md'))).toBe(true);
    });

    it('should create empty file by default', () => {
      const result = mutations.createFile({ id: 'empty' });

      expect(result.success).toBe(true);
      const content = readFileSync(join(testVaultPath, 'empty.md'), 'utf-8');
      expect(content).toBe('');
    });
  });

  describe('renameFile', () => {
    it('should rename a file', () => {
      writeFileSync(join(testVaultPath, 'old.md'), '# Old');

      const result = mutations.renameFile({
        oldId: 'old',
        newId: 'new',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('new.md');
      expect(existsSync(join(testVaultPath, 'old.md'))).toBe(false);
      expect(existsSync(join(testVaultPath, 'new.md'))).toBe(true);
    });

    it('should rename to nested path', () => {
      writeFileSync(join(testVaultPath, 'note.md'), '# Note');

      const result = mutations.renameFile({
        oldId: 'note',
        newId: 'archive/2025/note',
      });

      expect(result.success).toBe(true);
      expect(result.path).toBe('archive/2025/note.md');
      expect(existsSync(join(testVaultPath, 'note.md'))).toBe(false);
      expect(existsSync(join(testVaultPath, 'archive/2025/note.md'))).toBe(true);
    });

    it('should rename from nested path', () => {
      mkdirSync(join(testVaultPath, 'notes'), { recursive: true });
      writeFileSync(join(testVaultPath, 'notes/plan.md'), '# Plan');

      const result = mutations.renameFile({
        oldId: 'notes/plan',
        newId: 'plan',
      });

      expect(result.success).toBe(true);
      expect(existsSync(join(testVaultPath, 'notes/plan.md'))).toBe(false);
      expect(existsSync(join(testVaultPath, 'plan.md'))).toBe(true);
    });

    it('should fail if source does not exist', () => {
      const result = mutations.renameFile({
        oldId: 'missing',
        newId: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });

    it('should fail if destination exists without overwrite', () => {
      writeFileSync(join(testVaultPath, 'old.md'), 'old');
      writeFileSync(join(testVaultPath, 'new.md'), 'new');

      const result = mutations.renameFile({
        oldId: 'old',
        newId: 'new',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('already exists');
    });

    it('should overwrite if overwrite flag is set', () => {
      writeFileSync(join(testVaultPath, 'old.md'), 'old content');
      writeFileSync(join(testVaultPath, 'new.md'), 'new content');

      const result = mutations.renameFile({
        oldId: 'old',
        newId: 'new',
        overwrite: true,
      });

      expect(result.success).toBe(true);
      expect(existsSync(join(testVaultPath, 'old.md'))).toBe(false);
      const content = readFileSync(join(testVaultPath, 'new.md'), 'utf-8');
      expect(content).toBe('old content');
    });

    it('should preserve file content', () => {
      const originalContent = '# Title\n\nContent here.';
      writeFileSync(join(testVaultPath, 'old.md'), originalContent);

      mutations.renameFile({
        oldId: 'old',
        newId: 'new',
      });

      const newContent = readFileSync(join(testVaultPath, 'new.md'), 'utf-8');
      expect(newContent).toBe(originalContent);
    });
  });

  describe('deleteFile', () => {
    it('should delete a file', () => {
      writeFileSync(join(testVaultPath, 'note.md'), '# Note');

      const result = mutations.deleteFile({ id: 'note' });

      expect(result.success).toBe(true);
      expect(result.path).toBe('note.md');
      expect(existsSync(join(testVaultPath, 'note.md'))).toBe(false);
    });

    it('should delete nested file', () => {
      mkdirSync(join(testVaultPath, 'notes'), { recursive: true });
      writeFileSync(join(testVaultPath, 'notes/plan.md'), '# Plan');

      const result = mutations.deleteFile({ id: 'notes/plan' });

      expect(result.success).toBe(true);
      expect(existsSync(join(testVaultPath, 'notes/plan.md'))).toBe(false);
    });

    it('should fail if file does not exist', () => {
      const result = mutations.deleteFile({ id: 'missing' });

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  describe('fileExists', () => {
    it('should return true for existing file', () => {
      writeFileSync(join(testVaultPath, 'note.md'), '# Note');

      expect(mutations.fileExists('note')).toBe(true);
    });

    it('should return false for non-existing file', () => {
      expect(mutations.fileExists('missing')).toBe(false);
    });

    it('should check nested files', () => {
      mkdirSync(join(testVaultPath, 'notes'), { recursive: true });
      writeFileSync(join(testVaultPath, 'notes/plan.md'), '# Plan');

      expect(mutations.fileExists('notes/plan')).toBe(true);
      expect(mutations.fileExists('notes/missing')).toBe(false);
    });
  });

  describe('readFile', () => {
    it('should read file content', () => {
      const content = '# Note\n\nContent here.';
      writeFileSync(join(testVaultPath, 'note.md'), content);

      const result = mutations.readFile('note');

      expect(result.success).toBe(true);
      expect(result.content).toBe(content);
      expect(result.path).toBe('note.md');
    });

    it('should fail for missing file', () => {
      const result = mutations.readFile('missing');

      expect(result.success).toBe(false);
      expect(result.error).toContain('does not exist');
    });
  });

  describe('writeFile', () => {
    it('should write content to new file', () => {
      const content = '# New Note\n\nContent.';
      const result = mutations.writeFile('note', content);

      expect(result.success).toBe(true);
      expect(result.path).toBe('note.md');
      const fileContent = readFileSync(join(testVaultPath, 'note.md'), 'utf-8');
      expect(fileContent).toBe(content);
    });

    it('should overwrite existing file', () => {
      writeFileSync(join(testVaultPath, 'note.md'), 'old content');

      const newContent = 'new content';
      const result = mutations.writeFile('note', newContent);

      expect(result.success).toBe(true);
      const fileContent = readFileSync(join(testVaultPath, 'note.md'), 'utf-8');
      expect(fileContent).toBe(newContent);
    });

    it('should create directories as needed', () => {
      const result = mutations.writeFile('notes/2025/plan', '# Plan');

      expect(result.success).toBe(true);
      expect(existsSync(join(testVaultPath, 'notes/2025/plan.md'))).toBe(true);
    });
  });
});
