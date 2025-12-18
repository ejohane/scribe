/**
 * Content Extractor Module
 *
 * Provides functionality to convert Scribe notes to Markdown format.
 * This module handles the conversion of Lexical editor content to standard
 * Markdown syntax, including YAML frontmatter generation.
 *
 * @module content-extractor
 */

import type { Note } from './types.js';

/**
 * Options for Markdown export
 *
 * Controls how the note content is converted to Markdown format.
 *
 * @example
 * ```typescript
 * // Export with frontmatter (default)
 * const markdown = extractMarkdown(note);
 *
 * // Export without frontmatter
 * const markdown = extractMarkdown(note, { includeFrontmatter: false });
 *
 * // Export with title as H1 heading
 * const markdown = extractMarkdown(note, { includeTitle: true });
 * ```
 */
export interface MarkdownExportOptions {
  /**
   * Include YAML frontmatter with metadata
   *
   * When `true`, the output includes a YAML frontmatter block with:
   * - `title`: Note title
   * - `tags`: User-defined tags (array)
   * - `created`: Creation timestamp (ISO-8601)
   * - `updated`: Last update timestamp (ISO-8601)
   * - `type`: Note type (only if not a regular note)
   *
   * @default true
   */
  includeFrontmatter?: boolean;

  /**
   * Include title as H1 heading in the body
   *
   * When `true`, adds the note title as a `# Title` heading at the
   * start of the Markdown body. Usually `false` since the title
   * is already in the frontmatter.
   *
   * @default false
   */
  includeTitle?: boolean;
}

/**
 * Convert a note to Markdown format.
 *
 * Transforms a Scribe note into standard Markdown, handling all Lexical
 * node types and generating optional YAML frontmatter with metadata.
 *
 * ## Supported Node Types
 *
 * | Lexical Node | Markdown Output |
 * |--------------|-----------------|
 * | `heading` (h1-h3) | `#`, `##`, `###` |
 * | `paragraph` | Plain text with blank line separation |
 * | `listitem` (unordered) | `- item` |
 * | `listitem` (ordered) | `1. item` |
 * | `listitem` (checked) | `- [x] task` |
 * | `listitem` (unchecked) | `- [ ] task` |
 * | `quote` | `> quoted text` |
 * | `code` | ``` code ``` |
 * | `horizontalrule` | `---` |
 * | `wiki-link` | `[[Meeting Notes]]` |
 * | `person-mention` | `@Person Name` |
 * | `table` | Pipe table with header separator |
 * | `text` (bold) | `**bold**` |
 * | `text` (italic) | `*italic*` |
 * | `text` (code) | `` `code` `` |
 * | `text` (strikethrough) | `~~strikethrough~~` |
 * | `link` | `[text](url)` |
 * | `linebreak` | `\n` |
 *
 * ## Frontmatter Format
 *
 * When `includeFrontmatter` is `true` (default), the output includes:
 *
 * ```yaml
 * ---
 * title: "Note Title"
 * tags:
 *   - tag1
 *   - tag2
 * created: 2025-12-15T10:30:00.000Z
 * updated: 2025-12-15T11:45:00.000Z
 * type: meeting  # Only included if not a regular note
 * ---
 * ```
 *
 * @param note - The note to convert
 * @param options - Export options controlling output format
 * @returns Markdown string with optional frontmatter
 *
 * @example
 * ```typescript
 * import { extractMarkdown } from '@scribe/shared';
 *
 * // Basic usage with frontmatter
 * const markdown = extractMarkdown(note);
 *
 * // Without frontmatter (for clipboard copy)
 * const markdown = extractMarkdown(note, { includeFrontmatter: false });
 *
 * // With title as H1 heading
 * const markdown = extractMarkdown(note, {
 *   includeFrontmatter: true,
 *   includeTitle: true
 * });
 * ```
 *
 * @see MarkdownExportOptions for available options
 */
export function extractMarkdown(note: Note, options: MarkdownExportOptions = {}): string {
  const { includeFrontmatter = true, includeTitle = false } = options;

  const parts: string[] = [];

  // Generate frontmatter if requested
  if (includeFrontmatter) {
    parts.push(generateFrontmatter(note));
  }

  // Add title as H1 if requested
  if (includeTitle && note.title) {
    parts.push(`# ${note.title}\n`);
  }

  // Convert content to Markdown
  const contentMarkdown = convertContentToMarkdown(note.content);
  if (contentMarkdown) {
    parts.push(contentMarkdown);
  }

  return parts.join('\n');
}

/**
 * Generate YAML frontmatter block from note metadata.
 *
 * @param note - The note to extract metadata from
 * @returns YAML frontmatter string including delimiters
 * @internal
 */
function generateFrontmatter(note: Note): string {
  const lines: string[] = ['---'];

  // Title (quoted to handle special characters)
  lines.push(`title: "${escapeYamlString(note.title)}"`);

  // Tags (as YAML array)
  if (note.tags.length > 0) {
    lines.push('tags:');
    for (const tag of note.tags) {
      lines.push(`  - ${tag}`);
    }
  }

  // Timestamps in ISO-8601 format
  lines.push(`created: ${new Date(note.createdAt).toISOString()}`);
  lines.push(`updated: ${new Date(note.updatedAt).toISOString()}`);

  // Note type (only if not a regular note)
  if (note.type) {
    lines.push(`type: ${note.type}`);
  }

  lines.push('---');

  return lines.join('\n');
}

/**
 * Escape special characters in YAML strings.
 *
 * @param str - The string to escape
 * @returns Escaped string safe for YAML
 * @internal
 */
function escapeYamlString(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n');
}

/**
 * Lexical text format bitmask constants.
 * These match the TextFormatType constants from Lexical's core package.
 * @see https://lexical.dev/docs/concepts/nodes#textnode
 * @internal
 */
const TEXT_FORMAT = {
  BOLD: 1, // 1 << 0
  ITALIC: 2, // 1 << 1
  STRIKETHROUGH: 4, // 1 << 2
  UNDERLINE: 8, // 1 << 3 (not used in Markdown)
  CODE: 16, // 1 << 4
  SUBSCRIPT: 32, // 1 << 5 (not used in Markdown)
  SUPERSCRIPT: 64, // 1 << 6 (not used in Markdown)
  HIGHLIGHT: 128, // 1 << 7 (not used in Markdown)
} as const;

/**
 * Context for determining how to escape Markdown special characters.
 * @internal
 */
interface EscapeContext {
  /** Whether this text appears at the start of a line */
  isLineStart: boolean;
  /** Whether this text is inside a table cell */
  isInTable: boolean;
}

/**
 * Escape special Markdown characters in plain text content.
 *
 * Uses context-aware escaping to minimize visual noise while preserving
 * content fidelity. Only escapes characters that would be misinterpreted
 * as Markdown syntax in their current position.
 *
 * Escaping rules:
 * - `*` or `_` at word boundary: Escape (would become emphasis)
 * - `*` or `_` mid-word: No escape (e.g., snake_case)
 * - `#` at line start: Escape (would become heading)
 * - `#` mid-line: No escape (e.g., Issue #123)
 * - `[text]` pattern: Escape opening bracket (would become link)
 * - `>` at line start: Escape (would become blockquote)
 * - `-`, `+`, `*` at line start + space: Escape (would become list)
 * - `1.` at line start: Escape (would become ordered list)
 * - `|` in table context: Escape (would break table)
 * - `\` before special char: Escape (preserve backslash)
 *
 * @param text - The text to escape
 * @param context - Context for determining escape rules
 * @returns Text with Markdown special characters escaped where needed
 * @internal
 */
function escapeMarkdownText(text: string, context: EscapeContext): string {
  if (!text) {
    return '';
  }

  let result = '';
  let isAtLineStart = context.isLineStart;

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const prevChar = i > 0 ? text[i - 1] : '';
    const nextChar = i < text.length - 1 ? text[i + 1] : '';

    // Track line starts for multi-line text
    if (char === '\n') {
      result += char;
      isAtLineStart = true;
      continue;
    }

    // Escape backslashes before special characters
    if (char === '\\') {
      const nextIsSpecial = /[*_#\[\]>`\-+\\|~]/.test(nextChar);
      if (nextIsSpecial) {
        result += '\\\\';
      } else {
        result += '\\';
      }
      isAtLineStart = false;
      continue;
    }

    // Escape # at line start (would become heading)
    if (char === '#' && isAtLineStart) {
      result += '\\#';
      isAtLineStart = false;
      continue;
    }

    // Escape > at line start (would become blockquote)
    if (char === '>' && isAtLineStart) {
      result += '\\>';
      isAtLineStart = false;
      continue;
    }

    // Escape list markers at line start followed by space
    // Handles: - item, + item, * item
    if ((char === '-' || char === '+' || char === '*') && isAtLineStart && nextChar === ' ') {
      result += '\\' + char;
      isAtLineStart = false;
      continue;
    }

    // Escape ordered list markers at line start (e.g., 1. 2. etc.)
    if (isAtLineStart && /\d/.test(char)) {
      // Look ahead for digit(s) followed by . and space
      let j = i;
      while (j < text.length && /\d/.test(text[j])) {
        j++;
      }
      if (j < text.length && text[j] === '.' && (j + 1 >= text.length || text[j + 1] === ' ')) {
        // This is an ordered list pattern, escape by adding backslash before the dot
        // Copy the digits
        result += text.slice(i, j);
        result += '\\.';
        i = j; // Skip past the dot (loop will increment to j+1)
        isAtLineStart = false;
        continue;
      }
    }

    // Escape [ to prevent link interpretation
    // Only escape if followed by text and ]
    if (char === '[') {
      // Look ahead for matching ]
      const closeIndex = text.indexOf(']', i + 1);
      if (closeIndex !== -1) {
        // There's a matching ] - escape the [
        result += '\\[';
        isAtLineStart = false;
        continue;
      }
    }

    // Escape | in table context
    if (char === '|' && context.isInTable) {
      result += '\\|';
      isAtLineStart = false;
      continue;
    }

    // Escape * and _ only when they could become emphasis markers
    // Emphasis in Markdown requires: *word* or _word_ patterns, or **word** / __word__ for strong
    // - The marker must be adjacent to a word character on one side
    // - The marker must be at a word boundary on the other side
    // - Adjacent emphasis chars (** or __) also count as emphasis patterns
    if (char === '*' || char === '_') {
      // For word character detection, we use [a-zA-Z0-9] NOT \w because \w includes underscore
      // and we need to treat underscore specially as an emphasis character
      const prevIsAlphanumeric = /[a-zA-Z0-9]/.test(prevChar);
      const nextIsAlphanumeric = /[a-zA-Z0-9]/.test(nextChar);
      const prevIsWhitespace = prevChar === '' || /\s/.test(prevChar);
      const nextIsWhitespace = nextChar === '' || /\s/.test(nextChar);

      // Check if adjacent to another emphasis char of the same type (for ** or __)
      const prevIsSameEmphasisChar = prevChar === char;
      const nextIsSameEmphasisChar = nextChar === char;

      // Mid-word: alphanumeric on both sides (e.g., snake_case, 100*2)
      // These should NOT be escaped
      const isMidWord = prevIsAlphanumeric && nextIsAlphanumeric;

      // Surrounded by whitespace on both sides (e.g., "a * b")
      // These should NOT be escaped - they can't form emphasis
      const isSurroundedByWhitespace = prevIsWhitespace && nextIsWhitespace;

      if (isMidWord || isSurroundedByWhitespace) {
        // Not an emphasis pattern, don't escape
        result += char;
        isAtLineStart = false;
        continue;
      }

      // Opening emphasis: whitespace/boundary before, alphanumeric or same emphasis char after
      // Examples: *word, **word, _word, __word
      const isOpeningEmphasis = prevIsWhitespace && (nextIsAlphanumeric || nextIsSameEmphasisChar);

      // Closing emphasis: alphanumeric before, whitespace/punctuation/same-char after
      // Examples: word*, word**, word_, word__
      const isClosingEmphasis =
        prevIsAlphanumeric &&
        (nextIsWhitespace || /[.,!?;:)]/.test(nextChar) || nextIsSameEmphasisChar);

      // Adjacent to same emphasis char (for ** and __ patterns)
      // If we're between two emphasis chars of the same type, escape to prevent bold
      const isBetweenEmphasisChars = prevIsSameEmphasisChar || nextIsSameEmphasisChar;

      if (isOpeningEmphasis || isClosingEmphasis || isBetweenEmphasisChars) {
        result += '\\' + char;
        isAtLineStart = false;
        continue;
      }
    }

    // Default: add the character as-is
    result += char;

    // Update line start tracking (any non-newline char means we're not at line start)
    if (char !== '\n') {
      isAtLineStart = false;
    }
  }

  return result;
}

/**
 * Internal interface for Lexical node structure.
 * This mirrors the EditorNode type but with known properties typed.
 * @internal
 */
interface LexicalNode {
  type: string;
  text?: string;
  tag?: string;
  children?: LexicalNode[];
  checked?: boolean;
  listType?: 'bullet' | 'number' | 'check';
  value?: number;
  format?: number;
  url?: string;
  [key: string]: unknown;
}

/**
 * Context passed through list conversion for proper numbering and indentation.
 * @internal
 */
interface ListContext {
  /** Current indentation level (0-based) */
  depth: number;
  /** For ordered lists at each depth level, tracks the current item number */
  orderedCounters: Map<number, number>;
}

/**
 * Context passed through inline content extraction for proper escaping.
 * @internal
 */
interface InlineContext {
  /** Whether this is the first content in the block (at line start) */
  isLineStart: boolean;
  /** Whether we're extracting content inside a table cell */
  isInTable: boolean;
}

/**
 * Convert Lexical editor content to Markdown.
 *
 * This is the main conversion function that traverses the Lexical
 * content tree and generates corresponding Markdown output.
 *
 * @param content - The EditorContent to convert
 * @returns Markdown string representing the content
 * @internal
 */
function convertContentToMarkdown(content: Note['content']): string {
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
 * @internal
 */
function convertBlockNode(node: LexicalNode): string | null {
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
 * @internal
 */
function convertHeading(node: LexicalNode): string {
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
 * @internal
 */
function convertParagraph(node: LexicalNode): string | null {
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
 * @internal
 */
function convertList(node: LexicalNode, context: ListContext): string {
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
 * @internal
 */
function convertListItem(
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
 * @internal
 */
function convertQuote(node: LexicalNode): string {
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
 * @internal
 */
function convertCodeBlock(node: LexicalNode): string {
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
 * @internal
 */
function extractCodeContent(node: LexicalNode): string {
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
 * @internal
 */
function convertTable(node: LexicalNode): string {
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
 * @internal
 */
function extractTableRow(rowNode: LexicalNode): string[] {
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

/**
 * Default inline context for content extraction.
 * @internal
 */
const DEFAULT_INLINE_CONTEXT: InlineContext = {
  isLineStart: true,
  isInTable: false,
};

/**
 * Extract inline content from a node (text, wiki-links, mentions, etc.).
 *
 * This function recursively traverses child nodes and extracts text content.
 * Special inline nodes (wiki-links, mentions, links) are converted to their
 * Markdown representation. Text formatting (bold, italic, code, strikethrough)
 * is applied using standard Markdown syntax.
 *
 * @param node - The node to extract content from
 * @param context - Optional context for escaping (defaults to isLineStart: true, isInTable: false)
 * @returns Plain text or Markdown inline content
 * @internal
 */
function extractInlineContent(
  node: LexicalNode,
  context: InlineContext = DEFAULT_INLINE_CONTEXT
): string {
  if (!node.children) {
    return node.text || '';
  }

  // Track whether the next content should be at line start
  // This is true at the beginning and after each linebreak
  let nextIsAtLineStart = context.isLineStart;

  return node.children
    .map((child) => {
      // Capture current line start state for this child
      const childContext: InlineContext = {
        isLineStart: nextIsAtLineStart,
        isInTable: context.isInTable,
      };

      switch (child.type) {
        case 'text': {
          // After processing text, we're no longer at line start
          // (unless the text itself ends with a newline, which is handled internally)
          nextIsAtLineStart = false;
          return formatTextNode(child, childContext);
        }

        case 'link': {
          // Convert link nodes to Markdown link syntax: [text](url)
          // Don't escape inside link text - it's already inside markdown structure
          const linkText = child.children ? extractInlineContentRaw(child) : child.text || '';
          const url = child.url || '';
          nextIsAtLineStart = false;
          return `[${linkText}](${url})`;
        }

        case 'wiki-link': {
          // Preserve wiki-links as [[title]]
          const title =
            (child as { targetTitle?: string }).targetTitle ||
            (child as { noteTitle?: string }).noteTitle ||
            (child as { targetId?: string }).targetId ||
            '';
          nextIsAtLineStart = false;
          return `[[${title}]]`;
        }

        case 'person-mention': {
          // Preserve mentions as @name
          const name =
            (child as { personName?: string }).personName ||
            (child as { personId?: string }).personId ||
            '';
          nextIsAtLineStart = false;
          return `@${name}`;
        }

        case 'linebreak':
          // After a linebreak, the next content is at line start
          nextIsAtLineStart = true;
          return '\n';

        case 'list':
          // Nested list within inline content (shouldn't happen often)
          // Skip it here as it will be handled at block level
          return '';

        default:
          // Recursively extract from other inline nodes
          nextIsAtLineStart = false;
          return extractInlineContent(child, childContext);
      }
    })
    .join('');
}

/**
 * Extract inline content without escaping (for use inside Markdown structures like links).
 *
 * @param node - The node to extract content from
 * @returns Raw text content without Markdown escaping
 * @internal
 */
function extractInlineContentRaw(node: LexicalNode): string {
  if (!node.children) {
    return node.text || '';
  }

  return node.children
    .map((child) => {
      switch (child.type) {
        case 'text':
          return formatTextNodeRaw(child);

        case 'link': {
          const linkText = child.children ? extractInlineContentRaw(child) : child.text || '';
          const url = child.url || '';
          return `[${linkText}](${url})`;
        }

        case 'wiki-link': {
          const title =
            (child as { targetTitle?: string }).targetTitle ||
            (child as { noteTitle?: string }).noteTitle ||
            (child as { targetId?: string }).targetId ||
            '';
          return `[[${title}]]`;
        }

        case 'person-mention': {
          const name =
            (child as { personName?: string }).personName ||
            (child as { personId?: string }).personId ||
            '';
          return `@${name}`;
        }

        case 'linebreak':
          return '\n';

        case 'list':
          return '';

        default:
          return extractInlineContentRaw(child);
      }
    })
    .join('');
}

/**
 * Apply text formatting to a text node based on its format bitmask.
 *
 * Formats are applied in a consistent order to ensure proper nesting:
 * strikethrough (outermost) → code → bold → italic (innermost)
 *
 * Combined formatting example:
 * - Bold + Italic: ***text***
 * - Bold + Strikethrough: ~~**text**~~
 *
 * For plain text (no formatting), applies context-aware Markdown escaping
 * to prevent unintended interpretation of special characters.
 *
 * @param node - The text node with optional format property
 * @param context - Context for determining escape rules
 * @returns Formatted Markdown text
 * @internal
 */
function formatTextNode(node: LexicalNode, context: InlineContext): string {
  const text = node.text || '';
  if (!text) {
    return '';
  }

  const format = node.format || 0;

  // If no formatting, apply context-aware escaping and return
  if (format === 0) {
    return escapeMarkdownText(text, {
      isLineStart: context.isLineStart,
      isInTable: context.isInTable,
    });
  }

  // Text with formatting - don't escape the content since we're
  // intentionally creating Markdown structures
  let result = text;

  // Apply formatting in order from innermost to outermost
  // The order matters for proper Markdown nesting

  // Italic (innermost when combined with bold for ***text***)
  if (format & TEXT_FORMAT.ITALIC) {
    result = `*${result}*`;
  }

  // Bold (wraps italic for ***text***)
  if (format & TEXT_FORMAT.BOLD) {
    result = `**${result}**`;
  }

  // Code (inline code backticks)
  if (format & TEXT_FORMAT.CODE) {
    result = `\`${result}\``;
  }

  // Strikethrough (outermost)
  if (format & TEXT_FORMAT.STRIKETHROUGH) {
    result = `~~${result}~~`;
  }

  return result;
}

/**
 * Apply text formatting without escaping (for use inside Markdown structures).
 *
 * @param node - The text node with optional format property
 * @returns Formatted Markdown text without escaping
 * @internal
 */
function formatTextNodeRaw(node: LexicalNode): string {
  const text = node.text || '';
  if (!text) {
    return '';
  }

  const format = node.format || 0;

  // If no formatting, return raw text
  if (format === 0) {
    return text;
  }

  let result = text;

  if (format & TEXT_FORMAT.ITALIC) {
    result = `*${result}*`;
  }

  if (format & TEXT_FORMAT.BOLD) {
    result = `**${result}**`;
  }

  if (format & TEXT_FORMAT.CODE) {
    result = `\`${result}\``;
  }

  if (format & TEXT_FORMAT.STRIKETHROUGH) {
    result = `~~${result}~~`;
  }

  return result;
}
