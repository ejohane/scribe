import { HeadingNode, SerializedHeadingNode, HeadingTagType } from '@lexical/rich-text';
import {
  NodeKey,
  Spread,
  LexicalNode,
  EditorConfig,
  DOMExportOutput,
  LexicalEditor,
  DOMConversionMap,
} from 'lexical';

/**
 * Serialized form of CollapsibleHeadingNode for JSON export/import.
 * Extends SerializedHeadingNode with a collapsed state.
 */
export type SerializedCollapsibleHeadingNode = Spread<
  { collapsed: boolean },
  SerializedHeadingNode
>;

/**
 * Custom Lexical node that extends HeadingNode with collapse/expand functionality.
 *
 * This node preserves all heading semantics (h1-h6, markdown shortcuts) while adding:
 * - Collapsed state tracking via __collapsed property
 * - data-collapsed attribute on DOM for CSS-based visibility control
 * - collapsible-heading class for fold icon positioning
 * - Full JSON serialization for persistence
 *
 * Design decisions:
 * - Extends HeadingNode (not DecoratorNode) to preserve heading behavior
 * - Default collapsed=false (new headings are expanded)
 * - CSS handles content visibility via data-collapsed attribute
 */
export class CollapsibleHeadingNode extends HeadingNode {
  __collapsed: boolean;

  static getType(): string {
    return 'collapsible-heading';
  }

  static clone(node: CollapsibleHeadingNode): CollapsibleHeadingNode {
    return new CollapsibleHeadingNode(node.__tag, node.__collapsed, node.__key);
  }

  constructor(tag: HeadingTagType, collapsed: boolean = false, key?: NodeKey) {
    super(tag, key);
    this.__collapsed = collapsed;
  }

  /**
   * Creates DOM element with data-collapsed attribute for CSS targeting.
   * Adds collapsible-heading class as a styling hook.
   */
  createDOM(config: EditorConfig): HTMLElement {
    const dom = super.createDOM(config);
    dom.setAttribute('data-collapsed', String(this.__collapsed));
    dom.classList.add('collapsible-heading');
    return dom;
  }

  /**
   * Updates DOM when node properties change.
   * Returns true if the DOM was updated (signals Lexical to re-render children).
   */
  updateDOM(prevNode: this, dom: HTMLElement, config: EditorConfig): boolean {
    const updated = super.updateDOM(prevNode, dom, config);
    if (prevNode.__collapsed !== this.__collapsed) {
      dom.setAttribute('data-collapsed', String(this.__collapsed));
    }
    return updated;
  }

  /**
   * Exports DOM for copy/paste and HTML export.
   */
  exportDOM(editor: LexicalEditor): DOMExportOutput {
    const output = super.exportDOM(editor);
    if (output.element instanceof HTMLElement) {
      output.element.setAttribute('data-collapsed', String(this.__collapsed));
      output.element.classList.add('collapsible-heading');
    }
    return output;
  }

  /**
   * Import DOM conversion map - allows parsing HTML into CollapsibleHeadingNode.
   */
  static importDOM(): DOMConversionMap | null {
    // For now, use the parent's DOM conversion
    // Collapsible headings are created via the API, not from pasted HTML
    return null;
  }

  // State accessors

  /**
   * Returns the current collapsed state.
   * Uses getLatest() to ensure we read from the latest version of the node.
   */
  isCollapsed(): boolean {
    return this.getLatest().__collapsed;
  }

  /**
   * Sets the collapsed state.
   * Uses getWritable() to ensure we're modifying a writable version.
   */
  setCollapsed(collapsed: boolean): void {
    const writable = this.getWritable();
    writable.__collapsed = collapsed;
  }

  /**
   * Toggles the collapsed state between true and false.
   */
  toggleCollapsed(): void {
    this.setCollapsed(!this.isCollapsed());
  }

  /**
   * Returns the heading tag (h1-h6).
   * Inherited from HeadingNode but included for clarity.
   */
  getTag(): HeadingTagType {
    return super.getTag();
  }

  // JSON serialization for persistence

  /**
   * Exports node to JSON for persistence.
   * Includes the collapsed state alongside standard heading properties.
   */
  exportJSON(): SerializedCollapsibleHeadingNode {
    return {
      ...super.exportJSON(),
      type: 'collapsible-heading',
      collapsed: this.__collapsed,
    };
  }

  /**
   * Imports node from JSON.
   * Restores the collapsed state from persisted data.
   */
  static importJSON(json: SerializedCollapsibleHeadingNode): CollapsibleHeadingNode {
    const node = $createCollapsibleHeadingNode(json.tag, json.collapsed);
    // Import format and other properties from the parent
    node.setFormat(json.format);
    node.setIndent(json.indent);
    node.setDirection(json.direction);
    return node;
  }
}

/**
 * Creates a new CollapsibleHeadingNode.
 *
 * @param tag - The heading level ('h1' through 'h6')
 * @param collapsed - Initial collapsed state (defaults to false)
 * @returns A new CollapsibleHeadingNode instance
 *
 * @example
 * ```typescript
 * // Create an expanded h2 heading
 * const heading = $createCollapsibleHeadingNode('h2');
 *
 * // Create a collapsed h3 heading
 * const collapsed = $createCollapsibleHeadingNode('h3', true);
 * ```
 */
export function $createCollapsibleHeadingNode(
  tag: HeadingTagType,
  collapsed: boolean = false
): CollapsibleHeadingNode {
  return new CollapsibleHeadingNode(tag, collapsed);
}

/**
 * Type guard to check if a node is a CollapsibleHeadingNode.
 *
 * @param node - The node to check
 * @returns True if the node is a CollapsibleHeadingNode
 *
 * @example
 * ```typescript
 * if ($isCollapsibleHeadingNode(node)) {
 *   console.log('Collapsed:', node.isCollapsed());
 * }
 * ```
 */
export function $isCollapsibleHeadingNode(
  node: LexicalNode | null | undefined
): node is CollapsibleHeadingNode {
  return node instanceof CollapsibleHeadingNode;
}
