/**
 * Outline Widget Integration Tests
 *
 * Tests the complete flow from outline widget interaction to editor navigation.
 * Verifies integration between:
 * - OutlineWidget (extracts headings from note content)
 * - EditorCommandContext (provides focusNode function)
 * - FocusNodePlugin (handles FOCUS_NODE_COMMAND for scrolling/focus)
 *
 * Unit tests for individual components:
 * - OutlineWidget.test.tsx - Component rendering and interaction
 * - FocusNodePlugin.test.tsx - Command handling and node lookup
 * - EditorCommandContext.test.tsx - Context and provider
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { FileSystemVault } from '@scribe/storage-fs';
import { extractHeadings } from '@scribe/shared';
import type { EditorContent, Note } from '@scribe/shared';
import { type TestContext, setupTestContext, cleanupTestContext } from './test-helpers';

describe('Outline Integration Tests', () => {
  let ctx: TestContext;
  let vault: FileSystemVault;

  beforeEach(async () => {
    ctx = await setupTestContext('scribe-outline-test');
    vault = ctx.vault;
  });

  afterEach(async () => {
    await cleanupTestContext(ctx);
  });

  /**
   * Helper to create note content with headings
   */
  function createContentWithHeadings(
    headings: Array<{ tag: string; text: string; key?: string }>
  ): EditorContent {
    const children = headings.map((h, index) => ({
      type: 'heading',
      tag: h.tag,
      __key: h.key || `heading-key-${index}`,
      direction: null,
      format: '',
      indent: 0,
      version: 1,
      children: [
        { type: 'text', text: h.text, format: 0, style: '', mode: 'normal', detail: 0, version: 1 },
      ],
    }));

    return {
      root: {
        type: 'root',
        children,
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      },
    };
  }

  describe('Heading Extraction from Notes', () => {
    it('should extract headings from note content', async () => {
      const content = createContentWithHeadings([
        { tag: 'h1', text: 'Main Title', key: 'h1-key' },
        { tag: 'h2', text: 'Section One', key: 'h2-key-1' },
        { tag: 'h3', text: 'Subsection', key: 'h3-key' },
        { tag: 'h2', text: 'Section Two', key: 'h2-key-2' },
      ]);

      const note = await vault.create({ title: 'Test Note', content });

      // Extract headings using the same function OutlineWidget uses
      const headings = extractHeadings(note.content);

      expect(headings).toHaveLength(4);
      expect(headings[0].text).toBe('Main Title');
      expect(headings[0].level).toBe(1);
      expect(headings[0].nodeKey).toBe('h1-key');

      expect(headings[1].text).toBe('Section One');
      expect(headings[1].level).toBe(2);

      expect(headings[2].text).toBe('Subsection');
      expect(headings[2].level).toBe(3);

      expect(headings[3].text).toBe('Section Two');
      expect(headings[3].level).toBe(2);
    });

    it('should calculate correct depth (relative indentation)', async () => {
      // Start with h2, so it becomes depth 0
      const content = createContentWithHeadings([
        { tag: 'h2', text: 'First H2', key: 'h2-1' },
        { tag: 'h3', text: 'Nested H3', key: 'h3-1' },
        { tag: 'h4', text: 'Deeply Nested', key: 'h4-1' },
      ]);

      const note = await vault.create({ title: 'Depth Test', content });
      const headings = extractHeadings(note.content);

      // Depth is relative to minimum level found
      expect(headings[0].depth).toBe(0); // h2 is minimum, so depth 0
      expect(headings[1].depth).toBe(1); // h3 is min+1
      expect(headings[2].depth).toBe(2); // h4 is min+2
    });

    it('should generate textHash for each heading', async () => {
      const content = createContentWithHeadings([
        { tag: 'h1', text: 'Introduction', key: 'intro-key' },
        { tag: 'h1', text: 'Introduction', key: 'intro-key-2' }, // Duplicate text
      ]);

      const note = await vault.create({ title: 'Hash Test', content });
      const headings = extractHeadings(note.content);

      // Both headings have textHash
      expect(headings[0].textHash).toBeDefined();
      expect(headings[1].textHash).toBeDefined();

      // Same text = same hash (used as fallback for node lookup)
      expect(headings[0].textHash).toBe(headings[1].textHash);
    });

    it('should handle empty notes gracefully', async () => {
      const emptyContent: EditorContent = {
        root: {
          type: 'root',
          children: [],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      };

      const note = await vault.create({ title: 'Empty Note', content: emptyContent });
      const headings = extractHeadings(note.content);

      expect(headings).toHaveLength(0);
    });

    it('should handle notes with only paragraphs (no headings)', async () => {
      const paragraphContent: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'paragraph',
              direction: null,
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'text',
                  text: 'Just a paragraph',
                  format: 0,
                  style: '',
                  mode: 'normal',
                  detail: 0,
                  version: 1,
                },
              ],
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      };

      const note = await vault.create({ title: 'Paragraph Note', content: paragraphContent });
      const headings = extractHeadings(note.content);

      expect(headings).toHaveLength(0);
    });
  });

  describe('Outline Navigation Data', () => {
    it('should provide nodeKey for primary navigation', async () => {
      const content = createContentWithHeadings([
        { tag: 'h1', text: 'Navigate Here', key: 'target-key' },
      ]);

      const note = await vault.create({ title: 'Navigation Test', content });
      const headings = extractHeadings(note.content);

      // The heading should have the nodeKey for FocusNodePlugin
      const heading = headings[0];
      expect(heading.nodeKey).toBe('target-key');

      // This nodeKey is what EditorCommandContext.focusNode() passes to FOCUS_NODE_COMMAND
      // See FocusNodePlugin.test.tsx for verification of command handling
    });

    it('should provide lineIndex as fallback', async () => {
      const content = createContentWithHeadings([
        { tag: 'h1', text: 'First' },
        { tag: 'h2', text: 'Second' },
        { tag: 'h3', text: 'Third' },
      ]);

      const note = await vault.create({ title: 'Index Test', content });
      const headings = extractHeadings(note.content);

      // lineIndex provides positional fallback for navigation
      expect(headings[0].lineIndex).toBe(0);
      expect(headings[1].lineIndex).toBe(1);
      expect(headings[2].lineIndex).toBe(2);
    });
  });

  describe('Note Persistence with Headings', () => {
    it('should persist headings across save/load cycle', async () => {
      const content = createContentWithHeadings([
        { tag: 'h1', text: 'Persistent Heading', key: 'persist-key' },
        { tag: 'h2', text: 'Sub Heading', key: 'sub-key' },
      ]);

      const note = await vault.create({ title: 'Persist Test', content });
      const noteId = note.id;

      // Reload from vault (simulating app restart)
      const loaded = vault.read(noteId);
      expect(loaded).toBeDefined();

      const headings = extractHeadings(loaded!.content);

      expect(headings).toHaveLength(2);
      expect(headings[0].text).toBe('Persistent Heading');
      expect(headings[0].nodeKey).toBe('persist-key');
      expect(headings[1].text).toBe('Sub Heading');
    });

    it('should update headings when note content changes', async () => {
      // Initial content
      const initialContent = createContentWithHeadings([
        { tag: 'h1', text: 'Original Title', key: 'orig-key' },
      ]);

      const note = await vault.create({ title: 'Update Test', content: initialContent });
      const noteId = note.id;

      // Verify initial
      let headings = extractHeadings(note.content);
      expect(headings[0].text).toBe('Original Title');

      // Update content
      const updatedContent = createContentWithHeadings([
        { tag: 'h1', text: 'Updated Title', key: 'new-key' },
        { tag: 'h2', text: 'New Section', key: 'section-key' },
      ]);

      const loaded = vault.read(noteId);
      loaded!.content = updatedContent;
      await vault.save(loaded!);

      // Verify updated
      const reloaded = vault.read(noteId);
      headings = extractHeadings(reloaded!.content);

      expect(headings).toHaveLength(2);
      expect(headings[0].text).toBe('Updated Title');
      expect(headings[1].text).toBe('New Section');
    });
  });

  describe('Edge Cases', () => {
    it('should handle heading with empty text', async () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'heading',
              tag: 'h1',
              __key: 'empty-heading',
              direction: null,
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'text',
                  text: '',
                  format: 0,
                  style: '',
                  mode: 'normal',
                  detail: 0,
                  version: 1,
                },
              ],
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      };

      const note = await vault.create({ title: 'Empty Heading', content });
      const headings = extractHeadings(note.content);

      expect(headings).toHaveLength(1);
      expect(headings[0].text).toBe('');
      expect(headings[0].nodeKey).toBe('empty-heading');
    });

    it('should handle heading with whitespace-only text', async () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'heading',
              tag: 'h1',
              __key: 'ws-heading',
              direction: null,
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'text',
                  text: '   ',
                  format: 0,
                  style: '',
                  mode: 'normal',
                  detail: 0,
                  version: 1,
                },
              ],
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      };

      const note = await vault.create({ title: 'Whitespace Heading', content });
      const headings = extractHeadings(note.content);

      expect(headings).toHaveLength(1);
      // Text is preserved (OutlineWidget trims for display)
      expect(headings[0].text).toBe('   ');
    });

    it('should handle all heading levels (h1-h6)', async () => {
      const content = createContentWithHeadings([
        { tag: 'h1', text: 'H1' },
        { tag: 'h2', text: 'H2' },
        { tag: 'h3', text: 'H3' },
        { tag: 'h4', text: 'H4' },
        { tag: 'h5', text: 'H5' },
        { tag: 'h6', text: 'H6' },
      ]);

      const note = await vault.create({ title: 'All Levels', content });
      const headings = extractHeadings(note.content);

      expect(headings).toHaveLength(6);
      expect(headings[0].level).toBe(1);
      expect(headings[5].level).toBe(6);
    });

    it('should handle mixed content (headings and paragraphs)', async () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            {
              type: 'heading',
              tag: 'h1',
              __key: 'h1-key',
              direction: null,
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'text',
                  text: 'Title',
                  format: 0,
                  style: '',
                  mode: 'normal',
                  detail: 0,
                  version: 1,
                },
              ],
            },
            {
              type: 'paragraph',
              direction: null,
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'text',
                  text: 'Paragraph text',
                  format: 0,
                  style: '',
                  mode: 'normal',
                  detail: 0,
                  version: 1,
                },
              ],
            },
            {
              type: 'heading',
              tag: 'h2',
              __key: 'h2-key',
              direction: null,
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'text',
                  text: 'Section',
                  format: 0,
                  style: '',
                  mode: 'normal',
                  detail: 0,
                  version: 1,
                },
              ],
            },
            {
              type: 'paragraph',
              direction: null,
              format: '',
              indent: 0,
              version: 1,
              children: [
                {
                  type: 'text',
                  text: 'More text',
                  format: 0,
                  style: '',
                  mode: 'normal',
                  detail: 0,
                  version: 1,
                },
              ],
            },
          ],
          direction: null,
          format: '',
          indent: 0,
          version: 1,
        },
      };

      const note = await vault.create({ title: 'Mixed Content', content });
      const headings = extractHeadings(note.content);

      // Should only extract headings, not paragraphs
      expect(headings).toHaveLength(2);
      expect(headings[0].text).toBe('Title');
      expect(headings[1].text).toBe('Section');
    });
  });
});
