import { describe, test, expect } from 'bun:test';
import { createAppState, indexNote, removeNote } from './index';
import type { ParsedNote } from '@scribe/domain-model';

describe('createAppState', () => {
  test('should create empty app state with all indices', () => {
    const state = createAppState();

    expect(state.noteRegistry.byId).toBeInstanceOf(Map);
    expect(state.noteRegistry.byPath).toBeInstanceOf(Map);
    expect(state.noteRegistry.byTitle).toBeInstanceOf(Map);
    expect(state.noteRegistry.byAlias).toBeInstanceOf(Map);

    expect(state.peopleIndex.byId).toBeInstanceOf(Map);
    expect(state.peopleIndex.byName).toBeInstanceOf(Map);

    expect(state.tagIndex.tags).toBeInstanceOf(Map);
    expect(state.tagIndex.notesByTag).toBeInstanceOf(Map);

    expect(state.folderIndex.folders).toBeInstanceOf(Map);

    expect(state.graphIndex.nodes).toBeInstanceOf(Map);
    expect(state.graphIndex.outgoing).toBeInstanceOf(Map);
    expect(state.graphIndex.incoming).toBeInstanceOf(Map);
  });

  test('should create empty indices', () => {
    const state = createAppState();

    expect(state.noteRegistry.byId.size).toBe(0);
    expect(state.peopleIndex.byId.size).toBe(0);
    expect(state.tagIndex.tags.size).toBe(0);
  });
});

describe('indexNote', () => {
  test('should add note to registry', () => {
    const state = createAppState();
    const note: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Test content',
    };

    indexNote(state, note);

    expect(state.noteRegistry.byId.has('note:test.md')).toBe(true);
    expect(state.noteRegistry.byPath.has('test.md')).toBe(true);
    expect(state.noteRegistry.byId.get('note:test.md')).toBe(note);
  });

  test('should update existing note', () => {
    const state = createAppState();
    const note1: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Old content',
    };

    const note2: ParsedNote = {
      ...note1,
      plainText: 'New content',
    };

    indexNote(state, note1);
    indexNote(state, note2);

    expect(state.noteRegistry.byId.size).toBe(1);
    expect(state.noteRegistry.byId.get('note:test.md')?.plainText).toBe('New content');
  });
});

describe('removeNote', () => {
  test('should remove note from registry', () => {
    const state = createAppState();
    const note: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Test content',
    };

    indexNote(state, note);
    expect(state.noteRegistry.byId.size).toBe(1);

    removeNote(state, 'note:test.md');
    expect(state.noteRegistry.byId.size).toBe(0);
    expect(state.noteRegistry.byPath.size).toBe(0);
  });

  test('should handle removing non-existent note', () => {
    const state = createAppState();

    removeNote(state, 'note:nonexistent.md');
    expect(state.noteRegistry.byId.size).toBe(0);
  });
});
