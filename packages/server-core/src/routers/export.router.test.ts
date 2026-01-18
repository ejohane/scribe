/**
 * Unit tests for export router.
 *
 * Tests the export router's toMarkdown procedure using a direct caller
 * without HTTP transport for fast, isolated testing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { appRouter, createContextFactory, type Context } from './index.js';
import { createServices, destroyServices, type Services } from '../container.js';

// Test vault path
const TEST_VAULT = '/tmp/scribe-export-router-test-vault';

describe('Export Router', () => {
  let services: Services;
  let ctx: Context;
  let caller: ReturnType<typeof appRouter.createCaller>;

  // Helper to create test editor content
  const createTestContent = (text: string) => ({
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
      type: 'root' as const,
      version: 1,
    },
  });

  beforeEach(async () => {
    // Create clean test vault
    await fs.mkdir(path.join(TEST_VAULT, 'notes'), { recursive: true });

    // Initialize services with in-memory database
    services = createServices({
      vaultPath: TEST_VAULT,
      dbPath: ':memory:',
      verbose: false,
    });

    // Create context and caller
    const contextFactory = createContextFactory(services);
    ctx = contextFactory();
    caller = appRouter.createCaller(ctx);
  });

  afterEach(async () => {
    // Cleanup
    destroyServices(services);
    await fs.rm(TEST_VAULT, { recursive: true, force: true });
  });

  describe('toMarkdown', () => {
    describe('basic functionality', () => {
      it('should export a note to markdown with valid noteId', async () => {
        const note = await caller.notes.create({
          title: 'Test Note',
          type: 'note',
          content: createTestContent('Hello, world!'),
        });

        const result = await caller.export.toMarkdown({ noteId: note.id });

        expect(result.markdown).toBeDefined();
        expect(result.markdown).toContain('Hello, world!');
        expect(result.noteId).toBe(note.id);
        expect(result.title).toBe('Test Note');
        expect(result.exportedAt).toBeDefined();
      });

      it('should return correct metadata in response', async () => {
        const note = await caller.notes.create({
          title: 'Metadata Test',
          type: 'note',
          content: createTestContent('Content'),
        });

        const result = await caller.export.toMarkdown({ noteId: note.id });

        expect(result.noteId).toBe(note.id);
        expect(result.title).toBe('Metadata Test');
        // exportedAt should be a valid ISO timestamp
        expect(() => new Date(result.exportedAt)).not.toThrow();
        expect(new Date(result.exportedAt).getTime()).toBeLessThanOrEqual(Date.now());
      });

      it('should include frontmatter by default', async () => {
        const note = await caller.notes.create({
          title: 'Frontmatter Test',
          type: 'note',
          content: createTestContent('Test content'),
        });

        const result = await caller.export.toMarkdown({ noteId: note.id });

        expect(result.markdown).toMatch(/^---\n/);
        expect(result.markdown).toContain('title: "Frontmatter Test"');
        expect(result.markdown).toContain('created:');
        expect(result.markdown).toContain('updated:');
      });
    });

    describe('input validation', () => {
      it('should reject empty noteId', async () => {
        await expect(caller.export.toMarkdown({ noteId: '' })).rejects.toThrow();
      });

      it('should include validation error message for empty noteId', async () => {
        try {
          await caller.export.toMarkdown({ noteId: '' });
          expect.fail('Should have thrown');
        } catch (error: unknown) {
          const err = error as Error;
          // Zod validation error should mention the requirement
          expect(err.message).toBeDefined();
        }
      });
    });

    describe('error handling', () => {
      it('should throw error when note not found', async () => {
        await expect(caller.export.toMarkdown({ noteId: 'non-existent-id' })).rejects.toThrow(
          /not found/i
        );
      });

      it('should throw error with correct note ID in message', async () => {
        const fakeId = 'specific-missing-note-123';
        await expect(caller.export.toMarkdown({ noteId: fakeId })).rejects.toThrow(fakeId);
      });
    });

    describe('options', () => {
      it('should exclude frontmatter when includeFrontmatter is false', async () => {
        const note = await caller.notes.create({
          title: 'No Frontmatter',
          type: 'note',
          content: createTestContent('Just content'),
        });

        const result = await caller.export.toMarkdown({
          noteId: note.id,
          options: { includeFrontmatter: false },
        });

        expect(result.markdown).not.toMatch(/^---\n/);
        expect(result.markdown).toContain('Just content');
      });

      it('should include title as H1 when includeTitle is true', async () => {
        const note = await caller.notes.create({
          title: 'Title Heading',
          type: 'note',
          content: createTestContent('Body text'),
        });

        const result = await caller.export.toMarkdown({
          noteId: note.id,
          options: { includeFrontmatter: false, includeTitle: true },
        });

        expect(result.markdown).toContain('# Title Heading');
        expect(result.markdown).toContain('Body text');
      });

      it('should support both frontmatter and title options', async () => {
        const note = await caller.notes.create({
          title: 'Both Options',
          type: 'note',
          content: createTestContent('Content here'),
        });

        const result = await caller.export.toMarkdown({
          noteId: note.id,
          options: { includeFrontmatter: true, includeTitle: true },
        });

        expect(result.markdown).toContain('title: "Both Options"');
        expect(result.markdown).toContain('# Both Options');
      });

      it('should work with empty options object', async () => {
        const note = await caller.notes.create({
          title: 'Empty Options',
          type: 'note',
          content: createTestContent('Some content'),
        });

        const result = await caller.export.toMarkdown({
          noteId: note.id,
          options: {},
        });

        // Should use defaults (frontmatter on, title off)
        expect(result.markdown).toContain('title: "Empty Options"');
        expect(result.markdown).not.toContain('# Empty Options');
      });
    });

    describe('note types', () => {
      it('should export daily notes with type in frontmatter', async () => {
        const note = await caller.notes.create({
          title: 'Daily Note',
          type: 'daily',
          date: '2024-01-15',
          content: createTestContent('Daily content'),
        });

        const result = await caller.export.toMarkdown({ noteId: note.id });

        expect(result.markdown).toContain('type: daily');
      });

      it('should export meeting notes with type in frontmatter', async () => {
        const note = await caller.notes.create({
          title: 'Meeting Note',
          type: 'meeting',
          date: '2024-01-15',
          content: createTestContent('Meeting content'),
        });

        const result = await caller.export.toMarkdown({ noteId: note.id });

        expect(result.markdown).toContain('type: meeting');
      });

      it('should export regular notes without type in frontmatter', async () => {
        const note = await caller.notes.create({
          title: 'Regular Note',
          type: 'note',
          content: createTestContent('Regular content'),
        });

        const result = await caller.export.toMarkdown({ noteId: note.id });

        expect(result.markdown).not.toContain('type: note');
      });
    });

    describe('content handling', () => {
      it('should handle empty note content', async () => {
        const note = await caller.notes.create({
          title: 'Empty Note',
          type: 'note',
        });

        const result = await caller.export.toMarkdown({ noteId: note.id });

        expect(result.markdown).toBeDefined();
        expect(result.title).toBe('Empty Note');
      });

      it('should preserve text content', async () => {
        const note = await caller.notes.create({
          title: 'Text Content',
          type: 'note',
          content: createTestContent('This is the actual content of the note.'),
        });

        const result = await caller.export.toMarkdown({
          noteId: note.id,
          options: { includeFrontmatter: false },
        });

        expect(result.markdown).toContain('This is the actual content of the note.');
      });
    });
  });
});
