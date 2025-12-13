import {
  DecoratorNode,
  NodeKey,
  SerializedLexicalNode,
  Spread,
  DOMExportOutput,
  LexicalNode,
} from 'lexical';
import type { NoteId } from '@scribe/shared';

/**
 * Base serialized form for inline link nodes
 *
 * Subclasses should extend this with their specific properties using Spread<>
 */
export type SerializedInlineLinkNode = Spread<
  {
    displayText: string;
    targetId: NoteId | null;
  },
  SerializedLexicalNode
>;

/**
 * Base props for inline link components
 *
 * Subclass components should extend this with their specific props
 */
export interface InlineLinkComponentProps {
  displayText: string;
  targetId: NoteId | null;
  nodeKey: NodeKey;
}

/**
 * Abstract base class for inline link nodes in the Lexical editor.
 *
 * This class provides shared functionality for nodes that:
 * - Display inline in the editor (isInline() returns true)
 * - Store a target ID (NoteId) and display text
 * - Render as a span element with a specific CSS class
 * - Use a React decorator component for rendering
 *
 * Subclasses must implement:
 * - static getType(): string - The unique node type identifier
 * - static clone(): The clone method for the specific node type
 * - getClassName(): string - The CSS class for the span element
 * - decorate(): JSX.Element - The decorator component rendering
 * - exportJSON(): The serialization method for the specific node type
 * - static importJSON(): The deserialization method for the specific node type
 *
 * Examples of subclasses:
 * - WikiLinkNode: Internal note links using [[note]] syntax
 * - PersonMentionNode: Person references using @name syntax
 */
export abstract class InlineLinkNode extends DecoratorNode<JSX.Element> {
  __displayText: string;
  __targetId: NoteId | null;

  constructor(displayText: string, targetId: NoteId | null, key?: NodeKey) {
    super(key);
    this.__displayText = displayText;
    this.__targetId = targetId;
  }

  /**
   * Returns the CSS class name for this node's DOM element.
   * Subclasses must implement this to provide their specific class.
   */
  abstract getClassName(): string;

  /**
   * Creates the DOM element for this node.
   * Uses the class name provided by getClassName().
   */
  createDOM(): HTMLElement {
    const span = document.createElement('span');
    span.className = this.getClassName();
    return span;
  }

  /**
   * Returns false to indicate that the decorator component handles all updates.
   * This is standard for DecoratorNodes that use React components.
   */
  updateDOM(): boolean {
    return false;
  }

  /**
   * Exports the DOM representation of this node.
   * Creates a span with the class name and display text.
   */
  exportDOM(): DOMExportOutput {
    const element = document.createElement('span');
    element.className = this.getClassName();
    element.textContent = this.getDisplayText();
    return { element };
  }

  /**
   * Returns true to indicate this is an inline node.
   * Inline nodes are rendered within the text flow, not as block elements.
   */
  isInline(): boolean {
    return true;
  }

  /**
   * Returns the text content for this node.
   * Used for copy/paste and text extraction.
   * Subclasses can override this to customize the text representation.
   */
  getTextContent(): string {
    return this.__displayText;
  }

  /**
   * Returns the display text for this node.
   */
  getDisplayText(): string {
    return this.__displayText;
  }

  /**
   * Returns the target ID for this node.
   */
  getTargetId(): NoteId | null {
    return this.__targetId;
  }

  /**
   * Creates the base serialization for exportJSON.
   * Subclasses should call this and extend with their specific properties.
   */
  protected exportBaseJSON(): SerializedInlineLinkNode {
    return {
      ...super.exportJSON(),
      displayText: this.__displayText,
      targetId: this.__targetId,
    };
  }
}

/**
 * Type guard to check if a node is an InlineLinkNode
 *
 * @param node - The node to check
 * @returns True if the node is an InlineLinkNode (or subclass)
 */
export function $isInlineLinkNode(node: LexicalNode | null | undefined): node is InlineLinkNode {
  return node instanceof InlineLinkNode;
}
