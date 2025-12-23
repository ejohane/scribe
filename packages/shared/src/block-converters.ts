/**
 * Block Content Converters Module
 *
 * Provides functionality to convert block-level Lexical editor nodes to
 * Markdown format. Handles headings, paragraphs, lists, quotes, code blocks,
 * tables, and horizontal rules.
 *
 * @module block-converters
 */

import type { Note } from './types.js';
import { type LexicalNode, type InlineContext, extractInlineContent } from './inline-converters.js';

/**
 * Context passed through list conversion for proper numbering and indentation.
 */
export interface ListContext {
  /** Current indentation level (0-based) */
  depth: number;
  /** For ordered lists at each depth level, tracks the current item number */
  orderedCounters: Map<number, number>;
}

/**
 * Convert Lexical editor content to Markdown.
 *
 * This is the main conversion function that traverses the Lexical
 * content tree and generates corresponding Markdown output.
 *
 * @param content - The EditorContent to convert
 * @returns Markdown string representing the content
 *
 * @example
 * ```typescript
 * const content = {
 *   root: {
 *     children: [
 *       { type: 'heading', tag: 'h1', children: [{ type: 'text', text: 'Title' }] },
 *       { type: 'paragraph', children: [{ type: 'text', text: 'Hello world' }] },
 *     ]
 *   }
 * };
 * convertContentToMarkdown(content);
 * // Returns: '# Title\n\nHello world'
 * ```
 */
export function convertContentToMarkdown(content: Note['content']): string {
  if (!content?.root?.children) {
    return '';
  }

  const blocks: string[] = [];

  for (const node of content.root.children as LexicalNode[]) {
    const block = convertBlockNode(node);
    if (block !== null) {
      blocks.push(block);
    }
  }

  return blocks.join('\n\n');
}

/**
 * Convert a block-level Lexical node to Markdown.
 *
 * @param node - The Lexical node to convert
 * @returns Markdown string or null if node should be skipped
 */
export function convertBlockNode(node: LexicalNode): string | null {
  switch (node.type) {
    case 'heading':
      return convertHeading(node);

    case 'paragraph':
      return convertParagraph(node);

    case 'list':
      return convertList(node, { depth: 0, orderedCounters: new Map() });

    case 'listitem':
      // Standalone list items (shouldn't happen normally, but handle gracefully)
      return convertListItem(node, { depth: 0, orderedCounters: new Map() }, 'bullet');

    case 'quote':
      return convertQuote(node);

    case 'code':
      return convertCodeBlock(node);

    case 'horizontalrule':
      return '---';

    case 'table':
      return convertTable(node);

    default:
      // For unknown block types, try to extract inline content
      if (node.children) {
        const text = extractInlineContent(node);
        return text || null;
      }
      return null;
  }
}

/**
 * Convert a heading node to Markdown.
 *
 * @param node - The heading node
 * @returns Markdown heading string (e.g., "## Heading")
 */
export function convertHeading(node: LexicalNode): string {
  // Extract heading level from tag (e.g., "h1" -> 1, "h2" -> 2)
  const level = node.tag ? parseInt(node.tag[1], 10) : 1;
  const clampedLevel = Math.min(Math.max(level, 1), 6); // Clamp to valid range
  const hashes = '#'.repeat(clampedLevel);
  const text = extractInlineContent(node);
  return `${hashes} ${text}`;
}

/**
 * Convert a paragraph node to Markdown.
 *
 * @param node - The paragraph node
 * @returns Paragraph text or null for empty paragraphs
 */
export function convertParagraph(node: LexicalNode): string | null {
  const text = extractInlineContent(node);
  // Return empty string for empty paragraphs to preserve blank lines
  return text;
}

/**
 * Convert a list node to Markdown.
 *
 * @param node - The list node
 * @param context - List context for tracking depth and numbering
 * @returns Markdown list string
 */
export function convertList(node: LexicalNode, context: ListContext): string {
  if (!node.children || node.children.length === 0) {
    return '';
  }

  const listType = node.listType || 'bullet';

  // Reset ordered counter for this depth when starting a new list
  if (listType === 'number') {
    context.orderedCounters.set(context.depth, 0);
  }

  const items: string[] = [];

  for (const child of node.children) {
    if (child.type === 'listitem') {
      const item = convertListItem(child, context, listType);
      if (item !== null) {
        items.push(item);
      }
    }
  }

  return items.join('\n');
}

/**
 * Convert a list item node to Markdown.
 *
 * @param node - The list item node
 * @param context - List context for tracking depth and numbering
 * @param listType - The type of the parent list
 * @returns Markdown list item string
 */
export function convertListItem(
  node: LexicalNode,
  context: ListContext,
  listType: 'bullet' | 'number' | 'check'
): string | null {
  const indent = '  '.repeat(context.depth);
  const text = extractInlineContent(node);

  let prefix: string;

  // Check if this is a checklist item (has checked property)
  if (typeof node.checked === 'boolean') {
    const checkbox = node.checked ? '[x]' : '[ ]';
    prefix = `- ${checkbox}`;
  } else if (listType === 'number') {
    // Increment counter for ordered lists
    const currentCount = (context.orderedCounters.get(context.depth) || 0) + 1;
    context.orderedCounters.set(context.depth, currentCount);
    prefix = `${currentCount}.`;
  } else {
    // Unordered list (bullet or default)
    prefix = '-';
  }

  // Build the list item line
  let result = `${indent}${prefix} ${text}`;

  // Handle nested lists within this list item
  if (node.children) {
    for (const child of node.children) {
      if (child.type === 'list') {
        // Process nested list with increased depth
        const nestedContext: ListContext = {
          depth: context.depth + 1,
          orderedCounters: context.orderedCounters,
        };
        const nestedList = convertList(child, nestedContext);
        if (nestedList) {
          result += '\n' + nestedList;
        }
      }
    }
  }

  return result;
}

/**
 * Convert a quote (blockquote) node to Markdown.
 *
 * @param node - The quote node
 * @returns Markdown blockquote string with > prefix on each line
 */
export function convertQuote(node: LexicalNode): string {
  // Recursively extract all text content from the quote
  const content = extractInlineContent(node);

  // Prefix each line with >
  const lines = content.split('\n');
  return lines.map((line) => `> ${line}`).join('\n');
}

/**
 * Convert a code block node to Markdown.
 *
 * @param node - The code block node
 * @returns Markdown code block with triple backticks
 */
export function convertCodeBlock(node: LexicalNode): string {
  // Get the language hint if available
  const language = (node as { language?: string }).language || '';

  // Extract the code content - for code blocks, we want raw text without formatting
  const code = extractCodeContent(node);

  // Build the code block with optional language
  return '```' + language + '\n' + code + '\n```';
}

/**
 * Extract raw text content from a code block node, preserving whitespace.
 *
 * @param node - The code block node
 * @returns Raw text content
 */
export function extractCodeContent(node: LexicalNode): string {
  if (!node.children) {
    return node.text || '';
  }

  return node.children
    .map((child) => {
      if (child.type === 'code-highlight' || child.type === 'text') {
        return child.text || '';
      }
      if (child.type === 'linebreak') {
        return '\n';
      }
      // Recurse into other node types
      return extractCodeContent(child);
    })
    .join('');
}

/**
 * Convert a table node to Markdown pipe table format.
 *
 * @param node - The table node
 * @returns Markdown table string
 */
export function convertTable(node: LexicalNode): string {
  if (!node.children || node.children.length === 0) {
    return '';
  }

  const rows: string[][] = [];

  // Extract all rows and cells
  for (const child of node.children) {
    if (child.type === 'tablerow') {
      const cells = extractTableRow(child);
      rows.push(cells);
    }
  }

  if (rows.length === 0) {
    return '';
  }

  // Build the markdown table
  const lines: string[] = [];

  // First row is the header
  const headerRow = rows[0];
  lines.push('| ' + headerRow.join(' | ') + ' |');

  // Separator row with dashes
  const separatorCells = headerRow.map(() => '---');
  lines.push('| ' + separatorCells.join(' | ') + ' |');

  // Remaining rows are body rows
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    // Ensure row has same number of cells as header (pad if needed)
    while (row.length < headerRow.length) {
      row.push('');
    }
    lines.push('| ' + row.join(' | ') + ' |');
  }

  return lines.join('\n');
}

/**
 * Extract cell contents from a table row.
 *
 * @param rowNode - The table row node
 * @returns Array of cell content strings
 */
export function extractTableRow(rowNode: LexicalNode): string[] {
  if (!rowNode.children) {
    return [];
  }

  const cells: string[] = [];

  // Table context for proper escaping of pipe characters
  const tableContext: InlineContext = {
    isLineStart: false, // Table cells are never at line start
    isInTable: true,
  };

  for (const child of rowNode.children) {
    if (child.type === 'tablecell') {
      // Extract inline content from the cell with table context
      // The escapeMarkdownText function will handle pipe escaping
      const cellContent = extractInlineContent(child, tableContext);
      cells.push(cellContent);
    }
  }

  return cells;
}
