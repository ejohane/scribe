/**
 * Phase 3 Verification Tests
 *
 * These tests verify that all server core services are implemented and working
 * correctly as specified in beads issue scribe-zn2y.
 *
 * Acceptance Criteria:
 * - [ ] All services instantiate correctly
 * - [ ] DocumentService CRUD works end-to-end
 * - [ ] GraphService queries work
 * - [ ] SearchService finds notes
 * - [ ] CollaborationService manages Y.Docs
 * - [ ] No memory leaks in collab sessions
 * - [ ] Performance acceptable
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { tmpdir } from 'node:os';
import * as Y from 'yjs';
import { createServices, destroyServices, createTestServices, type Services } from './container.js';
import type { EditorContent } from './types/index.js';

describe('Phase 3 Verification: Server Core Services Complete', () => {
  let vaultPath: string;
  let services: Services;

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

  const createContentWithLink = (noteId: string, linkText = 'Link'): EditorContent => ({
    root: {
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'note-link',
              noteId,
              text: linkText,
            },
          ],
        },
      ],
      direction: null,
      format: '',
      indent: 0,
      type: 'root',
      version: 1,
    },
  });

  beforeEach(async () => {
    vaultPath = path.join(
      tmpdir(),
      `scribe-phase3-verify-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });
  });

  afterEach(async () => {
    if (services) {
      destroyServices(services);
    }
    await fs.rm(vaultPath, { recursive: true, force: true }).catch(() => {});
  });

  describe('Service Container', () => {
    it('should instantiate all services correctly', () => {
      services = createServices({
        vaultPath,
        dbPath: ':memory:',
      });

      expect(services.documentService).toBeDefined();
      expect(services.graphService).toBeDefined();
      expect(services.searchService).toBeDefined();
      expect(services.collaborationService).toBeDefined();
    });

    it('should support createTestServices helper', () => {
      services = createTestServices(vaultPath);

      expect(services.documentService).toBeDefined();
      expect(services.graphService).toBeDefined();
      expect(services.searchService).toBeDefined();
      expect(services.collaborationService).toBeDefined();
    });
  });

  describe('DocumentService', () => {
    beforeEach(() => {
      services = createServices({
        vaultPath,
        dbPath: ':memory:',
      });
    });

    it('should create a note', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      expect(note.id).toBeDefined();
      expect(note.id.length).toBe(12);
      expect(note.title).toBe('Test Note');
    });

    it('should verify file is created on disk', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const filePath = path.join(vaultPath, 'notes', `${note.id}.json`);
      const exists = await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(true);
    });

    it('should read a note', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const read = await services.documentService.read(note.id);

      expect(read).not.toBeNull();
      expect(read?.title).toBe('Test Note');
    });

    it('should update a note', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      await services.documentService.update(note.id, { title: 'Updated Title' });
      const updated = await services.documentService.read(note.id);

      expect(updated?.title).toBe('Updated Title');
    });

    it('should list notes', async () => {
      await services.documentService.create({ title: 'Note 1', type: 'note' });
      await services.documentService.create({ title: 'Note 2', type: 'note' });

      const list = services.documentService.list();

      expect(list.length).toBeGreaterThanOrEqual(2);
    });

    it('should delete a note', async () => {
      const note = await services.documentService.create({
        title: 'Test Note',
        type: 'note',
      });

      const filePath = path.join(vaultPath, 'notes', `${note.id}.json`);

      await services.documentService.delete(note.id);

      const exists = await fs
        .stat(filePath)
        .then(() => true)
        .catch(() => false);
      expect(exists).toBe(false);
    });
  });

  describe('GraphService', () => {
    beforeEach(() => {
      services = createServices({
        vaultPath,
        dbPath: ':memory:',
      });
    });

    it('should get backlinks', async () => {
      // Create two notes where A links to B
      const noteB = await services.documentService.create({
        title: 'Note B',
        type: 'note',
      });

      const noteA = await services.documentService.create({
        title: 'Note A',
        type: 'note',
        content: createContentWithLink(noteB.id, 'Link to Note B'),
      });

      const backlinks = services.graphService.getBacklinks(noteB.id);

      expect(backlinks.length).toBe(1);
      expect(backlinks[0].id).toBe(noteA.id);
    });

    it('should get forward links', async () => {
      const noteB = await services.documentService.create({
        title: 'Note B',
        type: 'note',
      });

      const noteA = await services.documentService.create({
        title: 'Note A',
        type: 'note',
        content: createContentWithLink(noteB.id, 'Link to Note B'),
      });

      const forwardLinks = services.graphService.getForwardLinks(noteA.id);

      expect(forwardLinks.length).toBe(1);
      expect(forwardLinks[0].id).toBe(noteB.id);
    });

    it('should get graph stats', async () => {
      await services.documentService.create({ title: 'Note 1', type: 'note' });
      await services.documentService.create({ title: 'Note 2', type: 'note' });

      const stats = services.graphService.getStats();

      expect(stats.totalNotes).toBe(2);
    });
  });

  describe('SearchService', () => {
    beforeEach(() => {
      services = createServices({
        vaultPath,
        dbPath: ':memory:',
      });
    });

    it('should search for notes', async () => {
      const note = await services.documentService.create({
        title: 'Searchable Note',
        type: 'note',
        content: createTestContent('This contains searchable keywords'),
      });

      const results = await services.searchService.search({ text: 'searchable' });

      expect(results.length).toBeGreaterThanOrEqual(1);
      expect(results[0].note.id).toBe(note.id);
    });

    it('should search by title', async () => {
      await services.documentService.create({
        title: 'Unique Title Here',
        type: 'note',
      });

      const results = await services.searchService.search({ text: 'Unique Title' });

      expect(results.length).toBeGreaterThanOrEqual(1);
    });

    it('should support filters', async () => {
      await services.documentService.create({
        title: 'Daily 2024-01-15',
        type: 'daily',
        date: '2024-01-15',
        content: createTestContent('Daily entry content'),
      });

      await services.documentService.create({
        title: 'Regular Note',
        type: 'note',
        content: createTestContent('Regular note content'),
      });

      const results = await services.searchService.search({
        text: 'content',
        filters: { type: ['daily'] },
      });

      expect(results.length).toBe(1);
      expect(results[0].note.type).toBe('daily');
    });
  });

  describe('CollaborationService', () => {
    beforeEach(() => {
      services = createServices({
        vaultPath,
        dbPath: ':memory:',
      });
    });

    it('should get Y.Doc for a note', async () => {
      const note = await services.documentService.create({
        title: 'Collab Note',
        type: 'note',
      });

      const doc = await services.collaborationService.getDoc(note.id);

      expect(doc).toBeInstanceOf(Y.Doc);
    });

    it('should join a document session', async () => {
      const note = await services.documentService.create({
        title: 'Session Note',
        type: 'note',
      });

      const session = await services.collaborationService.joinSession(note.id, 'client-1');

      expect(session.id).toBeDefined();
      expect(session.noteId).toBe(note.id);
      expect(session.clientId).toBe('client-1');
    });

    it('should apply updates', async () => {
      const note = await services.documentService.create({
        title: 'Update Note',
        type: 'note',
      });

      const doc = await services.collaborationService.getDoc(note.id);

      // Create a client update
      const clientDoc = new Y.Doc();
      const clientText = clientDoc.getText('test');
      clientText.insert(0, 'client update');
      const update = Y.encodeStateAsUpdate(clientDoc);
      clientDoc.destroy();

      const result = services.collaborationService.applyUpdate(note.id, update, 'client-1');

      expect(result).toBe(true);
      expect(doc.getText('test').toString()).toBe('client update');
    });

    it('should leave a session', async () => {
      const note = await services.documentService.create({
        title: 'Leave Note',
        type: 'note',
      });

      const session = await services.collaborationService.joinSession(note.id, 'client-1');
      const result = services.collaborationService.leaveSession(session.id);

      expect(result).toBe(true);
    });
  });

  describe('End-to-End Flow', () => {
    beforeEach(() => {
      services = createServices({
        vaultPath,
        dbPath: ':memory:',
      });
    });

    it('should complete full lifecycle: create, index, search, graph, collab, delete', async () => {
      // 1. Create note
      const note = await services.documentService.create({
        title: 'E2E Test',
        type: 'note',
        content: createTestContent('End to end test content'),
      });
      expect(note.id).toBeDefined();

      // 2. Verify indexed
      const list = services.documentService.list();
      expect(list.find((n) => n.id === note.id)).toBeDefined();

      // 3. Search works
      const searchResults = await services.searchService.search({ text: 'E2E' });
      expect(searchResults.length).toBeGreaterThan(0);

      // 4. Graph stats
      const stats = services.graphService.getStats();
      expect(stats.totalNotes).toBeGreaterThanOrEqual(1);

      // 5. Graph empty (no links yet)
      const backlinks = services.graphService.getBacklinks(note.id);
      expect(backlinks.length).toBe(0);

      // 6. Collab works
      const doc = await services.collaborationService.getDoc(note.id);
      expect(doc).toBeDefined();

      // 7. Cleanup - unload doc before deleting note to avoid foreign key constraint
      services.collaborationService.unloadDoc(note.id);
      await services.documentService.delete(note.id);
      const afterDelete = services.documentService.list();
      expect(afterDelete.find((n) => n.id === note.id)).toBeUndefined();
    });
  });

  describe('Memory Leak Prevention: Collab Sessions', () => {
    beforeEach(() => {
      services = createServices({
        vaultPath,
        dbPath: ':memory:',
      });
    });

    it('should unload doc when all sessions leave', async () => {
      const note = await services.documentService.create({
        title: 'Memory Test',
        type: 'note',
      });

      // Join multiple sessions
      const session1 = await services.collaborationService.joinSession(note.id, 'client-1');
      const session2 = await services.collaborationService.joinSession(note.id, 'client-2');

      expect(services.collaborationService.hasDoc(note.id)).toBe(true);
      expect(services.collaborationService.getSessionCount(note.id)).toBe(2);

      // Leave first session
      services.collaborationService.leaveSession(session1.id);
      expect(services.collaborationService.hasDoc(note.id)).toBe(true);
      expect(services.collaborationService.getSessionCount(note.id)).toBe(1);

      // Leave second session - doc should be unloaded
      services.collaborationService.leaveSession(session2.id);
      expect(services.collaborationService.hasDoc(note.id)).toBe(false);
      expect(services.collaborationService.getSessionCount(note.id)).toBe(0);
    });

    it('should persist state before unloading', async () => {
      const note = await services.documentService.create({
        title: 'Persist Test',
        type: 'note',
      });

      const session = await services.collaborationService.joinSession(note.id, 'client-1');
      const doc = await services.collaborationService.getDoc(note.id);

      // Make changes
      doc.getText('test').insert(0, 'persisted content');

      // Leave session (triggers unload)
      services.collaborationService.leaveSession(session.id);

      // Reload the doc - should have persisted content
      const reloadedDoc = await services.collaborationService.getDoc(note.id);
      expect(reloadedDoc.getText('test').toString()).toBe('persisted content');
    });

    it('should handle multiple notes without leaking', async () => {
      const noteIds: string[] = [];

      // Create and collaborate on multiple notes
      for (let i = 0; i < 10; i++) {
        const note = await services.documentService.create({
          title: `Note ${i}`,
          type: 'note',
        });
        noteIds.push(note.id);

        const session = await services.collaborationService.joinSession(note.id, `client-${i}`);
        services.collaborationService.leaveSession(session.id);
      }

      // All docs should be unloaded
      expect(services.collaborationService.getLoadedDocCount()).toBe(0);
    });
  });

  describe('Performance Baseline', () => {
    beforeEach(() => {
      services = createServices({
        vaultPath,
        dbPath: ':memory:',
      });
    });

    it('should create 100 notes in less than 5 seconds', async () => {
      const startTime = Date.now();

      for (let i = 0; i < 100; i++) {
        await services.documentService.create({
          title: `Note ${i}`,
          type: 'note',
          content: createTestContent(`Content for note ${i}`),
        });
      }

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(5000);
    });

    it('should search in less than 100ms', async () => {
      // Create notes first
      for (let i = 0; i < 50; i++) {
        await services.documentService.create({
          title: `Note ${i}`,
          type: 'note',
          content: createTestContent(`Content for note ${i} with searchable text`),
        });
      }

      const startTime = Date.now();
      await services.searchService.search({ text: 'searchable' });
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(100);
    });

    it('should list notes in less than 50ms', async () => {
      // Create notes first
      for (let i = 0; i < 50; i++) {
        await services.documentService.create({
          title: `Note ${i}`,
          type: 'note',
        });
      }

      const startTime = Date.now();
      services.documentService.list();
      const duration = Date.now() - startTime;

      expect(duration).toBeLessThan(50);
    });

    it('should handle graph operations efficiently', async () => {
      // Create a connected graph
      const notes: string[] = [];
      for (let i = 0; i < 50; i++) {
        const note = await services.documentService.create({
          title: `Note ${i}`,
          type: 'note',
        });
        notes.push(note.id);
      }

      // Create links: each note links to the previous
      for (let i = 1; i < notes.length; i++) {
        await services.documentService.update(notes[i], {
          content: createContentWithLink(notes[i - 1], `Link to ${i - 1}`),
        });
      }

      // Time graph operations
      const startTime = Date.now();

      services.graphService.getStats();
      services.graphService.getBacklinks(notes[25]);
      services.graphService.getForwardLinks(notes[25]);

      const duration = Date.now() - startTime;
      expect(duration).toBeLessThan(100);
    });
  });

  describe('Cross-Service Integration', () => {
    beforeEach(() => {
      services = createServices({
        vaultPath,
        dbPath: ':memory:',
      });
    });

    it('should maintain consistency across DocumentService and GraphService', async () => {
      const noteA = await services.documentService.create({
        title: 'Note A',
        type: 'note',
      });

      const noteB = await services.documentService.create({
        title: 'Note B',
        type: 'note',
        content: createContentWithLink(noteA.id, 'Link to A'),
      });

      // Verify graph reflects the link
      const backlinks = services.graphService.getBacklinks(noteA.id);
      expect(backlinks.length).toBe(1);
      expect(backlinks[0].id).toBe(noteB.id);

      // Update to remove link
      await services.documentService.update(noteB.id, {
        content: createTestContent('No link anymore'),
      });

      // Graph should reflect removal
      const updatedBacklinks = services.graphService.getBacklinks(noteA.id);
      expect(updatedBacklinks.length).toBe(0);
    });

    it('should maintain consistency across DocumentService and SearchService', async () => {
      const note = await services.documentService.create({
        title: 'Original Title',
        type: 'note',
        content: createTestContent('Original content'),
      });

      // Search should find original content
      let results = await services.searchService.search({ text: 'Original' });
      expect(results.length).toBe(1);

      // Update content
      await services.documentService.update(note.id, {
        title: 'Updated Title',
        content: createTestContent('Updated content completely different'),
      });

      // Search should find new content
      results = await services.searchService.search({ text: 'Updated' });
      expect(results.length).toBe(1);

      // Search should NOT find old content
      results = await services.searchService.search({ text: 'Original' });
      expect(results.length).toBe(0);
    });

    it('should handle cascading deletes correctly', async () => {
      const noteA = await services.documentService.create({
        title: 'Note A',
        type: 'note',
      });

      const noteB = await services.documentService.create({
        title: 'Note B',
        type: 'note',
        content: createContentWithLink(noteA.id, 'Link to A'),
      });

      // Verify setup
      expect(services.graphService.getBacklinks(noteA.id).length).toBe(1);
      let searchResults = await services.searchService.search({ text: 'Note B' });
      expect(searchResults.length).toBe(1);

      // Delete note B
      await services.documentService.delete(noteB.id);

      // Backlinks should be gone
      expect(services.graphService.getBacklinks(noteA.id).length).toBe(0);

      // Search should not find deleted note
      searchResults = await services.searchService.search({ text: 'Note B' });
      expect(searchResults.length).toBe(0);
    });
  });
});
