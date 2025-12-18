/**
 * Unit tests for notes export command
 *
 * Tests the CLI `notes export` subcommand for exporting notes to Markdown format.
 * These tests verify:
 * - Stdout export (default behavior)
 * - File export with --output option
 * - --no-frontmatter option
 * - Error handling for invalid note IDs
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { writeFile, readFile } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';
import type { EditorContent, RegularNote } from '@scribe/shared';
import { createNoteId } from '@scribe/shared';
import { runCLI, initializeTestVault, cleanupTestVault, createLexicalContent } from '../helpers';

/**
 * Create a test note with content for export testing.
 */
function createExportTestNote(options: {
  id: string;
  title: string;
  tags?: string[];
  content?: EditorContent;
}): RegularNote {
  const now = Date.now();
  return {
    id: createNoteId(options.id),
    title: options.title,
    type: undefined,
    tags: options.tags ?? [],
    content: options.content ?? createLexicalContent('Test content for export'),
    metadata: {
      title: options.title,
      tags: options.tags ?? [],
      links: [],
      mentions: [],
    },
    createdAt: now,
    updatedAt: now,
  };
}

describe('notes export', () => {
  let testVaultPath: string;
  let testNote: RegularNote;

  beforeEach(async () => {
    // Create a unique temp directory for each test
    testVaultPath = join(
      tmpdir(),
      `scribe-export-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );

    // Create test note
    testNote = createExportTestNote({
      id: 'export-test-note',
      title: 'Export Test Note',
      tags: ['#test', '#export'],
    });

    // Initialize vault with the test note
    await initializeTestVault(testVaultPath, [testNote]);
  });

  afterEach(async () => {
    await cleanupTestVault(testVaultPath);
  });

  describe('stdout export', () => {
    it('exports to stdout when no --output specified', async () => {
      const result = await runCLI(
        ['notes', 'export', testNote.id, '--vault', testVaultPath],
        join(__dirname, '../..')
      );

      // Should succeed
      expect(result.exitCode).toBe(0);

      // Stdout should contain Markdown content
      expect(result.stdout).toContain('---'); // Frontmatter
      expect(result.stdout).toContain('title: "Export Test Note"');
      expect(result.stdout).toContain('Test content for export');
    });

    it('includes frontmatter by default', async () => {
      const result = await runCLI(
        ['notes', 'export', testNote.id, '--vault', testVaultPath],
        join(__dirname, '../..')
      );

      expect(result.exitCode).toBe(0);

      // Check frontmatter structure
      expect(result.stdout).toContain('---');
      expect(result.stdout).toContain('title:');
      expect(result.stdout).toContain('tags:');
      expect(result.stdout).toContain('created:');
      expect(result.stdout).toContain('updated:');
    });

    it('includes tags in frontmatter', async () => {
      const result = await runCLI(
        ['notes', 'export', testNote.id, '--vault', testVaultPath],
        join(__dirname, '../..')
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('test');
      expect(result.stdout).toContain('export');
    });
  });

  describe('file export', () => {
    it('writes to file with --output option', async () => {
      const outputPath = join(testVaultPath, 'output.md');

      const result = await runCLI(
        [
          'notes',
          'export',
          testNote.id,
          '--output',
          outputPath,
          '--vault',
          testVaultPath,
          '--format',
          'json',
        ],
        join(__dirname, '../..')
      );

      // Command should succeed
      expect(result.exitCode).toBe(0);

      // Parse JSON output
      const output = JSON.parse(result.stdout);
      expect(output.success).toBe(true);
      expect(output.outputPath).toBe(outputPath);
      expect(output.note.id).toBe(testNote.id);

      // Verify file was created with correct content
      const fileContent = await readFile(outputPath, 'utf-8');
      expect(fileContent).toContain('---');
      expect(fileContent).toContain('title: "Export Test Note"');
      expect(fileContent).toContain('Test content for export');
    });

    it('creates file with Markdown content', async () => {
      const outputPath = join(testVaultPath, 'exported-note.md');

      await runCLI(
        ['notes', 'export', testNote.id, '--output', outputPath, '--vault', testVaultPath],
        join(__dirname, '../..')
      );

      const fileContent = await readFile(outputPath, 'utf-8');

      // Verify file structure
      expect(fileContent.startsWith('---')).toBe(true);
      expect(fileContent).toContain('Test content for export');
    });
  });

  describe('--no-frontmatter option', () => {
    it('excludes frontmatter with --no-frontmatter', async () => {
      const result = await runCLI(
        ['notes', 'export', testNote.id, '--no-frontmatter', '--vault', testVaultPath],
        join(__dirname, '../..')
      );

      expect(result.exitCode).toBe(0);

      // Should NOT contain YAML frontmatter delimiters
      expect(result.stdout).not.toContain('---');
      expect(result.stdout).not.toContain('title:');
      expect(result.stdout).not.toContain('tags:');
      expect(result.stdout).not.toContain('created:');

      // Should still contain content
      expect(result.stdout).toContain('Test content for export');
    });

    it('--no-frontmatter works with --output', async () => {
      const outputPath = join(testVaultPath, 'no-frontmatter.md');

      await runCLI(
        [
          'notes',
          'export',
          testNote.id,
          '--no-frontmatter',
          '--output',
          outputPath,
          '--vault',
          testVaultPath,
        ],
        join(__dirname, '../..')
      );

      const fileContent = await readFile(outputPath, 'utf-8');

      // Should NOT contain frontmatter
      expect(fileContent).not.toContain('---');
      expect(fileContent).not.toContain('title:');

      // Should contain content
      expect(fileContent).toContain('Test content for export');
    });
  });

  describe('error handling', () => {
    it('throws error for invalid note id', async () => {
      const result = await runCLI(
        ['notes', 'export', 'nonexistent-note-id', '--vault', testVaultPath, '--format', 'json'],
        join(__dirname, '../..')
      );

      // Should fail with non-zero exit code
      expect(result.exitCode).not.toBe(0);

      // Error output should contain appropriate error message
      const errorOutput = result.stdout || result.stderr;
      expect(errorOutput).toContain('Note not found');
    });

    it('returns error with proper format', async () => {
      const invalidId = 'this-note-does-not-exist';

      const result = await runCLI(
        ['notes', 'export', invalidId, '--vault', testVaultPath, '--format', 'json'],
        join(__dirname, '../..')
      );

      expect(result.exitCode).not.toBe(0);

      // Error output should be JSON formatted with error info
      const errorOutput = result.stdout || result.stderr;
      expect(errorOutput).toContain('error');
      expect(errorOutput).toContain('Note not found');
    });
  });

  describe('content preservation', () => {
    it('exports note with empty content', async () => {
      const emptyNote = createExportTestNote({
        id: 'empty-note',
        title: 'Empty Note',
        content: createLexicalContent(''),
      });

      // Add empty note to vault
      await writeFile(
        join(testVaultPath, 'notes', `${emptyNote.id}.json`),
        JSON.stringify(emptyNote, null, 2),
        'utf-8'
      );

      const result = await runCLI(
        ['notes', 'export', emptyNote.id, '--vault', testVaultPath],
        join(__dirname, '../..')
      );

      expect(result.exitCode).toBe(0);
      expect(result.stdout).toContain('title: "Empty Note"');
    });

    it('exports note with special characters in title', async () => {
      const specialNote = createExportTestNote({
        id: 'special-chars-note',
        title: 'Note with "quotes" and colons: here',
        content: createLexicalContent('Special content'),
      });

      await writeFile(
        join(testVaultPath, 'notes', `${specialNote.id}.json`),
        JSON.stringify(specialNote, null, 2),
        'utf-8'
      );

      const result = await runCLI(
        ['notes', 'export', specialNote.id, '--vault', testVaultPath],
        join(__dirname, '../..')
      );

      expect(result.exitCode).toBe(0);
      // Title should be properly escaped in YAML
      expect(result.stdout).toContain('Note with');
      expect(result.stdout).toContain('Special content');
    });
  });
});
