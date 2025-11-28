/**
 * Integration tests for metadata extraction in save/load pipeline
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileSystemVault } from './storage.js';
import type { LexicalState } from '@scribe/shared';

describe('Metadata Integration', () => {
  let tempDir: string;
  let vault: FileSystemVault;

  beforeEach(async () => {
    // Create temporary test directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'scribe-test-'));
    await fs.mkdir(path.join(tempDir, 'notes'), { recursive: true });
    vault = new FileSystemVault(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Save Pipeline', () => {
    it('should extract and save metadata on note creation', async () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'My Note Title with #scribe tag',
                },
              ],
            },
          ],
        },
      };

      const note = await vault.create({ content });

      // Verify metadata was extracted
      expect(note.metadata.title).toBe('My Note Title with #scribe tag');
      expect(note.metadata.tags).toEqual(['scribe']);
      expect(note.metadata.links).toEqual([]);

      // Verify metadata is persisted to disk
      const savedNote = vault.read(note.id);
      expect(savedNote?.metadata).toEqual(note.metadata);
    });

    it('should update metadata when content changes', async () => {
      // Create note with initial content
      const initialContent: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Initial title with #initial',
                },
              ],
            },
          ],
        },
      };

      const note = await vault.create({ content: initialContent });
      expect(note.metadata.tags).toEqual(['initial']);

      // Update note with new content
      const updatedContent: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Updated title with #updated tag',
                },
              ],
            },
          ],
        },
      };

      await vault.save({
        ...note,
        content: updatedContent,
      });

      // Verify metadata was updated
      const updatedNote = vault.read(note.id);
      expect(updatedNote?.metadata.title).toBe('Updated title with #updated tag');
      expect(updatedNote?.metadata.tags).toEqual(['updated']);
    });

    it('should extract links from content', async () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Note with link',
                },
              ],
            },
            {
              type: 'paragraph',
              children: [
                {
                  type: 'link',
                  url: 'note://linked-note-id',
                  children: [
                    {
                      type: 'text',
                      text: 'Link to another note',
                    },
                  ],
                },
              ],
            },
          ],
        },
      };

      const note = await vault.create({ content });

      expect(note.metadata.links).toEqual(['linked-note-id']);
    });

    it('should handle multiple tags in content', async () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Note with #architecture and #design tags',
                },
              ],
            },
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Also has #scribe tag',
                },
              ],
            },
          ],
        },
      };

      const note = await vault.create({ content });

      expect(note.metadata.tags.sort()).toEqual(['architecture', 'design', 'scribe']);
    });
  });

  describe('Load Pipeline', () => {
    it('should re-extract metadata when loading notes', async () => {
      // Create a note
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Test note with #test tag',
                },
              ],
            },
          ],
        },
      };

      const note = await vault.create({ content });

      // Create a new vault instance to test loading
      const vault2 = new FileSystemVault(tempDir);
      await vault2.load();

      // Verify metadata was re-extracted on load
      const loadedNote = vault2.read(note.id);
      expect(loadedNote?.metadata.title).toBe('Test note with #test tag');
      expect(loadedNote?.metadata.tags).toEqual(['test']);
    });

    it('should handle notes with empty content on load', async () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [],
        },
      };

      const note = await vault.create({ content });

      // Create a new vault instance to test loading
      const vault2 = new FileSystemVault(tempDir);
      await vault2.load();

      // Verify metadata extraction handled empty content
      const loadedNote = vault2.read(note.id);
      expect(loadedNote?.metadata.title).toBeNull();
      expect(loadedNote?.metadata.tags).toEqual([]);
      expect(loadedNote?.metadata.links).toEqual([]);
    });

    it('should persist complete metadata across app restart', async () => {
      // Create a note with comprehensive metadata: title, tags, and links
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'Architecture Decision with #scribe and #architecture tags',
                },
              ],
            },
            {
              type: 'paragraph',
              children: [
                {
                  type: 'link',
                  url: 'note://decision-1',
                  children: [
                    {
                      type: 'text',
                      text: 'Related decision',
                    },
                  ],
                },
              ],
            },
            {
              type: 'paragraph',
              children: [
                {
                  type: 'text',
                  text: 'See also #design',
                },
              ],
            },
          ],
        },
      };

      // Create note in first vault instance
      const note = await vault.create({ content });
      const originalMetadata = note.metadata;

      // Verify initial metadata
      expect(originalMetadata.title).toBe(
        'Architecture Decision with #scribe and #architecture tags'
      );
      expect(originalMetadata.tags.sort()).toEqual(['architecture', 'design', 'scribe']);
      expect(originalMetadata.links).toEqual(['decision-1']);

      // Simulate app restart by creating new vault instance
      const vault2 = new FileSystemVault(tempDir);
      const loadedCount = await vault2.load();
      expect(loadedCount).toBe(1);

      // Verify all metadata persisted correctly after restart
      const reloadedNote = vault2.read(note.id);
      expect(reloadedNote).toBeDefined();
      expect(reloadedNote?.metadata.title).toBe(originalMetadata.title);
      expect(reloadedNote?.metadata.tags).toEqual(originalMetadata.tags);
      expect(reloadedNote?.metadata.links).toEqual(originalMetadata.links);
    });
  });
});
