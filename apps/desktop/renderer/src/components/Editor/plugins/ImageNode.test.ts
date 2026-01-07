import { describe, it, expect, beforeEach } from 'vitest';
import { createEditor, $getRoot, $insertNodes, LexicalEditor } from 'lexical';
import { ImageNode, $createImageNode, $isImageNode, SerializedImageNode } from './ImageNode';

describe('ImageNode', () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createEditor({
      namespace: 'test',
      nodes: [ImageNode],
      onError: (error) => {
        throw error;
      },
    });
  });

  describe('static getType', () => {
    it('returns "image"', () => {
      expect(ImageNode.getType()).toBe('image');
    });
  });

  describe('constructor and properties', () => {
    it('can be created with all properties', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset123', 'A test image', 'png', 800, 600);
        expect(node.__assetId).toBe('asset123');
        expect(node.__alt).toBe('A test image');
        expect(node.__ext).toBe('png');
        expect(node.__width).toBe(800);
        expect(node.__height).toBe(600);
      });
    });

    it('can be created with required properties only', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset456', '', 'jpg');
        expect(node.__assetId).toBe('asset456');
        expect(node.__alt).toBe('');
        expect(node.__ext).toBe('jpg');
        expect(node.__width).toBeUndefined();
        expect(node.__height).toBeUndefined();
      });
    });

    it('uses empty string as default alt text', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset789', undefined as unknown as string, 'gif');
        // The default parameter should make alt an empty string when undefined
        expect(node.__alt).toBe('');
      });
    });
  });

  describe('clone', () => {
    it('clones node preserving all properties', async () => {
      await editor.update(() => {
        const original = $createImageNode('assetABC', 'My image', 'webp', 1024, 768);
        const cloned = ImageNode.clone(original);

        expect(cloned.__assetId).toBe('assetABC');
        expect(cloned.__alt).toBe('My image');
        expect(cloned.__ext).toBe('webp');
        expect(cloned.__width).toBe(1024);
        expect(cloned.__height).toBe(768);
        expect(cloned.__key).toBe(original.__key);
      });
    });

    it('clones node with undefined dimensions', async () => {
      await editor.update(() => {
        const original = $createImageNode('assetXYZ', 'Simple image', 'png');
        const cloned = ImageNode.clone(original);

        expect(cloned.__width).toBeUndefined();
        expect(cloned.__height).toBeUndefined();
      });
    });
  });

  describe('createDOM', () => {
    it('creates span with editor-image class', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'test', 'png');
        const dom = node.createDOM();

        expect(dom.tagName).toBe('SPAN');
        expect(dom.className).toBe('editor-image');
      });
    });
  });

  describe('updateDOM', () => {
    it('returns false (decorator handles updates)', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'test', 'png');
        expect(node.updateDOM()).toBe(false);
      });
    });
  });

  describe('isInline', () => {
    it('returns false (block-level)', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'test', 'png');
        expect(node.isInline()).toBe(false);
      });
    });
  });

  describe('getTextContent', () => {
    it('returns [Image: alt] format', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset123', 'My screenshot', 'png');
        expect(node.getTextContent()).toBe('[Image: My screenshot]');
      });
    });

    it('returns [Image: ] for empty alt', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset123', '', 'png');
        expect(node.getTextContent()).toBe('[Image: ]');
      });
    });
  });

  describe('getters', () => {
    it('getAssetId returns assetId', async () => {
      await editor.update(() => {
        const node = $createImageNode('myAsset', 'alt', 'png');
        expect(node.getAssetId()).toBe('myAsset');
      });
    });

    it('getAlt returns alt text', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'My alt text', 'png');
        expect(node.getAlt()).toBe('My alt text');
      });
    });

    it('getExt returns file extension', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'alt', 'jpeg');
        expect(node.getExt()).toBe('jpeg');
      });
    });

    it('getWidth returns width', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'alt', 'png', 500);
        expect(node.getWidth()).toBe(500);
      });
    });

    it('getHeight returns height', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'alt', 'png', 500, 300);
        expect(node.getHeight()).toBe(300);
      });
    });
  });

  describe('setters', () => {
    it('setAlt updates alt text', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'old alt', 'png');
        node.setAlt('new alt');
        expect(node.getAlt()).toBe('new alt');
      });
    });

    it('setDimensions updates width and height', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'alt', 'png');
        node.setDimensions(640, 480);
        expect(node.getWidth()).toBe(640);
        expect(node.getHeight()).toBe(480);
      });
    });

    it('setDimensions can clear dimensions', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'alt', 'png', 800, 600);
        node.setDimensions(undefined, undefined);
        expect(node.getWidth()).toBeUndefined();
        expect(node.getHeight()).toBeUndefined();
      });
    });
  });

  describe('JSON serialization', () => {
    it('exportJSON includes all properties', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset123', 'Screenshot', 'png', 1920, 1080);
        const json = node.exportJSON();

        expect(json.type).toBe('image');
        expect(json.assetId).toBe('asset123');
        expect(json.alt).toBe('Screenshot');
        expect(json.ext).toBe('png');
        expect(json.width).toBe(1920);
        expect(json.height).toBe(1080);
        expect(json.version).toBe(1);
      });
    });

    it('exportJSON includes ext field (required)', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', '', 'webp');
        const json = node.exportJSON();

        expect(json.ext).toBe('webp');
      });
    });

    it('exportJSON handles undefined dimensions', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'alt', 'jpg');
        const json = node.exportJSON();

        expect(json.width).toBeUndefined();
        expect(json.height).toBeUndefined();
      });
    });

    it('importJSON creates node from serialized data', async () => {
      const serialized: SerializedImageNode = {
        type: 'image',
        assetId: 'imported-asset',
        alt: 'Imported image',
        ext: 'gif',
        width: 400,
        height: 300,
        version: 1,
      };

      await editor.update(() => {
        const node = ImageNode.importJSON(serialized);

        expect(node.__assetId).toBe('imported-asset');
        expect(node.__alt).toBe('Imported image');
        expect(node.__ext).toBe('gif');
        expect(node.__width).toBe(400);
        expect(node.__height).toBe(300);
      });
    });

    it('importJSON handles missing optional fields', async () => {
      const serialized: SerializedImageNode = {
        type: 'image',
        assetId: 'minimal-asset',
        alt: '',
        ext: 'png',
        version: 1,
      };

      await editor.update(() => {
        const node = ImageNode.importJSON(serialized);

        expect(node.__assetId).toBe('minimal-asset');
        expect(node.__ext).toBe('png');
        expect(node.__width).toBeUndefined();
        expect(node.__height).toBeUndefined();
      });
    });

    it('JSON round-trip preserves all data', async () => {
      await editor.update(() => {
        const original = $createImageNode('roundtrip', 'Test image', 'svg', 200, 150);
        const json = original.exportJSON();
        const restored = ImageNode.importJSON(json);

        expect(restored.__assetId).toBe(original.__assetId);
        expect(restored.__alt).toBe(original.__alt);
        expect(restored.__ext).toBe(original.__ext);
        expect(restored.__width).toBe(original.__width);
        expect(restored.__height).toBe(original.__height);
      });
    });
  });

  describe('decorate', () => {
    it('returns a JSX element with correct props', async () => {
      await editor.update(() => {
        const node = $createImageNode('decorateAsset', 'Decorated', 'png', 100, 50);
        const element = node.decorate(editor);

        // The element should be a React element (created with createElement)
        expect(element).toBeDefined();
        expect(element.type).toBeDefined();
        expect(element.props.assetId).toBe('decorateAsset');
        expect(element.props.alt).toBe('Decorated');
        expect(element.props.ext).toBe('png');
        expect(element.props.width).toBe(100);
        expect(element.props.height).toBe(50);
        expect(element.props.nodeKey).toBeDefined();
      });
    });
  });

  describe('exportDOM', () => {
    it('creates an img element with correct attributes', async () => {
      await editor.update(() => {
        const node = $createImageNode('domAsset', 'DOM test', 'jpg', 640, 480);
        const { element } = node.exportDOM();
        const img = element as HTMLImageElement;

        expect(img.tagName).toBe('IMG');
        expect(img.getAttribute('src')).toBe('asset://domAsset.jpg');
        expect(img.getAttribute('alt')).toBe('DOM test');
        expect(img.getAttribute('width')).toBe('640');
        expect(img.getAttribute('height')).toBe('480');
      });
    });

    it('creates img element without width/height when undefined', async () => {
      await editor.update(() => {
        const node = $createImageNode('simpleAsset', 'Simple', 'png');
        const { element } = node.exportDOM();
        const img = element as HTMLImageElement;

        expect(img.tagName).toBe('IMG');
        expect(img.getAttribute('src')).toBe('asset://simpleAsset.png');
        expect(img.getAttribute('alt')).toBe('Simple');
        expect(img.hasAttribute('width')).toBe(false);
        expect(img.hasAttribute('height')).toBe(false);
      });
    });
  });

  describe('$isImageNode', () => {
    it('returns true for ImageNode', async () => {
      await editor.update(() => {
        const node = $createImageNode('asset', 'test', 'png');
        expect($isImageNode(node)).toBe(true);
      });
    });

    it('returns false for null', () => {
      expect($isImageNode(null)).toBe(false);
    });

    it('returns false for undefined', () => {
      expect($isImageNode(undefined)).toBe(false);
    });

    it('returns false for other values', () => {
      expect($isImageNode('string' as unknown as null)).toBe(false);
      expect($isImageNode({} as unknown as null)).toBe(false);
      expect($isImageNode(123 as unknown as null)).toBe(false);
    });
  });

  describe('integration with editor', () => {
    it('can be inserted into editor', async () => {
      await editor.update(() => {
        const root = $getRoot();
        const node = $createImageNode('editorAsset', 'Editor test', 'png');
        $insertNodes([node]);

        expect(root.getTextContent()).toBe('[Image: Editor test]');
      });
    });
  });
});
