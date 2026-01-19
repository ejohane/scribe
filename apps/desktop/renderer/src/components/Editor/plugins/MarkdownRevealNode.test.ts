import { describe, it, expect, beforeEach } from 'vitest';
import { createEditor, $getRoot, $insertNodes, LexicalEditor } from 'lexical';
import {
  MarkdownRevealNode,
  $createMarkdownRevealNode,
  $isMarkdownRevealNode,
  SerializedMarkdownRevealNode,
} from './MarkdownRevealNode';
import { IS_BOLD, IS_ITALIC, IS_STRIKETHROUGH, IS_CODE } from './markdownReconstruction';

describe('MarkdownRevealNode', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createEditor({
      namespace: 'test',
      nodes: [MarkdownRevealNode],
      onError: (error) => {
        throw error;
      },
    });
  });

  describe('static getType', () => {
    it('returns "markdown-reveal"', () => {
      expect(MarkdownRevealNode.getType()).toBe('markdown-reveal');
    });
  });

  describe('constructor and properties', () => {
    it('can be created with text and format', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello', IS_BOLD);
        expect(node.__text).toBe('hello');
        expect(node.__format).toBe(IS_BOLD);
      });
    });

    it('can be created with empty text', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('', IS_ITALIC);
        expect(node.__text).toBe('');
        expect(node.__format).toBe(IS_ITALIC);
      });
    });

    it('can be created with zero format', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('plain', 0);
        expect(node.__text).toBe('plain');
        expect(node.__format).toBe(0);
      });
    });

    it('can be created with combined formats', async () => {
      await editor.update(() => {
        const format = IS_BOLD | IS_ITALIC | IS_CODE;
        const node = $createMarkdownRevealNode('text', format);
        expect(node.__text).toBe('text');
        expect(node.__format).toBe(format);
      });
    });
  });

  describe('clone', () => {
    it('clones node preserving all properties', async () => {
      await editor.update(() => {
        const original = $createMarkdownRevealNode('hello world', IS_BOLD | IS_ITALIC);
        const cloned = MarkdownRevealNode.clone(original);

        expect(cloned.__text).toBe('hello world');
        expect(cloned.__format).toBe(IS_BOLD | IS_ITALIC);
        expect(cloned.__key).toBe(original.__key);
      });
    });

    it('clones node with empty text', async () => {
      await editor.update(() => {
        const original = $createMarkdownRevealNode('', IS_CODE);
        const cloned = MarkdownRevealNode.clone(original);

        expect(cloned.__text).toBe('');
        expect(cloned.__format).toBe(IS_CODE);
      });
    });

    it('clones node with zero format', async () => {
      await editor.update(() => {
        const original = $createMarkdownRevealNode('plain', 0);
        const cloned = MarkdownRevealNode.clone(original);

        expect(cloned.__text).toBe('plain');
        expect(cloned.__format).toBe(0);
      });
    });
  });

  describe('createDOM', () => {
    it('creates span with markdown-reveal class', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_BOLD);
        const dom = node.createDOM({} as never);

        expect(dom.tagName).toBe('SPAN');
        expect(dom.className).toBe('markdown-reveal');
      });
    });

    it('adds data-format-code attribute for code format', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_CODE);
        const dom = node.createDOM({} as never);

        expect(dom.tagName).toBe('SPAN');
        expect(dom.className).toBe('markdown-reveal');
        expect(dom.getAttribute('data-format-code')).toBe('true');
      });
    });

    it('adds data-format-code attribute for combined formats including code', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_BOLD | IS_CODE);
        const dom = node.createDOM({} as never);

        expect(dom.getAttribute('data-format-code')).toBe('true');
      });
    });

    it('does not add data-format-code attribute when code format is not present', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_BOLD | IS_ITALIC);
        const dom = node.createDOM({} as never);

        expect(dom.getAttribute('data-format-code')).toBeNull();
      });
    });

    it('adds data-format-strikethrough attribute for strikethrough format', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_STRIKETHROUGH);
        const dom = node.createDOM({} as never);

        expect(dom.tagName).toBe('SPAN');
        expect(dom.className).toBe('markdown-reveal');
        expect(dom.getAttribute('data-format-strikethrough')).toBe('true');
      });
    });

    it('adds data-format-strikethrough attribute for combined formats including strikethrough', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_BOLD | IS_STRIKETHROUGH);
        const dom = node.createDOM({} as never);

        expect(dom.getAttribute('data-format-strikethrough')).toBe('true');
      });
    });

    it('does not add data-format-strikethrough attribute when strikethrough format is not present', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_BOLD | IS_ITALIC);
        const dom = node.createDOM({} as never);

        expect(dom.getAttribute('data-format-strikethrough')).toBeNull();
      });
    });

    it('adds both data-format-code and data-format-strikethrough when both formats present', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_CODE | IS_STRIKETHROUGH);
        const dom = node.createDOM({} as never);

        expect(dom.getAttribute('data-format-code')).toBe('true');
        expect(dom.getAttribute('data-format-strikethrough')).toBe('true');
      });
    });
  });

  describe('updateDOM', () => {
    it('returns false (decorator handles updates)', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_BOLD);
        expect(node.updateDOM()).toBe(false);
      });
    });
  });

  describe('isInline', () => {
    it('returns true (inline node)', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_BOLD);
        expect(node.isInline()).toBe(true);
      });
    });
  });

  describe('getTextContent', () => {
    it('returns bold markdown syntax', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello', IS_BOLD);
        expect(node.getTextContent()).toBe('**hello**');
      });
    });

    it('returns italic markdown syntax', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello', IS_ITALIC);
        expect(node.getTextContent()).toBe('*hello*');
      });
    });

    it('returns strikethrough markdown syntax', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello', IS_STRIKETHROUGH);
        expect(node.getTextContent()).toBe('~~hello~~');
      });
    });

    it('returns code markdown syntax', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello', IS_CODE);
        expect(node.getTextContent()).toBe('`hello`');
      });
    });

    it('returns combined bold+italic markdown syntax', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello', IS_BOLD | IS_ITALIC);
        expect(node.getTextContent()).toBe('***hello***');
      });
    });

    it('returns plain text for zero format', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello', 0);
        expect(node.getTextContent()).toBe('hello');
      });
    });
  });

  describe('getters', () => {
    it('getText returns text', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('my text', IS_BOLD);
        expect(node.getText()).toBe('my text');
      });
    });

    it('getFormat returns format bitmask', async () => {
      await editor.update(() => {
        const format = IS_BOLD | IS_ITALIC | IS_STRIKETHROUGH;
        const node = $createMarkdownRevealNode('text', format);
        expect(node.getFormat()).toBe(format);
      });
    });
  });

  describe('JSON serialization', () => {
    it('exportJSON includes all properties', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello', IS_BOLD | IS_CODE);
        const json = node.exportJSON();

        expect(json.type).toBe('markdown-reveal');
        expect(json.text).toBe('hello');
        expect(json.format).toBe(IS_BOLD | IS_CODE);
        expect(json.version).toBe(1);
      });
    });

    it('exportJSON handles empty text', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('', IS_ITALIC);
        const json = node.exportJSON();

        expect(json.text).toBe('');
        expect(json.format).toBe(IS_ITALIC);
      });
    });

    it('exportJSON handles zero format', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('plain', 0);
        const json = node.exportJSON();

        expect(json.text).toBe('plain');
        expect(json.format).toBe(0);
      });
    });

    it('importJSON creates node from serialized data', async () => {
      const serialized: SerializedMarkdownRevealNode = {
        type: 'markdown-reveal',
        text: 'imported text',
        format: IS_BOLD | IS_STRIKETHROUGH,
        version: 1,
      };

      await editor.update(() => {
        const node = MarkdownRevealNode.importJSON(serialized);

        expect(node.__text).toBe('imported text');
        expect(node.__format).toBe(IS_BOLD | IS_STRIKETHROUGH);
      });
    });

    it('importJSON handles empty text', async () => {
      const serialized: SerializedMarkdownRevealNode = {
        type: 'markdown-reveal',
        text: '',
        format: IS_CODE,
        version: 1,
      };

      await editor.update(() => {
        const node = MarkdownRevealNode.importJSON(serialized);

        expect(node.__text).toBe('');
        expect(node.__format).toBe(IS_CODE);
      });
    });

    it('JSON round-trip preserves all data', async () => {
      await editor.update(() => {
        const format = IS_BOLD | IS_ITALIC | IS_STRIKETHROUGH | IS_CODE;
        const original = $createMarkdownRevealNode('round trip', format);
        const json = original.exportJSON();
        const restored = MarkdownRevealNode.importJSON(json);

        expect(restored.__text).toBe(original.__text);
        expect(restored.__format).toBe(original.__format);
      });
    });
  });

  describe('decorate', () => {
    it('returns a React element with correct props', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('decorated', IS_BOLD);
        const element = node.decorate();

        // The element should be a React element (created with createElement)
        expect(element).toBeDefined();
        // @ts-expect-error - accessing props for testing
        expect(element.props.text).toBe('decorated');
        // @ts-expect-error - accessing props for testing
        expect(element.props.format).toBe(IS_BOLD);
      });
    });

    it('returns element with combined format props', async () => {
      await editor.update(() => {
        const format = IS_BOLD | IS_ITALIC | IS_CODE;
        const node = $createMarkdownRevealNode('multi', format);
        const element = node.decorate();

        expect(element).toBeDefined();
        // @ts-expect-error - accessing props for testing
        expect(element.props.text).toBe('multi');
        // @ts-expect-error - accessing props for testing
        expect(element.props.format).toBe(format);
      });
    });
  });

  describe('$isMarkdownRevealNode', () => {
    it('returns true for MarkdownRevealNode', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('test', IS_BOLD);
        expect($isMarkdownRevealNode(node)).toBe(true);
      });
    });

    it('returns false for null', () => {
      expect($isMarkdownRevealNode(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect($isMarkdownRevealNode(undefined)).toBe(false);
    });

    it('returns false for other values', () => {
      expect($isMarkdownRevealNode('string' as unknown as null)).toBe(false);
      expect($isMarkdownRevealNode({} as unknown as null)).toBe(false);
      expect($isMarkdownRevealNode(123 as unknown as null)).toBe(false);
    });
  });

  describe('integration with editor', () => {
    it('can be inserted into editor', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const node = $createMarkdownRevealNode('editor test', IS_BOLD);
        $insertNodes([node]);

        expect(root.getTextContent()).toBe('**editor test**');
      });
    });

    it('can insert multiple nodes', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const node1 = $createMarkdownRevealNode('bold', IS_BOLD);
        const node2 = $createMarkdownRevealNode('italic', IS_ITALIC);
        $insertNodes([node1, node2]);

        expect(root.getTextContent()).toContain('**bold**');
        expect(root.getTextContent()).toContain('*italic*');
      });
    });
  });

  describe('edge cases', () => {
    it('handles text with special characters', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello *world*', IS_BOLD);
        expect(node.getTextContent()).toBe('**hello *world***');
      });
    });

    it('handles text with backticks', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello `code`', IS_BOLD);
        expect(node.getTextContent()).toBe('**hello `code`**');
      });
    });

    it('handles text with newlines', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello\nworld', IS_BOLD);
        expect(node.getTextContent()).toBe('**hello\nworld**');
      });
    });

    it('handles text with spaces', async () => {
      await editor.update(() => {
        const node = $createMarkdownRevealNode('hello world', IS_ITALIC);
        expect(node.getTextContent()).toBe('*hello world*');
      });
    });

    it('handles all formats combined', async () => {
      await editor.update(() => {
        const format = IS_BOLD | IS_ITALIC | IS_STRIKETHROUGH | IS_CODE;
        const node = $createMarkdownRevealNode('all', format);
        expect(node.getTextContent()).toBe('***~~`all`~~***');
      });
    });
  });
});
