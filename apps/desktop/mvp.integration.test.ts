/**
 * Comprehensive E2E Integration Tests for MVP
 *
 * Tests all critical user flows:
 * - Create note
 * - Edit and save note
 * - Search notes
 * - Navigate between notes
 * - Backlinks
 * - Persistence across restarts (simulated)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import { SearchEngine } from '@scribe/engine-search';
import type { Note } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  simulateAppRestart,
} from './test-helpers';

describe('MVP E2E Integration Tests', () => {
  let ctx: TestContext;

  // Convenience aliases for cleaner test code
  let tempDir: string;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-e2e-test');
    tempDir = ctx.tempDir;
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
    searchEngine = ctx.searchEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  describe('Create and Edit Flow', () => {
    it('should create a new note with empty content', async () => {
      const note = await vault.create();

      expect(note.id).toBeDefined();
      expect(note.createdAt).toBeDefined();
      expect(note.updatedAt).toBeDefined();
      expect(note.content).toBeDefined();
      expect(note.metadata).toEqual({
        title: null,
        tags: [],
        links: [],
        mentions: [],
        type: undefined,
      });
    });

    it('should save note content and extract metadata', async () => {
      const note = await vault.create();

      // Simulate editing content with title and tag
      note.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'My First Note' }],
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'This is content with #important tag' }],
            },
          ],
        },
      };

      await vault.save(note);

      // Reload note and verify metadata extraction
      const loaded = vault.read(note.id);
      expect(loaded?.metadata.title).toBe('My First Note');
      expect(loaded?.metadata.tags).toContain('important');
    });

    it('should update existing note and maintain ID', async () => {
      const note = await vault.create();
      const originalId = note.id;
      const originalCreatedAt = note.createdAt;

      // Edit and save
      note.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Updated content' }],
            },
          ],
        },
      };

      await vault.save(note);

      // Reload and verify
      const loaded = vault.read(note.id);
      expect(loaded?.id).toBe(originalId);
      expect(loaded?.createdAt).toBe(originalCreatedAt);
      expect(loaded?.updatedAt).toBeGreaterThanOrEqual(originalCreatedAt);
      expect(loaded?.metadata.title).toBe('Updated content');
    });
  });

  describe('Search Flow', () => {
    beforeEach(async () => {
      // Create multiple notes for searching with explicit titles
      const notesData = [
        {
          title: 'Project Alpha Overview',
          content: {
            root: {
              type: 'root' as const,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Project Alpha Overview' }],
                },
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Details about project alpha with #work tag' }],
                },
              ],
            },
          },
        },
        {
          title: 'Meeting Notes',
          content: {
            root: {
              type: 'root' as const,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Meeting Notes' }],
                },
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Discussed alpha version release #work' }],
                },
              ],
            },
          },
        },
        {
          title: 'Personal Todo',
          content: {
            root: {
              type: 'root' as const,
              children: [
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Personal Todo' }],
                },
                {
                  type: 'paragraph',
                  children: [{ type: 'text', text: 'Buy groceries #personal' }],
                },
              ],
            },
          },
        },
      ];

      for (const { title, content } of notesData) {
        const note = await vault.create({ title, content });
        searchEngine.indexNote(note);
      }
    });

    it('should search by title and return ranked results', async () => {
      const results = searchEngine.search('project alpha');

      expect(results.length).toBeGreaterThan(0);
      expect(results[0].title).toContain('Project Alpha');
    });

    it('should search by body text', async () => {
      const results = searchEngine.search('groceries');

      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Personal Todo');
    });

    it('should search by tag', async () => {
      const results = searchEngine.search('work');

      expect(results.length).toBeGreaterThanOrEqual(2);
      // Both work-tagged notes should appear
      const titles = results.map((r) => r.title);
      expect(titles).toContain('Project Alpha Overview');
      expect(titles).toContain('Meeting Notes');
    });

    it('should update search index when note is modified', async () => {
      // Create initial note
      const note = await vault.create();
      note.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Original Content' }],
            },
          ],
        },
      };
      await vault.save(note);
      searchEngine.indexNote(note);

      // Search for original content
      let results = searchEngine.search('original');
      expect(results.length).toBe(1);

      // Update note
      note.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Modified Content' }],
            },
          ],
        },
      };
      await vault.save(note);

      // Re-index with updated note
      const updated = vault.read(note.id);
      if (updated) {
        searchEngine.indexNote(updated);
      }

      // Old content should not be found
      results = searchEngine.search('original');
      expect(results.length).toBe(0);

      // New content should be found
      results = searchEngine.search('modified');
      expect(results.length).toBe(1);
    });
  });

  describe('Graph and Backlinks Flow', () => {
    let noteA: Note;
    let noteB: Note;
    let noteC: Note;

    beforeEach(async () => {
      // Create note A
      noteA = await vault.create();
      noteA.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Note A' }],
            },
          ],
        },
      };
      await vault.save(noteA);

      // Create note B
      noteB = await vault.create();
      noteB.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Note B' }],
            },
          ],
        },
      };
      await vault.save(noteB);

      // Create note C
      noteC = await vault.create();
      noteC.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Note C' }],
            },
          ],
        },
      };
      await vault.save(noteC);
    });

    it('should create link from Note A to Note B and detect backlink', async () => {
      // Add link from A to B (using note-reference node)
      noteA.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Note A linking to ' },
                { type: 'note-reference', noteId: noteB.id, text: 'Note B' },
              ],
            },
          ],
        },
      };
      await vault.save(noteA);

      // Reload to get extracted metadata
      const savedA = vault.read(noteA.id);
      const savedB = vault.read(noteB.id);

      // Build graph
      if (savedA) graphEngine.addNote(savedA);
      if (savedB) graphEngine.addNote(savedB);

      // Check neighbors of A (should include B as outgoing)
      const neighborsA = graphEngine.neighbors(noteA.id);
      expect(neighborsA.some((n) => n.id === noteB.id)).toBe(true);

      // Check backlinks of B (should include A)
      const backlinksB = graphEngine.backlinks(noteB.id);
      expect(backlinksB.some((n) => n.id === noteA.id)).toBe(true);
    });

    it('should handle bidirectional links correctly', async () => {
      // A links to B, B links to A
      noteA.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Note A ' },
                { type: 'note-reference', noteId: noteB.id, text: 'links to B' },
              ],
            },
          ],
        },
      };
      noteB.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Note B ' },
                { type: 'note-reference', noteId: noteA.id, text: 'links to A' },
              ],
            },
          ],
        },
      };
      await vault.save(noteA);
      await vault.save(noteB);

      // Reload to get extracted metadata
      const savedA = vault.read(noteA.id);
      const savedB = vault.read(noteB.id);

      // Build graph
      if (savedA) graphEngine.addNote(savedA);
      if (savedB) graphEngine.addNote(savedB);

      // Both should be neighbors
      const neighborsA = graphEngine.neighbors(noteA.id);
      const neighborsB = graphEngine.neighbors(noteB.id);

      expect(neighborsA.some((n) => n.id === noteB.id)).toBe(true);
      expect(neighborsB.some((n) => n.id === noteA.id)).toBe(true);

      // Both should have each other as backlinks
      const backlinksA = graphEngine.backlinks(noteA.id);
      const backlinksB = graphEngine.backlinks(noteB.id);

      expect(backlinksA.some((n) => n.id === noteB.id)).toBe(true);
      expect(backlinksB.some((n) => n.id === noteA.id)).toBe(true);
    });

    it('should track multiple links correctly', async () => {
      // A links to both B and C
      noteA.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Note A links to ' },
                { type: 'note-reference', noteId: noteB.id, text: 'B' },
                { type: 'text', text: ' and ' },
                { type: 'note-reference', noteId: noteC.id, text: 'C' },
              ],
            },
          ],
        },
      };
      await vault.save(noteA);

      // Reload to get extracted metadata
      const savedA = vault.read(noteA.id);
      const savedB = vault.read(noteB.id);
      const savedC = vault.read(noteC.id);

      // Build graph
      if (savedA) graphEngine.addNote(savedA);
      if (savedB) graphEngine.addNote(savedB);
      if (savedC) graphEngine.addNote(savedC);

      // A should have both B and C as neighbors
      const neighborsA = graphEngine.neighbors(noteA.id);
      expect(neighborsA.length).toBeGreaterThanOrEqual(2);
      expect(neighborsA.some((n) => n.id === noteB.id)).toBe(true);
      expect(neighborsA.some((n) => n.id === noteC.id)).toBe(true);

      // B and C should both have A as backlink
      const backlinksB = graphEngine.backlinks(noteB.id);
      const backlinksC = graphEngine.backlinks(noteC.id);

      expect(backlinksB.some((n) => n.id === noteA.id)).toBe(true);
      expect(backlinksC.some((n) => n.id === noteA.id)).toBe(true);
    });

    it('should query notes by tag', async () => {
      // Add tags to notes
      noteA.metadata.tags = ['project', 'important'];
      noteB.metadata.tags = ['project'];
      noteC.metadata.tags = ['personal'];

      await vault.save(noteA);
      await vault.save(noteB);
      await vault.save(noteC);

      // Build graph
      graphEngine.addNote(noteA);
      graphEngine.addNote(noteB);
      graphEngine.addNote(noteC);

      // Query by project tag
      const projectNotes = graphEngine.notesWithTag('project');
      expect(projectNotes.length).toBe(2);
      expect(projectNotes.some((n) => n.id === noteA.id)).toBe(true);
      expect(projectNotes.some((n) => n.id === noteB.id)).toBe(true);

      // Query by personal tag
      const personalNotes = graphEngine.notesWithTag('personal');
      expect(personalNotes.length).toBe(1);
      expect(personalNotes[0].id).toBe(noteC.id);
    });

    it('should update graph when links are modified', async () => {
      // Initial: A links to B
      noteA.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Note A ' },
                { type: 'note-reference', noteId: noteB.id, text: 'links to B' },
              ],
            },
          ],
        },
      };
      await vault.save(noteA);

      const savedA = vault.read(noteA.id);
      const savedB = vault.read(noteB.id);
      if (savedA) graphEngine.addNote(savedA);
      if (savedB) graphEngine.addNote(savedB);

      let backlinksB = graphEngine.backlinks(noteB.id);
      expect(backlinksB.some((n) => n.id === noteA.id)).toBe(true);

      // Update: A now links to C instead
      const updatedNoteA = vault.read(noteA.id);
      if (updatedNoteA) {
        updatedNoteA.content = {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Note A ' },
                  { type: 'note-reference', noteId: noteC.id, text: 'links to C' },
                ],
              },
            ],
          },
        };
        await vault.save(updatedNoteA);
      }

      // Rebuild graph (simulating incremental update)
      graphEngine = new GraphEngine();
      const refreshedA = vault.read(noteA.id);
      const refreshedB = vault.read(noteB.id);
      const refreshedC = vault.read(noteC.id);

      if (refreshedA) graphEngine.addNote(refreshedA);
      if (refreshedB) graphEngine.addNote(refreshedB);
      if (refreshedC) graphEngine.addNote(refreshedC);

      // B should no longer have A as backlink
      backlinksB = graphEngine.backlinks(noteB.id);
      expect(backlinksB.some((n) => n.id === noteA.id)).toBe(false);

      // C should now have A as backlink
      const backlinksC = graphEngine.backlinks(noteC.id);
      expect(backlinksC.some((n) => n.id === noteA.id)).toBe(true);
    });
  });

  describe('Persistence and Restart Simulation', () => {
    it('should persist notes across vault reload', async () => {
      // Create and save a note
      const note = await vault.create();
      note.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Persistent Note' }],
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'With #tag and important content' }],
            },
          ],
        },
      };
      await vault.save(note);
      const noteId = note.id;

      // Simulate restart: create new vault instance
      const newVault = await simulateAppRestart(tempDir);

      // Verify note exists
      const loaded = newVault.read(noteId);
      expect(loaded?.id).toBe(noteId);
      expect(loaded?.metadata.title).toBe('Persistent Note');
      expect(loaded?.metadata.tags).toContain('tag');
    });

    it('should rebuild graph correctly after restart', async () => {
      // Create linked notes
      const noteA = await vault.create();
      const noteB = await vault.create();

      noteA.content = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                { type: 'text', text: 'Note A ' },
                { type: 'note-reference', noteId: noteB.id, text: 'links to B' },
              ],
            },
          ],
        },
      };

      noteB.content = {
        root: {
          type: 'root',
          children: [{ type: 'paragraph', children: [{ type: 'text', text: 'Note B' }] }],
        },
      };

      await vault.save(noteA);
      await vault.save(noteB);

      // Simulate restart: new vault and graph engine
      const newVault = await simulateAppRestart(tempDir);
      const newGraphEngine = new GraphEngine();

      // Rebuild graph from loaded notes
      const notes = newVault.list();
      for (const note of notes) {
        newGraphEngine.addNote(note);
      }

      // Verify graph relationships
      const backlinksB = newGraphEngine.backlinks(noteB.id);
      expect(backlinksB.some((n) => n.id === noteA.id)).toBe(true);
    });

    it('should rebuild search index correctly after restart', async () => {
      // Create searchable notes with explicit title
      const note = await vault.create({
        title: 'Searchable Content',
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Searchable Content' }],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'With unique searchterm' }],
              },
            ],
          },
        },
      });

      // Simulate restart: new vault and search engine
      const newVault = await simulateAppRestart(tempDir);
      const newSearchEngine = new SearchEngine();

      // Rebuild search index from loaded notes
      const notes = newVault.list();
      for (const n of notes) {
        newSearchEngine.indexNote(n);
      }

      // Verify search works
      const results = newSearchEngine.search('searchterm');
      expect(results.length).toBe(1);
      expect(results[0].title).toBe('Searchable Content');
    });

    it('should handle multiple notes with complex relationships after restart', async () => {
      // Create a complex graph
      const notes: Note[] = [];

      for (let i = 0; i < 5; i++) {
        const note = await vault.create();

        const children: any[] = [
          {
            type: 'paragraph',
            children: [{ type: 'text', text: `Note ${i}` }],
          },
          {
            type: 'paragraph',
            children: [{ type: 'text', text: `Content with #tag${i % 2}` }],
          },
        ];

        // Create links: each note links to the previous one
        if (i > 0) {
          children.push({
            type: 'paragraph',
            children: [
              { type: 'text', text: 'Links to ' },
              { type: 'note-reference', noteId: notes[i - 1].id, text: `Note ${i - 1}` },
            ],
          });
        }

        note.content = {
          root: {
            type: 'root',
            children,
          },
        };

        await vault.save(note);
        const saved = vault.read(note.id);
        if (saved) {
          notes.push(saved);
        }
      }

      // Simulate restart
      const newVault = await simulateAppRestart(tempDir);
      const newGraphEngine = new GraphEngine();
      const newSearchEngine = new SearchEngine();

      const loadedNotes = newVault.list();
      expect(loadedNotes.length).toBe(5);

      for (const note of loadedNotes) {
        newGraphEngine.addNote(note);
        newSearchEngine.indexNote(note);
      }

      // Verify graph relationships
      const backlinks = newGraphEngine.backlinks(notes[0].id);
      expect(backlinks.length).toBeGreaterThanOrEqual(1);

      // Verify tag queries
      const tag0Notes = newGraphEngine.notesWithTag('tag0');
      expect(tag0Notes.length).toBe(3); // Notes 0, 2, 4

      // Verify search
      const searchResults = newSearchEngine.search('Note 3');
      expect(searchResults.length).toBeGreaterThan(0);
    });
  });

  describe('Complete User Journey', () => {
    it('should handle complete workflow: create → edit → search → navigate → backlinks', async () => {
      // Step 1: Create project note with explicit title
      const projectNote = await vault.create({
        title: 'Project Alpha',
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Project Alpha' }],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Main project documentation #project' }],
              },
            ],
          },
        },
      });
      const savedProject = vault.read(projectNote.id);
      if (savedProject) {
        graphEngine.addNote(savedProject);
        searchEngine.indexNote(savedProject);
      }

      // Step 2: Create meeting note linking to project with explicit title
      const meetingNote = await vault.create({
        title: 'Team Meeting',
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Team Meeting' }],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Discussed project alpha #meeting' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'Related to ' },
                  { type: 'note-reference', noteId: projectNote.id, text: 'Project Alpha' },
                ],
              },
            ],
          },
        },
      });
      const savedMeeting = vault.read(meetingNote.id);
      if (savedMeeting) {
        graphEngine.addNote(savedMeeting);
        searchEngine.indexNote(savedMeeting);
      }

      // Step 3: Create task note linking to project with explicit title
      const taskNote = await vault.create({
        title: 'Implementation Tasks',
        content: {
          root: {
            type: 'root',
            children: [
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'Implementation Tasks' }],
              },
              {
                type: 'paragraph',
                children: [{ type: 'text', text: 'TODO for alpha #task' }],
              },
              {
                type: 'paragraph',
                children: [
                  { type: 'text', text: 'For ' },
                  { type: 'note-reference', noteId: projectNote.id, text: 'Project Alpha' },
                ],
              },
            ],
          },
        },
      });
      const savedTask = vault.read(taskNote.id);
      if (savedTask) {
        graphEngine.addNote(savedTask);
        searchEngine.indexNote(savedTask);
      }

      // Step 4: Search for "alpha"
      const searchResults = searchEngine.search('alpha');
      expect(searchResults.length).toBe(3);

      // Step 5: Open project note (simulate navigation)
      const openedNote = vault.read(projectNote.id);
      expect(openedNote?.metadata.title).toBe('Project Alpha');

      // Step 6: Check backlinks for project note
      const backlinks = graphEngine.backlinks(projectNote.id);
      expect(backlinks.length).toBe(2);
      const backlinkTitles = backlinks.map((n) => n.title);
      expect(backlinkTitles).toContain('Team Meeting');
      expect(backlinkTitles).toContain('Implementation Tasks');

      // Step 7: Query notes by tag
      const projectNotes = graphEngine.notesWithTag('project');
      expect(projectNotes.length).toBe(1);
      expect(projectNotes[0].id).toBe(projectNote.id);

      // Step 8: Edit meeting note to add more content
      const updatedMeetingContent = {
        root: {
          type: 'root' as const,
          children: [
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Team Meeting' }],
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Discussed project alpha #meeting' }],
            },
            {
              type: 'paragraph',
              children: [{ type: 'text', text: 'Action items added' }],
            },
          ],
        },
      };
      const meetingToUpdate = vault.read(meetingNote.id);
      meetingToUpdate.content = updatedMeetingContent;
      await vault.save(meetingToUpdate);
      const updatedMeeting = vault.read(meetingNote.id);
      if (updatedMeeting) {
        searchEngine.indexNote(updatedMeeting);
      }

      // Step 9: Search for new content
      const actionResults = searchEngine.search('action items');
      expect(actionResults.length).toBe(1);
      expect(actionResults[0].id).toBe(meetingNote.id);

      // Step 10: Verify all notes still connected
      const finalBacklinks = graphEngine.backlinks(projectNote.id);
      expect(finalBacklinks.length).toBe(2);
    });
  });
});
