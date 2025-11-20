import { describe, test, expect, beforeEach } from 'bun:test';
import { SearchEngine } from './index';
import type { ParsedNote } from '@scribe/domain-model';

describe('SearchEngine', () => {
  let engine: SearchEngine;

  beforeEach(() => {
    engine = new SearchEngine();
  });

  const createNote = (id: string, title: string, content = ''): ParsedNote => ({
    id,
    path: `${id}.md`,
    fileName: `${id}.md`,
    resolvedTitle: title,
    frontmatter: {},
    inlineTags: [],
    fmTags: [],
    allTags: [],
    aliases: [],
    headings: [],
    links: [],
    embeds: [],
    peopleMentions: [],
    plainText: content,
  });

  describe('indexNote', () => {
    test('should index a note', () => {
      const note = createNote('note:test', 'Test Note');
      engine.indexNote(note);

      const results = engine.search('Test');
      expect(results.length).toBe(1);
      expect(results[0].note.id).toBe('note:test');
    });

    test('should update existing note', () => {
      const note1 = createNote('note:test', 'Test Note');
      const note2 = createNote('note:test', 'Updated Note');

      engine.indexNote(note1);
      engine.indexNote(note2);

      const results = engine.search('Updated');
      expect(results.length).toBe(1);
      expect(results[0].note.resolvedTitle).toBe('Updated Note');
    });
  });

  describe('removeNote', () => {
    test('should remove a note from index', () => {
      const note = createNote('note:test', 'Test Note');
      engine.indexNote(note);

      expect(engine.search('Test').length).toBe(1);

      engine.removeNote('note:test');
      expect(engine.search('Test').length).toBe(0);
    });

    test('should handle removing non-existent note', () => {
      engine.removeNote('note:nonexistent');
      expect(engine.search('Test').length).toBe(0);
    });
  });

  describe('search', () => {
    beforeEach(() => {
      engine.indexNote(createNote('note:1', 'JavaScript Tutorial'));
      engine.indexNote(createNote('note:2', 'TypeScript Guide'));
      engine.indexNote(createNote('note:3', 'Python Basics'));
      engine.indexNote(createNote('note:4', 'Java Programming'));
    });

    test('should find notes by title match', () => {
      const results = engine.search('JavaScript');
      expect(results.length).toBe(1);
      expect(results[0].note.resolvedTitle).toBe('JavaScript Tutorial');
    });

    test('should be case insensitive', () => {
      const results = engine.search('javascript');
      expect(results.length).toBe(1);
      expect(results[0].note.resolvedTitle).toBe('JavaScript Tutorial');
    });

    test('should find partial matches', () => {
      const results = engine.search('script');
      expect(results.length).toBe(2);
    });

    test('should return empty array for no matches', () => {
      const results = engine.search('Ruby');
      expect(results.length).toBe(0);
    });

    test('should respect limit option', () => {
      const results = engine.search('a', { limit: 2 });
      expect(results.length).toBeLessThanOrEqual(2);
    });

    test('should default limit to 50', () => {
      // Add many notes
      for (let i = 0; i < 60; i++) {
        engine.indexNote(createNote(`note:${i}`, `Test ${i}`));
      }

      const results = engine.search('Test');
      expect(results.length).toBe(50);
    });

    test('should set matchType to title', () => {
      const results = engine.search('JavaScript');
      expect(results[0].matchType).toBe('title');
    });

    test('should set score', () => {
      const results = engine.search('JavaScript');
      expect(results[0].score).toBe(1.0);
    });
  });

  describe('clear', () => {
    test('should clear all indexed notes', () => {
      engine.indexNote(createNote('note:1', 'Test 1'));
      engine.indexNote(createNote('note:2', 'Test 2'));

      expect(engine.search('Test').length).toBe(2);

      engine.clear();
      expect(engine.search('Test').length).toBe(0);
    });
  });
});
