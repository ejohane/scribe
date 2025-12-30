import { describe, it, expect } from 'vitest';
import { computeContentHash, hasContentChanged, matchesHash } from './content-hash.js';
import type { BaseNote, NoteId, NoteMetadata, EditorContent } from '@scribe/shared';

// Helper to create empty editor content with proper structure
const createEmptyEditorContent = (): EditorContent => ({
  root: {
    type: 'root',
    children: [],
  },
});

// Helper to create editor content with text
const createEditorContent = (text: string): EditorContent => ({
  root: {
    type: 'root',
    children: [{ type: 'paragraph', children: [{ type: 'text', text }] }],
  },
});

// Helper to create test notes with proper types
const createTestNote = (overrides: Partial<BaseNote> = {}): BaseNote => {
  const defaultMetadata: NoteMetadata = {
    title: null,
    tags: [],
    links: [],
    mentions: [],
  };

  return {
    id: 'test-note-1' as NoteId,
    title: 'Test Note',
    content: createEmptyEditorContent(),
    tags: ['test'],
    metadata: defaultMetadata,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    ...overrides,
  };
};

describe('computeContentHash', () => {
  it('returns a 16-character hex string', () => {
    const hash = computeContentHash(createTestNote());
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('returns same hash for identical content', () => {
    const note1 = createTestNote();
    const note2 = createTestNote();
    expect(computeContentHash(note1)).toBe(computeContentHash(note2));
  });

  it('returns different hash for different title', () => {
    const note1 = createTestNote({ title: 'Title A' });
    const note2 = createTestNote({ title: 'Title B' });
    expect(computeContentHash(note1)).not.toBe(computeContentHash(note2));
  });

  it('returns different hash for different content', () => {
    const note1 = createTestNote({ content: createEditorContent('A') });
    const note2 = createTestNote({ content: createEditorContent('B') });
    expect(computeContentHash(note1)).not.toBe(computeContentHash(note2));
  });

  it('returns different hash for different tags', () => {
    const note1 = createTestNote({ tags: ['tag1'] });
    const note2 = createTestNote({ tags: ['tag2'] });
    expect(computeContentHash(note1)).not.toBe(computeContentHash(note2));
  });

  it('returns different hash for tags in different order', () => {
    const note1 = createTestNote({ tags: ['alpha', 'beta', 'gamma'] });
    const note2 = createTestNote({ tags: ['gamma', 'alpha', 'beta'] });
    // Array order IS meaningful - different order = different hash
    expect(computeContentHash(note1)).not.toBe(computeContentHash(note2));
  });

  it('returns different hash for different metadata', () => {
    const metadata1: NoteMetadata = { title: null, tags: ['inline-tag'], links: [], mentions: [] };
    const metadata2: NoteMetadata = { title: null, tags: [], links: [], mentions: [] };
    const note1 = createTestNote({ metadata: metadata1 });
    const note2 = createTestNote({ metadata: metadata2 });
    expect(computeContentHash(note1)).not.toBe(computeContentHash(note2));
  });

  it('ignores id changes', () => {
    const note1 = createTestNote({ id: 'id-1' as NoteId });
    const note2 = createTestNote({ id: 'id-2' as NoteId });
    expect(computeContentHash(note1)).toBe(computeContentHash(note2));
  });

  it('ignores createdAt changes', () => {
    const note1 = createTestNote({ createdAt: 1000 });
    const note2 = createTestNote({ createdAt: 2000 });
    expect(computeContentHash(note1)).toBe(computeContentHash(note2));
  });

  it('ignores updatedAt changes', () => {
    const note1 = createTestNote({ updatedAt: 1000 });
    const note2 = createTestNote({ updatedAt: 2000 });
    expect(computeContentHash(note1)).toBe(computeContentHash(note2));
  });

  it('ignores sync metadata changes', () => {
    const note1 = createTestNote({ sync: { version: 1, contentHash: 'abc' } });
    const note2 = createTestNote({ sync: { version: 2, contentHash: 'def' } });
    expect(computeContentHash(note1)).toBe(computeContentHash(note2));
  });

  it('is deterministic across multiple calls', () => {
    const note = createTestNote();
    const hash1 = computeContentHash(note);
    const hash2 = computeContentHash(note);
    const hash3 = computeContentHash(note);
    expect(hash1).toBe(hash2);
    expect(hash2).toBe(hash3);
  });

  it('handles empty content', () => {
    const note = createTestNote({
      title: '',
      content: createEmptyEditorContent(),
      tags: [],
      metadata: { title: null, tags: [], links: [], mentions: [] },
    });
    const hash = computeContentHash(note);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });

  it('handles complex nested content', () => {
    const complexContent: EditorContent = {
      root: {
        type: 'root',
        children: [
          { type: 'paragraph', children: [{ type: 'text', text: 'Hello' }] },
          { type: 'heading', attrs: { level: 1 }, children: [{ type: 'text', text: 'Title' }] },
          {
            type: 'list',
            children: [{ type: 'listItem', children: [{ type: 'text', text: 'Item' }] }],
          },
        ],
      },
    };
    const note = createTestNote({ content: complexContent });
    const hash = computeContentHash(note);
    expect(hash).toMatch(/^[a-f0-9]{16}$/);
  });
});

describe('hasContentChanged', () => {
  it('returns false for identical notes', () => {
    const note1 = createTestNote();
    const note2 = createTestNote();
    expect(hasContentChanged(note1, note2)).toBe(false);
  });

  it('returns true when title changes', () => {
    const note1 = createTestNote({ title: 'Original' });
    const note2 = createTestNote({ title: 'Modified' });
    expect(hasContentChanged(note1, note2)).toBe(true);
  });

  it('returns true when content changes', () => {
    const note1 = createTestNote({ content: createEditorContent('Original') });
    const note2 = createTestNote({ content: createEditorContent('Modified') });
    expect(hasContentChanged(note1, note2)).toBe(true);
  });

  it('returns true when tags change', () => {
    const note1 = createTestNote({ tags: ['tag1', 'tag2'] });
    const note2 = createTestNote({ tags: ['tag1', 'tag3'] });
    expect(hasContentChanged(note1, note2)).toBe(true);
  });

  it('returns false when only excluded fields change', () => {
    const note1 = createTestNote({
      id: 'id-1' as NoteId,
      createdAt: 1000,
      updatedAt: 2000,
      sync: { version: 1, contentHash: 'old' },
    });
    const note2 = createTestNote({
      id: 'id-2' as NoteId,
      createdAt: 3000,
      updatedAt: 4000,
      sync: { version: 2, contentHash: 'new' },
    });
    expect(hasContentChanged(note1, note2)).toBe(false);
  });
});

describe('matchesHash', () => {
  it('returns true when hash matches', () => {
    const note = createTestNote();
    const hash = computeContentHash(note);
    expect(matchesHash(note, hash)).toBe(true);
  });

  it('returns false when hash does not match', () => {
    const note = createTestNote();
    expect(matchesHash(note, '0000000000000000')).toBe(false);
  });

  it('returns false after content modification', () => {
    const note1 = createTestNote({ title: 'Original' });
    const originalHash = computeContentHash(note1);

    const note2 = createTestNote({ title: 'Modified' });
    expect(matchesHash(note2, originalHash)).toBe(false);
  });

  it('returns true for equivalent notes with same hash', () => {
    const note1 = createTestNote();
    const hash = computeContentHash(note1);

    // Create an identical note (same content)
    const note2 = createTestNote();
    expect(matchesHash(note2, hash)).toBe(true);
  });
});
