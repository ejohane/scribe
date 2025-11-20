import { describe, test, expect, beforeEach, afterEach } from 'bun:test';
import { mkdirSync, writeFileSync, rmSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import {
  createAppState,
  indexNote,
  removeNote,
  performStartupIndexing,
  registerParsedNote,
  computeNoteDelta,
  applyNoteDelta,
  handleVaultChanges,
} from './index';
import type { ParsedNote } from '@scribe/domain-model';
import { Vault } from '@scribe/vault';

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

describe('registerParsedNote', () => {
  test('should register note in all indices', () => {
    const state = createAppState();
    const note: ParsedNote = {
      id: 'note:folder/test.md',
      path: 'folder/test.md',
      fileName: 'test.md',
      resolvedTitle: 'Test Note',
      frontmatter: {},
      inlineTags: ['tag:project', 'tag:important'],
      fmTags: [],
      allTags: ['tag:project', 'tag:important'],
      aliases: ['alias1'],
      headings: [
        {
          id: 'heading:section-1' as any,
          level: 1,
          rawText: 'Section 1',
          normalized: 'section-1',
          line: 5,
        },
      ],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Test content',
    };

    registerParsedNote(state, note);

    // Check note registry
    expect(state.noteRegistry.byId.has('note:folder/test.md')).toBe(true);
    expect(state.noteRegistry.byPath.has('folder/test.md')).toBe(true);

    // Check folder index
    expect(state.folderIndex.folders.has('folder' as any)).toBe(true);
    const notesInFolder = state.folderIndex.notesByFolder.get('folder' as any);
    expect(notesInFolder?.has('note:folder/test.md')).toBe(true);

    // Check tag index
    expect(state.tagIndex.tags.has('tag:project')).toBe(true);
    expect(state.tagIndex.tags.has('tag:important')).toBe(true);
    const notesForTag = state.tagIndex.notesByTag.get('tag:project');
    expect(notesForTag?.has('note:folder/test.md')).toBe(true);

    // Check heading index
    expect(state.headingIndex.byId.has('heading:section-1' as any)).toBe(true);
    const headingsForNote = state.headingIndex.headingsByNote.get('note:folder/test.md');
    expect(headingsForNote?.length).toBe(1);
  });

  test('should register person note in people index', () => {
    const state = createAppState();
    const note: ParsedNote = {
      id: 'note:people/Erik.md',
      path: 'people/Erik.md',
      fileName: 'Erik.md',
      resolvedTitle: 'Erik',
      frontmatter: { role: 'Developer' },
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Bio content',
    };

    registerParsedNote(state, note);

    // Check people index
    expect(state.peopleIndex.byId.has('note:people/Erik.md' as any)).toBe(true);
    expect(state.peopleIndex.byName.has('erik')).toBe(true);
    const person = state.peopleIndex.byId.get('note:people/Erik.md' as any);
    expect(person?.name).toBe('Erik');
    expect(person?.metadata.role).toBe('Developer');
  });
});

describe('performStartupIndexing', () => {
  let testVaultPath: string;

  beforeEach(() => {
    // Create temporary vault directory
    testVaultPath = join(tmpdir(), `scribe-test-${Date.now()}`);
    mkdirSync(testVaultPath, { recursive: true });
  });

  afterEach(() => {
    // Clean up temporary vault
    rmSync(testVaultPath, { recursive: true, force: true });
  });

  test('should index all files in vault', async () => {
    // Create test files
    mkdirSync(join(testVaultPath, 'notes'), { recursive: true });
    writeFileSync(
      join(testVaultPath, 'notes', 'test1.md'),
      '# Test 1\n\nThis is test note 1 #project'
    );
    writeFileSync(join(testVaultPath, 'notes', 'test2.md'), '# Test 2\n\n[[test1]] reference');
    writeFileSync(join(testVaultPath, 'root.md'), '# Root\n\nRoot note');

    const vault = new Vault({ vaultPath: testVaultPath });
    const state = createAppState();

    await performStartupIndexing(vault, state);

    // Check that all notes were indexed
    expect(state.noteRegistry.byId.size).toBe(3);
    expect(state.noteRegistry.byId.has('note:notes/test1.md' as any)).toBe(true);
    expect(state.noteRegistry.byId.has('note:notes/test2.md' as any)).toBe(true);
    expect(state.noteRegistry.byId.has('note:root.md' as any)).toBe(true);

    // Check folder index
    expect(state.folderIndex.folders.has('notes' as any)).toBe(true);

    // Check tag index
    expect(state.tagIndex.tags.has('tag:project')).toBe(true);
  });

  test('should handle empty vault', async () => {
    const vault = new Vault({ vaultPath: testVaultPath });
    const state = createAppState();

    await performStartupIndexing(vault, state);

    expect(state.noteRegistry.byId.size).toBe(0);
  });

  test('should handle vault with people folder', async () => {
    // Create people folder with a person note
    mkdirSync(join(testVaultPath, 'people'), { recursive: true });
    writeFileSync(
      join(testVaultPath, 'people', 'Erik.md'),
      '---\ntitle: Erik Johansson\nrole: Developer\n---\n\n# Erik\n\nBio content'
    );

    const vault = new Vault({ vaultPath: testVaultPath });
    const state = createAppState();

    await performStartupIndexing(vault, state);

    // Check that person was indexed
    expect(state.peopleIndex.byId.size).toBe(1);
    expect(state.peopleIndex.byName.has('erik johansson')).toBe(true);
  });

  test('should handle malformed files gracefully', async () => {
    // Create a file with invalid frontmatter
    writeFileSync(
      join(testVaultPath, 'broken.md'),
      '---\ninvalid yaml: [unclosed\n---\n\n# Broken\n\nContent'
    );

    const vault = new Vault({ vaultPath: testVaultPath });
    const state = createAppState();

    // Should not throw
    await performStartupIndexing(vault, state);

    // Should still index the file (with empty frontmatter)
    expect(state.noteRegistry.byId.size).toBe(1);
  });
});

describe('computeNoteDelta', () => {
  test('should detect added tags', () => {
    const oldNote: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: ['tag:old'],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Old content',
    };

    const newNote: ParsedNote = {
      ...oldNote,
      allTags: ['tag:old', 'tag:new', 'tag:added'],
      plainText: 'New content',
    };

    const delta = computeNoteDelta(oldNote, newNote);

    expect(delta.addedTags).toEqual(['tag:new', 'tag:added']);
    expect(delta.removedTags).toEqual([]);
  });

  test('should detect removed tags', () => {
    const oldNote: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: ['tag:old', 'tag:removed'],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Old content',
    };

    const newNote: ParsedNote = {
      ...oldNote,
      allTags: ['tag:old'],
      plainText: 'New content',
    };

    const delta = computeNoteDelta(oldNote, newNote);

    expect(delta.addedTags).toEqual([]);
    expect(delta.removedTags).toEqual(['tag:removed']);
  });

  test('should detect added and removed tags simultaneously', () => {
    const oldNote: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: ['tag:keep', 'tag:remove1', 'tag:remove2'],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Old content',
    };

    const newNote: ParsedNote = {
      ...oldNote,
      allTags: ['tag:keep', 'tag:add1', 'tag:add2'],
      plainText: 'New content',
    };

    const delta = computeNoteDelta(oldNote, newNote);

    expect(delta.addedTags.sort()).toEqual(['tag:add1', 'tag:add2']);
    expect(delta.removedTags.sort()).toEqual(['tag:remove1', 'tag:remove2']);
  });

  test('should detect added headings', () => {
    const oldNote: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [
        {
          id: 'heading:old' as any,
          level: 1,
          rawText: 'Old Heading',
          normalized: 'old-heading',
          line: 1,
        },
      ],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Old content',
    };

    const newNote: ParsedNote = {
      ...oldNote,
      headings: [
        {
          id: 'heading:old' as any,
          level: 1,
          rawText: 'Old Heading',
          normalized: 'old-heading',
          line: 1,
        },
        {
          id: 'heading:new' as any,
          level: 2,
          rawText: 'New Heading',
          normalized: 'new-heading',
          line: 10,
        },
      ],
      plainText: 'New content',
    };

    const delta = computeNoteDelta(oldNote, newNote);

    expect(delta.addedHeadings.length).toBe(1);
    expect(delta.addedHeadings[0].id).toBe('heading:new');
    expect(delta.removedHeadings.length).toBe(0);
  });

  test('should detect removed headings', () => {
    const oldNote: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [
        {
          id: 'heading:keep' as any,
          level: 1,
          rawText: 'Keep',
          normalized: 'keep',
          line: 1,
        },
        {
          id: 'heading:remove' as any,
          level: 2,
          rawText: 'Remove',
          normalized: 'remove',
          line: 10,
        },
      ],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Old content',
    };

    const newNote: ParsedNote = {
      ...oldNote,
      headings: [
        {
          id: 'heading:keep' as any,
          level: 1,
          rawText: 'Keep',
          normalized: 'keep',
          line: 1,
        },
      ],
      plainText: 'New content',
    };

    const delta = computeNoteDelta(oldNote, newNote);

    expect(delta.addedHeadings.length).toBe(0);
    expect(delta.removedHeadings.length).toBe(1);
    expect(delta.removedHeadings[0].id).toBe('heading:remove');
  });

  test('should detect title changes', () => {
    const oldNote: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'Old Title',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Content',
    };

    const newNote: ParsedNote = {
      ...oldNote,
      resolvedTitle: 'New Title',
    };

    const delta = computeNoteDelta(oldNote, newNote);

    expect(delta.titleChanged).toBe(true);
  });

  test('should detect path changes', () => {
    const oldNote: ParsedNote = {
      id: 'note:old/path.md',
      path: 'old/path.md',
      fileName: 'path.md',
      resolvedTitle: 'Title',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Content',
    };

    const newNote: ParsedNote = {
      ...oldNote,
      id: 'note:new/path.md',
      path: 'new/path.md',
    };

    const delta = computeNoteDelta(oldNote, newNote);

    expect(delta.pathChanged).toBe(true);
  });

  test('should handle new note (no old version)', () => {
    const newNote: ParsedNote = {
      id: 'note:new.md',
      path: 'new.md',
      fileName: 'new.md',
      resolvedTitle: 'New Note',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: ['tag:new'],
      aliases: [],
      headings: [
        {
          id: 'heading:new' as any,
          level: 1,
          rawText: 'New Heading',
          normalized: 'new-heading',
          line: 1,
        },
      ],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'New content',
    };

    const delta = computeNoteDelta(undefined, newNote);

    expect(delta.addedTags).toEqual(['tag:new']);
    expect(delta.removedTags).toEqual([]);
    expect(delta.addedHeadings.length).toBe(1);
    expect(delta.removedHeadings.length).toBe(0);
    expect(delta.titleChanged).toBe(false);
    expect(delta.pathChanged).toBe(false);
  });

  test('should detect added links', () => {
    const oldNote: ParsedNote = {
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

    const newNote: ParsedNote = {
      ...oldNote,
      links: [
        {
          raw: '[[other-note]]',
          targetText: 'other-note',
          noteName: 'other-note',
          position: { line: 5, column: 10 },
        },
      ],
      plainText: 'New content with [[other-note]]',
    };

    const delta = computeNoteDelta(oldNote, newNote);

    expect(delta.addedLinks.length).toBe(1);
    expect(delta.addedLinks[0].noteName).toBe('other-note');
    expect(delta.removedLinks.length).toBe(0);
  });

  test('should detect removed links', () => {
    const oldNote: ParsedNote = {
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
      links: [
        {
          raw: '[[old-link]]',
          targetText: 'old-link',
          noteName: 'old-link',
          position: { line: 5, column: 10 },
        },
      ],
      embeds: [],
      peopleMentions: [],
      plainText: 'Old content with [[old-link]]',
    };

    const newNote: ParsedNote = {
      ...oldNote,
      links: [],
      plainText: 'New content',
    };

    const delta = computeNoteDelta(oldNote, newNote);

    expect(delta.addedLinks.length).toBe(0);
    expect(delta.removedLinks.length).toBe(1);
    expect(delta.removedLinks[0].noteName).toBe('old-link');
  });

  test('should detect added people mentions', () => {
    const oldNote: ParsedNote = {
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

    const newNote: ParsedNote = {
      ...oldNote,
      peopleMentions: [
        {
          raw: '@Erik',
          personName: 'Erik',
          position: { line: 5, column: 10 },
        },
      ],
      plainText: 'New content with @Erik',
    };

    const delta = computeNoteDelta(oldNote, newNote);

    expect(delta.addedPeopleMentions.length).toBe(1);
    expect(delta.addedPeopleMentions[0].personName).toBe('Erik');
    expect(delta.removedPeopleMentions.length).toBe(0);
  });
});

describe('applyNoteDelta', () => {
  test('should update note registry', () => {
    const state = createAppState();
    const oldNote: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'Old Title',
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

    const newNote: ParsedNote = {
      ...oldNote,
      resolvedTitle: 'New Title',
      plainText: 'New content',
    };

    // Register old note first
    registerParsedNote(state, oldNote);

    const delta = computeNoteDelta(oldNote, newNote);
    applyNoteDelta(state, delta);

    const retrieved = state.noteRegistry.getNoteById('note:test.md');
    expect(retrieved?.resolvedTitle).toBe('New Title');
    expect(retrieved?.plainText).toBe('New content');
  });

  test('should update tag index efficiently', () => {
    const state = createAppState();
    const oldNote: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: ['tag:old', 'tag:keep'],
      aliases: [],
      headings: [],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Old content',
    };

    const newNote: ParsedNote = {
      ...oldNote,
      allTags: ['tag:keep', 'tag:new'],
      plainText: 'New content',
    };

    // Register old note first
    registerParsedNote(state, oldNote);

    const delta = computeNoteDelta(oldNote, newNote);
    applyNoteDelta(state, delta);

    // Check that old tag was removed (should not exist in index anymore)
    const oldTagNotes = state.tagIndex.notesByTag.get('tag:old');
    expect(oldTagNotes).toBeUndefined(); // Tag completely removed when no notes use it

    // Check that keep tag is still there
    const keepTagNotes = state.tagIndex.notesByTag.get('tag:keep');
    expect(keepTagNotes?.has('note:test.md')).toBe(true);

    // Check that new tag was added
    const newTagNotes = state.tagIndex.notesByTag.get('tag:new');
    expect(newTagNotes?.has('note:test.md')).toBe(true);

    // Check tag usage counts
    expect(state.tagIndex.tags.get('tag:keep')?.usageCount).toBe(1);
    expect(state.tagIndex.tags.get('tag:new')?.usageCount).toBe(1);
    expect(state.tagIndex.tags.has('tag:old')).toBe(false); // Should be cleaned up
  });

  test('should update heading index efficiently', () => {
    const state = createAppState();
    const oldNote: ParsedNote = {
      id: 'note:test.md',
      path: 'test.md',
      fileName: 'test.md',
      resolvedTitle: 'test',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: [],
      aliases: [],
      headings: [
        {
          id: 'heading:old' as any,
          level: 1,
          rawText: 'Old',
          normalized: 'old',
          line: 1,
        },
        {
          id: 'heading:keep' as any,
          level: 2,
          rawText: 'Keep',
          normalized: 'keep',
          line: 5,
        },
      ],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'Old content',
    };

    const newNote: ParsedNote = {
      ...oldNote,
      headings: [
        {
          id: 'heading:keep' as any,
          level: 2,
          rawText: 'Keep',
          normalized: 'keep',
          line: 5,
        },
        {
          id: 'heading:new' as any,
          level: 1,
          rawText: 'New',
          normalized: 'new',
          line: 10,
        },
      ],
      plainText: 'New content',
    };

    // Register old note first
    registerParsedNote(state, oldNote);

    const delta = computeNoteDelta(oldNote, newNote);
    applyNoteDelta(state, delta);

    // Check that old heading was removed
    expect(state.headingIndex.byId.has('heading:old' as any)).toBe(false);

    // Check that keep heading is still there
    expect(state.headingIndex.byId.has('heading:keep' as any)).toBe(true);

    // Check that new heading was added
    expect(state.headingIndex.byId.has('heading:new' as any)).toBe(true);

    // Check headingsByNote
    const headingsForNote = state.headingIndex.headingsByNote.get('note:test.md');
    expect(headingsForNote?.length).toBe(2);
    expect(headingsForNote?.includes('heading:keep' as any)).toBe(true);
    expect(headingsForNote?.includes('heading:new' as any)).toBe(true);
  });

  test('should handle new note insertion', () => {
    const state = createAppState();
    const newNote: ParsedNote = {
      id: 'note:new.md',
      path: 'new.md',
      fileName: 'new.md',
      resolvedTitle: 'New Note',
      frontmatter: {},
      inlineTags: [],
      fmTags: [],
      allTags: ['tag:new'],
      aliases: [],
      headings: [
        {
          id: 'heading:new' as any,
          level: 1,
          rawText: 'New Heading',
          normalized: 'new-heading',
          line: 1,
        },
      ],
      links: [],
      embeds: [],
      peopleMentions: [],
      plainText: 'New content',
    };

    const delta = computeNoteDelta(undefined, newNote);
    applyNoteDelta(state, delta);

    // Check that note was registered
    expect(state.noteRegistry.byId.has('note:new.md')).toBe(true);

    // Check that tags were added
    const tagNotes = state.tagIndex.notesByTag.get('tag:new');
    expect(tagNotes?.has('note:new.md')).toBe(true);

    // Check that headings were added
    expect(state.headingIndex.byId.has('heading:new' as any)).toBe(true);
  });
});
