/**
 * Integration tests for GraphService with DocumentService.
 *
 * These tests verify end-to-end scenarios where GraphService reads
 * graph data that was created through DocumentService mutations.
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
import { GraphService } from './graph.service.js';
import type { EditorContent } from '../types/index.js';

describe('GraphService Integration', () => {
  let scribeDb: ScribeDatabase;
  let vaultPath: string;
  let documentService: DocumentService;
  let graphService: GraphService;
  let notesRepo: NotesRepository;
  let linksRepo: LinksRepository;
  let tagsRepo: TagsRepository;
  let searchRepo: SearchRepository;

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

  const createContentWithLinks = (noteIds: string[]): EditorContent => ({
    root: {
      children: [
        {
          type: 'paragraph',
          children: noteIds.map((id) => ({
            type: 'note-link',
            noteId: id,
            text: `Link to ${id}`,
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

  const createContentWithTags = (tags: string[]): EditorContent => ({
    root: {
      children: [
        {
          type: 'paragraph',
          children: tags.map((tag) => ({
            type: 'hashtag',
            tag,
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

  beforeEach(async () => {
    vaultPath = path.join(
      tmpdir(),
      `scribe-graph-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    await fs.mkdir(vaultPath, { recursive: true });

    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();

    const db = scribeDb.getDb();
    notesRepo = new NotesRepository(db);
    linksRepo = new LinksRepository(db);
    tagsRepo = new TagsRepository(db);
    searchRepo = new SearchRepository(db);

    documentService = new DocumentService({
      vaultPath,
      notesRepo,
      linksRepo,
      tagsRepo,
      searchRepo,
    });

    graphService = new GraphService({
      notesRepo,
      linksRepo,
      tagsRepo,
    });
  });

  afterEach(async () => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
    await fs.rm(vaultPath, { recursive: true, force: true }).catch(() => {});
  });

  describe('Backlinks panel use case', () => {
    it('should show all notes linking to current note', async () => {
      // Create a hub note
      const hubNote = await documentService.create({
        title: 'Project Ideas',
        type: 'note',
        content: createTestContent('Collection of project ideas'),
      });

      // Create several notes linking to the hub
      const daily1 = await documentService.create({
        title: 'Daily 2024-01-15',
        type: 'daily',
        date: '2024-01-15',
        content: createContentWithLinks([hubNote.id]),
      });

      const daily2 = await documentService.create({
        title: 'Daily 2024-01-16',
        type: 'daily',
        date: '2024-01-16',
        content: createContentWithLinks([hubNote.id]),
      });

      const meeting = await documentService.create({
        title: 'Team Sync',
        type: 'meeting',
        date: '2024-01-15',
        content: createContentWithLinks([hubNote.id]),
      });

      // Query backlinks
      const backlinks = graphService.getBacklinks(hubNote.id);

      expect(backlinks).toHaveLength(3);
      expect(backlinks.map((l) => l.id)).toContain(daily1.id);
      expect(backlinks.map((l) => l.id)).toContain(daily2.id);
      expect(backlinks.map((l) => l.id)).toContain(meeting.id);

      // Verify metadata is included
      const dailyBacklink = backlinks.find((l) => l.id === daily1.id);
      expect(dailyBacklink?.title).toBe('Daily 2024-01-15');
      expect(dailyBacklink?.type).toBe('daily');
    });

    it('should update backlinks when source note is modified', async () => {
      const noteA = await documentService.create({
        title: 'Note A',
        type: 'note',
      });

      const noteB = await documentService.create({
        title: 'Note B',
        type: 'note',
      });

      const noteC = await documentService.create({
        title: 'Note C',
        type: 'note',
        content: createContentWithLinks([noteA.id]),
      });

      // Initially, A has one backlink from C
      let backlinks = graphService.getBacklinks(noteA.id);
      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].id).toBe(noteC.id);

      // Update C to link to B instead
      await documentService.update(noteC.id, {
        content: createContentWithLinks([noteB.id]),
      });

      // A should have no backlinks
      backlinks = graphService.getBacklinks(noteA.id);
      expect(backlinks).toHaveLength(0);

      // B should have one backlink
      const bBacklinks = graphService.getBacklinks(noteB.id);
      expect(bBacklinks).toHaveLength(1);
      expect(bBacklinks[0].id).toBe(noteC.id);
    });
  });

  describe('Forward links / Local graph use case', () => {
    it('should show all notes the current note references', async () => {
      // Create target notes
      const conceptA = await documentService.create({
        title: 'Concept A',
        type: 'note',
      });

      const conceptB = await documentService.create({
        title: 'Concept B',
        type: 'note',
      });

      const person = await documentService.create({
        title: 'John Doe',
        type: 'person',
      });

      // Create a note linking to all of them
      const overview = await documentService.create({
        title: 'Overview',
        type: 'note',
        content: createContentWithLinks([conceptA.id, conceptB.id, person.id]),
      });

      // Query forward links
      const forwardLinks = graphService.getForwardLinks(overview.id);

      expect(forwardLinks).toHaveLength(3);
      expect(forwardLinks.map((l) => l.id)).toContain(conceptA.id);
      expect(forwardLinks.map((l) => l.id)).toContain(conceptB.id);
      expect(forwardLinks.map((l) => l.id)).toContain(person.id);

      // Check note types
      const personLink = forwardLinks.find((l) => l.id === person.id);
      expect(personLink?.type).toBe('person');
    });
  });

  describe('Tag navigation use case', () => {
    it('should browse notes by tag', async () => {
      // Create notes with various tags
      await documentService.create({
        title: 'TypeScript Basics',
        type: 'note',
        content: createContentWithTags(['typescript', 'programming', 'learning']),
      });

      await documentService.create({
        title: 'Advanced TypeScript',
        type: 'note',
        content: createContentWithTags(['typescript', 'programming', 'advanced']),
      });

      await documentService.create({
        title: 'Python Intro',
        type: 'note',
        content: createContentWithTags(['python', 'programming', 'learning']),
      });

      // Browse by tag
      const tsNotes = graphService.getNotesWithTag('typescript');
      expect(tsNotes).toHaveLength(2);

      const programmingNotes = graphService.getNotesWithTag('programming');
      expect(programmingNotes).toHaveLength(3);

      const learningNotes = graphService.getNotesWithTag('learning');
      expect(learningNotes).toHaveLength(2);
    });

    it('should get all tags with counts for tag cloud', async () => {
      await documentService.create({
        title: 'Note 1',
        type: 'note',
        content: createContentWithTags(['project', 'typescript']),
      });

      await documentService.create({
        title: 'Note 2',
        type: 'note',
        content: createContentWithTags(['project', 'rust']),
      });

      await documentService.create({
        title: 'Note 3',
        type: 'note',
        content: createContentWithTags(['project']),
      });

      const allTags = graphService.getAllTags();

      const projectTag = allTags.find((t) => t.name === 'project');
      expect(projectTag?.count).toBe(3);

      const tsTag = allTags.find((t) => t.name === 'typescript');
      expect(tsTag?.count).toBe(1);

      const rustTag = allTags.find((t) => t.name === 'rust');
      expect(rustTag?.count).toBe(1);
    });

    it('should update tag associations when notes are updated', async () => {
      const note = await documentService.create({
        title: 'Changing Tags',
        type: 'note',
        content: createContentWithTags(['initial', 'tags']),
      });

      let tags = graphService.getNoteTags(note.id);
      expect(tags).toContain('initial');
      expect(tags).toContain('tags');

      // Update with new tags
      await documentService.update(note.id, {
        content: createContentWithTags(['new', 'different']),
      });

      tags = graphService.getNoteTags(note.id);
      expect(tags).not.toContain('initial');
      expect(tags).not.toContain('tags');
      expect(tags).toContain('new');
      expect(tags).toContain('different');
    });
  });

  describe('Dashboard stats use case', () => {
    it('should provide accurate vault statistics', async () => {
      // Create a small knowledge graph
      const noteA = await documentService.create({
        title: 'Note A',
        type: 'note',
        content: createContentWithTags(['common']),
      });

      const noteB = await documentService.create({
        title: 'Note B',
        type: 'note',
        content: createContentWithTags(['common', 'unique-b']),
      });

      await documentService.create({
        title: 'Orphan 1',
        type: 'note',
      });

      await documentService.create({
        title: 'Orphan 2',
        type: 'note',
      });

      // Create links: A -> B
      await documentService.update(noteA.id, {
        content: createContentWithLinks([noteB.id]),
      });

      const stats = graphService.getStats();

      expect(stats.totalNotes).toBe(4);
      expect(stats.totalLinks).toBe(1);
      expect(stats.totalTags).toBe(2); // 'common' and 'unique-b' (normalized)
      expect(stats.orphanedNotes).toBe(2); // orphan1 and orphan2
    });

    it('should track orphaned notes correctly', async () => {
      // Start with all orphans
      const note1 = await documentService.create({
        title: 'Note 1',
        type: 'note',
      });

      const note2 = await documentService.create({
        title: 'Note 2',
        type: 'note',
      });

      const note3 = await documentService.create({
        title: 'Note 3',
        type: 'note',
      });

      let stats = graphService.getStats();
      expect(stats.orphanedNotes).toBe(3);

      // Link note1 -> note2
      await documentService.update(note1.id, {
        content: createContentWithLinks([note2.id]),
      });

      stats = graphService.getStats();
      expect(stats.orphanedNotes).toBe(1); // Only note3 is orphaned

      // Link note3 -> note1
      await documentService.update(note3.id, {
        content: createContentWithLinks([note1.id]),
      });

      stats = graphService.getStats();
      expect(stats.orphanedNotes).toBe(0); // All connected
    });
  });

  describe('Note deletion cascades', () => {
    it('should remove backlinks when source note is deleted', async () => {
      const target = await documentService.create({
        title: 'Target',
        type: 'note',
      });

      const source = await documentService.create({
        title: 'Source',
        type: 'note',
        content: createContentWithLinks([target.id]),
      });

      // Verify backlink exists
      let backlinks = graphService.getBacklinks(target.id);
      expect(backlinks).toHaveLength(1);

      // Delete source
      await documentService.delete(source.id);

      // Backlinks should be gone
      backlinks = graphService.getBacklinks(target.id);
      expect(backlinks).toHaveLength(0);
    });

    it('should update stats when notes are deleted', async () => {
      const noteA = await documentService.create({
        title: 'Note A',
        type: 'note',
      });

      const noteB = await documentService.create({
        title: 'Note B',
        type: 'note',
      });

      await documentService.update(noteA.id, {
        content: createContentWithLinks([noteB.id]),
      });

      let stats = graphService.getStats();
      expect(stats.totalNotes).toBe(2);
      expect(stats.totalLinks).toBe(1);

      // Delete noteA
      await documentService.delete(noteA.id);

      stats = graphService.getStats();
      expect(stats.totalNotes).toBe(1);
      expect(stats.totalLinks).toBe(0);
      expect(stats.orphanedNotes).toBe(1); // noteB is now orphaned
    });
  });

  describe('Complex graph scenarios', () => {
    it('should handle bidirectional links correctly', async () => {
      const noteA = await documentService.create({
        title: 'Note A',
        type: 'note',
      });

      const noteB = await documentService.create({
        title: 'Note B',
        type: 'note',
      });

      // A -> B
      await documentService.update(noteA.id, {
        content: createContentWithLinks([noteB.id]),
      });

      // B -> A
      await documentService.update(noteB.id, {
        content: createContentWithLinks([noteA.id]),
      });

      // Each should have one backlink and one forward link
      expect(graphService.getBacklinks(noteA.id)).toHaveLength(1);
      expect(graphService.getBacklinks(noteB.id)).toHaveLength(1);
      expect(graphService.getForwardLinks(noteA.id)).toHaveLength(1);
      expect(graphService.getForwardLinks(noteB.id)).toHaveLength(1);

      // Stats should show 2 links total
      const stats = graphService.getStats();
      expect(stats.totalLinks).toBe(2);
      expect(stats.orphanedNotes).toBe(0);
    });

    it('should handle hub-and-spoke pattern', async () => {
      const hub = await documentService.create({
        title: 'Hub Note',
        type: 'note',
      });

      // Create 10 spokes linking to hub
      for (let i = 0; i < 10; i++) {
        await documentService.create({
          title: `Spoke ${i}`,
          type: 'note',
          content: createContentWithLinks([hub.id]),
        });
      }

      const backlinks = graphService.getBacklinks(hub.id);
      expect(backlinks).toHaveLength(10);

      const stats = graphService.getStats();
      expect(stats.totalNotes).toBe(11);
      expect(stats.totalLinks).toBe(10);
      expect(stats.orphanedNotes).toBe(0);
    });
  });

  describe('Performance with larger datasets', () => {
    it('should handle 100+ notes efficiently', async () => {
      const notes: string[] = [];

      // Create 100 notes with tags
      for (let i = 0; i < 100; i++) {
        const note = await documentService.create({
          title: `Note ${i}`,
          type: 'note',
          content: createContentWithTags([`tag${i % 10}`]),
        });
        notes.push(note.id);
      }

      // These should all complete quickly
      const stats = graphService.getStats();
      expect(stats.totalNotes).toBe(100);

      // All notes are orphans initially (no links)
      expect(stats.orphanedNotes).toBe(100);

      // Verify tags
      const tags = graphService.getAllTags();
      expect(tags).toHaveLength(10);

      // Each tag should have 10 notes
      const taggedNotes = graphService.getNotesWithTag('tag0');
      expect(taggedNotes).toHaveLength(10);
    });

    it('should handle complex link graphs efficiently', async () => {
      const notes: string[] = [];

      // Create 50 notes
      for (let i = 0; i < 50; i++) {
        const note = await documentService.create({
          title: `Note ${i}`,
          type: 'note',
        });
        notes.push(note.id);
      }

      // Create a chain of links: 1 -> 0, 2 -> 1, ..., 49 -> 48
      for (let i = 1; i < 50; i++) {
        await documentService.update(notes[i], {
          content: createContentWithLinks([notes[i - 1]]),
        });
      }

      const stats = graphService.getStats();
      expect(stats.totalNotes).toBe(50);
      expect(stats.totalLinks).toBe(49);

      // Note 0 has no outlinks, but has a backlink from note 1
      const note0Backlinks = graphService.getBacklinks(notes[0]);
      expect(note0Backlinks).toHaveLength(1);
      expect(note0Backlinks[0].id).toBe(notes[1]);

      // Note 25 should have one backlink (from note 26)
      const note25Backlinks = graphService.getBacklinks(notes[25]);
      expect(note25Backlinks).toHaveLength(1);
    });
  });
});
