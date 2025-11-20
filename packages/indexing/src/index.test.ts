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
