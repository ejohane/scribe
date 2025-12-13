/**
 * Integration tests for metadata extraction in save/load pipeline
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { FileSystemVault } from './storage.js';
import { createVaultPath, type VaultPath, type LexicalState } from '@scribe/shared';

describe('Metadata Integration', () => {
  let tempDirStr: string;
  let tempDir: VaultPath;
  let vault: FileSystemVault;

  beforeEach(async () => {
    // Create temporary test directory
    tempDirStr = await fs.mkdtemp(path.join(os.tmpdir(), 'scribe-test-'));
    tempDir = createVaultPath(tempDirStr);
    await fs.mkdir(path.join(tempDirStr, 'notes'), { recursive: true });
    vault = new FileSystemVault(tempDir);
  });

  afterEach(async () => {
    // Clean up temporary directory
    await fs.rm(tempDirStr, { recursive: true, force: true });
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

      const note = await vault.create({ content, title: 'My Note Title with #scribe tag' });

      // Verify title is set on note.title (metadata.title is always null)
      expect(note.title).toBe('My Note Title with #scribe tag');
      expect(note.metadata.title).toBeNull(); // metadata.title is deprecated
      expect(note.metadata.tags).toEqual(['scribe']);
      expect(note.metadata.links).toEqual([]);

      // Verify metadata is persisted to disk
      const savedNote = vault.read(note.id);
      expect(savedNote?.metadata).toEqual(note.metadata);
    });

    it('should update metadata when content changes', async () => {
      // Create note with initial content and title
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

      const note = await vault.create({ content: initialContent, title: 'Initial title' });
      expect(note.metadata.tags).toEqual(['initial']);

      // Update note with new content and title
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
        title: 'Updated title with #updated tag',
        content: updatedContent,
      });

      // Verify metadata was updated (title on note.title, metadata.title always null)
      const updatedNote = vault.read(note.id);
      expect(updatedNote?.title).toBe('Updated title with #updated tag');
      expect(updatedNote?.metadata.title).toBeNull(); // metadata.title is deprecated
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
      // Create a note with explicit title
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

      const note = await vault.create({ content, title: 'Test note with #test tag' });

      // Create a new vault instance to test loading
      const vault2 = new FileSystemVault(tempDir);
      await vault2.load();

      // Verify note.title persists and metadata.title is null
      const loadedNote = vault2.read(note.id);
      expect(loadedNote?.title).toBe('Test note with #test tag');
      expect(loadedNote?.metadata.title).toBeNull(); // metadata.title is deprecated
      expect(loadedNote?.metadata.tags).toEqual(['test']);
    });

    it('should handle notes with empty content on load', async () => {
      const content: LexicalState = {
        root: {
          type: 'root',
          children: [],
        },
      };

      // Note without explicit title defaults to 'Untitled'
      const note = await vault.create({ content });

      // Create a new vault instance to test loading
      const vault2 = new FileSystemVault(tempDir);
      await vault2.load();

      // Verify title defaults to 'Untitled' and metadata.title is null
      const loadedNote = vault2.read(note.id);
      expect(loadedNote?.title).toBe('Untitled'); // Default title for empty notes
      expect(loadedNote?.metadata.title).toBeNull(); // metadata.title is always null
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

      // Create note in first vault instance with explicit title
      const note = await vault.create({
        content,
        title: 'Architecture Decision with #scribe and #architecture tags',
      });
      const originalMetadata = note.metadata;

      // Verify initial metadata (title is on note.title, not metadata.title)
      expect(note.title).toBe('Architecture Decision with #scribe and #architecture tags');
      expect(originalMetadata.title).toBeNull(); // metadata.title is deprecated
      expect(originalMetadata.tags.sort()).toEqual(['architecture', 'design', 'scribe']);
      expect(originalMetadata.links).toEqual(['decision-1']);

      // Simulate app restart by creating new vault instance
      const vault2 = new FileSystemVault(tempDir);
      const loadedCount = await vault2.load();
      expect(loadedCount).toBe(1);

      // Verify all metadata persisted correctly after restart
      const reloadedNote = vault2.read(note.id);
      expect(reloadedNote).toBeDefined();
      expect(reloadedNote?.title).toBe(note.title); // title is on note.title
      expect(reloadedNote?.metadata.title).toBeNull(); // metadata.title is deprecated
      expect(reloadedNote?.metadata.tags).toEqual(originalMetadata.tags);
      expect(reloadedNote?.metadata.links).toEqual(originalMetadata.links);
    });
  });
});
