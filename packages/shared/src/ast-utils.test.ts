/**
 * Tests for AST traversal utilities
 *
 * Tests the traversal, querying, and text extraction utilities for Lexical AST trees.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  traverseNodes,
  traverseNodesWithAncestors,
  findNodeByKey,
  extractTextFromNodes,
  extractTextFromNode,
} from './ast-utils.js';
import type { LexicalNode } from './types.js';

/**
 * Helper to create a text node
 */
function createTextNode(text: string, key?: string): LexicalNode {
  return {
    type: 'text',
    text,
    __key: key,
  };
}

/**
 * Helper to create a paragraph node with children
 */
function createParagraphNode(children: LexicalNode[], key?: string): LexicalNode {
  return {
    type: 'paragraph',
    children,
    __key: key,
  };
}

/**
 * Helper to create a heading node
 */
function createHeadingNode(tag: string, children: LexicalNode[], key?: string): LexicalNode {
  return {
    type: 'heading',
    tag,
    children,
    __key: key,
  };
}

/**
 * Helper to create a code block node
 */
function createCodeNode(children: LexicalNode[], key?: string): LexicalNode {
  return {
    type: 'code',
    children,
    __key: key,
  };
}

/**
 * Helper to create a list node
 */
function createListNode(listType: string, children: LexicalNode[], key?: string): LexicalNode {
  return {
    type: 'list',
    listType,
    children,
    __key: key,
  };
}

/**
 * Helper to create a list item node
 */
function createListItemNode(children: LexicalNode[], key?: string): LexicalNode {
  return {
    type: 'listitem',
    children,
    __key: key,
  };
}

describe('ast-utils', () => {
  describe('traverseNodes', () => {
    it('should traverse empty array without calling callback', () => {
      const callback = vi.fn();
      traverseNodes([], callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should traverse single node', () => {
      const callback = vi.fn();
      const node = createTextNode('Hello');

      traverseNodes([node], callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(node);
    });

    it('should traverse multiple sibling nodes', () => {
      const callback = vi.fn();
      const node1 = createTextNode('Hello');
      const node2 = createTextNode('World');

      traverseNodes([node1, node2], callback);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, node1);
      expect(callback).toHaveBeenNthCalledWith(2, node2);
    });

    it('should traverse nested nodes depth-first', () => {
      const callback = vi.fn();
      const textNode = createTextNode('Hello');
      const paragraphNode = createParagraphNode([textNode]);

      traverseNodes([paragraphNode], callback);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, paragraphNode);
      expect(callback).toHaveBeenNthCalledWith(2, textNode);
    });

    it('should traverse deeply nested structure', () => {
      const callback = vi.fn();
      const textNode1 = createTextNode('Item 1');
      const textNode2 = createTextNode('Item 2');
      const listItem1 = createListItemNode([textNode1]);
      const listItem2 = createListItemNode([textNode2]);
      const listNode = createListNode('bullet', [listItem1, listItem2]);
      const paragraphNode = createParagraphNode([createTextNode('Before list')]);

      traverseNodes([paragraphNode, listNode], callback);

      expect(callback).toHaveBeenCalledTimes(7);
    });

    it('should handle nodes without children property', () => {
      const callback = vi.fn();
      const node: LexicalNode = { type: 'linebreak' };

      traverseNodes([node], callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(node);
    });

    it('should handle nodes with empty children array', () => {
      const callback = vi.fn();
      const node = createParagraphNode([]);

      traverseNodes([node], callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(node);
    });
  });

  describe('traverseNodesWithAncestors', () => {
    it('should traverse empty array without calling callback', () => {
      const callback = vi.fn();
      traverseNodesWithAncestors([], callback);
      expect(callback).not.toHaveBeenCalled();
    });

    it('should provide empty ancestors array for root nodes', () => {
      const callback = vi.fn();
      const node = createTextNode('Hello');

      traverseNodesWithAncestors([node], callback);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(callback).toHaveBeenCalledWith(node, []);
    });

    it('should provide parent in ancestors for nested nodes', () => {
      const callback = vi.fn();
      const textNode = createTextNode('Hello');
      const paragraphNode = createParagraphNode([textNode]);

      traverseNodesWithAncestors([paragraphNode], callback);

      expect(callback).toHaveBeenCalledTimes(2);
      expect(callback).toHaveBeenNthCalledWith(1, paragraphNode, []);
      expect(callback).toHaveBeenNthCalledWith(2, textNode, [paragraphNode]);
    });

    it('should provide full ancestor chain for deeply nested nodes', () => {
      const callback = vi.fn();
      const textNode = createTextNode('Item');
      const listItemNode = createListItemNode([textNode]);
      const listNode = createListNode('bullet', [listItemNode]);

      traverseNodesWithAncestors([listNode], callback);

      expect(callback).toHaveBeenCalledTimes(3);
      expect(callback).toHaveBeenNthCalledWith(1, listNode, []);
      expect(callback).toHaveBeenNthCalledWith(2, listItemNode, [listNode]);
      expect(callback).toHaveBeenNthCalledWith(3, textNode, [listNode, listItemNode]);
    });

    it('should allow checking ancestor types', () => {
      const textNode = createTextNode('code example');
      const codeNode = createCodeNode([textNode]);
      const nodesInsideCode: LexicalNode[] = [];

      traverseNodesWithAncestors([codeNode], (node, ancestors) => {
        if (ancestors.some((a) => a.type === 'code')) {
          nodesInsideCode.push(node);
        }
      });

      expect(nodesInsideCode).toEqual([textNode]);
    });

    it('should maintain separate ancestor chains for siblings', () => {
      const callback = vi.fn();
      const text1 = createTextNode('Hello');
      const text2 = createTextNode('World');
      const para1 = createParagraphNode([text1]);
      const para2 = createParagraphNode([text2]);

      traverseNodesWithAncestors([para1, para2], callback);

      expect(callback).toHaveBeenCalledWith(text1, [para1]);
      expect(callback).toHaveBeenCalledWith(text2, [para2]);
    });
  });

  describe('findNodeByKey', () => {
    it('should return null for empty array', () => {
      const result = findNodeByKey([], 'node_1');
      expect(result).toBeNull();
    });

    it('should find node at root level', () => {
      const targetNode = createTextNode('Hello', 'node_target');
      const otherNode = createTextNode('World', 'node_other');

      const result = findNodeByKey([targetNode, otherNode], 'node_target');

      expect(result).toBe(targetNode);
    });

    it('should find nested node', () => {
      const targetNode = createTextNode('Hello', 'node_target');
      const paragraphNode = createParagraphNode([targetNode], 'node_para');

      const result = findNodeByKey([paragraphNode], 'node_target');

      expect(result).toBe(targetNode);
    });

    it('should find deeply nested node', () => {
      const targetNode = createTextNode('Item', 'node_target');
      const listItemNode = createListItemNode([targetNode], 'node_item');
      const listNode = createListNode('bullet', [listItemNode], 'node_list');

      const result = findNodeByKey([listNode], 'node_target');

      expect(result).toBe(targetNode);
    });

    it('should return null for non-existent key', () => {
      const node = createTextNode('Hello', 'node_1');

      const result = findNodeByKey([node], 'non_existent');

      expect(result).toBeNull();
    });

    it('should return first matching node when duplicates exist', () => {
      const node1 = createTextNode('First', 'duplicate_key');
      const node2 = createTextNode('Second', 'duplicate_key');

      const result = findNodeByKey([node1, node2], 'duplicate_key');

      expect(result).toBe(node1);
    });

    it('should find node without children property', () => {
      const linebreak: LexicalNode = { type: 'linebreak', __key: 'lb_1' };
      const paragraph = createParagraphNode([createTextNode('Text')]);

      const result = findNodeByKey([paragraph, linebreak], 'lb_1');

      expect(result).toBe(linebreak);
    });
  });

  describe('extractTextFromNodes', () => {
    it('should return empty string for empty array', () => {
      const result = extractTextFromNodes([]);
      expect(result).toBe('');
    });

    it('should extract text from single text node', () => {
      const node = createTextNode('Hello');

      const result = extractTextFromNodes([node]);

      expect(result).toBe('Hello');
    });

    it('should extract and join text from multiple text nodes', () => {
      const node1 = createTextNode('Hello');
      const node2 = createTextNode('World');

      const result = extractTextFromNodes([node1, node2]);

      expect(result).toBe('Hello World');
    });

    it('should extract text from nested nodes', () => {
      const textNode = createTextNode('Nested text');
      const paragraphNode = createParagraphNode([textNode]);

      const result = extractTextFromNodes([paragraphNode]);

      expect(result).toBe('Nested text');
    });

    it('should extract text from complex structure', () => {
      const heading = createHeadingNode('h1', [createTextNode('Title')]);
      const para = createParagraphNode([createTextNode('Some'), createTextNode('content')]);
      const listItem1 = createListItemNode([createTextNode('Item 1')]);
      const listItem2 = createListItemNode([createTextNode('Item 2')]);
      const list = createListNode('bullet', [listItem1, listItem2]);

      const result = extractTextFromNodes([heading, para, list]);

      expect(result).toBe('Title Some content Item 1 Item 2');
    });

    it('should ignore non-text nodes', () => {
      const textNode = createTextNode('Text content');
      const linebreak: LexicalNode = { type: 'linebreak' };
      const paragraph = createParagraphNode([textNode, linebreak]);

      const result = extractTextFromNodes([paragraph]);

      expect(result).toBe('Text content');
    });

    it('should handle nodes where text is not a string', () => {
      const invalidTextNode: LexicalNode = { type: 'text', text: undefined };
      const validTextNode = createTextNode('Valid');

      const result = extractTextFromNodes([invalidTextNode, validTextNode]);

      expect(result).toBe('Valid');
    });

    it('should handle unicode text', () => {
      const node1 = createTextNode('日本語');
      const node2 = createTextNode('🎉');

      const result = extractTextFromNodes([node1, node2]);

      expect(result).toBe('日本語 🎉');
    });
  });

  describe('extractTextFromNode', () => {
    it('should extract text from single node without spaces', () => {
      const textNode = createTextNode('Hello');

      const result = extractTextFromNode(textNode);

      expect(result).toBe('Hello');
    });

    it('should concatenate text without spaces (for inline content)', () => {
      const text1 = createTextNode('Hello');
      const text2 = createTextNode('World');
      const paragraphNode = createParagraphNode([text1, text2]);

      const result = extractTextFromNode(paragraphNode);

      expect(result).toBe('HelloWorld');
    });

    it('should extract text from deeply nested structure', () => {
      const textNode = createTextNode('Task text');
      const listItemNode = createListItemNode([textNode]);

      const result = extractTextFromNode(listItemNode);

      expect(result).toBe('Task text');
    });

    it('should handle node with no text children', () => {
      const emptyParagraph = createParagraphNode([]);

      const result = extractTextFromNode(emptyParagraph);

      expect(result).toBe('');
    });

    it('should handle mixed content', () => {
      const text1 = createTextNode('Buy ');
      const text2 = createTextNode('groceries');
      const listItemNode = createListItemNode([text1, text2]);

      const result = extractTextFromNode(listItemNode);

      expect(result).toBe('Buy groceries');
    });

    it('should handle text node directly', () => {
      const textNode = createTextNode('Direct text');

      const result = extractTextFromNode(textNode);

      expect(result).toBe('Direct text');
    });
  });
});
