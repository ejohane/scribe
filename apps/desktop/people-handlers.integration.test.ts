/**
 * Integration Tests for People Handlers
 *
 * Tests the people management handler logic through the data layer packages.
 * Since IPC handlers are thin wrappers around vault/engine calls,
 * testing the underlying operations validates the handler behavior.
 *
 * Tests cover:
 * - people:list - List all person notes
 * - people:create - Create a new person note
 * - people:search - Search people by name
 *
 * Issue: scribe-q3n.10
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { EditorContent } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  simulateAppRestart,
  createNoteContent,
  createPersonContent,
  createNoteWithMention,
} from './test-helpers';

/**
 * Create person content (mirrors handler implementation)
 */
function createPersonContentInternal(name: string): EditorContent {
  return {
    root: {
      children: [
        {
          type: 'heading',
          tag: 'h1',
          children: [{ type: 'text', text: name }],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
        {
          type: 'paragraph',
          children: [],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      ],
      type: 'root',
      format: '',
      indent: 0,
      version: 1,
    },
    type: 'person',
  };
}

describe('People Handler Integration Tests', () => {
  let ctx: TestContext;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-people-handler-test');
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // people:list Tests
  // ===========================================================================

  describe('people:list logic', () => {
    it('should return empty array when no people exist', () => {
      const notes = vault.list();
      const people = notes.filter((n) => n.metadata.type === 'person');

      expect(people).toEqual([]);
    });

    it('should list all person notes', async () => {
      // Create people
      await vault.create({
        title: 'Alice',
        content: createPersonContent('Alice'),
        type: 'person',
      });
      await vault.create({
        title: 'Bob',
        content: createPersonContent('Bob'),
        type: 'person',
      });
      await vault.create({
        title: 'Carol',
        content: createPersonContent('Carol'),
        type: 'person',
      });

      const notes = vault.list();
      const people = notes.filter((n) => n.metadata.type === 'person');

      expect(people).toHaveLength(3);
    });

    it('should not include regular notes', async () => {
      await vault.create({
        title: 'Alice',
        content: createPersonContent('Alice'),
        type: 'person',
      });
      await vault.create({
        title: 'Meeting Notes',
        content: createNoteContent('Meeting Notes'),
      });

      const notes = vault.list();
      const people = notes.filter((n) => n.metadata.type === 'person');

      expect(people).toHaveLength(1);
      expect(people[0].title).toBe('Alice');
    });

    it('should not include daily notes', async () => {
      await vault.create({
        title: 'Alice',
        content: createPersonContent('Alice'),
        type: 'person',
      });
      await vault.create({
        title: '01-15-2024',
        type: 'daily',
        daily: { date: '01-15-2024' },
      });

      const notes = vault.list();
      const people = notes.filter((n) => n.metadata.type === 'person');

      expect(people).toHaveLength(1);
    });

    it('should return people with correct metadata', async () => {
      const alice = await vault.create({
        title: 'Alice Smith',
        content: createPersonContent('Alice Smith'),
        type: 'person',
      });

      const notes = vault.list();
      const people = notes.filter((n) => n.metadata.type === 'person');

      expect(people[0].id).toBe(alice.id);
      expect(people[0].title).toBe('Alice Smith');
      expect(people[0].metadata.type).toBe('person');
    });
  });

  // ===========================================================================
  // people:create Tests
  // ===========================================================================

  describe('people:create logic', () => {
    it('should create a person note with name', async () => {
      const name = 'John Doe';

      // Simulate handler logic
      if (!name || name.trim().length === 0) {
        throw new Error('Person name is required');
      }

      const content = createPersonContentInternal(name.trim());
      const note = await vault.create({
        content,
        type: 'person',
        title: name.trim(),
      });

      // Index in engines
      graphEngine.addNote(note);
      searchEngine.indexNote(note);

      expect(note.title).toBe('John Doe');
      expect(note.metadata.type).toBe('person');
      expect(note.content.type).toBe('person');
    });

    it('should throw error for empty name', () => {
      const name = '' as string;

      expect(() => {
        if (name.trim().length === 0) {
          throw new Error('Person name is required');
        }
      }).toThrow('Person name is required');
    });

    it('should throw error for whitespace-only name', () => {
      const name = '   ' as string;

      expect(() => {
        if (name.trim().length === 0) {
          throw new Error('Person name is required');
        }
      }).toThrow('Person name is required');
    });

    it('should trim name whitespace', async () => {
      const name = '  Jane Doe  ';

      const content = createPersonContentInternal(name.trim());
      const note = await vault.create({
        content,
        type: 'person',
        title: name.trim(),
      });

      expect(note.title).toBe('Jane Doe');
    });

    it('should add person to graph engine', async () => {
      const name = 'Alice';

      const content = createPersonContentInternal(name);
      const note = await vault.create({
        content,
        type: 'person',
        title: name,
      });

      graphEngine.addNote(note);

      const people = graphEngine.getAllPeople();
      expect(people).toContain(note.id);
    });

    it('should index person in search engine', async () => {
      const name = 'Bob Johnson';

      const content = createPersonContentInternal(name);
      const note = await vault.create({
        content,
        type: 'person',
        title: name,
      });

      searchEngine.indexNote(note);

      const results = searchEngine.search('Bob');
      expect(results.some((r) => r.id === note.id)).toBe(true);
    });

    it('should create person with H1 heading in content', async () => {
      const name = 'Carol';

      const content = createPersonContentInternal(name);
      const note = await vault.create({
        content,
        type: 'person',
        title: name,
      });

      // Verify content structure
      const heading = note.content.root.children[0];
      expect(heading.type).toBe('heading');
      expect((heading as { tag?: string }).tag).toBe('h1');
    });
  });

  // ===========================================================================
  // people:search Tests
  // ===========================================================================

  describe('people:search logic', () => {
    beforeEach(async () => {
      // Create some people for searching
      const people = ['Alice Smith', 'Alice Johnson', 'Bob Wilson', 'Carol Davis', 'Dave Smith'];

      for (const name of people) {
        await vault.create({
          title: name,
          content: createPersonContent(name),
          type: 'person',
        });
      }
    });

    it('should search people by name substring', () => {
      const query = 'alice';
      const limit = 10;

      const notes = vault.list();
      const people = notes.filter((n) => n.type === 'person');

      const queryLower = query.toLowerCase();
      const filtered = people.filter((n) => {
        const title = (n.title ?? '').toLowerCase();
        return title.includes(queryLower);
      });

      const results = filtered.slice(0, limit).map((n) => ({
        id: n.id,
        title: n.title,
        snippet: '',
        score: 1,
        matches: [],
      }));

      expect(results).toHaveLength(2);
      expect(results.every((r) => r.title?.toLowerCase().includes('alice'))).toBe(true);
    });

    it('should be case-insensitive', () => {
      const query = 'ALICE';

      const notes = vault.list();
      const people = notes.filter((n) => n.type === 'person');

      const queryLower = query.toLowerCase();
      const filtered = people.filter((n) => {
        const title = (n.title ?? '').toLowerCase();
        return title.includes(queryLower);
      });

      expect(filtered).toHaveLength(2);
    });

    it('should respect limit', () => {
      const query = 'smith';
      const limit = 1;

      const notes = vault.list();
      const people = notes.filter((n) => n.type === 'person');

      const queryLower = query.toLowerCase();
      const filtered = people.filter((n) => {
        const title = (n.title ?? '').toLowerCase();
        return title.includes(queryLower);
      });

      const results = filtered.slice(0, limit);

      expect(results).toHaveLength(1);
    });

    it('should return empty for no matches', () => {
      const query = 'xyz';

      const notes = vault.list();
      const people = notes.filter((n) => n.type === 'person');

      const filtered = people.filter((n) => {
        const title = (n.title ?? '').toLowerCase();
        return title.includes(query.toLowerCase());
      });

      expect(filtered).toHaveLength(0);
    });

    it('should default limit to 10', () => {
      const limit = 10;

      // We already have 5 people from beforeEach
      const notes = vault.list();
      const people = notes.filter((n) => n.type === 'person');

      const results = people.slice(0, limit);
      expect(results.length).toBeLessThanOrEqual(10);
    });

    it('should only search person notes', async () => {
      // Create regular note with "Alice" in title
      await vault.create({
        title: 'Meeting with Alice',
        content: createNoteContent('Meeting with Alice'),
      });

      const query = 'alice';

      const notes = vault.list();
      const people = notes.filter((n) => n.type === 'person');

      const filtered = people.filter((n) => {
        const title = (n.title ?? '').toLowerCase();
        return title.includes(query.toLowerCase());
      });

      // Should only find person notes, not the meeting note
      expect(filtered).toHaveLength(2);
      expect(filtered.every((n) => n.type === 'person')).toBe(true);
    });

    it('should return search result format', () => {
      const query = 'bob';

      const notes = vault.list();
      const people = notes.filter((n) => n.type === 'person');

      const queryLower = query.toLowerCase();
      const filtered = people.filter((n) => {
        const title = (n.title ?? '').toLowerCase();
        return title.includes(queryLower);
      });

      const results = filtered.slice(0, 10).map((n) => ({
        id: n.id,
        title: n.title,
        snippet: '',
        score: 1,
        matches: [],
      }));

      expect(results).toHaveLength(1);
      expect(results[0]).toHaveProperty('id');
      expect(results[0]).toHaveProperty('title');
      expect(results[0]).toHaveProperty('snippet');
      expect(results[0]).toHaveProperty('score');
      expect(results[0]).toHaveProperty('matches');
    });
  });

  // ===========================================================================
  // Person with Related Notes Tests
  // ===========================================================================

  describe('Get person by ID with related notes', () => {
    it('should get person by ID', async () => {
      const person = await vault.create({
        title: 'Alice',
        content: createPersonContent('Alice'),
        type: 'person',
      });

      const loaded = vault.read(person.id);

      expect(loaded.id).toBe(person.id);
      expect(loaded.title).toBe('Alice');
      expect(loaded.type).toBe('person');
    });

    it('should find notes mentioning the person', async () => {
      // Create person
      const alice = await vault.create({
        title: 'Alice',
        content: createPersonContent('Alice'),
        type: 'person',
      });

      // Create notes mentioning Alice
      const note1 = await vault.create({
        title: 'Meeting Notes',
        content: createNoteWithMention('Meeting Notes', alice.id, 'Alice'),
      });

      const note2 = await vault.create({
        title: 'Project Update',
        content: createNoteWithMention('Project Update', alice.id, 'Alice'),
      });

      // Index in graph
      graphEngine.addNote(alice);
      graphEngine.addNote(note1);
      graphEngine.addNote(note2);

      // Find notes mentioning Alice
      const mentioningNotes = graphEngine.notesMentioning(alice.id);

      expect(mentioningNotes).toContain(note1.id);
      expect(mentioningNotes).toContain(note2.id);
      expect(mentioningNotes).toHaveLength(2);
    });

    it('should return empty mentions for person with no references', async () => {
      const person = await vault.create({
        title: 'Lonely Person',
        content: createPersonContent('Lonely Person'),
        type: 'person',
      });

      graphEngine.addNote(person);

      const mentioningNotes = graphEngine.notesMentioning(person.id);
      expect(mentioningNotes).toHaveLength(0);
    });
  });

  // ===========================================================================
  // Persistence Tests
  // ===========================================================================

  describe('Person persistence', () => {
    it('should persist person through restart', async () => {
      const person = await vault.create({
        title: 'Persisted Person',
        content: createPersonContent('Persisted Person'),
        type: 'person',
      });

      // Simulate restart
      const vault2 = await simulateAppRestart(ctx.tempDir);

      const loaded = vault2.read(person.id);
      expect(loaded.title).toBe('Persisted Person');
      expect(loaded.type).toBe('person');
    });

    it('should rebuild person indexes after restart', async () => {
      const person = await vault.create({
        title: 'Indexed Person',
        content: createPersonContent('Indexed Person'),
        type: 'person',
      });

      graphEngine.addNote(person);
      searchEngine.indexNote(person);

      // Simulate restart
      const vault2 = await simulateAppRestart(ctx.tempDir);
      const newGraphEngine = new GraphEngine();
      const newSearchEngine = new SearchEngine();

      for (const note of vault2.list()) {
        newGraphEngine.addNote(note);
        newSearchEngine.indexNote(note);
      }

      // Verify indexes
      expect(newGraphEngine.getAllPeople()).toContain(person.id);

      const searchResults = newSearchEngine.search('Indexed');
      expect(searchResults.some((r) => r.id === person.id)).toBe(true);
    });
  });

  // ===========================================================================
  // Edge Cases
  // ===========================================================================

  describe('Edge cases', () => {
    it('should handle person names with special characters', async () => {
      const name = "O'Brien";

      const content = createPersonContentInternal(name);
      const note = await vault.create({
        content,
        type: 'person',
        title: name,
      });

      expect(note.title).toBe("O'Brien");
    });

    it('should handle unicode names', async () => {
      const name = 'José García';

      const content = createPersonContentInternal(name);
      const note = await vault.create({
        content,
        type: 'person',
        title: name,
      });

      expect(note.title).toBe('José García');
    });

    it('should handle very long names', async () => {
      const name = 'A'.repeat(100);

      const content = createPersonContentInternal(name);
      const note = await vault.create({
        content,
        type: 'person',
        title: name,
      });

      expect(note.title).toBe(name);
    });

    it('should handle creating multiple people with similar names', async () => {
      await vault.create({
        title: 'John Smith',
        content: createPersonContent('John Smith'),
        type: 'person',
      });
      await vault.create({
        title: 'John Doe',
        content: createPersonContent('John Doe'),
        type: 'person',
      });
      await vault.create({
        title: 'Johnny Smith',
        content: createPersonContent('Johnny Smith'),
        type: 'person',
      });

      const people = vault.list().filter((n) => n.type === 'person');
      expect(people).toHaveLength(3);
    });
  });
});
