/**
 * Integration Tests for Graph Handlers Logic
 *
 * Tests the graph:* handler logic through the GraphEngine package.
 * Since IPC handlers are thin wrappers, testing the underlying
 * GraphEngine operations validates the handler behavior.
 *
 * Tests cover:
 * - graph:forNote - via graphEngine.neighbors()
 * - graph:backlinks - via graphEngine.backlinks()
 * - graph:notesWithTag - via graphEngine.notesWithTag()
 *
 * Issue: scribe-5na
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { GraphEngine } from '@scribe/engine-graph';
import type { EditorContent, NoteId } from '@scribe/shared';
import {
  type TestContext,
  setupTestContext,
  cleanupTestContext,
  createWikiLinkNode,
} from './test-helpers';

/**
 * Creates a note content with a wiki-link to another note
 */
function createNoteWithWikiLink(
  title: string,
  targetTitle: string,
  targetId: NoteId
): EditorContent {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [{ type: 'text', text: title }],
        },
        {
          type: 'paragraph',
          children: [
            { type: 'text', text: 'Link to ' },
            createWikiLinkNode(targetTitle, targetTitle, targetId),
          ],
        },
      ],
    },
  };
}

describe('Graph Handler Integration Tests', () => {
  let ctx: TestContext;
  let vault: FileSystemVault;
  let graphEngine: GraphEngine;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-graph-handler-test');
    vault = ctx.vault;
    graphEngine = ctx.graphEngine;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  // ===========================================================================
  // graph:forNote (neighbors) Tests
  // ===========================================================================

  describe('graph:forNote (neighbors) logic', () => {
    it('should return neighbors for a note with links', async () => {
      // Create target note first
      const target = await vault.create({ title: 'Target Note' });

      // Create a note that links to target
      const content: EditorContent = createNoteWithWikiLink(
        'Linking Note',
        target.title,
        target.id
      );
      const linking = await vault.create({ title: 'Linking Note', content });

      // Index both in graph
      graphEngine.addNote(target);
      graphEngine.addNote(linking);

      // Get neighbors of linking note
      const neighbors = graphEngine.neighbors(linking.id);
      // neighbors returns GraphNode objects with id property
      const neighborIds = neighbors.map((n) => (typeof n === 'string' ? n : n.id));
      expect(neighborIds).toContain(target.id);
    });

    it('should return empty for isolated note', async () => {
      const note = await vault.create({ title: 'Isolated Note' });
      graphEngine.addNote(note);

      const neighbors = graphEngine.neighbors(note.id);
      expect(neighbors).toEqual([]);
    });
  });

  // ===========================================================================
  // graph:backlinks Tests
  // ===========================================================================

  describe('graph:backlinks logic', () => {
    it('should return backlinks for a note', async () => {
      // Create target note
      const target = await vault.create({ title: 'Target Note' });

      // Create notes that link to target
      const linker1 = await vault.create({
        title: 'Linker 1',
        content: createNoteWithWikiLink('Linker 1', target.title, target.id),
      });
      const linker2 = await vault.create({
        title: 'Linker 2',
        content: createNoteWithWikiLink('Linker 2', target.title, target.id),
      });

      // Index all in graph
      graphEngine.addNote(target);
      graphEngine.addNote(linker1);
      graphEngine.addNote(linker2);

      // Get backlinks to target
      const backlinks = graphEngine.backlinks(target.id);
      // backlinks returns GraphNode objects
      const backlinkIds = backlinks.map((n) => (typeof n === 'string' ? n : n.id));
      expect(backlinkIds).toContain(linker1.id);
      expect(backlinkIds).toContain(linker2.id);
      expect(backlinks).toHaveLength(2);
    });

    it('should return empty when no backlinks exist', async () => {
      const note = await vault.create({ title: 'No Backlinks' });
      graphEngine.addNote(note);

      const backlinks = graphEngine.backlinks(note.id);
      expect(backlinks).toEqual([]);
    });
  });

  // ===========================================================================
  // graph:notesWithTag Tests
  // ===========================================================================

  describe('graph:notesWithTag logic', () => {
    it('should return notes with a specific tag', async () => {
      // Create notes with tags in content
      const note1 = await vault.create({
        title: 'Note 1',
        tags: ['project', 'important'],
      });
      const note2 = await vault.create({
        title: 'Note 2',
        tags: ['project'],
      });
      const note3 = await vault.create({
        title: 'Note 3',
        tags: ['other'],
      });

      // Index in graph
      graphEngine.addNote(note1);
      graphEngine.addNote(note2);
      graphEngine.addNote(note3);

      // Get notes with 'project' tag
      const notesWithProject = graphEngine.notesWithTag('project');
      // notesWithTag returns GraphNode objects
      const noteIds = notesWithProject.map((n) => (typeof n === 'string' ? n : n.id));
      expect(noteIds).toContain(note1.id);
      expect(noteIds).toContain(note2.id);
      expect(noteIds).not.toContain(note3.id);
    });

    it('should return empty when no notes have the tag', async () => {
      const note = await vault.create({
        title: 'Some Note',
        tags: ['existing-tag'],
      });
      graphEngine.addNote(note);

      const notes = graphEngine.notesWithTag('non-existent-tag');
      expect(notes).toEqual([]);
    });
  });
});
