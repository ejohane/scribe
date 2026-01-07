## Summary

Implement the `ImageNode` class - a Lexical DecoratorNode that represents an image in the editor. This is the core data structure for images in the content tree.

## Context & Rationale

### DecoratorNode Pattern in Lexical
Lexical uses `DecoratorNode` for nodes that render React components. We already have a working example: `WikiLinkNode.ts`. Key aspects:

1. **Data storage**: Private `__` prefixed properties
2. **Serialization**: `exportJSON()` / `importJSON()` for persistence
3. **Rendering**: `decorate()` returns a React element
4. **DOM**: `createDOM()` / `updateDOM()` for wrapper element

### Why DecoratorNode (not ElementNode)?
- Images are **self-contained** - no child nodes
- Images need **React rendering** - for loading states, error handling, resize handles
- Images are **inline or block** - DecoratorNode supports both via `isInline()`

## Implementation

### File Location
`apps/desktop/renderer/src/components/Editor/plugins/ImageNode.ts`

### Code Implementation
```typescript
/**
 * ImageNode - Lexical DecoratorNode for inline images
 *
 * Represents an image in the editor content tree. The actual image data
 * is stored in the vault assets directory; this node holds a reference
 * to the asset ID.
 *
 * Pattern follows WikiLinkNode implementation.
 */

import {
  DecoratorNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  DOMExportOutput,
  LexicalEditor,
  LexicalNode,
  $applyNodeReplacement,
} from "lexical";
import { createElement } from "react";
import ImageComponent from "./ImageComponent";
import { createLogger } from "@scribe/shared";

const log = createLogger({ prefix: "ImageNode" });

/**
 * Serialized form of ImageNode for JSON persistence
 * 
 * IMPORTANT: The `ext` property stores the file extension to enable:
 * 1. Direct path construction without filesystem lookup
 * 2. Correct markdown export (![alt](./assets/id.ext))
 * 3. Proper MIME type inference for display
 */
export type SerializedImageNode = Spread<
  {
    assetId: string;
    alt: string;
    ext: string;      // File extension (e.g., "png", "jpg") - REQUIRED
    width?: number;
    height?: number;
  },
  SerializedLexicalNode
>;

/**
 * Props passed to the ImageComponent React component
 */
export interface ImageComponentProps {
  assetId: string;
  alt: string;
  ext: string;
  width?: number;
  height?: number;
  nodeKey: NodeKey;
}

/**
 * ImageNode - Represents an embedded image in the editor
 *
 * Stores:
 * - assetId: UUID reference to vault/assets/{assetId}.{ext}
 * - alt: Alt text for accessibility
 * - ext: File extension (png, jpg, gif, webp, svg)
 * - width/height: Optional display dimensions (for resize state)
 *
 * The ImageComponent handles:
 * - Loading the image from the asset path
 * - Displaying loading/error states
 * - Resize handles
 */
export class ImageNode extends DecoratorNode<JSX.Element> {
  __assetId: string;
  __alt: string;
  __ext: string;
  __width?: number;
  __height?: number;

  /**
   * Node type identifier - must be unique across all node types
   */
  static getType(): string {
    return "image";
  }

  /**
   * Clone the node (required for Lexical operations)
   */
  static clone(node: ImageNode): ImageNode {
    return new ImageNode(
      node.__assetId,
      node.__alt,
      node.__ext,
      node.__width,
      node.__height,
      node.__key
    );
  }

  /**
   * Create a new ImageNode
   */
  constructor(
    assetId: string,
    alt: string,
    ext: string,
    width?: number,
    height?: number,
    key?: NodeKey
  ) {
    super(key);
    this.__assetId = assetId;
    this.__alt = alt;
    this.__ext = ext;
    this.__width = width;
    this.__height = height;
  }

  /**
   * Create the DOM wrapper element
   * The actual image is rendered by React via decorate()
   */
  createDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = "editor-image";
    return span;
  }

  /**
   * Update the DOM element (return false = React handles updates)
   */
  updateDOM(): boolean {
    return false;
  }

  /**
   * Export to DOM for clipboard/external use
   */
  exportDOM(): DOMExportOutput {
    const element = document.createElement("img");
    element.setAttribute("data-asset-id", this.__assetId);
    element.setAttribute("data-ext", this.__ext);
    element.setAttribute("alt", this.__alt);
    if (this.__width) element.setAttribute("width", String(this.__width));
    if (this.__height) element.setAttribute("height", String(this.__height));
    return { element };
  }

  /**
   * Render the React component for the image
   */
  decorate(_editor: LexicalEditor): JSX.Element {
    return createElement(ImageComponent, {
      assetId: this.__assetId,
      alt: this.__alt,
      ext: this.__ext,
      width: this.__width,
      height: this.__height,
      nodeKey: this.__key,
    });
  }

  /**
   * Export to JSON for persistence
   */
  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: "image",
      assetId: this.__assetId,
      alt: this.__alt,
      ext: this.__ext,
      width: this.__width,
      height: this.__height,
      version: 1,
    };
  }

  /**
   * Import from JSON (static factory)
   */
  static importJSON(json: SerializedImageNode): ImageNode {
    return $createImageNode(
      json.assetId,
      json.alt,
      json.ext,
      json.width,
      json.height
    );
  }

  /**
   * Images are block-level (not inline like wiki-links)
   */
  isInline(): boolean {
    return false;
  }

  /**
   * Text representation for search/accessibility
   */
  getTextContent(): string {
    return `[Image: ${this.__alt || "untitled"}]`;
  }

  // ============ Getters & Setters ============

  getAssetId(): string {
    return this.__assetId;
  }

  getAlt(): string {
    return this.__alt;
  }

  getExt(): string {
    return this.__ext;
  }

  setAlt(alt: string): void {
    const writable = this.getWritable();
    writable.__alt = alt;
  }

  getWidth(): number | undefined {
    return this.__width;
  }

  getHeight(): number | undefined {
    return this.__height;
  }

  setDimensions(width: number, height: number): void {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
  }
}

/**
 * Create a new ImageNode
 *
 * @param assetId - UUID reference to stored asset
 * @param alt - Alt text for accessibility
 * @param ext - File extension (png, jpg, gif, webp, svg)
 * @param width - Optional display width
 * @param height - Optional display height
 * @returns A new ImageNode instance
 */
export function $createImageNode(
  assetId: string,
  alt: string = "",
  ext: string,
  width?: number,
  height?: number
): ImageNode {
  return $applyNodeReplacement(new ImageNode(assetId, alt, ext, width, height));
}

/**
 * Type guard to check if a node is an ImageNode
 */
export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
```

## Key Changes from Original Spec

### Added `ext` Property (Critical Fix)
The serialization schema now includes `ext: string` for the file extension. This is **required** because:

1. **Direct Path Construction**: `getPath()` no longer needs to search all extensions
2. **Markdown Export**: Can generate `![alt](./assets/{id}.{ext})` correctly
3. **MIME Inference**: Can derive content type from extension
4. **Performance**: O(1) path lookup instead of O(n) extension search

The extension is known at save time (from MIME type) and must be passed to `$createImageNode()`.

## Design Decisions

### Block vs Inline
**Decision**: Images are **block-level** (`isInline() returns false`)
**Rationale**:
- Allows full-width display
- Simpler layout (no inline flow issues)
- Matches behavior in Notion, Obsidian
- Resize handles work better on blocks

### Alt Text Default
**Decision**: Default to empty string ""
**Rationale**:
- Users rarely add alt text manually
- Can prompt for alt text in future UX enhancement
- Empty string is valid for decorative images

### Dimension Storage
**Decision**: Store optional width/height
**Rationale**:
- Enables resize state persistence
- User resizes should survive save/reload
- Natural dimensions come from the image file itself

## Files to Create

- `apps/desktop/renderer/src/components/Editor/plugins/ImageNode.ts`

## Testing

### Test File Location
`apps/desktop/renderer/src/components/Editor/plugins/__tests__/ImageNode.test.ts`

### Unit Tests
```typescript
import { $createImageNode, $isImageNode, ImageNode, SerializedImageNode } from "../ImageNode";
import { $getRoot, $createParagraphNode, LexicalEditor } from "lexical";
import { createHeadlessEditor } from "@lexical/headless";

describe("ImageNode", () => {
  let editor: LexicalEditor;

  beforeEach(() => {
    editor = createHeadlessEditor({
      nodes: [ImageNode],
    });
  });

  it("should create an ImageNode with assetId and ext", () => {
    editor.update(() => {
      const node = $createImageNode("test-asset-id", "Test image", "png");
      expect(node.getAssetId()).toBe("test-asset-id");
      expect(node.getAlt()).toBe("Test image");
      expect(node.getExt()).toBe("png");
    });
  });

  it("should serialize to JSON correctly including ext", () => {
    editor.update(() => {
      const node = $createImageNode("asset-123", "My image", "jpg", 800, 600);
      const json = node.exportJSON();
      
      expect(json.type).toBe("image");
      expect(json.assetId).toBe("asset-123");
      expect(json.alt).toBe("My image");
      expect(json.ext).toBe("jpg");
      expect(json.width).toBe(800);
      expect(json.height).toBe(600);
    });
  });

  it("should import from JSON correctly", () => {
    const json: SerializedImageNode = {
      type: "image",
      assetId: "imported-id",
      alt: "Imported image",
      ext: "gif",
      width: 400,
      version: 1,
    };
    
    editor.update(() => {
      const node = ImageNode.importJSON(json);
      expect(node.getAssetId()).toBe("imported-id");
      expect(node.getExt()).toBe("gif");
      expect(node.getWidth()).toBe(400);
    });
  });

  it("should update dimensions", () => {
    editor.update(() => {
      const node = $createImageNode("asset-id", "", "png");
      node.setDimensions(1024, 768);
      
      expect(node.getWidth()).toBe(1024);
      expect(node.getHeight()).toBe(768);
    });
  });

  it("should identify as not inline", () => {
    editor.update(() => {
      const node = $createImageNode("asset-id", "", "png");
      expect(node.isInline()).toBe(false);
    });
  });
});
```

## Acceptance Criteria

- [ ] ImageNode class extends DecoratorNode
- [ ] Stores assetId, alt, ext, width, height properties
- [ ] `ext` is required in constructor and serialization
- [ ] exportJSON() / importJSON() work correctly with ext field
- [ ] decorate() returns ImageComponent element with ext prop
- [ ] $createImageNode() requires ext parameter
- [ ] $isImageNode() helper exported
- [ ] Getters and setters for all properties including getExt()
- [ ] Unit tests pass
- [ ] TypeScript compiles without errors

## Dependencies

**Depends on**: 
- scribe-m7v (epic)
- scribe-m7v.3 (IPC contract types - for AssetsAPI type alignment)

**Note**: Does NOT depend on m7v.5 (preload) - ImageNode is a pure data structure that doesn't call IPC directly. The ImageComponent (m7v.7) is what needs the preload bridge.

**Blocks**: 
- scribe-m7v.7 (ImageComponent needs this)
- scribe-m7v.8 (ImagePlugin needs this)
- scribe-m7v.11 (Markdown export uses ext field)

## Notes for Implementer

- Follow WikiLinkNode pattern closely
- The ImageComponent is implemented in the next task
- Keep the node class focused on data; rendering logic goes in component
- Use $applyNodeReplacement for proper Lexical registration
- **ext is REQUIRED** - don't make it optional, ensure callers provide it
