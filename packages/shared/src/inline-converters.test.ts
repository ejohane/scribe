/**
 * Tests for inline-converters module
 *
 * This file provides targeted tests for edge cases and branches not covered
 * by the comprehensive content-extractor.test.ts integration tests.
 *
 * The content-extractor tests already provide extensive coverage of the happy paths
 * for text formatting, links, wiki-links, and mentions.
 * These tests focus on gap-filling for branch coverage.
 */

import { describe, it, expect } from 'vitest';
import {
  extractInlineContent,
  extractInlineContentRaw,
  formatTextNode,
  formatTextNodeRaw,
  type LexicalNode,
  type InlineContext,
  DEFAULT_INLINE_CONTEXT,
} from './inline-converters.js';
import { TEXT_FORMAT } from './markdown-escaper.js';

describe('inline-converters', () => {
  describe('extractInlineContent', () => {
    it('returns text property when node has no children', () => {
      const node: LexicalNode = {
        type: 'text',
        text: 'Hello world',
      };
      const result = extractInlineContent(node);
      expect(result).toBe('Hello world');
    });

    it('returns empty string when node has no children and no text', () => {
      const node: LexicalNode = { type: 'span' };
      const result = extractInlineContent(node);
      expect(result).toBe('');
    });

    it('handles link node with children', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', text: 'Example' }],
          },
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('[Example](https://example.com)');
    });

    it('handles link node without children', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            text: 'Example',
          },
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('[Example](https://example.com)');
    });

    it('handles link node with empty url', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            children: [{ type: 'text', text: 'Link text' }],
          },
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('[Link text]()');
    });

    it('handles wiki-link with targetTitle', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'wiki-link',
            targetTitle: 'My Note',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('[[My Note]]');
    });

    it('handles wiki-link with noteTitle fallback', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'wiki-link',
            noteTitle: 'Another Note',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('[[Another Note]]');
    });

    it('handles wiki-link with targetId fallback', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'wiki-link',
            targetId: 'note-123',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('[[note-123]]');
    });

    it('handles wiki-link with empty title', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'wiki-link',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('[[]]');
    });

    it('handles person-mention with personName', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'person-mention',
            personName: 'John Doe',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('@John Doe');
    });

    it('handles person-mention with personId fallback', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'person-mention',
            personId: 'user-456',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('@user-456');
    });

    it('handles person-mention with empty name', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'person-mention',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('@');
    });

    it('handles linebreak and resets line start context', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Line 1' },
          { type: 'linebreak' },
          { type: 'text', text: 'Line 2' },
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('Line 1\nLine 2');
    });

    it('handles nested list within inline content (skips it)', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Before ' },
          { type: 'list', children: [{ type: 'listitem', text: 'Item' }] },
          { type: 'text', text: ' After' },
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('Before  After');
    });

    it('recursively extracts from unknown node types', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'custom-inline',
            children: [{ type: 'text', text: 'Nested content' }],
          },
        ],
      };
      const result = extractInlineContent(node);
      expect(result).toBe('Nested content');
    });

    it('respects isInTable context', () => {
      const node: LexicalNode = {
        type: 'tablecell',
        children: [{ type: 'text', text: 'Cell | content' }],
      };
      const context: InlineContext = { isLineStart: false, isInTable: true };
      const result = extractInlineContent(node, context);
      // Pipe should be escaped in table context
      expect(result).toContain('\\|');
    });
  });

  describe('extractInlineContentRaw', () => {
    it('returns text property when node has no children', () => {
      const node: LexicalNode = {
        type: 'text',
        text: 'Raw text',
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('Raw text');
    });

    it('returns empty string when node has no children and no text', () => {
      const node: LexicalNode = { type: 'span' };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('');
    });

    it('handles link node with children', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            children: [{ type: 'text', text: 'Example Link' }],
          },
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('[Example Link](https://example.com)');
    });

    it('handles link node without children', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: 'https://example.com',
            text: 'Link Text',
          },
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('[Link Text](https://example.com)');
    });

    it('handles link node with empty url', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            children: [{ type: 'text', text: 'No URL' }],
          },
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('[No URL]()');
    });

    it('handles wiki-link with targetTitle', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'wiki-link',
            targetTitle: 'Raw Wiki Note',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('[[Raw Wiki Note]]');
    });

    it('handles wiki-link with noteTitle fallback', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'wiki-link',
            noteTitle: 'Fallback Note',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('[[Fallback Note]]');
    });

    it('handles wiki-link with targetId fallback', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'wiki-link',
            targetId: 'id-789',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('[[id-789]]');
    });

    it('handles person-mention with personName', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'person-mention',
            personName: 'Jane Smith',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('@Jane Smith');
    });

    it('handles person-mention with personId fallback', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'person-mention',
            personId: 'person-xyz',
          } as LexicalNode,
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('@person-xyz');
    });

    it('handles linebreak', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'First' },
          { type: 'linebreak' },
          { type: 'text', text: 'Second' },
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('First\nSecond');
    });

    it('handles nested list (skips it)', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          { type: 'text', text: 'Text ' },
          { type: 'list', children: [{ type: 'listitem', text: 'Item' }] },
          { type: 'text', text: ' more' },
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('Text  more');
    });

    it('recursively extracts from unknown node types', () => {
      const node: LexicalNode = {
        type: 'paragraph',
        children: [
          {
            type: 'unknown-node',
            children: [{ type: 'text', text: 'Deep content' }],
          },
        ],
      };
      const result = extractInlineContentRaw(node);
      expect(result).toBe('Deep content');
    });
  });

  describe('formatTextNode', () => {
    it('returns empty string for empty text', () => {
      const node: LexicalNode = { type: 'text', text: '' };
      const result = formatTextNode(node, DEFAULT_INLINE_CONTEXT);
      expect(result).toBe('');
    });

    it('returns empty string for undefined text', () => {
      const node: LexicalNode = { type: 'text' };
      const result = formatTextNode(node, DEFAULT_INLINE_CONTEXT);
      expect(result).toBe('');
    });

    it('escapes text without formatting', () => {
      const node: LexicalNode = { type: 'text', text: '*not bold*' };
      const context: InlineContext = { isLineStart: false, isInTable: false };
      const result = formatTextNode(node, context);
      // Asterisks should be escaped
      expect(result).toContain('\\*');
    });

    it('applies bold formatting', () => {
      const node: LexicalNode = { type: 'text', text: 'bold', format: TEXT_FORMAT.BOLD };
      const result = formatTextNode(node, DEFAULT_INLINE_CONTEXT);
      expect(result).toBe('**bold**');
    });

    it('applies italic formatting', () => {
      const node: LexicalNode = { type: 'text', text: 'italic', format: TEXT_FORMAT.ITALIC };
      const result = formatTextNode(node, DEFAULT_INLINE_CONTEXT);
      expect(result).toBe('*italic*');
    });

    it('applies code formatting', () => {
      const node: LexicalNode = { type: 'text', text: 'code', format: TEXT_FORMAT.CODE };
      const result = formatTextNode(node, DEFAULT_INLINE_CONTEXT);
      expect(result).toBe('`code`');
    });

    it('applies strikethrough formatting', () => {
      const node: LexicalNode = { type: 'text', text: 'strike', format: TEXT_FORMAT.STRIKETHROUGH };
      const result = formatTextNode(node, DEFAULT_INLINE_CONTEXT);
      expect(result).toBe('~~strike~~');
    });

    it('applies bold + italic formatting', () => {
      const node: LexicalNode = {
        type: 'text',
        text: 'both',
        format: TEXT_FORMAT.BOLD | TEXT_FORMAT.ITALIC,
      };
      const result = formatTextNode(node, DEFAULT_INLINE_CONTEXT);
      expect(result).toBe('***both***');
    });

    it('applies all formatting combined', () => {
      const node: LexicalNode = {
        type: 'text',
        text: 'all',
        format:
          TEXT_FORMAT.BOLD | TEXT_FORMAT.ITALIC | TEXT_FORMAT.CODE | TEXT_FORMAT.STRIKETHROUGH,
      };
      const result = formatTextNode(node, DEFAULT_INLINE_CONTEXT);
      // Order: strikethrough wraps code wraps bold wraps italic
      expect(result).toBe('~~`***all***`~~');
    });

    it('respects isLineStart context for escaping', () => {
      const node: LexicalNode = { type: 'text', text: '# Heading' };
      const lineStartContext: InlineContext = { isLineStart: true, isInTable: false };
      const result = formatTextNode(node, lineStartContext);
      // Hash at line start should be escaped
      expect(result).toContain('\\#');
    });

    it('respects isInTable context for escaping', () => {
      const node: LexicalNode = { type: 'text', text: 'a | b' };
      const tableContext: InlineContext = { isLineStart: false, isInTable: true };
      const result = formatTextNode(node, tableContext);
      // Pipe in table should be escaped
      expect(result).toContain('\\|');
    });
  });

  describe('formatTextNodeRaw', () => {
    it('returns empty string for empty text', () => {
      const node: LexicalNode = { type: 'text', text: '' };
      const result = formatTextNodeRaw(node);
      expect(result).toBe('');
    });

    it('returns empty string for undefined text', () => {
      const node: LexicalNode = { type: 'text' };
      const result = formatTextNodeRaw(node);
      expect(result).toBe('');
    });

    it('returns raw text without formatting', () => {
      const node: LexicalNode = { type: 'text', text: '*not escaped*', format: 0 };
      const result = formatTextNodeRaw(node);
      // No escaping should happen
      expect(result).toBe('*not escaped*');
    });

    it('applies bold formatting', () => {
      const node: LexicalNode = { type: 'text', text: 'bold', format: TEXT_FORMAT.BOLD };
      const result = formatTextNodeRaw(node);
      expect(result).toBe('**bold**');
    });

    it('applies italic formatting', () => {
      const node: LexicalNode = { type: 'text', text: 'italic', format: TEXT_FORMAT.ITALIC };
      const result = formatTextNodeRaw(node);
      expect(result).toBe('*italic*');
    });

    it('applies code formatting', () => {
      const node: LexicalNode = { type: 'text', text: 'code', format: TEXT_FORMAT.CODE };
      const result = formatTextNodeRaw(node);
      expect(result).toBe('`code`');
    });

    it('applies strikethrough formatting', () => {
      const node: LexicalNode = { type: 'text', text: 'strike', format: TEXT_FORMAT.STRIKETHROUGH };
      const result = formatTextNodeRaw(node);
      expect(result).toBe('~~strike~~');
    });

    it('applies combined bold + italic formatting', () => {
      const node: LexicalNode = {
        type: 'text',
        text: 'combined',
        format: TEXT_FORMAT.BOLD | TEXT_FORMAT.ITALIC,
      };
      const result = formatTextNodeRaw(node);
      expect(result).toBe('***combined***');
    });

    it('handles format as undefined (defaults to 0)', () => {
      const node: LexicalNode = { type: 'text', text: 'plain' };
      const result = formatTextNodeRaw(node);
      expect(result).toBe('plain');
    });
  });

  describe('DEFAULT_INLINE_CONTEXT', () => {
    it('has correct default values', () => {
      expect(DEFAULT_INLINE_CONTEXT.isLineStart).toBe(true);
      expect(DEFAULT_INLINE_CONTEXT.isInTable).toBe(false);
    });
  });
});
