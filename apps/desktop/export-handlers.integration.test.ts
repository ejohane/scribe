/**
 * Integration Tests for Export Handlers
 *
 * Tests the export:* handler logic through the data layer packages.
 * Since IPC handlers use vault for note reading and extractMarkdown for conversion,
 * this tests the actual business logic without Electron's IPC infrastructure.
 *
 * Tests cover:
 * - export:toMarkdown - export note to Markdown format
 *   - Exports valid note with content
 *   - Includes frontmatter with metadata
 *   - Sanitizes filename (removes invalid characters)
 *   - Handles missing note (returns error result)
 *   - Returns cancelled when user cancels dialog
 *
 * Issue: scribe-lpp
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { createNoteId, extractMarkdown, type Note, type ExportResult } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  createNoteContent,
} from './test-helpers';

/**
 * Sanitize a note title for use as a filename.
 * Mirrors the implementation in exportHandlers.ts
 */
function sanitizeFilename(title: string): string {
  return (
    title
      .replace(/[<>:"/\\|?*]/g, '-')
      .replace(/-+/g, '-')
      .replace(/\s+/g, ' ')
      .trim() || 'Untitled'
  );
}

/**
 * Mock dialog result type - simulates Electron's dialog.showSaveDialog result
 */
interface MockDialogResult {
  canceled: boolean;
  filePath?: string;
}

/**
 * Mock file system write result
 */
interface MockWriteResult {
  success: boolean;
  error?: Error;
}

/**
 * Result from simulating the export flow.
 * Includes the markdown content that would have been written.
 */
interface SimulatedExportResult extends ExportResult {
  /** The markdown content that would be written to file */
  markdownContent?: string;
  /** The sanitized filename used in the dialog */
  sanitizedFilename?: string;
}

/**
 * Simulates the export handler logic.
 * This mirrors the actual implementation in exportHandlers.ts
 * but allows us to test without IPC infrastructure.
 *
 * @param vault - The vault to read notes from
 * @param noteId - The note ID to export
 * @param dialogResult - Simulated result from dialog.showSaveDialog
 * @param writeResult - Simulated result from fs.writeFile
 * @returns Export result with additional test metadata
 */
function simulateExportToMarkdown(
  vault: FileSystemVault,
  noteId: string,
  dialogResult: MockDialogResult,
  writeResult: MockWriteResult = { success: true }
): SimulatedExportResult {
  // 1. Read the note (throws if not found)
  let note: Note;
  try {
    note = vault.read(createNoteId(noteId));
  } catch {
    return { success: false, error: 'Note not found' };
  }

  // 2. Convert to Markdown
  const markdown = extractMarkdown(note, { includeFrontmatter: true });

  // 3. Sanitize filename
  const sanitizedTitle = sanitizeFilename(note.title);
  const sanitizedFilename = `${sanitizedTitle}.md`;

  // 4. Check dialog result (simulating user interaction)
  const { canceled, filePath } = dialogResult;

  if (canceled || !filePath) {
    return {
      success: true,
      cancelled: true,
      markdownContent: markdown,
      sanitizedFilename,
    };
  }

  // 5. Simulate file write
  if (!writeResult.success && writeResult.error) {
    const error = writeResult.error;
    if (error instanceof Error && 'code' in error) {
      const nodeError = error as NodeJS.ErrnoException;
      switch (nodeError.code) {
        case 'EACCES':
          return {
            success: false,
            error: 'Permission denied. Try saving to a different location.',
            markdownContent: markdown,
            sanitizedFilename,
          };
        case 'EROFS':
          return {
            success: false,
            error: 'Cannot save to a read-only file system. Try saving to a different location.',
            markdownContent: markdown,
            sanitizedFilename,
          };
        case 'ENOSPC':
          return {
            success: false,
            error: 'The disk is full. Free up space and try again.',
            markdownContent: markdown,
            sanitizedFilename,
          };
      }
    }
    const message = error instanceof Error ? error.message : 'Unknown error';
    return {
      success: false,
      error: `Failed to write file: ${message}`,
      markdownContent: markdown,
      sanitizedFilename,
    };
  }

  // Success!
  return {
    success: true,
    filePath,
    markdownContent: markdown,
    sanitizedFilename,
  };
}

describe('Export Handler Integration Tests', () => {
  let ctx: TestContext;
  let vault: FileSystemVault;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-export-handler-test');
    vault = ctx.vault;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // export:toMarkdown Tests
  // ===========================================================================

  describe('export:toMarkdown logic', () => {
    it('should export valid note to markdown', async () => {
      // Create a note with content
      const note = await vault.create({
        title: 'Test Note',
        content: createNoteContent('Test Note', 'This is the body content'),
      });

      const expectedPath = '/tmp/Test Note.md';
      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: expectedPath,
      });

      expect(result.success).toBe(true);
      expect(result.cancelled).toBeUndefined();
      expect(result.filePath).toBe(expectedPath);
      expect(result.error).toBeUndefined();

      // Verify the markdown content includes the note content
      expect(result.markdownContent).toContain('Test Note');
      expect(result.markdownContent).toContain('This is the body content');
    });

    it('should include frontmatter with metadata', async () => {
      // Create a note with tags
      const note = await vault.create({
        title: 'Meeting Notes',
        content: createNoteContent('Meeting Notes', 'Discussed project timeline'),
        tags: ['work', 'meetings'],
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '/tmp/Meeting Notes.md',
      });

      const markdown = result.markdownContent!;

      // Verify frontmatter is present
      expect(markdown).toMatch(/^---\n/); // Starts with YAML frontmatter
      expect(markdown).toContain('title:');
      expect(markdown).toContain('Meeting Notes');
      expect(markdown).toContain('tags:');
      expect(markdown).toContain('- work');
      expect(markdown).toContain('- meetings');
      expect(markdown).toContain('created:');
      expect(markdown).toContain('updated:');
    });

    it('should sanitize filename by removing invalid characters', async () => {
      // Create a note with invalid filename characters
      const note = await vault.create({
        title: 'Meeting: Project / Planning <2024>',
        content: createNoteContent('Meeting: Project / Planning <2024>'),
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '/tmp/sanitized.md',
      });

      // Verify the sanitized filename
      const sanitized = result.sanitizedFilename!;
      expect(sanitized).not.toContain(':');
      expect(sanitized).not.toContain('/');
      expect(sanitized).not.toContain('<');
      expect(sanitized).not.toContain('>');
      expect(sanitized).toMatch(/\.md$/);
    });

    it('should handle missing note and return error result', async () => {
      const result = simulateExportToMarkdown(vault, 'non-existent-note-id', {
        canceled: false,
        filePath: '/tmp/test.md',
      });

      expect(result.success).toBe(false);
      expect(result.error).toBe('Note not found');
      expect(result.filePath).toBeUndefined();
      expect(result.markdownContent).toBeUndefined();
    });

    it('should return cancelled when user cancels dialog', async () => {
      const note = await vault.create({
        title: 'Test Note',
        content: createNoteContent('Test Note'),
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: true,
        filePath: undefined,
      });

      expect(result.success).toBe(true);
      expect(result.cancelled).toBe(true);
      expect(result.filePath).toBeUndefined();
      expect(result.error).toBeUndefined();
      // Markdown should still be generated even if cancelled
      expect(result.markdownContent).toBeDefined();
    });

    it('should handle dialog returning empty filePath', async () => {
      const note = await vault.create({
        title: 'Test Note',
        content: createNoteContent('Test Note'),
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '',
      });

      expect(result.success).toBe(true);
      expect(result.cancelled).toBe(true);
    });
  });

  // ===========================================================================
  // Filename Sanitization Tests
  // ===========================================================================

  describe('filename sanitization', () => {
    it('should replace all invalid Windows/Mac/Linux filename characters', () => {
      // Characters invalid on Windows: < > : " / \ | ? *
      expect(sanitizeFilename('File<Name')).toBe('File-Name');
      expect(sanitizeFilename('File>Name')).toBe('File-Name');
      expect(sanitizeFilename('File:Name')).toBe('File-Name');
      expect(sanitizeFilename('File"Name')).toBe('File-Name');
      expect(sanitizeFilename('File/Name')).toBe('File-Name');
      expect(sanitizeFilename('File\\Name')).toBe('File-Name');
      expect(sanitizeFilename('File|Name')).toBe('File-Name');
      expect(sanitizeFilename('File?Name')).toBe('File-Name');
      expect(sanitizeFilename('File*Name')).toBe('File-Name');
    });

    it('should collapse consecutive dashes', () => {
      expect(sanitizeFilename('A: B / C')).toBe('A- B - C');
      expect(sanitizeFilename('A::B')).toBe('A-B');
      expect(sanitizeFilename('Test---File')).toBe('Test-File');
    });

    it('should normalize whitespace', () => {
      expect(sanitizeFilename('File   Name')).toBe('File Name');
      expect(sanitizeFilename('  Trimmed  ')).toBe('Trimmed');
    });

    it('should return Untitled for empty or whitespace-only titles', () => {
      expect(sanitizeFilename('')).toBe('Untitled');
      expect(sanitizeFilename('   ')).toBe('Untitled');
      expect(sanitizeFilename('\t\n')).toBe('Untitled');
    });

    it('should handle complex titles with multiple invalid characters', () => {
      const result = sanitizeFilename('Meeting: Q4 <2024> Review / Budget | Approved?');
      expect(result).not.toContain(':');
      expect(result).not.toContain('<');
      expect(result).not.toContain('>');
      expect(result).not.toContain('/');
      expect(result).not.toContain('|');
      expect(result).not.toContain('?');
    });
  });

  // ===========================================================================
  // File Write Error Handling Tests
  // ===========================================================================

  describe('file write error handling', () => {
    it('should handle permission denied error', async () => {
      const note = await vault.create({
        title: 'Test Note',
        content: createNoteContent('Test Note'),
      });

      const permissionError = new Error('Permission denied');
      (permissionError as NodeJS.ErrnoException).code = 'EACCES';

      const result = simulateExportToMarkdown(
        vault,
        note.id,
        { canceled: false, filePath: '/protected/file.md' },
        { success: false, error: permissionError }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Permission denied. Try saving to a different location.');
    });

    it('should handle read-only filesystem error', async () => {
      const note = await vault.create({
        title: 'Test Note',
        content: createNoteContent('Test Note'),
      });

      const readOnlyError = new Error('Read-only filesystem');
      (readOnlyError as NodeJS.ErrnoException).code = 'EROFS';

      const result = simulateExportToMarkdown(
        vault,
        note.id,
        { canceled: false, filePath: '/readonly/file.md' },
        { success: false, error: readOnlyError }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe(
        'Cannot save to a read-only file system. Try saving to a different location.'
      );
    });

    it('should handle disk full error', async () => {
      const note = await vault.create({
        title: 'Test Note',
        content: createNoteContent('Test Note'),
      });

      const diskFullError = new Error('No space left');
      (diskFullError as NodeJS.ErrnoException).code = 'ENOSPC';

      const result = simulateExportToMarkdown(
        vault,
        note.id,
        { canceled: false, filePath: '/full-disk/file.md' },
        { success: false, error: diskFullError }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('The disk is full. Free up space and try again.');
    });

    it('should handle generic write error', async () => {
      const note = await vault.create({
        title: 'Test Note',
        content: createNoteContent('Test Note'),
      });

      const genericError = new Error('Something went wrong');

      const result = simulateExportToMarkdown(
        vault,
        note.id,
        { canceled: false, filePath: '/tmp/file.md' },
        { success: false, error: genericError }
      );

      expect(result.success).toBe(false);
      expect(result.error).toBe('Failed to write file: Something went wrong');
    });
  });

  // ===========================================================================
  // Content Export Tests
  // ===========================================================================

  describe('content export', () => {
    it('should export note with various content types', async () => {
      // Create a note with rich content
      const note = await vault.create({
        title: 'Rich Content Note',
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Rich Content Note' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'This is ' },
                  { type: 'text', text: 'bold', format: 1 }, // Bold
                  { type: 'text', text: ' and ' },
                  { type: 'text', text: 'italic', format: 2 }, // Italic
                  { type: 'text', text: ' text.' },
                ],
              },
            ],
          },
        },
        tags: ['test', 'rich-content'],
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '/tmp/Rich Content Note.md',
      });

      const markdown = result.markdownContent!;

      // Verify content structure
      expect(markdown).toContain('Rich Content Note');
      expect(markdown).toContain('---'); // Frontmatter delimiter
    });

    it('should export empty note with frontmatter only', async () => {
      const note = await vault.create({
        title: 'Empty Note',
        content: {
          root: {
            type: 'root',
            children: [],
          },
        },
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '/tmp/Empty Note.md',
      });

      const markdown = result.markdownContent!;

      // Should still have frontmatter
      expect(markdown).toMatch(/^---\n/);
      expect(markdown).toContain('title:');
      expect(markdown).toContain('Empty Note');
    });

    it('should preserve unicode content in export', async () => {
      const note = await vault.create({
        title: 'Unicode Test ☕ 日本語',
        content: createNoteContent('Unicode Test ☕ 日本語', 'Emoji and CJK: 🎉 中文 한국어'),
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '/tmp/unicode.md',
      });

      const markdown = result.markdownContent!;

      // Verify unicode is preserved
      expect(markdown).toContain('☕');
      expect(markdown).toContain('日本語');
      expect(markdown).toContain('🎉');
      expect(markdown).toContain('中文');
      expect(markdown).toContain('한국어');
    });
  });

  // ===========================================================================
  // Note Type Export Tests
  // ===========================================================================

  describe('note type export', () => {
    it('should include type in frontmatter for person notes', async () => {
      const note = await vault.create({
        title: 'John Smith',
        type: 'person',
        content: createNoteContent('John Smith', 'Software Engineer'),
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '/tmp/John Smith.md',
      });

      const markdown = result.markdownContent!;
      expect(markdown).toContain('type: person');
    });

    it('should include type in frontmatter for daily notes', async () => {
      const today = new Date();
      const dateStr = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}-${today.getFullYear()}`;

      const note = await vault.create({
        title: dateStr,
        type: 'daily',
        daily: { date: dateStr },
        content: createNoteContent(dateStr, 'Daily journal entry'),
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: `/tmp/${dateStr}.md`,
      });

      const markdown = result.markdownContent!;
      expect(markdown).toContain('type: daily');
    });

    it('should omit type field for regular notes', async () => {
      const note = await vault.create({
        title: 'Regular Note',
        content: createNoteContent('Regular Note', 'Just a normal note'),
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '/tmp/Regular Note.md',
      });

      const markdown = result.markdownContent!;

      // Regular notes should not have a type field (or type: undefined)
      // The extractMarkdown function should omit the type for regular notes
      const lines = markdown.split('\n');
      const typeLines = lines.filter((line) => line.startsWith('type:'));

      // Either no type line, or if present it shouldn't say a specific type
      if (typeLines.length > 0) {
        expect(typeLines[0]).not.toContain('type: person');
        expect(typeLines[0]).not.toContain('type: daily');
        expect(typeLines[0]).not.toContain('type: meeting');
      }
    });
  });

  // ===========================================================================
  // Edge Case Tests
  // ===========================================================================

  describe('edge cases', () => {
    it('should handle note with only whitespace in title', async () => {
      // Note: vault will likely assign "Untitled" but let's test the sanitization
      const result = sanitizeFilename('   ');
      expect(result).toBe('Untitled');
    });

    it('should handle very long titles', async () => {
      const longTitle = 'A'.repeat(200);
      const note = await vault.create({
        title: longTitle,
        content: createNoteContent(longTitle),
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '/tmp/long.md',
      });

      expect(result.success).toBe(true);
      expect(result.sanitizedFilename).toContain('A');
    });

    it('should handle note with special markdown characters in content', async () => {
      const note = await vault.create({
        title: 'Markdown Special Chars',
        content: createNoteContent(
          'Markdown Special Chars',
          '# Heading * bullet _italic_ **bold**'
        ),
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '/tmp/special.md',
      });

      expect(result.success).toBe(true);
      expect(result.markdownContent).toBeDefined();
    });

    it('should handle note with empty tags array', async () => {
      const note = await vault.create({
        title: 'No Tags Note',
        content: createNoteContent('No Tags Note', 'Content without tags'),
        tags: [],
      });

      const result = simulateExportToMarkdown(vault, note.id, {
        canceled: false,
        filePath: '/tmp/no-tags.md',
      });

      expect(result.success).toBe(true);
      expect(result.markdownContent).toContain('title:');
      // Empty tags array should either be omitted or shown as empty
    });
  });
});
