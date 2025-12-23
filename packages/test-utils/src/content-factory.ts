/**
 * Test Content Factory
 *
 * Utilities for creating EditorContent structures for testing.
 * These helpers make it easy to create complex Lexical content
 * for testing extractors, renderers, and transformers.
 *
 * @module @scribe/test-utils/content-factory
 */

import type { EditorContent, EditorNode } from '@scribe/shared';

// ============================================================================
// Text Nodes
// ============================================================================

/**
 * Text format flags (bitmask values).
 */
export const TextFormat = {
  /** No formatting */
  NONE: 0,
  /** Bold text */
  BOLD: 1,
  /** Italic text */
  ITALIC: 2,
  /** Bold + Italic */
  BOLD_ITALIC: 3,
  /** Strikethrough text */
  STRIKETHROUGH: 4,
  /** Underline text */
  UNDERLINE: 8,
  /** Code (inline monospace) */
  CODE: 16,
  /** Subscript text */
  SUBSCRIPT: 32,
  /** Superscript text */
  SUPERSCRIPT: 64,
} as const;

/**
 * Create a text node.
 *
 * @param text - The text content
 * @param format - Format flags (use TextFormat constants)
 * @returns An EditorNode representing text
 */
export function text(textContent: string, format: number = TextFormat.NONE): EditorNode {
  return {
    type: 'text',
    format,
    style: '',
    mode: 'normal',
    detail: 0,
    text: textContent,
  };
}

/**
 * Create a bold text node.
 */
export function bold(textContent: string): EditorNode {
  return text(textContent, TextFormat.BOLD);
}

/**
 * Create an italic text node.
 */
export function italic(textContent: string): EditorNode {
  return text(textContent, TextFormat.ITALIC);
}

/**
 * Create a strikethrough text node.
 */
export function strikethrough(textContent: string): EditorNode {
  return text(textContent, TextFormat.STRIKETHROUGH);
}

/**
 * Create an inline code text node.
 */
export function code(textContent: string): EditorNode {
  return text(textContent, TextFormat.CODE);
}

// ============================================================================
// Block Nodes
// ============================================================================

/**
 * Create a paragraph node.
 *
 * @param children - Child nodes (text, links, mentions, etc.)
 * @returns An EditorNode representing a paragraph
 */
export function paragraph(...children: EditorNode[]): EditorNode {
  return {
    type: 'paragraph',
    format: '',
    indent: 0,
    children,
  };
}

/**
 * Create a heading node.
 *
 * @param level - Heading level (1-6)
 * @param children - Child nodes
 * @returns An EditorNode representing a heading
 */
export function heading(level: 1 | 2 | 3 | 4 | 5 | 6, ...children: EditorNode[]): EditorNode {
  return {
    type: 'heading',
    format: '',
    indent: 0,
    tag: `h${level}`,
    children,
  };
}

/**
 * Create a blockquote node.
 *
 * @param children - Child nodes
 * @returns An EditorNode representing a blockquote
 */
export function quote(...children: EditorNode[]): EditorNode {
  return {
    type: 'quote',
    children,
  };
}

/**
 * Create a code block node.
 *
 * @param language - Programming language (optional)
 * @param children - Child nodes (typically text or code-highlight nodes)
 * @returns An EditorNode representing a code block
 */
export function codeBlock(language: string | undefined, ...children: EditorNode[]): EditorNode {
  return {
    type: 'code',
    language,
    children,
  };
}

/**
 * Create a horizontal rule node.
 */
export function horizontalRule(): EditorNode {
  return { type: 'horizontalrule' };
}

/**
 * Create a line break node.
 */
export function linebreak(): EditorNode {
  return { type: 'linebreak' };
}

// ============================================================================
// List Nodes
// ============================================================================

/**
 * List types for creating lists.
 */
export type ListType = 'bullet' | 'number' | 'check';

/**
 * Create a list node.
 *
 * @param listType - Type of list ('bullet', 'number', or 'check')
 * @param items - List item nodes
 * @returns An EditorNode representing a list
 */
export function list(listType: ListType, ...items: EditorNode[]): EditorNode {
  return {
    type: 'list',
    listType,
    children: items,
  };
}

/**
 * Create a list item node.
 *
 * @param children - Child nodes
 * @returns An EditorNode representing a list item
 */
export function listItem(...children: EditorNode[]): EditorNode {
  return {
    type: 'listitem',
    format: '',
    indent: 0,
    children,
  };
}

/**
 * Create a checklist item (task) node.
 *
 * @param checked - Whether the task is completed
 * @param children - Child nodes
 * @returns An EditorNode representing a checklist item
 */
export function checklistItem(checked: boolean, ...children: EditorNode[]): EditorNode {
  return {
    type: 'listitem',
    format: '',
    indent: 0,
    value: 1,
    listType: 'check',
    checked,
    children,
  };
}

// ============================================================================
// Link Nodes
// ============================================================================

/**
 * Create an external link node.
 *
 * @param url - The link URL
 * @param children - Child nodes (link text)
 * @returns An EditorNode representing a link
 */
export function link(url: string, ...children: EditorNode[]): EditorNode {
  return {
    type: 'link',
    url,
    children,
  };
}

/**
 * Create a wiki-link node (internal note link).
 *
 * @param targetTitle - Title of the linked note
 * @param targetId - ID of the linked note
 * @returns An EditorNode representing a wiki-link
 */
export function wikiLink(targetTitle: string, targetId: string): EditorNode {
  return {
    type: 'wiki-link',
    targetTitle,
    targetId,
  };
}

/**
 * Create a person mention node.
 *
 * @param personName - Name of the person
 * @param personId - ID of the person note
 * @returns An EditorNode representing a person mention
 */
export function mention(personName: string, personId: string): EditorNode {
  return {
    type: 'person-mention',
    personName,
    personId,
  };
}

// ============================================================================
// Table Nodes
// ============================================================================

/**
 * Create a table node.
 *
 * @param rows - Table row nodes
 * @returns An EditorNode representing a table
 */
export function table(...rows: EditorNode[]): EditorNode {
  return {
    type: 'table',
    children: rows,
  };
}

/**
 * Create a table row node.
 *
 * @param cells - Table cell nodes
 * @returns An EditorNode representing a table row
 */
export function tableRow(...cells: EditorNode[]): EditorNode {
  return {
    type: 'tablerow',
    children: cells,
  };
}

/**
 * Create a table cell node.
 *
 * @param children - Child nodes (cell content)
 * @returns An EditorNode representing a table cell
 */
export function tableCell(...children: EditorNode[]): EditorNode {
  return {
    type: 'tablecell',
    children,
  };
}

// ============================================================================
// Content Builders
// ============================================================================

/**
 * Create EditorContent from child nodes.
 *
 * This is the primary entry point for building test content.
 *
 * @param children - Block-level nodes (paragraphs, headings, lists, etc.)
 * @returns A complete EditorContent structure
 *
 * @example
 * ```typescript
 * const content = createContent(
 *   heading(1, text('My Title')),
 *   paragraph(text('Hello, '), bold('world'), text('!')),
 *   list('bullet',
 *     listItem(text('First item')),
 *     listItem(text('Second item')),
 *   ),
 * );
 * ```
 */
export function createContent(...children: EditorNode[]): EditorContent {
  return {
    root: {
      type: 'root',
      format: '',
      indent: 0,
      children,
    },
  };
}

/**
 * Create empty EditorContent.
 *
 * @returns An EditorContent with an empty root
 */
export function emptyContent(): EditorContent {
  return {
    root: {
      type: 'root',
      children: [],
    },
  };
}

/**
 * Create EditorContent from plain text.
 *
 * Wraps the text in a paragraph node.
 *
 * @param textContent - Plain text string
 * @returns EditorContent with the text in a paragraph
 */
export function textContent(textContent: string): EditorContent {
  return createContent(paragraph(text(textContent)));
}

// ============================================================================
// Content Accessors (Type-Safe Child Access)
// ============================================================================

/**
 * Type guard interface for block nodes with children.
 */
export interface BlockNode extends EditorNode {
  children?: EditorNode[];
}

/**
 * Type guard interface for paragraph nodes.
 */
export interface ParagraphNode extends BlockNode {
  type: 'paragraph';
}

/**
 * Type guard interface for heading nodes.
 */
export interface HeadingNode extends BlockNode {
  type: 'heading';
  tag: `h${1 | 2 | 3 | 4 | 5 | 6}`;
}

/**
 * Type guard interface for list nodes.
 */
export interface ListNode extends BlockNode {
  type: 'list';
  listType: 'bullet' | 'number' | 'check';
}

/**
 * Type guard interface for list item nodes.
 */
export interface ListItemNode extends BlockNode {
  type: 'listitem';
  checked?: boolean;
  value?: number;
  listType?: string;
}

/**
 * Gets a child node at a specific index from content with type safety.
 *
 * @param content - The EditorContent to access
 * @param index - The index of the child to access
 * @returns The child node at the index, or undefined if not found
 *
 * @example
 * ```ts
 * const firstChild = getContentChild(note.content, 0);
 * if (firstChild && firstChild.type === 'heading') {
 *   expect((firstChild as HeadingNode).tag).toBe('h1');
 * }
 * ```
 */
export function getContentChild(content: EditorContent, index: number): EditorNode | undefined {
  return content.root.children?.[index];
}

/**
 * Gets a child node as a specific block type with assertion.
 *
 * @param content - The EditorContent to access
 * @param index - The index of the child to access
 * @returns The child node at the index
 * @throws Error if child is not found
 *
 * @example
 * ```ts
 * const heading = getBlockChild(note.content, 0);
 * expect(heading.type).toBe('heading');
 * ```
 */
export function getBlockChild(content: EditorContent, index: number): BlockNode {
  const child = content.root.children?.[index];
  if (!child) {
    throw new Error(`No child at index ${index}`);
  }
  return child as BlockNode;
}

/**
 * Type guard for paragraph nodes.
 */
export function isParagraphNode(node: EditorNode): node is ParagraphNode {
  return node.type === 'paragraph';
}

/**
 * Type guard for heading nodes.
 */
export function isHeadingNode(node: EditorNode): node is HeadingNode {
  return node.type === 'heading';
}

/**
 * Type guard for list nodes.
 */
export function isListNode(node: EditorNode): node is ListNode {
  return node.type === 'list';
}

/**
 * Type guard for list item nodes.
 */
export function isListItemNode(node: EditorNode): node is ListItemNode {
  return node.type === 'listitem';
}

/**
 * Gets the children of a block node, or empty array if none.
 *
 * @param node - The block node to access
 * @returns Array of child nodes
 */
export function getNodeChildren(node: EditorNode): EditorNode[] {
  return (node as BlockNode).children ?? [];
}
