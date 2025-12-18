/**
 * Tests for text extraction utilities for search indexing
 *
 * Tests the extraction of plain text from Lexical JSON content for search indexing
 * and snippet generation.
 */

import { describe, it, expect } from 'vitest';
import {
  extractTextForSearch,
  extractTextWithContext,
  generateSnippet,
} from './text-extraction.js';
import type { EditorContent, EditorNode } from '@scribe/shared';

/**
 * Helper to create a text node
 */
function createTextNode(text: string): EditorNode {
  return {
    type: 'text',
    text,
  };
}

/**
 * Helper to create a paragraph node with text children
 */
function createParagraph(texts: string[]): EditorNode {
  return {
    type: 'paragraph',
    children: texts.map((t) => createTextNode(t)),
  };
}

/**
 * Helper to create a complete EditorContent from children nodes
 */
function createEditorContent(children: EditorNode[]): EditorContent {
  return {
    root: {
      type: 'root',
      children,
    },
  };
}

describe('text-extraction', () => {
  describe('extractTextForSearch', () => {
    describe('empty/null handling', () => {
      it('should return empty string for empty root children', () => {
        const content = createEditorContent([]);

        const result = extractTextForSearch(content);

        expect(result).toBe('');
      });

      it('should return empty string for null root', () => {
        const content = { root: null } as unknown as EditorContent;

        const result = extractTextForSearch(content);

        expect(result).toBe('');
      });

      it('should return empty string for undefined root', () => {
        const content = { root: undefined } as unknown as EditorContent;

        const result = extractTextForSearch(content);

        expect(result).toBe('');
      });

      it('should return empty string for root without children', () => {
        const content = { root: { type: 'root' } } as unknown as EditorContent;

        const result = extractTextForSearch(content);

        expect(result).toBe('');
      });
    });

    describe('text extraction', () => {
      it('should extract text from single paragraph', () => {
        const content = createEditorContent([createParagraph(['Hello world'])]);

        const result = extractTextForSearch(content);

        expect(result).toBe('Hello world');
      });

      it('should extract and join text from multiple text nodes', () => {
        const content = createEditorContent([createParagraph(['Hello', 'world'])]);

        const result = extractTextForSearch(content);

        expect(result).toBe('Hello world');
      });

      it('should extract text from multiple paragraphs', () => {
        const content = createEditorContent([
          createParagraph(['First paragraph']),
          createParagraph(['Second paragraph']),
        ]);

        const result = extractTextForSearch(content);

        expect(result).toBe('First paragraph Second paragraph');
      });

      it('should trim leading and trailing whitespace', () => {
        const content = createEditorContent([
          createParagraph(['  Leading space']),
          createParagraph(['Trailing space  ']),
        ]);

        const result = extractTextForSearch(content);

        expect(result).toBe('Leading space Trailing space');
      });

      it('should extract text from nested structures', () => {
        const listItem: EditorNode = {
          type: 'listitem',
          children: [createTextNode('List item text')],
        };
        const list: EditorNode = {
          type: 'list',
          listType: 'bullet',
          children: [listItem],
        };
        const content = createEditorContent([createParagraph(['Before list']), list]);

        const result = extractTextForSearch(content);

        expect(result).toBe('Before list List item text');
      });

      it('should handle headings', () => {
        const heading: EditorNode = {
          type: 'heading',
          tag: 'h1',
          children: [createTextNode('Main Title')],
        };
        const content = createEditorContent([heading, createParagraph(['Body text'])]);

        const result = extractTextForSearch(content);

        expect(result).toBe('Main Title Body text');
      });

      it('should handle code blocks', () => {
        const codeBlock: EditorNode = {
          type: 'code',
          language: 'javascript',
          children: [createTextNode('const x = 1;')],
        };
        const content = createEditorContent([createParagraph(['Some code:']), codeBlock]);

        const result = extractTextForSearch(content);

        expect(result).toBe('Some code: const x = 1;');
      });

      it('should ignore non-text nodes', () => {
        const linebreak: EditorNode = { type: 'linebreak' };
        const paragraph: EditorNode = {
          type: 'paragraph',
          children: [createTextNode('Before'), linebreak, createTextNode('After')],
        };
        const content = createEditorContent([paragraph]);

        const result = extractTextForSearch(content);

        expect(result).toBe('Before After');
      });

      it('should handle unicode text', () => {
        const content = createEditorContent([
          createParagraph(['日本語テスト']),
          createParagraph(['🎉 Emoji support']),
        ]);

        const result = extractTextForSearch(content);

        expect(result).toBe('日本語テスト 🎉 Emoji support');
      });

      it('should handle empty paragraphs', () => {
        const content = createEditorContent([
          createParagraph(['Before']),
          createParagraph([]),
          createParagraph(['After']),
        ]);

        const result = extractTextForSearch(content);

        expect(result).toBe('Before After');
      });

      it('should handle nodes with non-string text property', () => {
        const invalidTextNode: EditorNode = { type: 'text', text: undefined };
        const validTextNode = createTextNode('Valid text');
        const paragraph: EditorNode = {
          type: 'paragraph',
          children: [invalidTextNode, validTextNode],
        };
        const content = createEditorContent([paragraph]);

        const result = extractTextForSearch(content);

        expect(result).toBe('Valid text');
      });
    });
  });

  describe('extractTextWithContext', () => {
    it('should return full text when under maxLength', () => {
      const content = createEditorContent([createParagraph(['Short text'])]);

      const result = extractTextWithContext(content);

      expect(result).toBe('Short text');
    });

    it('should truncate text at maxLength', () => {
      const content = createEditorContent([
        createParagraph(['This is a longer text that should be truncated']),
      ]);

      const result = extractTextWithContext(content, 20);

      expect(result).toBe('This is a longer tex');
      expect(result.length).toBe(20);
    });

    it('should use default maxLength of 5000', () => {
      const longText = 'a'.repeat(6000);
      const content = createEditorContent([createParagraph([longText])]);

      const result = extractTextWithContext(content);

      expect(result.length).toBe(5000);
    });

    it('should handle empty content', () => {
      const content = createEditorContent([]);

      const result = extractTextWithContext(content);

      expect(result).toBe('');
    });

    it('should handle maxLength of 0', () => {
      const content = createEditorContent([createParagraph(['Some text'])]);

      const result = extractTextWithContext(content, 0);

      expect(result).toBe('');
    });

    it('should handle very short maxLength', () => {
      const content = createEditorContent([createParagraph(['Hello'])]);

      const result = extractTextWithContext(content, 3);

      expect(result).toBe('Hel');
    });
  });

  describe('generateSnippet', () => {
    describe('basic snippet generation', () => {
      it('should generate snippet around match position', () => {
        const text = 'This is a test string for snippet generation';
        const matchPosition = 10; // 'test'

        const result = generateSnippet(text, matchPosition);

        expect(result).toContain('test');
      });

      it('should include context on both sides', () => {
        const text = 'prefix some context around the match and some suffix text after';
        const matchPosition = 30; // 'match'

        const result = generateSnippet(text, matchPosition, 15);

        expect(result).toContain('match');
        // 15*2 = 30 chars of content + up to 6 chars for ellipses (3 on each side)
        expect(result.length).toBeLessThanOrEqual(36);
      });
    });

    describe('ellipsis handling', () => {
      it('should add leading ellipsis when truncated at start', () => {
        const text = 'This is a very long text with the match somewhere in the middle';
        const matchPosition = 40;

        const result = generateSnippet(text, matchPosition, 10);

        expect(result.startsWith('...')).toBe(true);
      });

      it('should add trailing ellipsis when truncated at end', () => {
        const text = 'This is a very long text with the match somewhere in the middle';
        const matchPosition = 10;

        const result = generateSnippet(text, matchPosition, 10);

        expect(result.endsWith('...')).toBe(true);
      });

      it('should not add leading ellipsis when starting from beginning', () => {
        const text = 'Short text here';
        const matchPosition = 0;

        const result = generateSnippet(text, matchPosition, 50);

        expect(result.startsWith('...')).toBe(false);
      });

      it('should not add trailing ellipsis when reaching end', () => {
        const text = 'Short text here';
        const matchPosition = 12;

        const result = generateSnippet(text, matchPosition, 50);

        expect(result.endsWith('...')).toBe(false);
      });

      it('should add both ellipses when truncated on both sides', () => {
        const text = 'prefix____match____suffix';
        const matchPosition = 10;

        const result = generateSnippet(text, matchPosition, 5);

        expect(result.startsWith('...')).toBe(true);
        expect(result.endsWith('...')).toBe(true);
      });

      it('should not add ellipses for short text that fits entirely', () => {
        const text = 'Short';
        const matchPosition = 2;

        const result = generateSnippet(text, matchPosition, 80);

        expect(result).toBe('Short');
      });
    });

    describe('edge cases', () => {
      it('should handle match at the very beginning', () => {
        const text = 'Match at start of the text';
        const matchPosition = 0;

        const result = generateSnippet(text, matchPosition);

        expect(result).toContain('Match');
        expect(result.startsWith('...')).toBe(false);
      });

      it('should handle match at the very end', () => {
        const text = 'Text with match at end';
        const matchPosition = text.length - 1;

        const result = generateSnippet(text, matchPosition);

        expect(result).toContain('end');
        expect(result.endsWith('...')).toBe(false);
      });

      it('should handle empty text', () => {
        const text = '';
        const matchPosition = 0;

        const result = generateSnippet(text, matchPosition);

        expect(result).toBe('');
      });

      it('should handle position beyond text length', () => {
        const text = 'Short';
        const matchPosition = 100;

        const result = generateSnippet(text, matchPosition, 10);

        // Should still return something without crashing
        expect(typeof result).toBe('string');
      });

      it('should handle negative position', () => {
        const text = 'Some text';
        const matchPosition = -5;

        const result = generateSnippet(text, matchPosition, 10);

        // Math.max(0, -5 - 10) = 0, should work without crashing
        expect(typeof result).toBe('string');
      });

      it('should handle very small contextLength', () => {
        const text = 'This is a test';
        const matchPosition = 5;

        const result = generateSnippet(text, matchPosition, 1);

        expect(result.length).toBeGreaterThan(0);
      });

      it('should handle contextLength of 0', () => {
        const text = 'This is a test';
        const matchPosition = 5;

        const result = generateSnippet(text, matchPosition, 0);

        // With context 0, we get empty slice + potential ellipses
        expect(typeof result).toBe('string');
      });

      it('should trim the result', () => {
        const text = '  spaces around match  ';
        const matchPosition = 10;

        const result = generateSnippet(text, matchPosition);

        expect(result).not.toMatch(/^\s|\s$/);
      });
    });

    describe('default context length', () => {
      it('should use default contextLength of 80', () => {
        const text = 'a'.repeat(200);
        const matchPosition = 100;

        const result = generateSnippet(text, matchPosition);

        // Should be around 160 chars (80 on each side) + ellipses
        expect(result.length).toBeLessThanOrEqual(166); // 160 + 3 + 3 for ellipses
      });
    });

    describe('unicode handling', () => {
      it('should handle unicode characters in snippet', () => {
        const text = 'Some text with 日本語 characters and 🎉 emojis here';
        const matchPosition = 15; // somewhere in the middle

        const result = generateSnippet(text, matchPosition, 20);

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      });

      it('should handle text with only unicode', () => {
        const text = '日本語テストテキスト';
        const matchPosition = 4;

        const result = generateSnippet(text, matchPosition, 5);

        expect(result).toBeDefined();
        expect(typeof result).toBe('string');
      });
    });
  });
});
