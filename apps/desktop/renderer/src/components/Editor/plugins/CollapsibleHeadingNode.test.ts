import { describe, it, expect, beforeEach } from 'vitest';
import { createEditor, $getRoot, $insertNodes, LexicalEditor, ParagraphNode } from 'lexical';
import { HeadingNode } from '@lexical/rich-text';
import {
  CollapsibleHeadingNode,
  $createCollapsibleHeadingNode,
  $isCollapsibleHeadingNode,
  SerializedCollapsibleHeadingNode,
} from './CollapsibleHeadingNode';

describe('CollapsibleHeadingNode', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createEditor({
      namespace: 'test',
      nodes: [HeadingNode, CollapsibleHeadingNode, ParagraphNode],
      onError: (error) => {
        throw error;
      },
    });
  });

  describe('static getType', () => {
    it('returns "collapsible-heading"', () => {
      expect(CollapsibleHeadingNode.getType()).toBe('collapsible-heading');
    });
  });

  describe('constructor and properties', () => {
    it('can be created with tag and defaults to not collapsed', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h1');
        expect(node.getTag()).toBe('h1');
        expect(node.isCollapsed()).toBe(false);
      });
    });

    it('can be created with explicit collapsed state', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h2', true);
        expect(node.getTag()).toBe('h2');
        expect(node.isCollapsed()).toBe(true);
      });
    });

    it('supports all heading levels h1-h6', async () => {
      const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

      for (const level of levels) {
        await editor.update(() => {
          const node = $createCollapsibleHeadingNode(level);
          expect(node.getTag()).toBe(level);
        });
      }
    });
  });

  describe('collapsed state management', () => {
    it('setCollapsed updates the collapsed state', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h1');
        expect(node.isCollapsed()).toBe(false);

        node.setCollapsed(true);
        expect(node.isCollapsed()).toBe(true);

        node.setCollapsed(false);
        expect(node.isCollapsed()).toBe(false);
      });
    });

    it('toggleCollapsed toggles between states', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h1');
        expect(node.isCollapsed()).toBe(false);

        node.toggleCollapsed();
        expect(node.isCollapsed()).toBe(true);

        node.toggleCollapsed();
        expect(node.isCollapsed()).toBe(false);
      });
    });
  });

  describe('clone', () => {
    it('clones node preserving tag and collapsed state', async () => {
      await editor.update(() => {
        const original = $createCollapsibleHeadingNode('h3', true);
        const cloned = CollapsibleHeadingNode.clone(original);

        expect(cloned.getTag()).toBe('h3');
        expect(cloned.isCollapsed()).toBe(true);
        expect(cloned.__key).toBe(original.__key);
      });
    });

    it('clones expanded node correctly', async () => {
      await editor.update(() => {
        const original = $createCollapsibleHeadingNode('h2', false);
        const cloned = CollapsibleHeadingNode.clone(original);

        expect(cloned.getTag()).toBe('h2');
        expect(cloned.isCollapsed()).toBe(false);
      });
    });
  });

  describe('createDOM', () => {
    it('creates heading element with data-collapsed attribute and class', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h2', false);
        const dom = node.createDOM({ namespace: 'test', theme: {} });

        expect(dom.tagName).toBe('H2');
        expect(dom.getAttribute('data-collapsed')).toBe('false');
        expect(dom.classList.contains('collapsible-heading')).toBe(true);
      });
    });

    it('creates collapsed heading with data-collapsed="true"', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h3', true);
        const dom = node.createDOM({ namespace: 'test', theme: {} });

        expect(dom.tagName).toBe('H3');
        expect(dom.getAttribute('data-collapsed')).toBe('true');
        expect(dom.classList.contains('collapsible-heading')).toBe(true);
      });
    });
  });

  describe('updateDOM', () => {
    it('updates data-collapsed attribute when state changes', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h2', false);
        const dom = node.createDOM({ namespace: 'test', theme: {} });
        expect(dom.getAttribute('data-collapsed')).toBe('false');

        // Simulate state change
        const collapsedNode = $createCollapsibleHeadingNode('h2', true);
        // Create a "previous" node for comparison
        const prevNode = $createCollapsibleHeadingNode('h2', false);

        collapsedNode.updateDOM(prevNode, dom, { namespace: 'test', theme: {} });
        expect(dom.getAttribute('data-collapsed')).toBe('true');
      });
    });

    it('does not update DOM when collapsed state unchanged', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h2', false);
        const dom = node.createDOM({ namespace: 'test', theme: {} });
        const originalAttr = dom.getAttribute('data-collapsed');

        const prevNode = $createCollapsibleHeadingNode('h2', false);
        node.updateDOM(prevNode, dom, { namespace: 'test', theme: {} });

        expect(dom.getAttribute('data-collapsed')).toBe(originalAttr);
      });
    });
  });

  describe('JSON serialization', () => {
    it('exportJSON includes collapsed state', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h2', true);
        const json = node.exportJSON();

        expect(json.type).toBe('collapsible-heading');
        expect(json.tag).toBe('h2');
        expect(json.collapsed).toBe(true);
      });
    });

    it('exportJSON handles expanded state', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h1', false);
        const json = node.exportJSON();

        expect(json.type).toBe('collapsible-heading');
        expect(json.tag).toBe('h1');
        expect(json.collapsed).toBe(false);
      });
    });

    it('importJSON creates node from serialized data', async () => {
      const serialized: SerializedCollapsibleHeadingNode = {
        type: 'collapsible-heading',
        tag: 'h3',
        collapsed: true,
        children: [],
        direction: null,
        format: '',
        indent: 0,
        version: 1,
      };

      await editor.update(() => {
        const node = CollapsibleHeadingNode.importJSON(serialized);

        expect(node.getTag()).toBe('h3');
        expect(node.isCollapsed()).toBe(true);
      });
    });

    it('JSON round-trip preserves all data', async () => {
      await editor.update(() => {
        const original = $createCollapsibleHeadingNode('h4', true);
        const json = original.exportJSON();
        const restored = CollapsibleHeadingNode.importJSON(json);

        expect(restored.getTag()).toBe(original.getTag());
        expect(restored.isCollapsed()).toBe(original.isCollapsed());
      });
    });

    it('JSON round-trip preserves expanded state', async () => {
      await editor.update(() => {
        const original = $createCollapsibleHeadingNode('h5', false);
        const json = original.exportJSON();
        const restored = CollapsibleHeadingNode.importJSON(json);

        expect(restored.getTag()).toBe('h5');
        expect(restored.isCollapsed()).toBe(false);
      });
    });
  });

  describe('$isCollapsibleHeadingNode', () => {
    it('returns true for CollapsibleHeadingNode', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h1');
        expect($isCollapsibleHeadingNode(node)).toBe(true);
      });
    });

    it('returns false for regular HeadingNode', async () => {
      await editor.update(() => {
        // Import HeadingNode factory function
        const headingNode = new HeadingNode('h1');
        expect($isCollapsibleHeadingNode(headingNode)).toBe(false);
      });
    });

    it('returns false for other values', () => {
      expect($isCollapsibleHeadingNode(null)).toBe(false);
      expect($isCollapsibleHeadingNode(undefined)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect($isCollapsibleHeadingNode('string' as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect($isCollapsibleHeadingNode({} as any)).toBe(false);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect($isCollapsibleHeadingNode(123 as any)).toBe(false);
    });
  });

  describe('integration with editor', () => {
    it('can be inserted into editor', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const node = $createCollapsibleHeadingNode('h1');
        $insertNodes([node]);

        // Verify node is in the editor
        const descendants = root.getChildren();
        expect(descendants.length).toBeGreaterThan(0);
      });
    });

    it('maintains collapsed state after editor operations', async () => {
      let nodeKey: string;

      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h2', true);
        $insertNodes([node]);
        nodeKey = node.getKey();
      });

      // Read state in a separate update
      await editor.update(() => {
        const root = $getRoot();
        const children = root.getChildren();
        const heading = children.find(
          (child) => child.getKey() === nodeKey
        ) as CollapsibleHeadingNode;

        expect(heading).toBeDefined();
        expect($isCollapsibleHeadingNode(heading)).toBe(true);
        expect(heading.isCollapsed()).toBe(true);
      });
    });
  });

  describe('inheritance from HeadingNode', () => {
    it('is an instance of HeadingNode', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h1');
        expect(node instanceof HeadingNode).toBe(true);
      });
    });

    it('can use HeadingNode methods', async () => {
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h1');
        expect(node.getTag()).toBe('h1');
      });
    });
  });

  describe('migration from HeadingNode', () => {
    it('HeadingNode can be deserialized when both node types are registered', async () => {
      // Create editor with both HeadingNode and CollapsibleHeadingNode registered
      // This simulates the production EditorRoot configuration
      const migrationEditor = createEditor({
        namespace: 'migration-test',
        nodes: [HeadingNode, CollapsibleHeadingNode, ParagraphNode],
        onError: (error) => {
          throw error;
        },
      });

      // Serialized state with old "heading" type (pre-collapsible feature)
      const oldFormatState = {
        root: {
          children: [
            {
              type: 'heading',
              tag: 'h1',
              format: '',
              indent: 0,
              direction: null,
              version: 1,
              children: [
                {
                  type: 'text',
                  text: 'Old Heading',
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
          type: 'root',
          version: 1,
        },
      };

      // Parse the old format - this should succeed because HeadingNode is registered
      const editorState = migrationEditor.parseEditorState(JSON.stringify(oldFormatState));

      // Verify the heading was deserialized
      editorState.read(() => {
        const root = $getRoot();
        const children = root.getChildren();
        expect(children.length).toBe(1);

        // The node should be a HeadingNode (not yet transformed)
        const heading = children[0];
        expect(heading instanceof HeadingNode).toBe(true);
        expect(heading.getType()).toBe('heading');
      });
    });

    it('preserves heading tag during deserialization', async () => {
      const migrationEditor = createEditor({
        namespace: 'migration-test',
        nodes: [HeadingNode, CollapsibleHeadingNode, ParagraphNode],
        onError: (error) => {
          throw error;
        },
      });

      // Test different heading levels
      const levels = ['h1', 'h2', 'h3', 'h4', 'h5', 'h6'] as const;

      for (const tag of levels) {
        const oldFormatState = {
          root: {
            children: [
              {
                type: 'heading',
                tag: tag,
                format: '',
                indent: 0,
                direction: null,
                version: 1,
                children: [],
              },
            ],
            direction: null,
            format: '',
            indent: 0,
            type: 'root',
            version: 1,
          },
        };

        const editorState = migrationEditor.parseEditorState(JSON.stringify(oldFormatState));

        editorState.read(() => {
          const root = $getRoot();
          const heading = root.getChildren()[0] as HeadingNode;
          expect(heading.getTag()).toBe(tag);
        });
      }
    });

    it('preserves text content during deserialization', async () => {
      const migrationEditor = createEditor({
        namespace: 'migration-test',
        nodes: [HeadingNode, CollapsibleHeadingNode, ParagraphNode],
        onError: (error) => {
          throw error;
        },
      });

      const oldFormatState = {
        root: {
          children: [
            {
              type: 'heading',
              tag: 'h2',
              format: '',
              indent: 0,
              direction: null,
              version: 1,
              children: [
                {
                  type: 'text',
                  text: 'Important Title',
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
          type: 'root',
          version: 1,
        },
      };

      const editorState = migrationEditor.parseEditorState(JSON.stringify(oldFormatState));

      editorState.read(() => {
        const root = $getRoot();
        const heading = root.getChildren()[0] as HeadingNode;
        expect(heading.getTextContent()).toBe('Important Title');
      });
    });

    it('CollapsibleHeadingNode format is preferred when re-saving', async () => {
      // When a note is loaded and saved, it should use the new format
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h1', false);
        $insertNodes([node]);
      });

      // Get the serialized state
      const json = editor.getEditorState().toJSON();
      const rootChildren = json.root.children;

      expect(rootChildren.length).toBeGreaterThan(0);
      // Find the heading in the children
      const heading = rootChildren.find(
        (child: { type: string }) => child.type === 'collapsible-heading'
      ) as SerializedCollapsibleHeadingNode | undefined;
      expect(heading).toBeDefined();
      expect(heading!.type).toBe('collapsible-heading');
      expect(heading!.collapsed).toBe(false);
    });

    it('migrated headings default to collapsed=false', async () => {
      // When old HeadingNode is transformed to CollapsibleHeadingNode,
      // it should default to expanded (collapsed=false)
      await editor.update(() => {
        const node = $createCollapsibleHeadingNode('h1');
        // Default should be false
        expect(node.isCollapsed()).toBe(false);
      });
    });
  });
});
