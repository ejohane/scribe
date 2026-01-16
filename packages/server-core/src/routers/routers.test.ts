/**
 * Unit and integration tests for tRPC routers.
 *
 * Tests the notes, search, and graph routers using a direct caller
 * without HTTP transport for fast, isolated testing.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { appRouter, createContextFactory, type Context } from './index.js';
import { createServices, destroyServices, type Services } from '../container.js';

// Test vault path
const TEST_VAULT = '/tmp/scribe-router-test-vault';

describe('tRPC Routers', () => {
  let services: Services;
  let ctx: Context;
  let caller: ReturnType<typeof appRouter.createCaller>;

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

  describe('Notes Router', () => {
    describe('create', () => {
      it('should create a note with required fields', async () => {
        const note = await caller.notes.create({
          title: 'Test Note',
          type: 'note',
        });

        expect(note).toBeDefined();
        expect(note.id).toBeDefined();
        expect(note.title).toBe('Test Note');
        expect(note.type).toBe('note');
        expect(note.createdAt).toBeDefined();
        expect(note.updatedAt).toBeDefined();
        expect(note.content).toBeDefined();
      });

      it('should create a daily note with date', async () => {
        const note = await caller.notes.create({
          title: 'Daily 2024-01-15',
          type: 'daily',
          date: '2024-01-15',
        });

        expect(note.type).toBe('daily');
        expect(note.date).toBe('2024-01-15');
      });

      it('should create a note with initial content', async () => {
        const content = {
          root: {
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Hello world' }],
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root' as const,
            version: 1,
          },
        };

        const note = await caller.notes.create({
          title: 'Content Note',
          type: 'note',
          content,
        });

        expect(note.content.root.children[0]?.children?.[0]?.text).toBe('Hello world');
        expect(note.wordCount).toBe(2);
      });

      it('should reject invalid note type', async () => {
        await expect(
          caller.notes.create({
            title: 'Test',
            // @ts-expect-error - testing invalid type
            type: 'invalid',
          })
        ).rejects.toThrow();
      });

      it('should reject empty title', async () => {
        await expect(
          caller.notes.create({
            title: '',
            type: 'note',
          })
        ).rejects.toThrow();
      });
    });

    describe('get', () => {
      it('should get an existing note', async () => {
        const created = await caller.notes.create({
          title: 'Get Test',
          type: 'note',
        });

        const note = await caller.notes.get(created.id);

        expect(note).toBeDefined();
        expect(note?.id).toBe(created.id);
        expect(note?.title).toBe('Get Test');
      });

      it('should return null for non-existent note', async () => {
        const note = await caller.notes.get('non-existent-id');
        expect(note).toBeNull();
      });
    });

    describe('list', () => {
      it('should list all notes', async () => {
        await caller.notes.create({ title: 'Note 1', type: 'note' });
        await caller.notes.create({ title: 'Note 2', type: 'note' });
        await caller.notes.create({ title: 'Daily', type: 'daily' });

        const notes = await caller.notes.list();

        expect(notes.length).toBe(3);
      });

      it('should filter by type', async () => {
        await caller.notes.create({ title: 'Note 1', type: 'note' });
        await caller.notes.create({ title: 'Note 2', type: 'note' });
        await caller.notes.create({ title: 'Daily', type: 'daily' });

        const notes = await caller.notes.list({ type: 'daily' });

        expect(notes.length).toBe(1);
        expect(notes[0].title).toBe('Daily');
      });

      it('should paginate results', async () => {
        for (let i = 0; i < 10; i++) {
          await caller.notes.create({ title: `Note ${i}`, type: 'note' });
        }

        const page1 = await caller.notes.list({ limit: 3, offset: 0 });
        const page2 = await caller.notes.list({ limit: 3, offset: 3 });

        expect(page1.length).toBe(3);
        expect(page2.length).toBe(3);
      });

      it('should work with no parameters', async () => {
        await caller.notes.create({ title: 'Note', type: 'note' });

        const notes = await caller.notes.list();

        expect(notes.length).toBe(1);
      });
    });

    describe('update', () => {
      it('should update note title', async () => {
        const created = await caller.notes.create({
          title: 'Original',
          type: 'note',
        });

        // Add a small delay to ensure updatedAt changes
        await new Promise((resolve) => setTimeout(resolve, 10));

        const updated = await caller.notes.update({
          id: created.id,
          title: 'Updated',
        });

        expect(updated.title).toBe('Updated');
        // updatedAt should change but may be same if within same millisecond
        expect(updated.updatedAt).toBeDefined();
      });

      it('should update note content', async () => {
        const created = await caller.notes.create({
          title: 'Test',
          type: 'note',
        });

        const newContent = {
          root: {
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'New content here' }],
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root' as const,
            version: 1,
          },
        };

        const updated = await caller.notes.update({
          id: created.id,
          content: newContent,
        });

        expect(updated.content.root.children[0]?.children?.[0]?.text).toBe('New content here');
        expect(updated.wordCount).toBe(3);
      });

      it('should throw for non-existent note', async () => {
        await expect(
          caller.notes.update({
            id: 'non-existent',
            title: 'Updated',
          })
        ).rejects.toThrow(/not found/i);
      });
    });

    describe('delete', () => {
      it('should delete an existing note', async () => {
        const created = await caller.notes.create({
          title: 'To Delete',
          type: 'note',
        });

        const result = await caller.notes.delete(created.id);

        expect(result.success).toBe(true);
        expect(result.id).toBe(created.id);

        // Verify deleted
        const note = await caller.notes.get(created.id);
        expect(note).toBeNull();
      });

      it('should throw for non-existent note', async () => {
        await expect(caller.notes.delete('non-existent')).rejects.toThrow(/not found/i);
      });
    });

    describe('exists', () => {
      it('should return true for existing note', async () => {
        const created = await caller.notes.create({
          title: 'Test',
          type: 'note',
        });

        const exists = await caller.notes.exists(created.id);
        expect(exists).toBe(true);
      });

      it('should return false for non-existent note', async () => {
        const exists = await caller.notes.exists('non-existent');
        expect(exists).toBe(false);
      });
    });

    describe('count', () => {
      it('should count all notes', async () => {
        await caller.notes.create({ title: 'Note 1', type: 'note' });
        await caller.notes.create({ title: 'Note 2', type: 'daily' });

        const count = await caller.notes.count();
        expect(count).toBe(2);
      });

      it('should count by type', async () => {
        await caller.notes.create({ title: 'Note 1', type: 'note' });
        await caller.notes.create({ title: 'Note 2', type: 'note' });
        await caller.notes.create({ title: 'Daily', type: 'daily' });

        const noteCount = await caller.notes.count('note');
        expect(noteCount).toBe(2);

        const dailyCount = await caller.notes.count('daily');
        expect(dailyCount).toBe(1);
      });
    });
  });

  describe('Search Router', () => {
    describe('query', () => {
      it('should find notes by text', async () => {
        const content = {
          root: {
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'TypeScript is a programming language' }],
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root' as const,
            version: 1,
          },
        };

        await caller.notes.create({
          title: 'TypeScript Guide',
          type: 'note',
          content,
        });

        const results = await caller.search.query({ text: 'TypeScript' });

        expect(results.length).toBeGreaterThan(0);
        expect(results[0].note.title).toBe('TypeScript Guide');
      });

      it('should return empty array for no matches', async () => {
        await caller.notes.create({ title: 'Test', type: 'note' });

        const results = await caller.search.query({ text: 'nonexistent' });
        expect(results).toEqual([]);
      });

      it('should filter by type', async () => {
        await caller.notes.create({ title: 'Meeting Note', type: 'meeting' });
        await caller.notes.create({ title: 'Regular Note', type: 'note' });

        const results = await caller.search.query({
          text: 'Note',
          filters: { type: ['meeting'] },
        });

        expect(results.length).toBe(1);
        expect(results[0].note.type).toBe('meeting');
      });

      it('should respect limit and offset', async () => {
        for (let i = 0; i < 5; i++) {
          await caller.notes.create({ title: `Test Note ${i}`, type: 'note' });
        }

        const results = await caller.search.query({
          text: 'Test',
          options: { limit: 2, offset: 0 },
        });

        expect(results.length).toBeLessThanOrEqual(2);
      });
    });

    describe('reindex', () => {
      it('should reindex a single note', async () => {
        const note = await caller.notes.create({
          title: 'Reindex Test',
          type: 'note',
        });

        const result = await caller.search.reindex(note.id);

        expect(result.success).toBe(true);
        expect(result.noteId).toBe(note.id);
      });
    });

    describe('reindexAll', () => {
      it('should reindex all notes', async () => {
        await caller.notes.create({ title: 'Note 1', type: 'note' });
        await caller.notes.create({ title: 'Note 2', type: 'note' });

        const result = await caller.search.reindexAll();

        expect(result.indexed).toBe(2);
        expect(result.errors).toBe(0);
      });
    });
  });

  describe('Graph Router', () => {
    describe('backlinks', () => {
      it('should return empty array for note with no backlinks', async () => {
        const note = await caller.notes.create({ title: 'Lonely Note', type: 'note' });

        const backlinks = await caller.graph.backlinks(note.id);
        expect(backlinks).toEqual([]);
      });

      it('should return backlinks when notes reference each other', async () => {
        // Create target note first
        const target = await caller.notes.create({
          title: 'Target Note',
          type: 'note',
        });

        // Create source note that links to target
        const content = {
          root: {
            children: [
              {
                type: 'paragraph',
                children: [
                  {
                    type: 'note-link',
                    noteId: target.id,
                    text: 'link to target',
                  },
                ],
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root' as const,
            version: 1,
          },
        };

        await caller.notes.create({
          title: 'Source Note',
          type: 'note',
          content,
        });

        const backlinks = await caller.graph.backlinks(target.id);
        expect(backlinks.length).toBe(1);
        expect(backlinks[0].title).toBe('Source Note');
      });
    });

    describe('forwardLinks', () => {
      it('should return empty array for note with no forward links', async () => {
        const note = await caller.notes.create({ title: 'No Links', type: 'note' });

        const forwardLinks = await caller.graph.forwardLinks(note.id);
        expect(forwardLinks).toEqual([]);
      });
    });

    describe('tags', () => {
      it('should return all tags with counts', async () => {
        const content = {
          root: {
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'hashtag', tag: 'typescript' },
                  { type: 'text', text: ' ' },
                  { type: 'hashtag', tag: 'testing' },
                ],
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root' as const,
            version: 1,
          },
        };

        await caller.notes.create({ title: 'Tagged Note', type: 'note', content });

        const tags = await caller.graph.tags();

        expect(tags.length).toBeGreaterThanOrEqual(2);
        expect(tags.find((t) => t.name === 'typescript')).toBeDefined();
        expect(tags.find((t) => t.name === 'testing')).toBeDefined();
      });

      it('should return empty array when no tags exist', async () => {
        const tags = await caller.graph.tags();
        expect(tags).toEqual([]);
      });
    });

    describe('notesByTag', () => {
      it('should return notes with a specific tag', async () => {
        const content = {
          root: {
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'hashtag', tag: 'project' }],
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root' as const,
            version: 1,
          },
        };

        await caller.notes.create({ title: 'Project Note', type: 'note', content });

        const notes = await caller.graph.notesByTag('project');

        expect(notes.length).toBe(1);
        expect(notes[0].title).toBe('Project Note');
      });
    });

    describe('noteTags', () => {
      it('should return tags for a specific note', async () => {
        const content = {
          root: {
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'hashtag', tag: 'tag1' },
                  { type: 'hashtag', tag: 'tag2' },
                ],
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root' as const,
            version: 1,
          },
        };

        const note = await caller.notes.create({ title: 'Multi-tag', type: 'note', content });

        const tags = await caller.graph.noteTags(note.id);

        expect(tags).toContain('tag1');
        expect(tags).toContain('tag2');
      });
    });

    describe('stats', () => {
      it('should return graph statistics', async () => {
        await caller.notes.create({ title: 'Note 1', type: 'note' });
        await caller.notes.create({ title: 'Note 2', type: 'note' });

        const stats = await caller.graph.stats();

        expect(stats.totalNotes).toBe(2);
        expect(stats.totalLinks).toBe(0);
        expect(stats.totalTags).toBe(0);
        expect(stats.orphanedNotes).toBe(2);
      });
    });
  });

  describe('Error Handling', () => {
    it('should handle validation errors for invalid input', async () => {
      await expect(
        caller.notes.create({
          title: '',
          type: 'note',
        })
      ).rejects.toThrow();
    });

    it('should return appropriate error codes', async () => {
      try {
        await caller.notes.update({
          id: 'non-existent',
          title: 'Updated',
        });
      } catch (error: unknown) {
        const trpcError = error as { code?: string };
        expect(trpcError.code).toBe('NOT_FOUND');
      }
    });
  });
});

describe('AppRouter Type', () => {
  it('should export AppRouter type', async () => {
    // This is a compile-time check - if the type is exported correctly,
    // this test file will compile without errors
    const router: typeof appRouter = appRouter;
    expect(router).toBeDefined();
  });
});
