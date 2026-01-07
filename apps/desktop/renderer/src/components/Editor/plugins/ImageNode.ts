import {
  DecoratorNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  DOMExportOutput,
  LexicalEditor,
  LexicalNode,
  $applyNodeReplacement,
} from 'lexical';
import { createElement } from 'react';
import ImageComponent from './ImageComponent';

/**
 * Serialized form of ImageNode for JSON export/import
 */
export type SerializedImageNode = Spread<
  {
    assetId: string;
    alt: string;
    ext: string; // File extension (e.g., "png", "jpg") - REQUIRED
    width?: number;
    height?: number;
  },
  SerializedLexicalNode
>;

/**
 * Props for the ImageComponent React component
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
 * Custom Lexical DecoratorNode for images.
 *
 * Images are block-level nodes that store:
 * - assetId: The unique identifier for the image asset
 * - alt: Alternative text for accessibility
 * - ext: File extension (e.g., "png", "jpg") - required for path construction
 * - width: Optional width in pixels
 * - height: Optional height in pixels
 *
 * The node renders as a block-level span with the 'editor-image' class.
 */
export class ImageNode extends DecoratorNode<JSX.Element> {
  __assetId: string;
  __alt: string;
  __ext: string;
  __width?: number;
  __height?: number;

  static getType(): string {
    return 'image';
  }

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

  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = 'editor-image';
    return span;
  }

  updateDOM(): boolean {
    // Returning false tells Lexical that the decorator component handles all updates
    return false;
  }

  exportDOM(): DOMExportOutput {
    const img = document.createElement('img');
    img.setAttribute('src', `asset://${this.__assetId}.${this.__ext}`);
    img.setAttribute('alt', this.__alt);
    if (this.__width !== undefined) {
      img.setAttribute('width', String(this.__width));
    }
    if (this.__height !== undefined) {
      img.setAttribute('height', String(this.__height));
    }
    return { element: img };
  }

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

  exportJSON(): SerializedImageNode {
    return {
      ...super.exportJSON(),
      type: 'image',
      assetId: this.__assetId,
      alt: this.__alt,
      ext: this.__ext,
      width: this.__width,
      height: this.__height,
      version: 1,
    };
  }

  static importJSON(json: SerializedImageNode): ImageNode {
    return $createImageNode(json.assetId, json.alt, json.ext, json.width, json.height);
  }

  isInline(): boolean {
    return false; // Block-level node
  }

  getTextContent(): string {
    return `[Image: ${this.__alt}]`;
  }

  // Getters
  getAssetId(): string {
    return this.__assetId;
  }

  getAlt(): string {
    return this.__alt;
  }

  getExt(): string {
    return this.__ext;
  }

  getWidth(): number | undefined {
    return this.__width;
  }

  getHeight(): number | undefined {
    return this.__height;
  }

  // Setters
  setAlt(alt: string): this {
    const writable = this.getWritable();
    writable.__alt = alt;
    return writable;
  }

  setDimensions(width?: number, height?: number): this {
    const writable = this.getWritable();
    writable.__width = width;
    writable.__height = height;
    return writable;
  }
}

/**
 * Creates a new ImageNode
 *
 * @param assetId - The unique identifier for the image asset
 * @param alt - Alternative text for accessibility (defaults to empty string)
 * @param ext - File extension (e.g., "png", "jpg") - REQUIRED
 * @param width - Optional width in pixels
 * @param height - Optional height in pixels
 * @returns A new ImageNode instance
 */
export function $createImageNode(
  assetId: string,
  alt: string = '',
  ext: string,
  width?: number,
  height?: number
): ImageNode {
  return $applyNodeReplacement(new ImageNode(assetId, alt, ext, width, height));
}

/**
 * Type guard to check if a node is an ImageNode
 *
 * @param node - The node to check
 * @returns True if the node is an ImageNode
 */
export function $isImageNode(node: LexicalNode | null | undefined): node is ImageNode {
  return node instanceof ImageNode;
}
