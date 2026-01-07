/**
 * Tests for block-converters module
 *
 * This file provides targeted tests for edge cases and branches not covered
 * by the comprehensive content-extractor.test.ts integration tests.
 *
 * The content-extractor tests already provide extensive coverage of the happy paths
 * for headings, paragraphs, lists, quotes, code blocks, and tables.
 * These tests focus on gap-filling for branch coverage.
 */

import { describe, it, expect } from 'vitest';
import {
  convertBlockNode,
  convertContentToMarkdown,
  convertHeading,
  convertImage,
  convertList,
  convertListItem,
  convertTable,
  extractCodeContent,
  extractTableRow,
  type ListContext,
} from './block-converters.js';
import type { LexicalNode } from './inline-converters.js';
import type { Note, EditorContent } from './types.js';

describe('block-converters', () => {
  describe('convertContentToMarkdown', () => {
    it('returns empty string for null content', () => {
      const result = convertContentToMarkdown(null as unknown as Note['content']);
      expect(result).toBe('');
    });

    it('returns empty string for undefined content', () => {
      const result = convertContentToMarkdown(undefined as unknown as Note['content']);
      expect(result).toBe('');
    });

    it('returns empty string for content with null root', () => {
      const content = { root: null } as unknown as EditorContent;
      const result = convertContentToMarkdown(content);
      expect(result).toBe('');
    });

    it('returns empty string for content with empty children', () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [],
        },
      };
      const result = convertContentToMarkdown(content);
      expect(result).toBe('');
    });

    it('joins multiple blocks with double newlines', () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            { type: 'paragraph', children: [{ type: 'text', text: 'First' }] },
            { type: 'paragraph', children: [{ type: 'text', text: 'Second' }] },
          ],
        },
      };
      const result = convertContentToMarkdown(content);
      expect(result).toBe('First\n\nSecond');
    });

    it('skips null block conversions', () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          children: [
            { type: 'paragraph', children: [{ type: 'text', text: 'Valid' }] },
            { type: 'unknown-type-no-children' }, // Will return null
            { type: 'paragraph', children: [{ type: 'text', text: 'Also valid' }] },
          ],
        },
      };
      const result = convertContentToMarkdown(content);
      expect(result).toBe('Valid\n\nAlso valid');
    });
  });

  describe('convertBlockNode', () => {
    describe('standalone listitem (edge case)', () => {
      it('handles standalone list item gracefully', () => {
        const node = {
          type: 'listitem',
          children: [{ type: 'text', text: 'Item text' }],
        };
        const result = convertBlockNode(node);
        expect(result).toBe('- Item text');
      });

      it('handles standalone checked list item', () => {
        const node = {
          type: 'listitem',
          checked: true,
          children: [{ type: 'text', text: 'Checked item' }],
        };
        const result = convertBlockNode(node);
        expect(result).toBe('- [x] Checked item');
      });
    });

    describe('unknown block types with children', () => {
      it('extracts inline content from unknown block type with children', () => {
        const node = {
          type: 'custom-block',
          children: [{ type: 'text', text: 'Custom content' }],
        };
        const result = convertBlockNode(node);
        expect(result).toBe('Custom content');
      });

      it('returns null for unknown block with empty text children', () => {
        const node = {
          type: 'custom-block',
          children: [{ type: 'text', text: '' }],
        };
        const result = convertBlockNode(node);
        // extractInlineContent returns empty string, which is falsy, so returns null
        expect(result).toBeNull();
      });
    });

    describe('unknown block types without children', () => {
      it('returns null for unknown block type without children', () => {
        const node = {
          type: 'custom-block-no-children',
        };
        const result = convertBlockNode(node);
        expect(result).toBeNull();
      });
    });
  });

  describe('convertHeading', () => {
    it('defaults to h1 when tag is missing', () => {
      const node = {
        type: 'heading',
        children: [{ type: 'text', text: 'No tag' }],
      };
      const result = convertHeading(node);
      expect(result).toBe('# No tag');
    });

    it('clamps heading level to minimum 1', () => {
      const node = {
        type: 'heading',
        tag: 'h0', // Invalid, should clamp to 1
        children: [{ type: 'text', text: 'Clamped' }],
      };
      const result = convertHeading(node);
      expect(result).toBe('# Clamped');
    });

    it('clamps heading level to maximum 6', () => {
      const node = {
        type: 'heading',
        tag: 'h9', // Invalid, should clamp to 6
        children: [{ type: 'text', text: 'Clamped' }],
      };
      const result = convertHeading(node);
      expect(result).toBe('###### Clamped');
    });
  });

  describe('convertList', () => {
    it('returns empty string for list with no children', () => {
      const node = { type: 'list', children: [] };
      const context: ListContext = { depth: 0, orderedCounters: new Map() };
      const result = convertList(node, context);
      expect(result).toBe('');
    });

    it('returns empty string for list with undefined children', () => {
      const node = { type: 'list' };
      const context: ListContext = { depth: 0, orderedCounters: new Map() };
      const result = convertList(node, context);
      expect(result).toBe('');
    });

    it('handles ordered list counter reset', () => {
      const node = {
        type: 'list',
        listType: 'number' as const,
        children: [
          { type: 'listitem', children: [{ type: 'text', text: 'First' }] },
          { type: 'listitem', children: [{ type: 'text', text: 'Second' }] },
        ],
      };
      const context: ListContext = { depth: 0, orderedCounters: new Map() };
      const result = convertList(node, context);
      expect(result).toBe('1. First\n2. Second');
    });

    it('skips non-listitem children', () => {
      const node = {
        type: 'list',
        children: [
          { type: 'listitem', children: [{ type: 'text', text: 'Item' }] },
          { type: 'paragraph', children: [{ type: 'text', text: 'Not an item' }] },
        ],
      };
      const context: ListContext = { depth: 0, orderedCounters: new Map() };
      const result = convertList(node, context);
      expect(result).toBe('- Item');
    });
  });

  describe('convertListItem', () => {
    it('handles checklist with unchecked item', () => {
      const node = {
        type: 'listitem',
        checked: false,
        children: [{ type: 'text', text: 'Todo' }],
      };
      const context: ListContext = { depth: 0, orderedCounters: new Map() };
      const result = convertListItem(node, context, 'check');
      expect(result).toBe('- [ ] Todo');
    });

    it('handles checklist with checked item', () => {
      const node = {
        type: 'listitem',
        checked: true,
        children: [{ type: 'text', text: 'Done' }],
      };
      const context: ListContext = { depth: 0, orderedCounters: new Map() };
      const result = convertListItem(node, context, 'check');
      expect(result).toBe('- [x] Done');
    });

    it('handles nested list within list item', () => {
      const node: LexicalNode = {
        type: 'listitem',
        children: [
          { type: 'text', text: 'Parent' },
          {
            type: 'list',
            listType: 'bullet',
            children: [{ type: 'listitem', children: [{ type: 'text', text: 'Child' }] }],
          },
        ],
      };
      const context: ListContext = { depth: 0, orderedCounters: new Map() };
      const result = convertListItem(node, context, 'bullet');
      expect(result).toBe('- Parent\n  - Child');
    });

    it('handles indentation at different depths', () => {
      const node = {
        type: 'listitem',
        children: [{ type: 'text', text: 'Deep item' }],
      };
      const context: ListContext = { depth: 2, orderedCounters: new Map() };
      const result = convertListItem(node, context, 'bullet');
      expect(result).toBe('    - Deep item');
    });
  });

  describe('extractCodeContent', () => {
    it('returns text property when node has no children', () => {
      const node = {
        type: 'code',
        text: 'console.log("hello")',
      };
      const result = extractCodeContent(node);
      expect(result).toBe('console.log("hello")');
    });

    it('returns empty string when node has no children and no text', () => {
      const node = { type: 'code' };
      const result = extractCodeContent(node);
      expect(result).toBe('');
    });

    it('handles code-highlight nodes', () => {
      const node = {
        type: 'code',
        children: [
          { type: 'code-highlight', text: 'const ' },
          { type: 'code-highlight', text: 'x = 1' },
        ],
      };
      const result = extractCodeContent(node);
      expect(result).toBe('const x = 1');
    });

    it('handles linebreak nodes', () => {
      const node = {
        type: 'code',
        children: [
          { type: 'text', text: 'line1' },
          { type: 'linebreak' },
          { type: 'text', text: 'line2' },
        ],
      };
      const result = extractCodeContent(node);
      expect(result).toBe('line1\nline2');
    });

    it('recursively extracts nested content', () => {
      const node = {
        type: 'code',
        children: [
          {
            type: 'container',
            children: [{ type: 'text', text: 'nested content' }],
          },
        ],
      };
      const result = extractCodeContent(node);
      expect(result).toBe('nested content');
    });

    it('handles empty text in children', () => {
      const node = {
        type: 'code',
        children: [{ type: 'text', text: '' }],
      };
      const result = extractCodeContent(node);
      expect(result).toBe('');
    });
  });

  describe('convertTable', () => {
    it('returns empty string for table with no children', () => {
      const node = { type: 'table', children: [] };
      const result = convertTable(node);
      expect(result).toBe('');
    });

    it('returns empty string for table with undefined children', () => {
      const node = { type: 'table' };
      const result = convertTable(node);
      expect(result).toBe('');
    });

    it('returns empty string when no tablerow children exist', () => {
      const node = {
        type: 'table',
        children: [{ type: 'paragraph', children: [{ type: 'text', text: 'not a row' }] }],
      };
      const result = convertTable(node);
      expect(result).toBe('');
    });

    it('pads rows with fewer cells than header', () => {
      const node = {
        type: 'table',
        children: [
          {
            type: 'tablerow',
            children: [
              { type: 'tablecell', children: [{ type: 'text', text: 'Col1' }] },
              { type: 'tablecell', children: [{ type: 'text', text: 'Col2' }] },
              { type: 'tablecell', children: [{ type: 'text', text: 'Col3' }] },
            ],
          },
          {
            type: 'tablerow',
            children: [
              { type: 'tablecell', children: [{ type: 'text', text: 'A' }] },
              // Missing Col2 and Col3 cells
            ],
          },
        ],
      };
      const result = convertTable(node);
      expect(result).toBe('| Col1 | Col2 | Col3 |\n| --- | --- | --- |\n| A |  |  |');
    });
  });

  describe('extractTableRow', () => {
    it('returns empty array for row with no children', () => {
      const node = { type: 'tablerow' };
      const result = extractTableRow(node);
      expect(result).toEqual([]);
    });

    it('skips non-tablecell children', () => {
      const node = {
        type: 'tablerow',
        children: [
          { type: 'tablecell', children: [{ type: 'text', text: 'Valid' }] },
          { type: 'paragraph', children: [{ type: 'text', text: 'Invalid' }] },
        ],
      };
      const result = extractTableRow(node);
      expect(result).toEqual(['Valid']);
    });
  });

  describe('convertImage', () => {
    it('converts image node to markdown syntax', () => {
      const node = {
        type: 'image',
        assetId: 'abc123',
        alt: 'A beautiful sunset',
        ext: 'jpg',
      };
      const result = convertImage(node);
      expect(result).toBe('![A beautiful sunset](./assets/abc123.jpg)');
    });

    it('handles empty alt text', () => {
      const node = {
        type: 'image',
        assetId: 'img456',
        alt: '',
        ext: 'png',
      };
      const result = convertImage(node);
      expect(result).toBe('![](./assets/img456.png)');
    });

    it('escapes brackets in alt text', () => {
      const node = {
        type: 'image',
        assetId: 'xyz789',
        alt: 'Image with [brackets] in text',
        ext: 'webp',
      };
      const result = convertImage(node);
      expect(result).toBe('![Image with \\[brackets\\] in text](./assets/xyz789.webp)');
    });

    it('handles missing alt text (undefined)', () => {
      const node = {
        type: 'image',
        assetId: 'noalt',
        ext: 'gif',
      };
      const result = convertImage(node);
      expect(result).toBe('![](./assets/noalt.gif)');
    });

    it('defaults to png extension when ext is missing', () => {
      const node = {
        type: 'image',
        assetId: 'noext',
        alt: 'No extension',
      };
      const result = convertImage(node);
      expect(result).toBe('![No extension](./assets/noext.png)');
    });

    it('is called correctly via convertBlockNode', () => {
      const node = {
        type: 'image',
        assetId: 'block123',
        alt: 'Test image',
        ext: 'jpeg',
      };
      const result = convertBlockNode(node);
      expect(result).toBe('![Test image](./assets/block123.jpeg)');
    });
  });
});
