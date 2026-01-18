/**
 * Tests for ExportService.
 *
 * These tests verify:
 * 1. toMarkdown with valid note
 * 2. toMarkdown with non-existent note
 * 3. toMarkdown with empty note content
 * 4. toMarkdown preserves formatting
 * 5. toMarkdown options (frontmatter, title)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import {
  ScribeDatabase,
  NotesRepository,
  LinksRepository,
  TagsRepository,
  SearchRepository,
} from '@scribe/server-db';
import { DocumentService } from './document.service.js';
import { createExportService, type ExportService } from './export.service.js';
import type { EditorContent } from '../types/index.js';

describe('ExportService', () => {
  let scribeDb: ScribeDatabase;
  let vaultPath: string;
  let documentService: DocumentService;
  let exportService: ExportService;

  // Helper to create test editor content
  const createTestContent = (text: string): EditorContent => ({
    root: {
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text }],
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });

  // Helper to create content with heading
  const createContentWithHeading = (
    heading: string,
    level: 1 | 2 | 3 = 1,
    bodyText?: string
  ): EditorContent => ({
    root: {
      children: [
        {
          type: 'heading',
          tag: `h${level}`,
          children: [{ type: 'text', text: heading }],
        },
        ...(bodyText
          ? [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: bodyText }],
              },
            ]
          : []),
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });

  // Helper to create content with list
  const createContentWithList = (items: string[], ordered = false): EditorContent => ({
    root: {
      children: [
        {
          type: 'list',
          listType: ordered ? 'number' : 'bullet',
          children: items.map((item) => ({
            type: 'listitem',
            children: [{ type: 'text', text: item }],
          })),
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });

  // Helper to create content with code block
  const createContentWithCodeBlock = (code: string, language?: string): EditorContent => ({
    root: {
      children: [
        {
          type: 'code',
          language: language ?? '',
          children: [{ type: 'text', text: code }],
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });

  // Helper to create content with bold/italic text
  const createContentWithFormattedText = (
    text: string,
    format: 'bold' | 'italic' | 'code' | 'strikethrough'
  ): EditorContent => {
    const formatFlags: Record<string, number> = {
      bold: 1,
      italic: 2,
      strikethrough: 4,
      code: 16,
    };

    return {
      root: {
        children: [
          {
            type: 'paragraph',
            children: [{ type: 'text', text, format: formatFlags[format] }],
          },
        ],
        direction: null,
        format: '',
        indent: 0,
        type: 'root',
        version: 1,
      },
    };
  };

  beforeEach(async () => {
    // Create temporary vault directory
    vaultPath = path.join(
      tmpdir(),
      `scribe-export-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });

    // Initialize in-memory database
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();

    const db = scribeDb.getDb();
    documentService = new DocumentService({
      vaultPath,
      notesRepo: new NotesRepository(db),
      linksRepo: new LinksRepository(db),
      tagsRepo: new TagsRepository(db),
      searchRepo: new SearchRepository(db),
    });

    exportService = createExportService({
      documentService,
    });
  });

  afterEach(async () => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
    // Clean up temp directory
    await fs.rm(vaultPath, { recursive: true, force: true }).catch(() => {});
  });

  describe('toMarkdown', () => {
    describe('basic functionality', () => {
      it('should export a note to markdown', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
          content: createTestContent('Hello, world!'),
        });

        const result = await exportService.toMarkdown(note.id);

        expect(result.markdown).toBeDefined();
        expect(result.title).toBe('Test Note');
        expect(result.markdown).toContain('Hello, world!');
      });

      it('should include frontmatter by default', async () => {
        const note = await documentService.create({
          title: 'Test Note',
          type: 'note',
          content: createTestContent('Content here'),
        });

        const result = await exportService.toMarkdown(note.id);

        // Check for frontmatter markers
        expect(result.markdown).toMatch(/^---\n/);
        expect(result.markdown).toContain('title: "Test Note"');
        expect(result.markdown).toContain('created:');
        expect(result.markdown).toContain('updated:');
      });

      it('should return the note title in the result', async () => {
        const note = await documentService.create({
          title: 'My Important Note',
          type: 'note',
          content: createTestContent('Content'),
        });

        const result = await exportService.toMarkdown(note.id);

        expect(result.title).toBe('My Important Note');
      });
    });

    describe('error handling', () => {
      it('should throw error for non-existent note', async () => {
        await expect(exportService.toMarkdown('non-existent-id')).rejects.toThrow(
          'Note not found: non-existent-id'
        );
      });

      it('should throw error with the correct note ID', async () => {
        const testId = 'specific-note-id';
        await expect(exportService.toMarkdown(testId)).rejects.toThrow(`Note not found: ${testId}`);
      });
    });

    describe('empty content handling', () => {
      it('should handle note with empty content', async () => {
        const note = await documentService.create({
          title: 'Empty Note',
          type: 'note',
        });

        const result = await exportService.toMarkdown(note.id);

        expect(result.markdown).toBeDefined();
        expect(result.title).toBe('Empty Note');
        // Should still have frontmatter
        expect(result.markdown).toContain('title: "Empty Note"');
      });

      it('should return empty markdown body for note with no text', async () => {
        const emptyContent: EditorContent = {
          root: {
            children: [
              {
                type: 'paragraph',
                children: [],
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        };

        const note = await documentService.create({
          title: 'Empty Content Note',
          type: 'note',
          content: emptyContent,
        });

        const result = await exportService.toMarkdown(note.id);

        // Frontmatter + possibly just whitespace for body
        expect(result.markdown).toContain('title: "Empty Content Note"');
      });
    });

    describe('options', () => {
      it('should exclude frontmatter when includeFrontmatter is false', async () => {
        const note = await documentService.create({
          title: 'No Frontmatter Note',
          type: 'note',
          content: createTestContent('Just content'),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
        });

        // Should not start with frontmatter
        expect(result.markdown).not.toMatch(/^---\n/);
        expect(result.markdown).toContain('Just content');
      });

      it('should include title as H1 when includeTitle is true', async () => {
        const note = await documentService.create({
          title: 'Title as Heading',
          type: 'note',
          content: createTestContent('Body content'),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
          includeTitle: true,
        });

        // Should have title as H1
        expect(result.markdown).toContain('# Title as Heading');
        expect(result.markdown).toContain('Body content');
      });

      it('should support both frontmatter and title heading', async () => {
        const note = await documentService.create({
          title: 'Both Options',
          type: 'note',
          content: createTestContent('Content'),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: true,
          includeTitle: true,
        });

        // Should have both
        expect(result.markdown).toContain('title: "Both Options"');
        expect(result.markdown).toContain('# Both Options');
      });
    });

    describe('formatting preservation', () => {
      it('should preserve paragraph text', async () => {
        const note = await documentService.create({
          title: 'Paragraphs',
          type: 'note',
          content: createTestContent('This is a paragraph of text.'),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
        });

        expect(result.markdown).toContain('This is a paragraph of text.');
      });

      it('should convert headings to markdown', async () => {
        const note = await documentService.create({
          title: 'Headings Test',
          type: 'note',
          content: createContentWithHeading('Section Title', 2, 'Some body text'),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
        });

        expect(result.markdown).toContain('## Section Title');
      });

      it('should convert unordered lists to markdown', async () => {
        const note = await documentService.create({
          title: 'List Test',
          type: 'note',
          content: createContentWithList(['First item', 'Second item', 'Third item']),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
        });

        expect(result.markdown).toContain('- First item');
        expect(result.markdown).toContain('- Second item');
        expect(result.markdown).toContain('- Third item');
      });

      it('should convert ordered lists to markdown', async () => {
        const note = await documentService.create({
          title: 'Ordered List Test',
          type: 'note',
          content: createContentWithList(['Step one', 'Step two'], true),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
        });

        expect(result.markdown).toContain('1. Step one');
        expect(result.markdown).toContain('2. Step two');
      });

      it('should convert code blocks to markdown', async () => {
        const note = await documentService.create({
          title: 'Code Test',
          type: 'note',
          content: createContentWithCodeBlock('const x = 42;', 'typescript'),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
        });

        expect(result.markdown).toContain('```typescript');
        expect(result.markdown).toContain('const x = 42;');
        expect(result.markdown).toContain('```');
      });

      it('should convert bold text to markdown', async () => {
        const note = await documentService.create({
          title: 'Bold Test',
          type: 'note',
          content: createContentWithFormattedText('bold text', 'bold'),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
        });

        expect(result.markdown).toContain('**bold text**');
      });

      it('should convert italic text to markdown', async () => {
        const note = await documentService.create({
          title: 'Italic Test',
          type: 'note',
          content: createContentWithFormattedText('italic text', 'italic'),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
        });

        expect(result.markdown).toContain('*italic text*');
      });

      it('should convert inline code to markdown', async () => {
        const note = await documentService.create({
          title: 'Inline Code Test',
          type: 'note',
          content: createContentWithFormattedText('codeSnippet', 'code'),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
        });

        expect(result.markdown).toContain('`codeSnippet`');
      });
    });

    describe('note types', () => {
      it('should include type in frontmatter for daily notes', async () => {
        const note = await documentService.create({
          title: 'Daily Note',
          type: 'daily',
          date: '2024-01-15',
          content: createTestContent('Daily content'),
        });

        const result = await exportService.toMarkdown(note.id);

        expect(result.markdown).toContain('type: daily');
      });

      it('should include type in frontmatter for meeting notes', async () => {
        const note = await documentService.create({
          title: 'Meeting Note',
          type: 'meeting',
          date: '2024-01-15',
          content: createTestContent('Meeting content'),
        });

        const result = await exportService.toMarkdown(note.id);

        expect(result.markdown).toContain('type: meeting');
      });

      it('should not include type in frontmatter for regular notes', async () => {
        const note = await documentService.create({
          title: 'Regular Note',
          type: 'note',
          content: createTestContent('Regular content'),
        });

        const result = await exportService.toMarkdown(note.id);

        // Should not have a type field for regular notes
        expect(result.markdown).not.toContain('type: note');
      });
    });

    describe('special characters in content', () => {
      it('should handle special characters in title', async () => {
        const note = await documentService.create({
          title: 'Title with "quotes" and special: characters',
          type: 'note',
          content: createTestContent('Content'),
        });

        const result = await exportService.toMarkdown(note.id);

        // Quotes should be escaped in frontmatter
        expect(result.markdown).toContain('Title with');
        expect(result.title).toBe('Title with "quotes" and special: characters');
      });

      it('should handle markdown-like content', async () => {
        const note = await documentService.create({
          title: 'Markdown Content',
          type: 'note',
          content: createTestContent('This has *asterisks* and _underscores_ in text'),
        });

        const result = await exportService.toMarkdown(note.id, {
          includeFrontmatter: false,
        });

        // Content should be preserved
        expect(result.markdown).toContain('asterisks');
        expect(result.markdown).toContain('underscores');
      });
    });
  });
});
