/**
 * Unit tests for InlineLinkNode abstract base class
 *
 * InlineLinkNode is an abstract class that provides shared functionality for:
 * - WikiLinkNode (internal note links [[note]])
 * - PersonMentionNode (person references @name)
 *
 * Tests use a concrete TestLinkNode implementation to test the abstract class.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createEditor, $getRoot, $insertNodes, LexicalEditor } from 'lexical';
import { createNoteId } from '@scribe/shared';
import { createElement } from 'react';
import { InlineLinkNode, $isInlineLinkNode, type SerializedInlineLinkNode } from './InlineLinkNode';

/**
 * Concrete test implementation of InlineLinkNode for testing the abstract class.
 */
class TestLinkNode extends InlineLinkNode {
  static getType(): string {
    return 'test-link';
  }

  static clone(node: TestLinkNode): TestLinkNode {
    return new TestLinkNode(node.__displayText, node.__targetId, node.__key);
  }

  getClassName(): string {
    return 'test-link';
  }

  decorate(): JSX.Element {
    return createElement('span', {
      className: 'test-link',
      displayText: this.__displayText,
      targetId: this.__targetId,
    });
  }

  exportJSON(): SerializedInlineLinkNode & { type: 'test-link'; version: 1 } {
    return {
      ...this.exportBaseJSON(),
      type: 'test-link',
      version: 1,
    };
  }

  static importJSON(json: SerializedInlineLinkNode): TestLinkNode {
    return $createTestLinkNode(json.displayText, json.targetId);
  }
}

function $createTestLinkNode(displayText: string, targetId: string | null): TestLinkNode {
  return new TestLinkNode(displayText, targetId ? createNoteId(targetId) : null);
}

describe('InlineLinkNode', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createEditor({
      namespace: 'test',
      nodes: [TestLinkNode],
      onError: (error) => {
        throw error;
      },
    });
  });

  describe('constructor and properties', () => {
    it('stores displayText and targetId', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Test Link', 'target-123');
        expect(node.__displayText).toBe('Test Link');
        expect(node.__targetId).toBe('target-123');
      });
    });

    it('handles null targetId', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Unresolved Link', null);
        expect(node.__displayText).toBe('Unresolved Link');
        expect(node.__targetId).toBeNull();
      });
    });

    it('handles empty displayText', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('', 'target-456');
        expect(node.__displayText).toBe('');
      });
    });
  });

  describe('getDisplayText', () => {
    it('returns the display text', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Link Text', 'id-123');
        expect(node.getDisplayText()).toBe('Link Text');
      });
    });
  });

  describe('getTargetId', () => {
    it('returns the target ID', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Link', 'target-abc');
        expect(node.getTargetId()).toBe('target-abc');
      });
    });

    it('returns null when target not resolved', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Link', null);
        expect(node.getTargetId()).toBeNull();
      });
    });
  });

  describe('getTextContent', () => {
    it('returns displayText for copy/paste', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Copyable Text', 'id');
        expect(node.getTextContent()).toBe('Copyable Text');
      });
    });
  });

  describe('isInline', () => {
    it('returns true', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Test', null);
        expect(node.isInline()).toBe(true);
      });
    });
  });

  describe('createDOM', () => {
    it('creates span with class from getClassName()', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Test', null);
        const dom = node.createDOM();

        expect(dom.tagName).toBe('SPAN');
        expect(dom.className).toBe('test-link');
      });
    });
  });

  describe('updateDOM', () => {
    it('returns false (decorator handles updates)', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Test', null);
        expect(node.updateDOM()).toBe(false);
      });
    });
  });

  describe('exportDOM', () => {
    it('exports span with class and display text', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Display Text', 'id-123');
        const { element } = node.exportDOM();

        expect(element).toBeInstanceOf(HTMLElement);
        if (element instanceof HTMLElement) {
          expect(element.tagName).toBe('SPAN');
          expect(element.className).toBe('test-link');
          expect(element.textContent).toBe('Display Text');
        }
      });
    });
  });

  describe('clone (via concrete TestLinkNode)', () => {
    it('clones node preserving all properties', async () => {
      await editor.update(() => {
        const original = $createTestLinkNode('Clone Test', 'target-xyz');
        const cloned = TestLinkNode.clone(original);

        expect(cloned.__displayText).toBe('Clone Test');
        expect(cloned.__targetId).toBe('target-xyz');
        expect(cloned.__key).toBe(original.__key);
      });
    });
  });

  describe('JSON serialization', () => {
    it('exportBaseJSON includes displayText and targetId', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Export Test', 'export-id');
        const json = node.exportJSON();

        expect(json.displayText).toBe('Export Test');
        expect(json.targetId).toBe('export-id');
        expect(json.type).toBe('test-link');
        expect(json.version).toBe(1);
      });
    });

    it('exportBaseJSON handles null targetId', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('No Target', null);
        const json = node.exportJSON();

        expect(json.displayText).toBe('No Target');
        expect(json.targetId).toBeNull();
      });
    });

    it('JSON round-trip preserves data', async () => {
      await editor.update(() => {
        const original = $createTestLinkNode('Round Trip', 'round-id');
        const json = original.exportJSON();
        const restored = TestLinkNode.importJSON(json);

        expect(restored.__displayText).toBe(original.__displayText);
        expect(restored.__targetId).toBe(original.__targetId);
      });
    });
  });

  describe('decorate', () => {
    it('returns a JSX element', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Decorate Test', 'dec-id');
        const element = node.decorate();

        expect(element).toBeDefined();
        expect(element.props.displayText).toBe('Decorate Test');
        expect(element.props.targetId).toBe('dec-id');
      });
    });
  });

  describe('$isInlineLinkNode type guard', () => {
    it('returns true for InlineLinkNode subclass', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Test', 'id');
        expect($isInlineLinkNode(node)).toBe(true);
      });
    });

    it('returns false for null', () => {
      expect($isInlineLinkNode(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect($isInlineLinkNode(undefined)).toBe(false);
    });

    it('returns false for non-nodes', () => {
      // @ts-expect-error testing runtime behavior with invalid input
      expect($isInlineLinkNode('string')).toBe(false);
      // @ts-expect-error testing runtime behavior with invalid input
      expect($isInlineLinkNode({})).toBe(false);
      // @ts-expect-error testing runtime behavior with invalid input
      expect($isInlineLinkNode(123)).toBe(false);
    });
  });

  describe('integration with editor', () => {
    it('can be inserted into editor', async () => {
      await editor.update(() => {
        const node = $createTestLinkNode('Link Content', 'link-id');
        $insertNodes([node]);

        const root = $getRoot();
        expect(root.getTextContent()).toBe('Link Content');
      });
    });

    it('multiple nodes can be inserted', async () => {
      await editor.update(() => {
        const node1 = $createTestLinkNode('Link1', 'id1');
        const node2 = $createTestLinkNode('Link2', 'id2');
        $insertNodes([node1, node2]);

        const root = $getRoot();
        expect(root.getTextContent()).toBe('Link1Link2');
      });
    });
  });
});
