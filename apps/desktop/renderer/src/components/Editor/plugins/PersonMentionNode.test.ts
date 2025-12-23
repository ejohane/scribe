/**
 * Unit tests for PersonMentionNode
 *
 * Tests the PersonMentionNode Lexical decorator node, covering:
 * - Node type and properties
 * - Clone operation
 * - DOM creation and export
 * - JSON serialization/deserialization
 * - Type guard function
 * - Lexical editor integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { createEditor, $getRoot, $insertNodes, LexicalEditor } from 'lexical';
import { createNoteId } from '@scribe/shared';
import {
  PersonMentionNode,
  $createPersonMentionNode,
  $isPersonMentionNode,
  type SerializedPersonMentionNode,
} from './PersonMentionNode';

describe('PersonMentionNode', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createEditor({
      namespace: 'test',
      nodes: [PersonMentionNode],
      onError: (error) => {
        throw error;
      },
    });
  });

  describe('static getType', () => {
    it('returns "person-mention"', () => {
      expect(PersonMentionNode.getType()).toBe('person-mention');
    });
  });

  describe('constructor and properties', () => {
    it('can be created with personName and personId', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('John Smith', createNoteId('person-abc123'));
        expect(node.__personName).toBe('John Smith');
        expect(node.__personId).toBe('person-abc123');
      });
    });

    it('can be created with different person names', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('Jane Doe', createNoteId('person-xyz789'));
        expect(node.__personName).toBe('Jane Doe');
        expect(node.__personId).toBe('person-xyz789');
      });
    });

    it('handles special characters in person names', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode("O'Brien-Smith", createNoteId('person-special'));
        expect(node.__personName).toBe("O'Brien-Smith");
      });
    });

    it('handles unicode characters in person names', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('田中太郎', createNoteId('person-unicode'));
        expect(node.__personName).toBe('田中太郎');
      });
    });
  });

  describe('clone', () => {
    it('clones node preserving all properties', async () => {
      await editor.update(() => {
        const original = $createPersonMentionNode('Alice Johnson', createNoteId('person-alice'));
        const cloned = PersonMentionNode.clone(original);

        expect(cloned.__personName).toBe('Alice Johnson');
        expect(cloned.__personId).toBe('person-alice');
        expect(cloned.__key).toBe(original.__key);
      });
    });

    it('cloned node is independent from original', async () => {
      await editor.update(() => {
        const original = $createPersonMentionNode('Bob Wilson', createNoteId('person-bob'));
        const cloned = PersonMentionNode.clone(original);

        // Verify they have same values but are different instances
        expect(cloned).not.toBe(original);
        expect(cloned.__personName).toBe(original.__personName);
        expect(cloned.__personId).toBe(original.__personId);
      });
    });
  });

  describe('createDOM', () => {
    it('creates span with person-mention class', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('Test Person', createNoteId('person-test'));
        const dom = node.createDOM();

        expect(dom.tagName).toBe('SPAN');
        expect(dom.className).toBe('person-mention');
      });
    });
  });

  describe('updateDOM', () => {
    it('returns false (decorator handles updates)', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('Test Person', createNoteId('person-test'));
        expect(node.updateDOM()).toBe(false);
      });
    });
  });

  describe('exportDOM', () => {
    it('exports span with person-mention class and @ prefix text', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('John Doe', createNoteId('person-john'));
        const { element } = node.exportDOM();

        // Type guard - element can be HTMLElement | DocumentFragment | Text
        expect(element).toBeInstanceOf(HTMLElement);
        if (element instanceof HTMLElement) {
          expect(element.tagName).toBe('SPAN');
          expect(element.className).toBe('person-mention');
          expect(element.textContent).toBe('@John Doe');
        }
      });
    });
  });

  describe('isInline', () => {
    it('returns true', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('Test Person', createNoteId('person-test'));
        expect(node.isInline()).toBe(true);
      });
    });
  });

  describe('getTextContent', () => {
    it('returns @personName for copy/paste and search', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('Jane Smith', createNoteId('person-jane'));
        expect(node.getTextContent()).toBe('@Jane Smith');
      });
    });

    it('includes @ prefix in text content', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('John', createNoteId('person-john'));
        expect(node.getTextContent()).toMatch(/^@/);
        expect(node.getTextContent()).toBe('@John');
      });
    });
  });

  describe('JSON serialization', () => {
    it('exportJSON includes all properties', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('Alice Cooper', createNoteId('person-alice'));
        const json = node.exportJSON();

        expect(json.type).toBe('person-mention');
        expect(json.personName).toBe('Alice Cooper');
        expect(json.personId).toBe('person-alice');
        expect(json.version).toBe(1);
      });
    });

    it('importJSON creates node from serialized data', async () => {
      const serialized: SerializedPersonMentionNode = {
        type: 'person-mention',
        personName: 'Bob Builder',
        personId: createNoteId('person-bob'),
        version: 1,
      };

      await editor.update(() => {
        const node = PersonMentionNode.importJSON(serialized);

        expect(node.__personName).toBe('Bob Builder');
        expect(node.__personId).toBe('person-bob');
      });
    });

    it('JSON round-trip preserves all data', async () => {
      await editor.update(() => {
        const original = $createPersonMentionNode('Charlie Brown', createNoteId('person-charlie'));
        const json = original.exportJSON();
        const restored = PersonMentionNode.importJSON(json);

        expect(restored.__personName).toBe(original.__personName);
        expect(restored.__personId).toBe(original.__personId);
      });
    });

    it('handles special characters in JSON serialization', async () => {
      await editor.update(() => {
        const original = $createPersonMentionNode(
          'O\'Connor "The Great"',
          createNoteId('person-special')
        );
        const json = original.exportJSON();
        const restored = PersonMentionNode.importJSON(json);

        expect(restored.__personName).toBe('O\'Connor "The Great"');
      });
    });
  });

  describe('decorate', () => {
    it('returns a JSX element', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('Test Person', createNoteId('person-test'));
        const element = node.decorate(editor);

        // The element should be a React element (created with createElement)
        expect(element).toBeDefined();
        expect(element.type).toBeDefined();
        expect(element.props.personName).toBe('Test Person');
        expect(element.props.personId).toBe('person-test');
      });
    });

    it('passes nodeKey to decorated component', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('Test', createNoteId('person-test'));
        const element = node.decorate(editor);

        expect(element.props.nodeKey).toBe(node.__key);
      });
    });
  });

  describe('$isPersonMentionNode type guard', () => {
    it('returns true for PersonMentionNode', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('Test', createNoteId('person-test'));
        expect($isPersonMentionNode(node)).toBe(true);
      });
    });

    it('returns false for null', () => {
      expect($isPersonMentionNode(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect($isPersonMentionNode(undefined)).toBe(false);
    });

    it('returns false for non-nodes', () => {
      // @ts-expect-error testing runtime behavior with invalid input
      expect($isPersonMentionNode('string')).toBe(false);
      // @ts-expect-error testing runtime behavior with invalid input
      expect($isPersonMentionNode({})).toBe(false);
      // @ts-expect-error testing runtime behavior with invalid input
      expect($isPersonMentionNode(123)).toBe(false);
    });
  });

  describe('$createPersonMentionNode factory', () => {
    it('creates a PersonMentionNode instance', async () => {
      await editor.update(() => {
        const node = $createPersonMentionNode('Factory Test', createNoteId('person-factory'));

        expect(node).toBeInstanceOf(PersonMentionNode);
        expect(node.__personName).toBe('Factory Test');
        expect(node.__personId).toBe('person-factory');
      });
    });
  });

  describe('integration with editor', () => {
    it('can be inserted into editor', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const node = $createPersonMentionNode('John Doe', createNoteId('person-john'));
        $insertNodes([node]);

        // PersonMentionNode content should be in root
        expect(root.getTextContent()).toBe('@John Doe');
      });
    });

    it('can be retrieved from editor state', async () => {
      let nodeKey: string | null = null;

      await editor.update(() => {
        const node = $createPersonMentionNode('Test Person', createNoteId('person-test'));
        nodeKey = node.__key;
        $insertNodes([node]);
      });

      // Read the node back from editor state
      editor.getEditorState().read(() => {
        const root = $getRoot();
        const textContent = root.getTextContent();
        expect(textContent).toBe('@Test Person');
      });
    });

    it('multiple nodes can be inserted', async () => {
      await editor.update(() => {
        const node1 = $createPersonMentionNode('Alice', createNoteId('person-alice'));
        const node2 = $createPersonMentionNode('Bob', createNoteId('person-bob'));
        $insertNodes([node1, node2]);

        const root = $getRoot();
        expect(root.getTextContent()).toBe('@Alice@Bob');
      });
    });
  });
});
