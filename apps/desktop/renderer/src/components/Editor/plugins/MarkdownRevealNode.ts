/**
 * MarkdownRevealNode - A transient DecoratorNode for revealing markdown syntax.
 *
 * This node displays reconstructed markdown syntax (e.g., "**bold**") when the
 * cursor enters a formatted text region. It's designed to be transient - inserted
 * when the cursor enters a formatted region and removed when the cursor exits.
 *
 * The node is NOT meant to be persisted to storage.
 */

import {
  DecoratorNode,
  NodeKey,
  EditorConfig,
  LexicalNode,
  SerializedLexicalNode,
  Spread,
  $applyNodeReplacement,
} from 'lexical';
import { ReactNode, createElement } from 'react';
import {
  reconstructInlineMarkdown,
  reconstructMarkdownSegments,
  IS_CODE,
  IS_STRIKETHROUGH,
} from './markdownReconstruction';

/**
 * Serialized form of MarkdownRevealNode for JSON export/import.
 * Note: This node should not typically be persisted, but serialization
 * is implemented for completeness and potential debugging.
 */
export type SerializedMarkdownRevealNode = Spread<
  {
    text: string;
    format: number;
  },
  SerializedLexicalNode
>;

/**
 * Props for the MarkdownRevealComponent React component.
 */
export interface MarkdownRevealComponentProps {
  text: string;
  format: number;
}

/**
 * A DecoratorNode that displays reconstructed markdown syntax.
 *
 * This node is used transiently - it's inserted when the cursor enters
 * a formatted region and removed when the cursor exits. It's not meant
 * to be persisted.
 *
 * The node stores:
 * - __text: The original text content
 * - __format: The Lexical format bitmask
 *
 * It renders the reconstructed markdown (e.g., "**bold**") using
 * special styling to differentiate delimiters from content.
 *
 * @example
 * ```tsx
 * // Create a reveal node for bold text
 * const node = $createMarkdownRevealNode('hello', IS_BOLD);
 * // Renders: **hello**
 * ```
 */
export class MarkdownRevealNode extends DecoratorNode<ReactNode> {
  /** The original text content */
  __text: string;
  /** The Lexical format bitmask (bold, italic, etc.) */
  __format: number;

  /**
   * Returns the type identifier for this node.
   * @returns The string 'markdown-reveal'
   */
  static getType(): string {
    return 'markdown-reveal';
  }

  /**
   * Creates a clone of the given MarkdownRevealNode.
   * @param node - The node to clone
   * @returns A new MarkdownRevealNode with the same properties
   */
  static clone(node: MarkdownRevealNode): MarkdownRevealNode {
    return new MarkdownRevealNode(node.__text, node.__format, node.__key);
  }

  /**
   * Creates a new MarkdownRevealNode.
   * @param text - The original text content
   * @param format - The Lexical format bitmask
   * @param key - Optional node key
   */
  constructor(text: string, format: number, key?: NodeKey) {
    super(key);
    this.__text = text;
    this.__format = format;
  }

  /**
   * Creates the DOM element for this node.
   * @param _config - The editor configuration (unused)
   * @returns A span element with the 'markdown-reveal' class
   */
  createDOM(_config: EditorConfig): HTMLElement {
    const span = document.createElement('span');
    span.className = 'markdown-reveal';
    // Add data attribute for code format to enable monospace styling
    if (this.__format & IS_CODE) {
      span.setAttribute('data-format-code', 'true');
    }
    // Add data attribute for strikethrough format to preserve line-through styling
    if (this.__format & IS_STRIKETHROUGH) {
      span.setAttribute('data-format-strikethrough', 'true');
    }
    return span;
  }

  /**
   * Determines if the DOM needs to be updated.
   * @returns false - the decorator component handles all updates
   */
  updateDOM(): false {
    return false;
  }

  /**
   * Returns the React component to render for this node.
   * Uses the reconstructInlineMarkdown utility to convert the format
   * bitmask back into markdown syntax.
   * @returns A React element displaying the revealed markdown
   */
  decorate(): ReactNode {
    return createElement(MarkdownRevealComponent, {
      text: this.__text,
      format: this.__format,
    });
  }

  /**
   * Gets the text content of this node.
   * @returns The original text content
   */
  getText(): string {
    return this.getLatest().__text;
  }

  /**
   * Gets the format bitmask of this node.
   * @returns The Lexical format bitmask
   */
  getFormat(): number {
    return this.getLatest().__format;
  }

  /**
   * Exports this node to JSON format.
   * Note: This node should not typically be persisted.
   * @returns The serialized node data
   */
  exportJSON(): SerializedMarkdownRevealNode {
    return {
      type: 'markdown-reveal',
      version: 1,
      text: this.__text,
      format: this.__format,
    };
  }

  /**
   * Creates a MarkdownRevealNode from serialized JSON data.
   * @param json - The serialized node data
   * @returns A new MarkdownRevealNode
   */
  static importJSON(json: SerializedMarkdownRevealNode): MarkdownRevealNode {
    return $createMarkdownRevealNode(json.text, json.format);
  }

  /**
   * Indicates that this node is inline (flows with text).
   * @returns true - this node is inline
   */
  isInline(): boolean {
    return true;
  }

  /**
   * Returns the text content for copy/paste and search operations.
   * Returns the reconstructed markdown syntax.
   * @returns The markdown representation of the text
   */
  getTextContent(): string {
    return reconstructInlineMarkdown(this.__text, this.__format);
  }
}

/**
 * React component that renders the revealed markdown.
 *
 * The component displays the reconstructed markdown syntax with
 * distinct styling for delimiters vs content:
 * - Delimiters (**, *, ~~, `) are rendered muted/gray
 * - Content is rendered with normal text styling
 *
 * @param props - The component props
 * @param props.text - The original text content
 * @param props.format - The Lexical format bitmask
 */
function MarkdownRevealComponent({ text, format }: MarkdownRevealComponentProps): ReactNode {
  const segments = reconstructMarkdownSegments(text, format);

  // Render each segment with appropriate styling
  const children = segments.map((segment, index) => {
    if (segment.type === 'delimiter') {
      return createElement(
        'span',
        {
          key: index,
          className: 'markdown-reveal-delimiter',
        },
        segment.value
      );
    }
    // Content segment - render without special styling
    return createElement(
      'span',
      {
        key: index,
        className: 'markdown-reveal-text',
      },
      segment.value
    );
  });

  return createElement('span', { className: 'markdown-reveal-content' }, ...children);
}

/**
 * Creates a new MarkdownRevealNode.
 *
 * @param text - The original text content
 * @param format - The Lexical format bitmask (e.g., IS_BOLD | IS_ITALIC)
 * @returns A new MarkdownRevealNode instance
 *
 * @example
 * ```tsx
 * import { IS_BOLD, IS_ITALIC } from './markdownReconstruction';
 *
 * // Create a node for bold text
 * const boldNode = $createMarkdownRevealNode('hello', IS_BOLD);
 *
 * // Create a node for bold+italic text
 * const boldItalicNode = $createMarkdownRevealNode('world', IS_BOLD | IS_ITALIC);
 * ```
 */
export function $createMarkdownRevealNode(text: string, format: number): MarkdownRevealNode {
  return $applyNodeReplacement(new MarkdownRevealNode(text, format));
}

/**
 * Type guard to check if a node is a MarkdownRevealNode.
 *
 * @param node - The node to check
 * @returns true if the node is a MarkdownRevealNode
 *
 * @example
 * ```tsx
 * if ($isMarkdownRevealNode(node)) {
 *   const text = node.getText();
 *   const format = node.getFormat();
 * }
 * ```
 */
export function $isMarkdownRevealNode(
  node: LexicalNode | null | undefined
): node is MarkdownRevealNode {
  return node instanceof MarkdownRevealNode;
}
