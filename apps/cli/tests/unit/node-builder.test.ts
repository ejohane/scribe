/**
 * Unit tests for node-builder.ts
 *
 * Tests the Lexical AST node construction functions used by CLI write operations.
 */

import { describe, it, expect } from 'vitest';
import {
  createParagraphNode,
  createHeadingNode,
  createListNode,
  appendParagraphToContent,
  appendHeadingToContent,
  createEmptyContent,
  createInitialContent,
  createContentWithHeading,
  type EditorContent,
  type EditorNode,
} from '../../src/node-builder';

describe('node-builder', () => {
  describe('createParagraphNode', () => {
    it('should create a paragraph node with text', () => {
      const node = createParagraphNode('Hello world');

      expect(node.type).toBe('paragraph');
      expect(node.children).toHaveLength(1);
      expect(node.children?.[0].type).toBe('text');
      expect(node.children?.[0].text).toBe('Hello world');
    });

    it('should create paragraph node with empty children for empty text', () => {
      const node = createParagraphNode('');

      expect(node.type).toBe('paragraph');
      expect(node.children).toHaveLength(0);
    });

    it('should set standard paragraph properties', () => {
      const node = createParagraphNode('Text');

      expect(node.format).toBe('');
      expect(node.indent).toBe(0);
      expect(node.direction).toBeNull();
    });

    it('should NOT set node key (let Lexical handle)', () => {
      const node = createParagraphNode('Text');

      // Node builder should not set keys - Lexical manages them
      expect(node.key).toBeUndefined();
    });
  });

  describe('createHeadingNode', () => {
    it('should create h1 heading by default', () => {
      const node = createHeadingNode('Main Title');

      expect(node.type).toBe('heading');
      expect(node.tag).toBe('h1');
      expect(node.children?.[0].text).toBe('Main Title');
    });

    it('should create heading with specified level', () => {
      const h2 = createHeadingNode('Section', 2);
      const h3 = createHeadingNode('Subsection', 3);
      const h4 = createHeadingNode('Minor', 4);
      const h5 = createHeadingNode('Small', 5);
      const h6 = createHeadingNode('Tiny', 6);

      expect(h2.tag).toBe('h2');
      expect(h3.tag).toBe('h3');
      expect(h4.tag).toBe('h4');
      expect(h5.tag).toBe('h5');
      expect(h6.tag).toBe('h6');
    });

    it('should create empty children for empty text', () => {
      const node = createHeadingNode('');

      expect(node.children).toHaveLength(0);
    });
  });

  describe('createListNode', () => {
    it('should create bullet list by default', () => {
      const items = [createParagraphNode('Item 1'), createParagraphNode('Item 2')];
      const node = createListNode(items);

      expect(node.type).toBe('list');
      expect(node.listType).toBe('bullet');
      expect(node.tag).toBe('ul');
      expect(node.children).toHaveLength(2);
    });

    it('should create numbered list', () => {
      const items = [createParagraphNode('First')];
      const node = createListNode(items, 'number');

      expect(node.listType).toBe('number');
      expect(node.tag).toBe('ol');
    });

    it('should set start property to 1', () => {
      const node = createListNode([]);

      expect(node.start).toBe(1);
    });
  });

  describe('appendParagraphToContent', () => {
    it('should append paragraph to existing content', () => {
      const content = createInitialContent('First paragraph');
      const updated = appendParagraphToContent(content, 'Second paragraph');

      expect(updated.root.children).toHaveLength(2);
      expect(updated.root.children[1].type).toBe('paragraph');
      expect(updated.root.children[1].children?.[0].text).toBe('Second paragraph');
    });

    it('should not mutate original content', () => {
      const original = createInitialContent('Original');
      const updated = appendParagraphToContent(original, 'New');

      expect(original.root.children).toHaveLength(1);
      expect(updated.root.children).toHaveLength(2);
    });

    it('should handle empty initial content', () => {
      const content = createEmptyContent();
      const updated = appendParagraphToContent(content, 'First');

      // createEmptyContent has 1 empty paragraph, append adds another
      expect(updated.root.children).toHaveLength(2);
    });

    it('should handle content with no children array', () => {
      const content: EditorContent = {
        root: {
          type: 'root',
          format: '',
          indent: 0,
          direction: null,
          children: undefined as unknown as EditorNode[],
        },
      };
      const updated = appendParagraphToContent(content, 'New');

      expect(updated.root.children).toHaveLength(1);
    });
  });

  describe('appendHeadingToContent', () => {
    it('should append heading with default level 1', () => {
      const content = createEmptyContent();
      const updated = appendHeadingToContent(content, 'New Section');

      // createEmptyContent has 1 empty paragraph, append adds heading as second child
      expect(updated.root.children).toHaveLength(2);
      expect(updated.root.children[1].type).toBe('heading');
      expect(updated.root.children[1].tag).toBe('h1');
    });

    it('should append heading with specified level', () => {
      const content = createEmptyContent();
      const updated = appendHeadingToContent(content, 'Subsection', 2);

      expect(updated.root.children[1].tag).toBe('h2');
    });

    it('should not mutate original content', () => {
      const original = createEmptyContent();
      appendHeadingToContent(original, 'Heading');

      // createEmptyContent starts with 1 empty paragraph
      expect(original.root.children).toHaveLength(1);
    });
  });

  describe('createEmptyContent', () => {
    it('should create valid empty content structure with empty paragraph', () => {
      const content = createEmptyContent();

      expect(content.root).toBeDefined();
      expect(content.root.type).toBe('root');
      // Canonical empty content includes one empty paragraph
      expect(content.root.children).toHaveLength(1);
      expect(content.root.children[0].type).toBe('paragraph');
      expect(content.root.children[0].children).toEqual([]);
    });

    it('should set standard root properties', () => {
      const content = createEmptyContent();

      expect(content.root.format).toBe('');
      expect(content.root.indent).toBe(0);
      expect(content.root.version).toBe(1);
    });
  });

  describe('createInitialContent', () => {
    it('should create content with single paragraph', () => {
      const content = createInitialContent('Hello world');

      expect(content.root.children).toHaveLength(1);
      expect(content.root.children[0].type).toBe('paragraph');
      expect(content.root.children[0].children?.[0].text).toBe('Hello world');
    });

    it('should create empty content for empty string', () => {
      const content = createInitialContent('');

      expect(content.root.children).toHaveLength(0);
    });
  });

  describe('createContentWithHeading', () => {
    it('should create content with heading only', () => {
      const content = createContentWithHeading('My Title');

      expect(content.root.children).toHaveLength(1);
      expect(content.root.children[0].type).toBe('heading');
      expect(content.root.children[0].tag).toBe('h1');
      expect(content.root.children[0].children?.[0].text).toBe('My Title');
    });

    it('should create content with heading and body', () => {
      const content = createContentWithHeading('Title', 'Body text');

      expect(content.root.children).toHaveLength(2);
      expect(content.root.children[0].type).toBe('heading');
      expect(content.root.children[1].type).toBe('paragraph');
      expect(content.root.children[1].children?.[0].text).toBe('Body text');
    });

    it('should create content with specified heading level', () => {
      const content = createContentWithHeading('Section', undefined, 2);

      expect(content.root.children[0].tag).toBe('h2');
    });

    it('should skip empty body text', () => {
      const content = createContentWithHeading('Title', '');

      expect(content.root.children).toHaveLength(1);
    });
  });
});
