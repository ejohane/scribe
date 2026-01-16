/**
 * Tests for GraphService.
 *
 * These tests verify:
 * 1. getBacklinks returns notes that link TO target
 * 2. getForwardLinks returns notes linked FROM source
 * 3. getNotesWithTag filters by tag correctly
 * 4. getAllTags returns tags with usage counts
 * 5. getNoteTags returns tags for a specific note
 * 6. getStats provides accurate counts
 * 7. Empty results handled gracefully (not errors)
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  ScribeDatabase,
  NotesRepository,
  LinksRepository,
  TagsRepository,
} from '@scribe/server-db';
import { GraphService } from './graph.service.js';

describe('GraphService', () => {
  let scribeDb: ScribeDatabase;
  let notesRepo: NotesRepository;
  let linksRepo: LinksRepository;
  let tagsRepo: TagsRepository;
  let service: GraphService;

  // Helper to create a note in the repository
  const createNote = (
    id: string,
    title: string,
    type: 'note' | 'daily' | 'meeting' | 'person' = 'note'
  ) => {
    const now = new Date().toISOString();
    return notesRepo.create({
      id,
      title,
      type,
      filePath: `notes/${id}.json`,
      createdAt: now,
      updatedAt: now,
    });
  };

  // Helper to create a link
  const createLink = (sourceId: string, targetId: string, linkText?: string) => {
    return linksRepo.create({
      sourceId,
      targetId,
      linkText: linkText ?? null,
    });
  };

  beforeEach(() => {
    // Initialize in-memory database
    scribeDb = new ScribeDatabase({ path: ':memory:' });
    scribeDb.initialize();

    const db = scribeDb.getDb();
    notesRepo = new NotesRepository(db);
    linksRepo = new LinksRepository(db);
    tagsRepo = new TagsRepository(db);

    service = new GraphService({
      notesRepo,
      linksRepo,
      tagsRepo,
    });
  });

  afterEach(() => {
    if (scribeDb.isOpen()) {
      scribeDb.close();
    }
  });

  describe('getBacklinks', () => {
    it('should return notes that link TO the target note', () => {
      // Setup: A -> B, C -> B (B has 2 backlinks)
      const noteA = createNote('note-a', 'Note A');
      const noteB = createNote('note-b', 'Note B');
      const noteC = createNote('note-c', 'Note C');

      createLink(noteA.id, noteB.id, 'see also');
      createLink(noteC.id, noteB.id, 'related');

      const backlinks = service.getBacklinks(noteB.id);

      expect(backlinks).toHaveLength(2);
      expect(backlinks.map((l) => l.id)).toContain(noteA.id);
      expect(backlinks.map((l) => l.id)).toContain(noteC.id);
    });

    it('should include link text in results', () => {
      const source = createNote('source', 'Source Note');
      const target = createNote('target', 'Target Note');

      createLink(source.id, target.id, 'see this note');

      const backlinks = service.getBacklinks(target.id);

      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].linkText).toBe('see this note');
    });

    it('should return empty array when no backlinks exist', () => {
      const note = createNote('lonely', 'Lonely Note');

      const backlinks = service.getBacklinks(note.id);

      expect(backlinks).toEqual([]);
    });

    it('should return empty array for non-existent note', () => {
      const backlinks = service.getBacklinks('non-existent-id');

      expect(backlinks).toEqual([]);
    });

    it('should include note type in results', () => {
      const daily = createNote('daily-1', 'Daily 2024-01-15', 'daily');
      const target = createNote('target', 'Target');

      createLink(daily.id, target.id);

      const backlinks = service.getBacklinks(target.id);

      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].type).toBe('daily');
    });

    it('should handle null link text', () => {
      const source = createNote('source', 'Source');
      const target = createNote('target', 'Target');

      createLink(source.id, target.id); // no link text

      const backlinks = service.getBacklinks(target.id);

      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].linkText).toBeNull();
    });
  });

  describe('getForwardLinks', () => {
    it('should return notes that the source links TO', () => {
      // Setup: A -> B, A -> C (A has 2 forward links)
      const noteA = createNote('note-a', 'Note A');
      const noteB = createNote('note-b', 'Note B');
      const noteC = createNote('note-c', 'Note C');

      createLink(noteA.id, noteB.id, 'link to B');
      createLink(noteA.id, noteC.id, 'link to C');

      const forwardLinks = service.getForwardLinks(noteA.id);

      expect(forwardLinks).toHaveLength(2);
      expect(forwardLinks.map((l) => l.id)).toContain(noteB.id);
      expect(forwardLinks.map((l) => l.id)).toContain(noteC.id);
    });

    it('should include link text in results', () => {
      const source = createNote('source', 'Source Note');
      const target = createNote('target', 'Target Note');

      createLink(source.id, target.id, 'check this out');

      const forwardLinks = service.getForwardLinks(source.id);

      expect(forwardLinks).toHaveLength(1);
      expect(forwardLinks[0].linkText).toBe('check this out');
    });

    it('should return empty array when no forward links exist', () => {
      const note = createNote('isolated', 'Isolated Note');

      const forwardLinks = service.getForwardLinks(note.id);

      expect(forwardLinks).toEqual([]);
    });

    it('should return empty array for non-existent note', () => {
      const forwardLinks = service.getForwardLinks('non-existent-id');

      expect(forwardLinks).toEqual([]);
    });

    it('should include target note title and type', () => {
      const source = createNote('source', 'Source');
      const meeting = createNote('meeting-1', 'Meeting with Team', 'meeting');

      createLink(source.id, meeting.id);

      const forwardLinks = service.getForwardLinks(source.id);

      expect(forwardLinks).toHaveLength(1);
      expect(forwardLinks[0].title).toBe('Meeting with Team');
      expect(forwardLinks[0].type).toBe('meeting');
    });
  });

  describe('getNotesWithTag', () => {
    it('should return all notes with a specific tag', () => {
      const note1 = createNote('note-1', 'Note 1');
      const note2 = createNote('note-2', 'Note 2');
      const note3 = createNote('note-3', 'Note 3');

      tagsRepo.setNoteTags(note1.id, ['typescript', 'programming']);
      tagsRepo.setNoteTags(note2.id, ['typescript']);
      tagsRepo.setNoteTags(note3.id, ['python']);

      const typescriptNotes = service.getNotesWithTag('typescript');

      expect(typescriptNotes).toHaveLength(2);
      expect(typescriptNotes.map((n) => n.id)).toContain(note1.id);
      expect(typescriptNotes.map((n) => n.id)).toContain(note2.id);
    });

    it('should be case-insensitive', () => {
      const note = createNote('note-1', 'Note 1');
      tagsRepo.setNoteTags(note.id, ['TypeScript']);

      const result1 = service.getNotesWithTag('typescript');
      const result2 = service.getNotesWithTag('TYPESCRIPT');
      const result3 = service.getNotesWithTag('TypeScript');

      expect(result1).toHaveLength(1);
      expect(result2).toHaveLength(1);
      expect(result3).toHaveLength(1);
    });

    it('should return empty array for non-existent tag', () => {
      const note = createNote('note-1', 'Note 1');
      tagsRepo.setNoteTags(note.id, ['javascript']);

      const result = service.getNotesWithTag('rust');

      expect(result).toEqual([]);
    });

    it('should include note type in results', () => {
      const meeting = createNote('meeting-1', 'Team Sync', 'meeting');
      tagsRepo.setNoteTags(meeting.id, ['team', 'weekly']);

      const result = service.getNotesWithTag('team');

      expect(result).toHaveLength(1);
      expect(result[0].type).toBe('meeting');
    });
  });

  describe('getAllTags', () => {
    it('should return all tags with counts', () => {
      const note1 = createNote('note-1', 'Note 1');
      const note2 = createNote('note-2', 'Note 2');
      const note3 = createNote('note-3', 'Note 3');

      tagsRepo.setNoteTags(note1.id, ['project', 'important']);
      tagsRepo.setNoteTags(note2.id, ['project']);
      tagsRepo.setNoteTags(note3.id, ['project', 'todo']);

      const tags = service.getAllTags();

      expect(tags.length).toBeGreaterThanOrEqual(3);

      const projectTag = tags.find((t) => t.name === 'project');
      expect(projectTag).toBeDefined();
      expect(projectTag?.count).toBe(3);

      const importantTag = tags.find((t) => t.name === 'important');
      expect(importantTag).toBeDefined();
      expect(importantTag?.count).toBe(1);
    });

    it('should return empty array when no tags exist', () => {
      createNote('note-1', 'Note 1');

      const tags = service.getAllTags();

      expect(tags).toEqual([]);
    });

    it('should be ordered by count descending', () => {
      const note1 = createNote('note-1', 'Note 1');
      const note2 = createNote('note-2', 'Note 2');
      const note3 = createNote('note-3', 'Note 3');

      tagsRepo.setNoteTags(note1.id, ['rare', 'common', 'popular']);
      tagsRepo.setNoteTags(note2.id, ['common', 'popular']);
      tagsRepo.setNoteTags(note3.id, ['popular']);

      const tags = service.getAllTags();

      // First tag should have highest count
      expect(tags[0].name).toBe('popular');
      expect(tags[0].count).toBe(3);
    });
  });

  describe('getNoteTags', () => {
    it('should return tags for a specific note', () => {
      const note = createNote('note-1', 'Note 1');
      tagsRepo.setNoteTags(note.id, ['typescript', 'project', 'todo']);

      const tags = service.getNoteTags(note.id);

      expect(tags).toHaveLength(3);
      expect(tags).toContain('typescript');
      expect(tags).toContain('project');
      expect(tags).toContain('todo');
    });

    it('should return empty array for note with no tags', () => {
      const note = createNote('note-1', 'Note 1');

      const tags = service.getNoteTags(note.id);

      expect(tags).toEqual([]);
    });

    it('should return empty array for non-existent note', () => {
      const tags = service.getNoteTags('non-existent-id');

      expect(tags).toEqual([]);
    });

    it('should return normalized tag names', () => {
      const note = createNote('note-1', 'Note 1');
      tagsRepo.setNoteTags(note.id, ['TypeScript', 'PROJECT', 'ToDo']);

      const tags = service.getNoteTags(note.id);

      expect(tags).toContain('typescript');
      expect(tags).toContain('project');
      expect(tags).toContain('todo');
    });
  });

  describe('getStats', () => {
    it('should return accurate total counts', () => {
      const note1 = createNote('note-1', 'Note 1');
      const note2 = createNote('note-2', 'Note 2');
      const note3 = createNote('note-3', 'Note 3');

      createLink(note1.id, note2.id);
      createLink(note1.id, note3.id);
      createLink(note2.id, note3.id);

      tagsRepo.setNoteTags(note1.id, ['tag1', 'tag2']);
      tagsRepo.setNoteTags(note2.id, ['tag1']);

      const stats = service.getStats();

      expect(stats.totalNotes).toBe(3);
      expect(stats.totalLinks).toBe(3);
      expect(stats.totalTags).toBe(2);
    });

    it('should count orphaned notes correctly', () => {
      // 3 connected notes + 2 orphans
      const note1 = createNote('note-1', 'Note 1');
      const note2 = createNote('note-2', 'Note 2');
      const note3 = createNote('note-3', 'Note 3');
      createNote('orphan-1', 'Orphan 1');
      createNote('orphan-2', 'Orphan 2');

      createLink(note1.id, note2.id);
      createLink(note2.id, note3.id);

      const stats = service.getStats();

      expect(stats.totalNotes).toBe(5);
      expect(stats.orphanedNotes).toBe(2);
    });

    it('should return zeros when vault is empty', () => {
      const stats = service.getStats();

      expect(stats.totalNotes).toBe(0);
      expect(stats.totalLinks).toBe(0);
      expect(stats.totalTags).toBe(0);
      expect(stats.orphanedNotes).toBe(0);
    });

    it('should count note with only backlinks as non-orphaned', () => {
      const source = createNote('source', 'Source');
      const target = createNote('target', 'Target');

      createLink(source.id, target.id);

      const stats = service.getStats();

      // Both notes are connected via the link
      expect(stats.orphanedNotes).toBe(0);
    });

    it('should count note with only outlinks as non-orphaned', () => {
      const source = createNote('source', 'Source');
      const target = createNote('target', 'Target');

      createLink(source.id, target.id);

      const stats = service.getStats();

      expect(stats.orphanedNotes).toBe(0);
    });
  });

  describe('edge cases', () => {
    it('should handle self-referencing links', () => {
      const note = createNote('self-ref', 'Self Referencing Note');
      createLink(note.id, note.id, 'see above');

      const backlinks = service.getBacklinks(note.id);
      const forwardLinks = service.getForwardLinks(note.id);

      expect(backlinks).toHaveLength(1);
      expect(backlinks[0].id).toBe(note.id);
      expect(forwardLinks).toHaveLength(1);
      expect(forwardLinks[0].id).toBe(note.id);
    });

    it('should handle circular links', () => {
      const noteA = createNote('note-a', 'Note A');
      const noteB = createNote('note-b', 'Note B');

      createLink(noteA.id, noteB.id);
      createLink(noteB.id, noteA.id);

      const aBacklinks = service.getBacklinks(noteA.id);
      const aForwardLinks = service.getForwardLinks(noteA.id);
      const bBacklinks = service.getBacklinks(noteB.id);
      const bForwardLinks = service.getForwardLinks(noteB.id);

      expect(aBacklinks).toHaveLength(1);
      expect(aBacklinks[0].id).toBe(noteB.id);
      expect(aForwardLinks).toHaveLength(1);
      expect(aForwardLinks[0].id).toBe(noteB.id);
      expect(bBacklinks).toHaveLength(1);
      expect(bBacklinks[0].id).toBe(noteA.id);
      expect(bForwardLinks).toHaveLength(1);
      expect(bForwardLinks[0].id).toBe(noteA.id);
    });

    it('should handle notes with many links', () => {
      const hub = createNote('hub', 'Hub Note');

      // Create 50 notes linking to hub
      for (let i = 0; i < 50; i++) {
        const spoke = createNote(`spoke-${i}`, `Spoke ${i}`);
        createLink(spoke.id, hub.id);
      }

      const backlinks = service.getBacklinks(hub.id);

      expect(backlinks).toHaveLength(50);
    });

    it('should handle notes with many tags', () => {
      const note = createNote('tagged', 'Tagged Note');
      const manyTags = Array.from({ length: 20 }, (_, i) => `tag${i}`);
      tagsRepo.setNoteTags(note.id, manyTags);

      const tags = service.getNoteTags(note.id);

      expect(tags).toHaveLength(20);
    });
  });
});
