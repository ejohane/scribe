import { describe, it, expect, beforeEach } from 'vitest';
import { createEditor, $getRoot, $insertNodes, LexicalEditor } from 'lexical';
import { createNoteId } from '@scribe/shared';
import {
  WikiLinkNode,
  $createWikiLinkNode,
  $isWikiLinkNode,
  SerializedWikiLinkNode,
} from './WikiLinkNode';

describe('WikiLinkNode', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createEditor({
      namespace: 'test',
      nodes: [WikiLinkNode],
      onError: (error) => {
        throw error;
      },
    });
  });

  describe('static getType', () => {
    it('returns "wiki-link"', () => {
      expect(WikiLinkNode.getType()).toBe('wiki-link');
    });
  });

  describe('constructor and properties', () => {
    it('can be created with noteTitle, displayText, and targetId', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('Meeting Notes', 'Meeting Notes', createNoteId('abc123'));
        expect(node.__noteTitle).toBe('Meeting Notes');
        expect(node.__displayText).toBe('Meeting Notes');
        expect(node.__targetId).toBe('abc123');
      });
    });

    it('can be created with null targetId (unresolved link)', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('New Note', 'New Note', null);
        expect(node.__noteTitle).toBe('New Note');
        expect(node.__displayText).toBe('New Note');
        expect(node.__targetId).toBeNull();
      });
    });

    it('can have different displayText (alias) than noteTitle', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('Meeting Notes', 'yesterday', createNoteId('abc123'));
        expect(node.__noteTitle).toBe('Meeting Notes');
        expect(node.__displayText).toBe('yesterday');
      });
    });
  });

  describe('clone', () => {
    it('clones node preserving all properties', async () => {
      await editor.update(() => {
        const original = $createWikiLinkNode(
          'Project Alpha',
          'the project',
          createNoteId('xyz789')
        );
        const cloned = WikiLinkNode.clone(original);

        expect(cloned.__noteTitle).toBe('Project Alpha');
        expect(cloned.__displayText).toBe('the project');
        expect(cloned.__targetId).toBe('xyz789');
        expect(cloned.__key).toBe(original.__key);
      });
    });
  });

  describe('createDOM', () => {
    it('creates span with wiki-link class', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('Test', 'Test', null);
        const dom = node.createDOM();

        expect(dom.tagName).toBe('SPAN');
        expect(dom.className).toBe('wiki-link');
      });
    });
  });

  describe('updateDOM', () => {
    it('returns false (decorator handles updates)', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('Test', 'Test', null);
        expect(node.updateDOM()).toBe(false);
      });
    });
  });

  describe('isInline', () => {
    it('returns true', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('Test', 'Test', null);
        expect(node.isInline()).toBe(true);
      });
    });
  });

  describe('getTextContent', () => {
    it('returns displayText for copy/paste', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('Meeting Notes', 'yesterday', createNoteId('abc123'));
        expect(node.getTextContent()).toBe('yesterday');
      });
    });

    it('returns noteTitle when displayText equals noteTitle', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('Meeting Notes', 'Meeting Notes', createNoteId('abc123'));
        expect(node.getTextContent()).toBe('Meeting Notes');
      });
    });
  });

  describe('JSON serialization', () => {
    it('exportJSON includes all properties', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('Meeting Notes', 'yesterday', createNoteId('abc123'));
        const json = node.exportJSON();

        expect(json.type).toBe('wiki-link');
        expect(json.noteTitle).toBe('Meeting Notes');
        expect(json.displayText).toBe('yesterday');
        expect(json.targetId).toBe('abc123');
        expect(json.version).toBe(1);
      });
    });

    it('exportJSON handles null targetId', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('New Note', 'New Note', null);
        const json = node.exportJSON();

        expect(json.targetId).toBeNull();
      });
    });

    it('importJSON creates node from serialized data', async () => {
      const serialized: SerializedWikiLinkNode = {
        type: 'wiki-link',
        noteTitle: 'Project Beta',
        displayText: 'the beta project',
        targetId: createNoteId('def456'),
        version: 1,
      };

      await editor.update(() => {
        const node = WikiLinkNode.importJSON(serialized);

        expect(node.__noteTitle).toBe('Project Beta');
        expect(node.__displayText).toBe('the beta project');
        expect(node.__targetId).toBe('def456');
      });
    });

    it('JSON round-trip preserves all data', async () => {
      await editor.update(() => {
        const original = $createWikiLinkNode('Test Note', 'test alias', createNoteId('test123'));
        const json = original.exportJSON();
        const restored = WikiLinkNode.importJSON(json);

        expect(restored.__noteTitle).toBe(original.__noteTitle);
        expect(restored.__displayText).toBe(original.__displayText);
        expect(restored.__targetId).toBe(original.__targetId);
      });
    });
  });

  describe('decorate', () => {
    it('returns a JSX element', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('Test', 'Test Display', null);
        const element = node.decorate(editor);

        // The element should be a React element (created with createElement)
        expect(element).toBeDefined();
        expect(element.type).toBeDefined();
        expect(element.props.displayText).toBe('Test Display');
        expect(element.props.noteTitle).toBe('Test');
        expect(element.props.targetId).toBeNull();
      });
    });
  });

  describe('$isWikiLinkNode', () => {
    it('returns true for WikiLinkNode', async () => {
      await editor.update(() => {
        const node = $createWikiLinkNode('Test', 'Test', null);
        expect($isWikiLinkNode(node)).toBe(true);
      });
    });

    it('returns false for other values', () => {
      expect($isWikiLinkNode(null)).toBe(false);
      expect($isWikiLinkNode(undefined)).toBe(false);
      expect($isWikiLinkNode('string')).toBe(false);
      expect($isWikiLinkNode({})).toBe(false);
      expect($isWikiLinkNode(123)).toBe(false);
    });
  });

  describe('integration with editor', () => {
    it('can be inserted into editor', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const node = $createWikiLinkNode('Test Note', 'Test Note', createNoteId('id123'));
        $insertNodes([node]);

        // WikiLinkNode is not a TextNode, so check the root's descendants
        expect(root.getTextContent()).toBe('Test Note');
      });
    });
  });
});
