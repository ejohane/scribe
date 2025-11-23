/**
 * Integration tests for search with storage
 *
 * Tests the full workflow of creating notes, indexing them, and searching
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { FileSystemVault } from './storage';
import { SearchEngine } from '@scribe/engine-search';
import type { LexicalState } from '@scribe/shared';

/**
 * Helper to create Lexical content
 */
function createLexicalContent(text: string): LexicalState {
  return {
    root: {
      type: 'root',
      children: [
        {
          type: 'paragraph',
          children: [
            {
              type: 'text',
              text,
            },
          ],
        },
      ],
    },
  };
}

describe('Search Integration', () => {
  let vaultPath: string;
  let vault: FileSystemVault;
  let searchEngine: SearchEngine;

  beforeEach(async () => {
    // Create temporary vault directory
    vaultPath = mkdtempSync(join(tmpdir(), 'scribe-test-'));

    // Create notes subdirectory
    mkdirSync(join(vaultPath, 'notes'), { recursive: true });

    vault = new FileSystemVault(vaultPath);
    await vault.load();

    // Initialize search engine
    searchEngine = new SearchEngine();
  });

  afterEach(() => {
    // Clean up temporary directory
    if (vaultPath) {
      rmSync(vaultPath, { recursive: true, force: true });
    }
  });

  it('should index and search newly created notes', async () => {
    // Create a note
    const note = await vault.create();
    note.content = createLexicalContent('This is a test note about architecture');
    await vault.save(note);

    // Index the note
    const savedNote = vault.read(note.id);
    expect(savedNote).toBeDefined();
    searchEngine.indexNote(savedNote!);

    // Search for it
    const results = searchEngine.search('architecture');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(note.id);
  });

  it('should find notes by title', async () => {
    // Create note with specific title
    const note = await vault.create();
    note.content = createLexicalContent('Getting Started with Scribe');
    await vault.save(note);

    // Index
    const savedNote = vault.read(note.id);
    searchEngine.indexNote(savedNote!);

    // Search by title
    const results = searchEngine.search('Getting Started');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(note.id);
  });

  it('should find notes by tags', async () => {
    // Create note with tags
    const note = await vault.create();
    note.content = createLexicalContent('Content with #documentation and #tutorial tags');
    await vault.save(note);

    // Index
    const savedNote = vault.read(note.id);
    searchEngine.indexNote(savedNote!);

    // Search by tag
    const results = searchEngine.search('documentation');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe(note.id);
  });

  it('should update search index when note is modified', async () => {
    // Create initial note
    const note = await vault.create();
    note.content = createLexicalContent('Original content');
    await vault.save(note);

    // Index
    let savedNote = vault.read(note.id);
    searchEngine.indexNote(savedNote!);

    // Verify original content is searchable
    let results = searchEngine.search('Original');
    expect(results.length).toBe(1);

    // Update note
    note.content = createLexicalContent('Updated content with new keyword');
    await vault.save(note);

    // Re-index
    savedNote = vault.read(note.id);
    searchEngine.indexNote(savedNote!);

    // Verify new content is searchable
    results = searchEngine.search('new keyword');
    expect(results.length).toBe(1);
    expect(results[0].id).toBe(note.id);

    // Verify old content is no longer prioritized
    results = searchEngine.search('Original');
    expect(results.length).toBe(0);
  });

  it('should handle multiple notes and rank results', async () => {
    // Create multiple notes
    const note1 = await vault.create();
    note1.content = createLexicalContent('Scribe is a note-taking application');
    await vault.save(note1);

    const note2 = await vault.create();
    note2.content = createLexicalContent('Getting started with Scribe for beginners');
    await vault.save(note2);

    const note3 = await vault.create();
    note3.content = createLexicalContent('Advanced Scribe features and tips');
    await vault.save(note3);

    // Index all notes
    const savedNote1 = vault.read(note1.id);
    const savedNote2 = vault.read(note2.id);
    const savedNote3 = vault.read(note3.id);

    searchEngine.indexNote(savedNote1!);
    searchEngine.indexNote(savedNote2!);
    searchEngine.indexNote(savedNote3!);

    // Search for common term
    const results = searchEngine.search('Scribe');

    // Should find all three notes
    expect(results.length).toBe(3);

    // All should have the search term
    const noteIds = results.map((r) => r.id);
    expect(noteIds).toContain(note1.id);
    expect(noteIds).toContain(note2.id);
    expect(noteIds).toContain(note3.id);
  });

  it('should load and index all notes from vault', async () => {
    // Create several notes
    for (let i = 0; i < 5; i++) {
      const note = await vault.create();
      note.content = createLexicalContent(`Test note number ${i} with unique content ${i}`);
      await vault.save(note);
    }

    // Load all notes and index them
    const notes = vault.list();
    expect(notes.length).toBe(5);

    for (const note of notes) {
      searchEngine.indexNote(note);
    }

    expect(searchEngine.size()).toBe(5);

    // Search should find notes
    const results = searchEngine.search('unique content');
    expect(results.length).toBeGreaterThan(0);
  });

  it('should handle empty search queries gracefully', async () => {
    // Create and index a note
    const note = await vault.create();
    note.content = createLexicalContent('Test content');
    await vault.save(note);

    const savedNote = vault.read(note.id);
    searchEngine.indexNote(savedNote!);

    // Empty query should return no results
    expect(searchEngine.search('').length).toBe(0);
    expect(searchEngine.search('   ').length).toBe(0);
  });
});
