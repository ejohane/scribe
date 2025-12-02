/**
 * E2E Integration Tests for People Feature
 *
 * Tests the People feature functionality including:
 * - Person note creation with type="person"
 * - Person type persistence through save/load
 * - Graph engine mention tracking
 * - getAllPeople filtering
 * - Mention cleanup on person removal
 * - Person mention in notes
 *
 * Note: UI component tests (autocomplete, mention clicking) are in renderer tests.
 * This file focuses on data layer integration.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { LexicalState } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  simulateAppRestart,
  createNoteContent,
  createPersonContent,
  createPersonMentionNode,
  createNoteWithMention,
  createNoteWithMultipleMentions,
} from './test-helpers';

// =============================================================================
// Integration Tests
// =============================================================================

describe('People Feature Integration Tests', () => {
  let ctx: TestContext;

  // Convenience aliases for cleaner test code
  let tempDir: string;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-people-test');
    tempDir = ctx.tempDir;
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // Test Flow 1: Create person via vault
  // ===========================================================================

  describe('Flow 1: Create person via vault', () => {
    it('should create a person note with type="person"', async () => {
      const content = createPersonContent('John Smith');
      const person = await vault.create({ title: 'John Smith', content, type: 'person' });

      expect(person.metadata.type).toBe('person');
      expect(person.title).toBe('John Smith');
      expect(person.content.type).toBe('person');
    });

    it('should create person without explicit type in options when content has type', async () => {
      // When content already has type, it should be preserved
      const content = createPersonContent('Jane Doe');
      const person = await vault.create({ content });

      expect(person.metadata.type).toBe('person');
      expect(person.content.type).toBe('person');
    });

    it('should create regular note without type', async () => {
      const note = await vault.create();

      expect(note.metadata.type).toBeUndefined();
      expect(note.content.type).toBeUndefined();
    });

    it('should create regular note with content but no type', async () => {
      const content = createNoteContent('Regular Note', 'Some content');
      const note = await vault.create({ title: 'Regular Note', content });

      expect(note.metadata.type).toBeUndefined();
      expect(note.title).toBe('Regular Note');
    });

    it('should set person name as title', async () => {
      const content = createPersonContent('Alice Johnson');
      const person = await vault.create({ title: 'Alice Johnson', content, type: 'person' });

      expect(person.title).toBe('Alice Johnson');
    });
  });

  // ===========================================================================
  // Test Flow 2: Person type persists through save/load
  // ===========================================================================

  describe('Flow 2: Person type persistence', () => {
    it('should persist person type through save and reload', async () => {
      const person = await vault.create({
        content: createPersonContent('Jane Doe'),
        type: 'person',
      });

      // Simulate restart by loading from disk
      const vault2 = await simulateAppRestart(tempDir);

      const loaded = vault2.read(person.id);
      expect(loaded.metadata.type).toBe('person');
      expect(loaded.content.type).toBe('person');
    });

    it('should persist person title through save and reload', async () => {
      const person = await vault.create({
        title: 'Bob Wilson',
        content: createPersonContent('Bob Wilson'),
        type: 'person',
      });

      const vault2 = await simulateAppRestart(tempDir);

      const loaded = vault2.read(person.id);
      expect(loaded.title).toBe('Bob Wilson');
    });

    it('should maintain type after note update', async () => {
      const person = await vault.create({
        title: 'Carol Davis',
        content: createPersonContent('Carol Davis'),
        type: 'person',
      });

      // Update the person note
      const loaded = vault.read(person.id);
      loaded.title = 'Carol Davis-Smith';
      loaded.content = {
        ...loaded.content,
        root: {
          type: 'root',
          children: [
            {
              type: 'heading',
              tag: 'h1',
              children: [{ type: 'text', text: 'Carol Davis-Smith' }],
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Updated bio' }],
            },
          ],
        },
      };
      await vault.save(loaded);

      // Verify type is preserved
      const updated = vault.read(person.id);
      expect(updated.metadata.type).toBe('person');
      expect(updated.title).toBe('Carol Davis-Smith');
    });

    it('should persist multiple people through restart', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const bob = await vault.create({
        content: createPersonContent('Bob'),
        type: 'person',
      });
      const regular = await vault.create({
        content: createNoteContent('Regular Note'),
      });

      const vault2 = await simulateAppRestart(tempDir);

      const loadedAlice = vault2.read(alice.id);
      const loadedBob = vault2.read(bob.id);
      const loadedRegular = vault2.read(regular.id);

      expect(loadedAlice.metadata.type).toBe('person');
      expect(loadedBob.metadata.type).toBe('person');
      expect(loadedRegular.metadata.type).toBeUndefined();
    });
  });

  // ===========================================================================
  // Test Flow 3: Graph engine tracks mentions
  // ===========================================================================

  describe('Flow 3: Graph engine mention tracking', () => {
    it('should track person mentions in graph engine', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });

      const noteContent = createNoteWithMention('Meeting notes', alice.id, 'Alice');
      const meetingNote = await vault.create({ content: noteContent });

      graphEngine.addNote(alice);
      graphEngine.addNote(meetingNote);

      const mentioningNotes = graphEngine.notesMentioning(alice.id);
      expect(mentioningNotes).toContain(meetingNote.id);

      const mentionedPeople = graphEngine.peopleMentionedIn(meetingNote.id);
      expect(mentionedPeople).toContain(alice.id);
    });

    it('should track multiple mentions in a single note', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const bob = await vault.create({
        content: createPersonContent('Bob'),
        type: 'person',
      });

      const noteContent = createNoteWithMultipleMentions('Team Meeting', [
        { personId: alice.id, personName: 'Alice' },
        { personId: bob.id, personName: 'Bob' },
      ]);
      const meetingNote = await vault.create({ content: noteContent });

      graphEngine.addNote(alice);
      graphEngine.addNote(bob);
      graphEngine.addNote(meetingNote);

      const mentionedPeople = graphEngine.peopleMentionedIn(meetingNote.id);
      expect(mentionedPeople).toContain(alice.id);
      expect(mentionedPeople).toContain(bob.id);
      expect(mentionedPeople).toHaveLength(2);
    });

    it('should track mentions across multiple notes', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });

      const note1 = await vault.create({
        content: createNoteWithMention('Meeting 1', alice.id, 'Alice'),
      });
      const note2 = await vault.create({
        content: createNoteWithMention('Meeting 2', alice.id, 'Alice'),
      });

      graphEngine.addNote(alice);
      graphEngine.addNote(note1);
      graphEngine.addNote(note2);

      const mentioningNotes = graphEngine.notesMentioning(alice.id);
      expect(mentioningNotes).toContain(note1.id);
      expect(mentioningNotes).toContain(note2.id);
      expect(mentioningNotes).toHaveLength(2);
    });

    it('should update mentions when note is modified', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const bob = await vault.create({
        content: createPersonContent('Bob'),
        type: 'person',
      });

      // Create note mentioning Alice
      const noteContent = createNoteWithMention('Meeting', alice.id, 'Alice');
      const note = await vault.create({ content: noteContent });

      graphEngine.addNote(alice);
      graphEngine.addNote(bob);
      graphEngine.addNote(note);

      // Verify initial state
      expect(graphEngine.peopleMentionedIn(note.id)).toContain(alice.id);
      expect(graphEngine.peopleMentionedIn(note.id)).not.toContain(bob.id);

      // Update note to mention Bob instead
      const loaded = vault.read(note.id);
      loaded.content = createNoteWithMention('Meeting', bob.id, 'Bob');
      await vault.save(loaded);

      // Re-add to graph (simulating update)
      const updated = vault.read(note.id);
      graphEngine.addNote(updated);

      // Verify updated mentions
      expect(graphEngine.peopleMentionedIn(note.id)).not.toContain(alice.id);
      expect(graphEngine.peopleMentionedIn(note.id)).toContain(bob.id);
    });

    it('should rebuild mention indexes after restart', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });

      const noteContent = createNoteWithMention('Meeting', alice.id, 'Alice');
      const note = await vault.create({ content: noteContent });

      // Simulate restart
      const vault2 = await simulateAppRestart(tempDir);
      const newGraphEngine = new GraphEngine();

      // Rebuild graph from loaded notes
      for (const n of vault2.list()) {
        newGraphEngine.addNote(n);
      }

      // Verify mentions are restored
      const mentioningNotes = newGraphEngine.notesMentioning(alice.id);
      expect(mentioningNotes).toContain(note.id);

      const mentionedPeople = newGraphEngine.peopleMentionedIn(note.id);
      expect(mentionedPeople).toContain(alice.id);
    });
  });

  // ===========================================================================
  // Test Flow 4: getAllPeople returns only person notes
  // ===========================================================================

  describe('Flow 4: getAllPeople filtering', () => {
    it('should filter people correctly in getAllPeople', async () => {
      const person1 = await vault.create({
        content: createPersonContent('Bob'),
        type: 'person',
      });
      const person2 = await vault.create({
        content: createPersonContent('Carol'),
        type: 'person',
      });
      const regularNote = await vault.create(); // No type

      graphEngine.addNote(person1);
      graphEngine.addNote(person2);
      graphEngine.addNote(regularNote);

      const people = graphEngine.getAllPeople();

      expect(people).toHaveLength(2);
      expect(people).toContain(person1.id);
      expect(people).toContain(person2.id);
      expect(people).not.toContain(regularNote.id);
    });

    it('should return empty array when no people exist', async () => {
      const note1 = await vault.create({ content: createNoteContent('Note 1') });
      const note2 = await vault.create({ content: createNoteContent('Note 2') });

      graphEngine.addNote(note1);
      graphEngine.addNote(note2);

      const people = graphEngine.getAllPeople();
      expect(people).toHaveLength(0);
    });

    it('should return all people when only people exist', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const bob = await vault.create({
        content: createPersonContent('Bob'),
        type: 'person',
      });
      const carol = await vault.create({
        content: createPersonContent('Carol'),
        type: 'person',
      });

      graphEngine.addNote(alice);
      graphEngine.addNote(bob);
      graphEngine.addNote(carol);

      const people = graphEngine.getAllPeople();
      expect(people).toHaveLength(3);
    });

    it('should update getAllPeople after adding a person', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });

      graphEngine.addNote(alice);
      expect(graphEngine.getAllPeople()).toHaveLength(1);

      const bob = await vault.create({
        content: createPersonContent('Bob'),
        type: 'person',
      });
      graphEngine.addNote(bob);

      expect(graphEngine.getAllPeople()).toHaveLength(2);
    });

    it('should update getAllPeople after removing a person', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const bob = await vault.create({
        content: createPersonContent('Bob'),
        type: 'person',
      });

      graphEngine.addNote(alice);
      graphEngine.addNote(bob);
      expect(graphEngine.getAllPeople()).toHaveLength(2);

      graphEngine.removeNote(alice.id);
      expect(graphEngine.getAllPeople()).toHaveLength(1);
      expect(graphEngine.getAllPeople()).toContain(bob.id);
    });
  });

  // ===========================================================================
  // Test Flow 5: Remove person cleans up mentions
  // ===========================================================================

  describe('Flow 5: Mention cleanup on person removal', () => {
    it('should clean up mention indexes when person is removed', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const note = await vault.create({
        content: createNoteWithMention('Note', alice.id, 'Alice'),
      });

      graphEngine.addNote(alice);
      graphEngine.addNote(note);

      // Verify mention tracked
      expect(graphEngine.notesMentioning(alice.id)).toContain(note.id);

      // Remove person
      graphEngine.removeNote(alice.id);

      // Verify cleanup
      expect(graphEngine.notesMentioning(alice.id)).toHaveLength(0);
    });

    it('should clean up mentions in multiple notes when person is removed', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const note1 = await vault.create({
        content: createNoteWithMention('Note 1', alice.id, 'Alice'),
      });
      const note2 = await vault.create({
        content: createNoteWithMention('Note 2', alice.id, 'Alice'),
      });

      graphEngine.addNote(alice);
      graphEngine.addNote(note1);
      graphEngine.addNote(note2);

      // Verify initial mentions
      expect(graphEngine.notesMentioning(alice.id)).toHaveLength(2);

      // Remove person
      graphEngine.removeNote(alice.id);

      // Verify cleanup
      expect(graphEngine.notesMentioning(alice.id)).toHaveLength(0);
    });

    it('should clean up peopleMentionedIn when note is removed', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const note = await vault.create({
        content: createNoteWithMention('Note', alice.id, 'Alice'),
      });

      graphEngine.addNote(alice);
      graphEngine.addNote(note);

      // Verify initial state
      expect(graphEngine.notesMentioning(alice.id)).toContain(note.id);

      // Remove note
      graphEngine.removeNote(note.id);

      // Verify cleanup
      expect(graphEngine.notesMentioning(alice.id)).toHaveLength(0);
    });

    it('should not affect other mentions when one note is removed', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const note1 = await vault.create({
        content: createNoteWithMention('Note 1', alice.id, 'Alice'),
      });
      const note2 = await vault.create({
        content: createNoteWithMention('Note 2', alice.id, 'Alice'),
      });

      graphEngine.addNote(alice);
      graphEngine.addNote(note1);
      graphEngine.addNote(note2);

      // Remove note1
      graphEngine.removeNote(note1.id);

      // Verify note2 mention is still tracked
      const mentioningNotes = graphEngine.notesMentioning(alice.id);
      expect(mentioningNotes).not.toContain(note1.id);
      expect(mentioningNotes).toContain(note2.id);
      expect(mentioningNotes).toHaveLength(1);
    });
  });

  // ===========================================================================
  // Metadata extraction tests
  // ===========================================================================

  describe('Person mention metadata extraction', () => {
    it('should extract person mentions into note metadata', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });

      const noteContent = createNoteWithMention('Meeting', alice.id, 'Alice');
      const note = await vault.create({ content: noteContent });

      expect(note.metadata.mentions).toContain(alice.id);
      expect(note.metadata.mentions).toHaveLength(1);
    });

    it('should extract multiple mentions without duplicates', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });

      // Create note that mentions Alice twice
      const noteContent: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Meeting' }],
            },
            {
              type: 'paragraph',
              children: [
                createPersonMentionNode(alice.id, 'Alice'),
                { type: 'text', text: ' talked to ' },
                createPersonMentionNode(alice.id, 'Alice'),
              ],
            },
          ],
        },
      };

      const note = await vault.create({ content: noteContent });

      // Should only have one entry for Alice (no duplicates)
      expect(note.metadata.mentions).toHaveLength(1);
      expect(note.metadata.mentions).toContain(alice.id);
    });

    it('should have empty mentions for notes without person mentions', async () => {
      const note = await vault.create({
        content: createNoteContent('Regular Note', 'No mentions here'),
      });

      expect(note.metadata.mentions).toEqual([]);
    });
  });

  // ===========================================================================
  // Complete user journey tests
  // ===========================================================================

  describe('Complete People workflow', () => {
    it('should handle complete workflow: create person -> mention in note -> view mentions', async () => {
      // Step 1: Create a person
      const alice = await vault.create({
        title: 'Alice',
        content: createPersonContent('Alice'),
        type: 'person',
      });
      graphEngine.addNote(alice);
      searchEngine.indexNote(alice);

      // Verify person created
      expect(alice.metadata.type).toBe('person');
      expect(alice.title).toBe('Alice');
      expect(graphEngine.getAllPeople()).toContain(alice.id);

      // Step 2: Create meeting note that mentions Alice
      const meetingNote = await vault.create({
        content: createNoteWithMention('Team Standup', alice.id, 'Alice'),
      });
      graphEngine.addNote(meetingNote);
      searchEngine.indexNote(meetingNote);

      // Verify mention tracked
      expect(meetingNote.metadata.mentions).toContain(alice.id);
      expect(graphEngine.notesMentioning(alice.id)).toContain(meetingNote.id);

      // Step 3: Create another note mentioning Alice
      const projectNote = await vault.create({
        content: createNoteWithMention('Project Alpha', alice.id, 'Alice'),
      });
      graphEngine.addNote(projectNote);
      searchEngine.indexNote(projectNote);

      // Verify both mentions tracked
      const mentioningNotes = graphEngine.notesMentioning(alice.id);
      expect(mentioningNotes).toContain(meetingNote.id);
      expect(mentioningNotes).toContain(projectNote.id);
      expect(mentioningNotes).toHaveLength(2);

      // Step 4: Simulate restart and verify persistence
      const vault2 = await simulateAppRestart(tempDir);
      const newGraphEngine = new GraphEngine();
      const newSearchEngine = new SearchEngine();

      for (const note of vault2.list()) {
        newGraphEngine.addNote(note);
        newSearchEngine.indexNote(note);
      }

      // Verify data persisted
      const loadedAlice = vault2.read(alice.id);
      expect(loadedAlice.metadata.type).toBe('person');

      const persistedMentions = newGraphEngine.notesMentioning(alice.id);
      expect(persistedMentions).toHaveLength(2);
    });

    it('should handle person deletion and mention cleanup', async () => {
      // Create people and notes
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const bob = await vault.create({
        content: createPersonContent('Bob'),
        type: 'person',
      });
      const note = await vault.create({
        content: createNoteWithMultipleMentions('Meeting', [
          { personId: alice.id, personName: 'Alice' },
          { personId: bob.id, personName: 'Bob' },
        ]),
      });

      graphEngine.addNote(alice);
      graphEngine.addNote(bob);
      graphEngine.addNote(note);

      // Verify initial state
      expect(graphEngine.getAllPeople()).toHaveLength(2);
      expect(graphEngine.peopleMentionedIn(note.id)).toHaveLength(2);

      // Delete Alice from graph
      graphEngine.removeNote(alice.id);
      await vault.delete(alice.id);

      // Verify Alice is removed
      expect(graphEngine.getAllPeople()).toHaveLength(1);
      expect(graphEngine.getAllPeople()).toContain(bob.id);
      expect(graphEngine.notesMentioning(alice.id)).toHaveLength(0);

      // Note still mentions Bob
      // Note: peopleMentionedIn still shows alice.id because the note content
      // wasn't updated - this is expected behavior (broken mention)
    });
  });

  // ===========================================================================
  // Edge cases
  // ===========================================================================

  describe('Edge cases', () => {
    it('should handle mentioning a person that does not exist in graph', async () => {
      // Create note mentioning a non-existent person ID
      const fakePersonId = 'non-existent-person-id';
      const note = await vault.create({
        content: createNoteWithMention('Meeting', fakePersonId, 'Ghost'),
      });

      graphEngine.addNote(note);

      // The mention should still be tracked (like a broken link)
      expect(note.metadata.mentions).toContain(fakePersonId);
      expect(graphEngine.peopleMentionedIn(note.id)).toContain(fakePersonId);
    });

    it('should handle self-mention (person note mentioning itself)', async () => {
      // First create person without mentions
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });

      // Then update to mention self
      const loaded = vault.read(alice.id);
      loaded.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'heading',
              tag: 'h1',
              children: [{ type: 'text', text: 'Alice' }],
            },
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'I am ' },
                createPersonMentionNode(alice.id, 'Alice'),
              ],
            },
          ],
        },
        type: 'person',
      };
      await vault.save(loaded);

      const updated = vault.read(alice.id);
      graphEngine.addNote(updated);

      // Self-mention should be tracked but probably ignored in UI
      expect(updated.metadata.mentions).toContain(alice.id);
      expect(graphEngine.notesMentioning(alice.id)).toContain(alice.id);
    });

    it('should handle note with both wiki-links and person mentions', async () => {
      const alice = await vault.create({
        content: createPersonContent('Alice'),
        type: 'person',
      });
      const projectNote = await vault.create({
        content: createNoteContent('Project Alpha', 'Project details'),
      });

      // Create note with both link and mention
      const combinedContent: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Meeting Notes' }],
            },
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Discussed ' },
                {
                  type: 'wiki-link',
                  noteTitle: 'Project Alpha',
                  displayText: 'Project Alpha',
                  targetId: projectNote.id,
                  version: 1,
                },
                { type: 'text', text: ' with ' },
                createPersonMentionNode(alice.id, 'Alice'),
              ],
            },
          ],
        },
      };

      const note = await vault.create({ content: combinedContent });

      // Verify both links and mentions are extracted
      expect(note.metadata.links).toContain(projectNote.id);
      expect(note.metadata.mentions).toContain(alice.id);
    });
  });
});
